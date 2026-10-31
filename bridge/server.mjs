import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = process.env.DSH_ASTRIAX_BRIDGE_ROOT || process.cwd();
const BRIDGE_DIR = path.join(ROOT, 'bridge');
const WORKDIR = process.env.DSH_WORKSPACE_ROOT || path.join(ROOT, 'qq-work');
const LOG_FILE = path.join(BRIDGE_DIR, 'bridge.log');
const TOKEN_FILE = path.join(BRIDGE_DIR, 'bridge-token.txt');
const STATE_FILE = path.join(BRIDGE_DIR, 'sessions.json');
const HOST = process.env.DSH_BRIDGE_HOST || '127.0.0.1';
const PORT = Number(process.env.DSH_BRIDGE_PORT || 18081);
const ELECTRON = process.env.DSH_ELECTRON || '';
const CLI_JS = process.env.DSH_CLI_JS || '';
const PROFILE = process.env.DSH_PROFILE || 'sdk';
const PROVIDER = process.env.DSH_PROVIDER || 'deepseek-official';
const MODEL = process.env.DSH_MODEL || 'deepseek-flash';
const REASONING_EFFORT = process.env.DSH_REASONING_EFFORT || 'high';
const CHAT_TIMEOUT_MS = 360000;

fs.mkdirSync(BRIDGE_DIR, { recursive: true });
fs.mkdirSync(WORKDIR, { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')}`;
  console.log(line);
  logStream.write(line + '\n');
}
function readOrCreateToken() {
  try {
    const existing = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (existing) return existing;
  } catch {}
  const token = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(TOKEN_FILE, token, 'utf8');
  return token;
}
const AUTH_TOKEN = readOrCreateToken();
const TOKEN_MIRROR = path.join(os.homedir(), '.dsh', 'qq-bridge-token.txt');
try {
  fs.mkdirSync(path.dirname(TOKEN_MIRROR), { recursive: true });
  fs.writeFileSync(TOKEN_MIRROR, AUTH_TOKEN, 'utf8');
} catch (err) {
  log('token mirror failed:', err.message);
}

function readState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return data && typeof data === 'object' && data.conversations ? data : { conversations: {} };
  } catch {
    return { conversations: {} };
  }
}
let persisted = readState();
function saveState() {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(persisted, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

function makeSessionId(conversationId) {
  const digest = crypto.createHash('sha256').update(String(conversationId)).digest('hex').slice(0, 20);
  return `qq-${digest}`;
}
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

class HarnessClient {
  constructor() {
    this.child = null;
    this.ready = false;
    this.startPromise = null;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map();
    this.sessions = new Map();
    this.restartTimer = null;
    this.restartDelayMs = 2000;
    this.stopping = false;
  }

  ensureStarted() {
    if (this.ready && this.child && this.child.exitCode === null) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  async start() {
    this.cleanupChild();
    this.ready = false;
    this.buffer = '';
    log('starting DSH SDK runtime');
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DSH_HOME: process.env.DSH_HOME || path.join(os.homedir(), '.dsh'),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };
    const child = spawn(ELECTRON, [
      '--expose-internals', CLI_JS, '--profile', PROFILE
    ], {
      cwd: WORKDIR,
      env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    this.attach(child);
    const init = await this.request('initialize', {
      cwd: WORKDIR,
      provider: PROVIDER,
      model: MODEL,
      reasoningEffort: REASONING_EFFORT,
      maxTokens: 12000,
    }, 180000);
    this.ready = true;
    this.restartDelayMs = 2000;
    log('DSH SDK ready', init);
  }

  attach(child) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.onData(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      const text = String(chunk).trim();
      if (text) log('sdk stderr:', text.slice(0, 4000));
    });
    child.on('error', (err) => {
      log('sdk process error:', err.stack || err.message);
      this.onExit(err);
    });
    child.on('exit', (code, signal) => {
      log('sdk process exit:', { code, signal });
      this.onExit(new Error(`DSH SDK exited (code=${code}, signal=${signal})`));
    });
    child.stdin.on('error', (err) => log('sdk stdin error:', err.message));
  }

  cleanupChild() {
    const old = this.child;
    this.child = null;
    if (old) {
      try { old.kill(); } catch {}
    }
  }

  onData(chunk) {
    this.buffer += chunk;
    for (;;) {
      const idx = this.buffer.indexOf('\n');
      if (idx < 0) break;
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        log('sdk non-json stdout:', line.slice(0, 2000));
        continue;
      }
      this.onMessage(message);
    }
  }

  onMessage(message) {
    if (message && (typeof message.id === 'string' || typeof message.id === 'number') && message.method === undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        const err = new Error(message.error.message || 'SDK request failed');
        err.code = message.error.code;
        err.data = message.error.data;
        pending.reject(err);
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message && typeof message.method === 'string') {
      if (message.method === 'session.event') {
        this.onSessionEvent(message.params || {});
      } else if (message.method !== 'session.status') {
        log('sdk notification:', message.method, JSON.stringify(message.params || {}).slice(0, 2000));
      }
    }
  }

  onSessionEvent(params) {
    const sessionId = String(params.sessionId || '');
    const event = params.event || {};
    const state = this.sessions.get(sessionId);
    if (event.type === 'assistant/message') {
      const text = extractAssistantText(event);
      if (state) {
        if (!state.messages) state.messages = [];
        if (text) state.messages.push(text);
      }
      log('assistant message', { sessionId, chars: text.length, seq: event.seq });
      return;
    }
    if (event.type === 'turn/end') {
      if (!state || !state.pending) return;
      const pending = state.pending;
      state.pending = null;
      clearTimeout(pending.timer);
      const text = (state.messages || []).filter(Boolean).slice(-1)[0] || '';
      state.messages = [];
      const failure = event.data && (event.data.error || event.data.failure || event.data.reason);
      if (text) pending.resolve({ text, seq: event.seq, failure: failure || null });
      else pending.reject(new Error(failure ? `DSH turn ended without text: ${JSON.stringify(failure).slice(0, 500)}` : 'DSH turn ended without a text reply'));
      return;
    }
    if (event.type === 'agent/error') {
      log('agent error event', JSON.stringify(event).slice(0, 3000));
    }
  }

  onExit(error) {
    this.ready = false;
    this.child = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const state of this.sessions.values()) {
      if (state.pending) {
        clearTimeout(state.pending.timer);
        state.pending.reject(error);
        state.pending = null;
      }
    }
    if (!this.stopping && !this.restartTimer) {
      const wait = this.restartDelayMs;
      this.restartDelayMs = Math.min(this.restartDelayMs * 2, 30000);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        this.ensureStarted().catch((err) => log('sdk restart failed:', err.message));
      }, wait);
    }
  }

  request(method, params, timeoutMs = 60000) {
    if (!this.child || !this.child.stdin || this.child.exitCode !== null) {
      return Promise.reject(new Error('DSH SDK is not running'));
    }
    const id = `r${this.nextId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`SDK request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async shutdown() {
    this.stopping = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.child && this.ready) {
      try { await this.request('shutdown', {}, 5000); } catch {}
    }
    await delay(500);
    this.cleanupChild();
  }
}

function extractAssistantText(event) {
  const content = event && event.data && event.data.message && event.data.message.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

const client = new HarnessClient();
const conversations = new Map();

function getConversation(conversationId) {
  let state = conversations.get(conversationId);
  if (state) return state;
  const existing = persisted.conversations[conversationId];
  const sessionId = existing && existing.sessionId ? String(existing.sessionId) : makeSessionId(conversationId);
  state = {
    conversationId,
    sessionId,
    started: Boolean(existing && existing.started),
    tail: Promise.resolve(),
    messages: [],
    pending: null,
  };
  conversations.set(conversationId, state);
  return state;
}

function persistConversation(state) {
  persisted.conversations[state.conversationId] = {
    sessionId: state.sessionId,
    started: state.started,
    updatedAt: new Date().toISOString(),
  };
  saveState();
}

function normalizeReply(text) {
  let out = String(text || '').trim();
  out = out.replace(/^回复\s*[:：]\s*/, '');
  if (out.length > 6000) out = out.slice(0, 6000) + '\n...(过长已截断)';
  return out;
}

function formatPrompt(input) {
  const chatType = input.chatType === 'group' ? '群聊' : '私聊';
  const parts = [
    `[QQ ${chatType}]`,
    `发送者: ${input.senderName || '未知'} (${input.senderId || '未知'})`,
  ];
  if (input.groupId) parts.push(`群号: ${input.groupId}`);
  if (input.groupName) parts.push(`群名: ${input.groupName}`);
  parts.push(`会话: ${input.conversationId}`);
  parts.push(`时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  parts.push('');
  parts.push(String(input.text || '').trim());
  parts.push('');
  parts.push('只输出要直接发回 QQ 的最终内容。');
  return parts.join('\n');
}


const transcriptFile = path.join(BRIDGE_DIR, 'transcripts.json');
let transcripts = {};
try { transcripts = JSON.parse(fs.readFileSync(transcriptFile, 'utf8')) || {}; } catch { transcripts = {}; }
function saveTranscripts() {
  try {
    fs.mkdirSync(BRIDGE_DIR, { recursive: true });
    const tmp = transcriptFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(transcripts, null, 2), 'utf8');
    fs.renameSync(tmp, transcriptFile);
  } catch {}
}
function localEmbedding(text, dim = 384) {
  const vector = new Float64Array(dim);
  const value = String(text || '').toLowerCase();
  const add = (token, weight) => {
    if (!token) return;
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vector[idx] += (h & 1 ? 1 : -1) * weight;
  };
  for (let i = 0; i < value.length; i++) {
    add(value.slice(i, i + 1), 1);
    add(value.slice(i, i + 2), 0.65);
    add(value.slice(i, i + 3), 0.4);
  }
  for (const token of value.split(/[^0-9a-z\u4e00-\u9fff]+/i)) add(token, 1.2);
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vector, (value) => Number((value / norm).toFixed(8)));
}

function transcriptWorkspace(conversationId) {
  const key = String(conversationId || 'unknown').replace(/[^0-9A-Za-z._-]+/g, '_').slice(0, 80) || 'unknown';
  const dir = path.join(WORKDIR, 'sessions', key);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}
function appendTranscript(conversationId, role, text, meta) {
  const id = String(conversationId || '').trim();
  if (!id || !String(text || '').trim()) return;
  const item = transcripts[id] || { id, messages: [], createdAt: new Date().toISOString(), workspace: transcriptWorkspace(id) };
  item.workspace = item.workspace || transcriptWorkspace(id);
  item.messages.push({ role, text: String(text).slice(0, 12000), at: new Date().toISOString(), ...(meta || {}) });
  if (item.messages.length > 200) item.messages = item.messages.slice(-200);
  item.updatedAt = new Date().toISOString();
  item.lastMessage = String(text).slice(0, 240);
  item.messageCount = item.messages.length;
  if (meta && meta.senderName) item.senderName = meta.senderName;
  if (meta && meta.senderId) item.senderId = meta.senderId;
  if (meta && meta.chatType) item.chatType = meta.chatType;
  transcripts[id] = item;
  saveTranscripts();
}
const providerSeen = new Set();

function normalizeProviderContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return String(part || '');
      if (part.type === 'text') return String(part.text || '');
      if (part.type === 'image_url') return '[图片]';
      if (part.type === 'audio_url') return '[音频]';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function lastUserText(body) {
  const direct = String(body.prompt || '').trim();
  if (direct) return direct;
  const contexts = Array.isArray(body.contexts) ? body.contexts : [];
  for (let i = contexts.length - 1; i >= 0; i--) {
    const message = contexts[i] || {};
    if (String(message.role || '') !== 'user') continue;
    const text = normalizeProviderContent(message.content).trim();
    if (text) return text;
  }
  return '';
}

function formatProviderPrompt(body, conversationId) {
  const systemPrompt = String(body.systemPrompt || '').trim();
  const prompt = String(body.prompt || '').trim();
  const extra = String(body.extraUserContent || '').trim();
  const contexts = Array.isArray(body.contexts) ? body.contexts : [];
  const firstTurn = !providerSeen.has(conversationId);
  const parts = [];
  if (systemPrompt) parts.push('[AstrBot 人格、记忆与当前状态]\n' + systemPrompt);
  if (firstTurn && contexts.length) {
    const history = [];
    for (const message of contexts.slice(-24)) {
      if (!message || typeof message !== 'object') continue;
      const role = String(message.role || 'user');
      if (role === 'system' && systemPrompt) continue;
      const text = normalizeProviderContent(message.content).trim();
      if (text) history.push(role + ': ' + text);
    }
    if (history.length) parts.push('[AstrBot 对话历史]\n' + history.join('\n'));
  }
  parts.push('[当前用户消息]\n' + (prompt || '[空消息]'));
  if (extra) parts.push('[额外用户内容]\n' + extra);
  parts.push('这是 AstrBot 已组装好的上下文。请以 AstrBot 的人格和记忆为准，只输出最终要发回 QQ 的回复。');
  return parts.join('\n\n');
}

function enqueueChat(input) {
  const state = getConversation(input.conversationId);
  const run = state.tail.catch(() => {}).then(() => runChat(state, input));
  state.tail = run.catch(() => {});
  return run;
}

async function runChat(state, input) {
  await client.ensureStarted();
  if (!state.pending) state.messages = [];
  if (state.started && !client.sessions.has(state.sessionId)) {
    try {
      await client.request('session/resume', { sessionId: state.sessionId }, 60000);
      client.sessions.set(state.sessionId, { messages: [], pending: null });
      log('resumed SDK session', state.sessionId);
    } catch (err) {
      log('session resume skipped:', err.message);
      client.sessions.set(state.sessionId, { messages: [], pending: null });
    }
  } else if (!client.sessions.has(state.sessionId)) {
    client.sessions.set(state.sessionId, { messages: [], pending: null });
  }
  const sdkState = client.sessions.get(state.sessionId);
  sdkState.messages = [];
  const turn = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (sdkState.pending) sdkState.pending = null;
      reject(new Error('DSH reply timed out'));
    }, CHAT_TIMEOUT_MS);
    sdkState.pending = { resolve, reject, timer };
  });
  let promptResult;
  try {
    promptResult = await client.request('session/prompt', {
      sessionId: state.sessionId,
      contentBlocks: [{ type: 'text', text: formatPrompt(input) }],
    }, 30000);
    state.started = true;
    persistConversation(state);
    log('prompt accepted', { conversationId: input.conversationId, sessionId: state.sessionId, messageId: promptResult && promptResult.messageId });
  } catch (err) {
    if (sdkState.pending) {
      clearTimeout(sdkState.pending.timer);
      sdkState.pending = null;
    }
    throw err;
  }
  const result = await turn;
  const reply = normalizeReply(result.text);
  if (!reply) throw new Error('DSH returned an empty reply');
  log('reply ready', { conversationId: input.conversationId, chars: reply.length, seq: result.seq });
  return {
    reply,
    sessionId: state.sessionId,
    messageId: promptResult && promptResult.messageId,
    seq: result.seq,
  };
}

function resetConversation(conversationId) {
  const state = getConversation(conversationId);
  state.sessionId = makeSessionId(conversationId + ':' + Date.now() + ':' + crypto.randomUUID());
  state.started = false;
  state.messages = [];
  state.pending = null;
  client.sessions.delete(state.sessionId);
  persistConversation(state);
  return state.sessionId;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data) });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (err) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function authorized(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return Boolean(match && match[1] === AUTH_TOKEN);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        ready: client.ready,
        pid: client.child ? client.child.pid : null,
        provider: PROVIDER,
        model: MODEL,
        reasoningEffort: REASONING_EFFORT,
        profile: PROFILE,
        workspace: WORKDIR,
        conversations: conversations.size,
        time: new Date().toISOString(),
      });
    }
    if (req.method === 'GET' && url.pathname === '/sessions') {
      const list = Object.values(transcripts).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map((item) => ({ id: item.id, senderName: item.senderName || '', senderId: item.senderId || '', chatType: item.chatType || '', lastMessage: item.lastMessage || '', messageCount: item.messageCount || 0, updatedAt: item.updatedAt || '', workspace: item.workspace || '' }));
      return json(res, 200, { ok: true, sessions: list });
    }
    if (req.method === 'GET' && url.pathname === '/session') {
      const id = url.searchParams.get('id') || '';
      const item = transcripts[id];
      if (!item) return json(res, 404, { ok: false, error: 'session not found' });
      return json(res, 200, { ok: true, session: item });
    }
    if (req.method === 'POST' && (url.pathname === '/v1/embeddings' || url.pathname === '/embedding')) {
      const body = await readJsonBody(req);
      const inputs = Array.isArray(body.input) ? body.input.map(String) : [String(body.input || '')];
      const data = inputs.map((text, index) => ({ object: 'embedding', index, embedding: localEmbedding(text) }));
      return json(res, 200, { object: 'list', data, model: String(body.model || 'dsh-local-hash'), usage: { prompt_tokens: 0, total_tokens: 0 } });
    }
    if (req.method === 'POST' && !authorized(req)) {
      return json(res, 401, { ok: false, error: 'unauthorized' });
    }
    if (req.method === 'POST' && url.pathname === '/transcript') {
      const body = await readJsonBody(req);
      if (!body.conversationId || !body.text) return json(res, 400, { ok: false, error: 'conversationId and text are required' });
      appendTranscript(String(body.conversationId), String(body.role || 'user'), String(body.text), { senderName: String(body.senderName || 'DSH Panel'), chatType: 'panel' });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/provider_chat') {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId || '').trim();
      const conversationId = sessionId ? 'provider:' + sessionId : 'provider:internal:' + crypto.randomUUID();
      const text = formatProviderPrompt(body, conversationId);
      const providerSessionId = String(body.sessionId || '').trim();
      if (providerSessionId) { const userText = lastUserText(body); if (userText) appendTranscript(conversationId, 'user', userText, { chatType: 'provider', senderName: 'QQ' }); }
      const result = await enqueueChat({
        conversationId,
        text,
        senderId: 'astrbot-provider',
        senderName: 'AstrBot',
        chatType: 'private',
      });
      providerSeen.add(conversationId);
      if (providerSessionId) appendTranscript(conversationId, 'assistant', result.reply, { chatType: 'provider' });
      return json(res, 200, { ok: true, reply: result.reply, sessionId: result.sessionId, conversationId });
    }
    if (req.method === 'POST' && url.pathname === '/chat') {
      const body = await readJsonBody(req);
      if (!body.conversationId || !body.text) return json(res, 400, { ok: false, error: 'conversationId and text are required' });
      const conversationId = String(body.conversationId);
      appendTranscript(conversationId, 'user', body.text, { senderName: body.senderName, senderId: body.senderId, chatType: body.chatType });
      const result = await enqueueChat({
        conversationId,
        text: String(body.text),
        senderId: String(body.senderId || ''),
        senderName: String(body.senderName || ''),
        chatType: body.chatType === 'group' ? 'group' : 'private',
        groupId: body.groupId ? String(body.groupId) : '',
        groupName: body.groupName ? String(body.groupName) : '',
      });
      appendTranscript(conversationId, 'assistant', result.reply, { chatType: body.chatType });
      return json(res, 200, { ok: true, ...result });
    }
    if (req.method === 'POST' && url.pathname === '/reset') {
      const body = await readJsonBody(req);
      if (!body.conversationId) return json(res, 400, { ok: false, error: 'conversationId is required' });
      const sessionId = resetConversation(String(body.conversationId));
      try { delete transcripts[String(body.conversationId)]; saveTranscripts(); } catch {}
      return json(res, 200, { ok: true, conversationId: String(body.conversationId), sessionId });
    }
    return json(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    log('http error:', err.stack || err.message);
    return json(res, 502, { ok: false, error: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  log(`bridge listening on http://${HOST}:${PORT}`);
  client.ensureStarted().catch((err) => log('initial SDK start failed:', err.stack || err.message));
});

async function shutdown() {
  log('bridge shutting down');
  server.close();
  await client.shutdown();
  logStream.end();
  setTimeout(() => process.exit(0), 200).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
