import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const TYPE_DIR = { a: 'AstrBot', n: 'NapCat' };
const TYPE_LABEL = { a: 'AstrBot', n: 'NapCat' };
const PORT_RANGE = { a: [6100, 6299], n: [6200, 6399] };

function nowIso() { return new Date().toISOString(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function existsSync(p) { try { return fs.existsSync(p); } catch { return false; } }
function normText(value, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function typeLabel(type) { return TYPE_LABEL[type] || String(type || 'instance'); }
function formatSize(bytes) { return Number(bytes) > 0 ? Number(bytes) : 0; }
async function readJson(file, fallback) {
  try { return JSON.parse((await fsp.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
  catch { return fallback; }
}
async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fsp.rename(tmp, file);
}
async function listDirs(base) {
  try {
    const entries = await fsp.readdir(base, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch { return []; }
}
function sortTags(tags) {
  return [...tags].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

function normalizeRuntimeVersion(value) {
  const text = String(value || '').trim().replace(/^v/i, '');
  const match = /^(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/.exec(text);
  return match ? match[1] : '';
}
function runtimeTagFor(value) { const version = normalizeRuntimeVersion(value); return version ? 'v' + version : ''; }
function isStableRuntimeVersion(value) { return /^\d+\.\d+\.\d+$/.test(normalizeRuntimeVersion(value)); }
function compareRuntimeTags(a, b) { return String(b || '').localeCompare(String(a || ''), undefined, { numeric: true }); }
function isLocalRuntimeSource(source) { const value = String(source || '').trim(); return Boolean(value) && !/^https?:\/\//i.test(value); }
function runtimeSourceWithSlash(source) { const value = String(source || '').trim(); return value && !value.endsWith('/') ? value + '/' : value; }
function proxyRuntimeAsset(source, assetUrl) { const value = String(source || '').trim(); if (!value) return assetUrl; return value.endsWith('/') ? value + assetUrl : value + '/' + assetUrl; }
async function copyDirectory(src, dst) {
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  if (process.platform === 'win32') {
    try {
      await execFileAsync('robocopy.exe', [src, dst, '/E', '/COPY:DAT', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    } catch (error) {
      const code = Number(error && error.code);
      if (!(code >= 0 && code < 8)) throw error;
    }
    return;
  }
  await fsp.cp(src, dst, { recursive: true, force: true });
}

export function defaultDataRoot() {
  return path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'astriax-native');
}

export class AstriaXNativeManager {
  constructor(options = {}) {
    this.dataRoot = path.resolve(options.dataRoot || defaultDataRoot());
    this.bootstrapSource = options.bootstrapSource ? path.resolve(options.bootstrapSource) : '';
    this.probeTimeoutMs = Number(options.probeTimeoutMs) || 800;
    this.instancesFile = path.join(this.dataRoot, 'instances.json');
    this.stateFile = path.join(this.dataRoot, 'runtime-state.json');
    this.logsDir = path.join(this.dataRoot, 'logs', 'instances');
    this.backupsRoot = path.join(this.dataRoot, 'backups', 'instances');
    this.backupsTmp = path.join(this.dataRoot, 'backups', '.tmp');
    this.settingsFile = path.join(this.dataRoot, 'settings.json');
    this.cacheDir = path.join(this.dataRoot, 'cache');
    this.downloadDir = path.join(this.dataRoot, 'cache', 'downloads');
    this.pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    this.providerAsset = path.join(this.pluginRoot, 'assets', 'dsh_bridge_source.py');
    this.bridgePort = Number(options.bridgePort) || 18081;
    this.pythonRoot = path.join(this.dataRoot, 'runtime', 'python');
    this.runtimeRoot = path.join(this.dataRoot, 'runtimes');
    this.jobs = new Map();
    this.startWaits = new Map();
    this.watchdogFailures = new Map();
    this.watchdogRunning = false;
  }

  info() {
    return {
      dataRoot: this.dataRoot,
      bootstrapSource: this.bootstrapSource,
      bootstrapAvailable: existsSync(path.join(this.bootstrapSource, 'runtime', 'python', 'python.exe')) || existsSync(path.join(this.bootstrapSource, 'runtimes')),
      pythonExists: existsSync(path.join(this.pythonRoot, 'python.exe')),
    };
  }

  async ensureLayout() {
    await Promise.all([
      fsp.mkdir(this.logsDir, { recursive: true }),
      fsp.mkdir(path.join(this.dataRoot, 'instances'), { recursive: true }),
      fsp.mkdir(path.join(this.dataRoot, 'backups'), { recursive: true }),
      fsp.mkdir(this.backupsRoot, { recursive: true }),
      fsp.mkdir(this.backupsTmp, { recursive: true }),
      fsp.mkdir(this.cacheDir, { recursive: true }),
      fsp.mkdir(this.downloadDir, { recursive: true }),
      fsp.mkdir(this.runtimeRoot, { recursive: true }),
    ]);
  }

  async readInstances() {
    const data = await readJson(this.instancesFile, { instances: [] });
    return Array.isArray(data.instances) ? data : { instances: [] };
  }
  async writeInstances(instances) { await writeJson(this.instancesFile, { instances }); }
  async readState() {
    const data = await readJson(this.stateFile, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }
  async writeState(state) { await writeJson(this.stateFile, state); }
  async findInstance(id) {
    const manifest = await this.readInstances();
    return manifest.instances.find((item) => item.id === id) || null;
  }

  async probeTcp(port, timeoutMs = this.probeTimeoutMs) {
    if (!Number.isInteger(Number(port)) || Number(port) <= 0) return false;
    return await new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port: Number(port) });
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        try { socket.destroy(); } catch {}
        resolve(value);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
  }
  async probeHttp(url, timeoutMs = this.probeTimeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      return response.status < 500;
    } catch { return false; }
  }
  pidAlive(pid) {
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) return false;
    try { process.kill(n, 0); return true; }
    catch (error) { return error && error.code === 'EPERM'; }
  }

  async listRuntimes() {
    const [aTags, nTags] = await Promise.all([listDirs(path.join(this.runtimeRoot, 'a')), listDirs(path.join(this.runtimeRoot, 'n'))]);
    const pythonExe = path.join(this.pythonRoot, 'python.exe');
    return {
      python: { exists: existsSync(pythonExe), path: pythonExe },
      a: sortTags(aTags),
      n: sortTags(nTags),
      root: this.runtimeRoot,
    };
  }

  async runtimeDir(type, tag) {
    const normalized = normText(tag, '');
    if (!normalized || !/^[a-zA-Z0-9._-]+$/.test(normalized)) throw Object.assign(new Error('invalid runtime version'), { status: 400 });
    const dir = path.join(this.runtimeRoot, type === 'a' ? 'a' : 'n', normalized);
    if (!existsSync(dir)) throw Object.assign(new Error('runtime not installed: ' + normalized), { status: 400 });
    return dir;
  }

  async runtimeOptions(type) {
    const tags = await listDirs(path.join(this.runtimeRoot, type === 'a' ? 'a' : 'n'));
    return sortTags(tags);
  }

  async overview() {
    await this.ensureLayout();
    const [manifest, state, runtimes] = await Promise.all([this.readInstances(), this.readState(), this.listRuntimes()]);
    const instances = await Promise.all(manifest.instances.map((rec) => this.projectInstance(rec, state[rec.id])));
    return {
      version: '0.1.0',
      info: this.info(),
      runtimes,
      runtimeSources: await this.runtimeSources(),
      instances,
      jobs: [...this.jobs.values()].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))).slice(0, 10),
      time: nowIso(),
    };
  }

  async webUiInfo(rec, portOpen) {
    if (rec.type === 'a') {
      const url = 'http://127.0.0.1:' + rec.port + '/';
      return { kind: 'dashboard', label: 'AstrBot Dashboard', url, reachable: portOpen ? await this.probeHttp(url) : false };
    }
    if (rec.type === 'n') {
      const config = await readJson(path.join(rec.dir || '', 'config', 'webui.json'), null);
      const ports = [];
      const add = (value) => { const n = Number(value); if (Number.isInteger(n) && n > 0 && !ports.includes(n)) ports.push(n); };
      add(rec.port);
      if (config) add(config.port);
      const token = config && typeof config.token === 'string' ? config.token : '';
      const candidates = [];
      for (const port of ports) {
        const url = 'http://127.0.0.1:' + port + '/webui/';
        const reachable = await this.probeHttp(url);
        candidates.push({ port, url, reachable });
        if (reachable) return { kind: 'napcat', label: 'NapCat WebUI', url, reachable, port, token, candidates };
      }
      return { kind: 'napcat', label: 'NapCat WebUI', url: candidates.length ? candidates[0].url : 'http://127.0.0.1:' + rec.port + '/webui/', reachable: false, token, candidates };
    }
    return null;
  }

  async projectInstance(rec, entry) {
    const alive = this.pidAlive(entry && entry.pid);
    const portOpen = await this.probeTcp(rec.port);
    let status = 'stopped';
    if (alive) status = 'running';
    else if (portOpen) status = 'port-open';
    else if (rec.status === 'error') status = 'error';
    const webui = await this.webUiInfo(rec, portOpen);
    return {
      id: rec.id,
      name: normText(rec.name, rec.id),
      type: rec.type,
      typeLabel: typeLabel(rec.type),
      port: rec.port,
      status,
      live: alive || portOpen,
      pid: alive ? Number(entry.pid) : null,
      runtimeTag: normText(rec.runtimeTag, ''),
      dir: rec.dir || '',
      createdAt: rec.createdAt || null,
      lastStartedAt: rec.lastStartedAt || (entry && entry.startedAt) || null,
      autoStart: rec.autoStart === true,
      autoRestart: rec.autoRestart !== false,
      desiredRunning: Boolean(entry && entry.desiredRunning),
      webui,
      pair: rec.pair || null,
      logPath: path.join(this.logsDir, String(rec.id) + '.log'),
    };
  }

  async allocatePort(type) {
    const [min, max] = PORT_RANGE[type] || [6100, 6399];
    const manifest = await this.readInstances();
    const used = new Set(manifest.instances.map((item) => Number(item.port)));
    for (let port = min; port <= max; port += 1) {
      if (used.has(port)) continue;
      if (await this.probeTcp(port, 250)) continue;
      return port;
    }
    throw Object.assign(new Error('no free port in range'), { status: 409 });
  }

  async createInstance(input = {}) {
    await this.ensureLayout();
    const type = input.type === 'n' ? 'n' : input.type === 'a' ? 'a' : '';
    if (!type) throw Object.assign(new Error('type must be a or n'), { status: 400 });
    const name = normText(input.name, '') || (type === 'a' ? 'AstrBot' : 'NapCat') + ' 实例';
    const runtimeTag = normText(input.runtimeTag, '');
    if (!runtimeTag) throw Object.assign(new Error('runtime version is required'), { status: 400 });
    await this.runtimeDir(type, runtimeTag);
    if (type === 'a' && !existsSync(path.join(this.pythonRoot, 'python.exe'))) throw Object.assign(new Error('Python runtime is not installed'), { status: 400 });
    const manifest = await this.readInstances();
    let port = Number(input.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) port = await this.allocatePort(type);
    if (manifest.instances.some((item) => Number(item.port) === port)) throw Object.assign(new Error('port already used by an instance'), { status: 409 });
    if (await this.probeTcp(port, 300)) throw Object.assign(new Error('port is already in use: ' + port), { status: 409 });
    const id = (type === 'a' ? 'a_' : 'n_') + randomBytes(5).toString('hex');
    const dir = path.join(this.dataRoot, 'instances', TYPE_DIR[type], id);
    await fsp.mkdir(dir, { recursive: true });
    if (type === 'a') {
      await fsp.mkdir(path.join(dir, 'data'), { recursive: true });
      await fsp.writeFile(path.join(dir, '.astrbot'), '', 'utf8');
    } else {
      await fsp.mkdir(path.join(dir, 'config'), { recursive: true });
    }
    const record = {
      id,
      type,
      name,
      port,
      dir,
      runtimeTag,
      status: 'stopped',
      createdAt: nowIso(),
      lastStartedAt: null,
      autoStart: input.autoStart === true,
      autoRestart: input.autoRestart !== false,
      ...(type === 'n' ? { webuiToken: randomBytes(6).toString('hex') } : {}),
    };
    await fsp.writeFile(path.join(dir, 'instance.json'), JSON.stringify(record, null, 2) + '\n', 'utf8');
    manifest.instances.push(record);
    await this.writeInstances(manifest.instances);
    return record;
  }

  async updateInstance(id, patch = {}) {
    const manifest = await this.readInstances();
    const idx = manifest.instances.findIndex((item) => item.id === id);
    if (idx < 0) throw Object.assign(new Error('instance not found'), { status: 404 });
    const rec = manifest.instances[idx];
    const state = await this.readState();
    const running = state[id] && this.pidAlive(state[id].pid);
    const next = { ...rec };
    if (patch.name !== undefined) {
      const name = normText(patch.name, '');
      if (!name) throw Object.assign(new Error('name cannot be empty'), { status: 400 });
      next.name = name.slice(0, 120);
    }
    if (patch.port !== undefined) {
      if (running) throw Object.assign(new Error('stop the instance before changing its port'), { status: 409 });
      const port = Number(patch.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error('invalid port'), { status: 400 });
      if (manifest.instances.some((item) => item.id !== id && Number(item.port) === port)) throw Object.assign(new Error('port already used'), { status: 409 });
      if (await this.probeTcp(port, 250)) throw Object.assign(new Error('port is already in use'), { status: 409 });
      next.port = port;
    }
    if (patch.runtimeTag !== undefined) {
      if (running) throw Object.assign(new Error('stop the instance before changing runtime'), { status: 409 });
      const tag = normText(patch.runtimeTag, '');
      await this.runtimeDir(next.type, tag);
      if (next.type === 'a' && !existsSync(path.join(this.pythonRoot, 'python.exe'))) throw Object.assign(new Error('Python runtime is not installed'), { status: 400 });
      next.runtimeTag = tag;
    }
    if (patch.autoStart !== undefined) next.autoStart = patch.autoStart === true;
    if (patch.autoRestart !== undefined) next.autoRestart = patch.autoRestart !== false;
    manifest.instances[idx] = next;
    await this.writeInstances(manifest.instances);
    await fsp.writeFile(path.join(next.dir, 'instance.json'), JSON.stringify(next, null, 2) + '\n', 'utf8');
    return next;
  }

  async deleteInstance(id, deleteFiles = false) {
    const manifest = await this.readInstances();
    const rec = manifest.instances.find((item) => item.id === id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const state = await this.readState();
    if (state[id] && this.pidAlive(state[id].pid)) throw Object.assign(new Error('stop the instance first'), { status: 409 });
    if (rec.pair && rec.pair.peerId) {
      const peerIdx = manifest.instances.findIndex((item) => item.id === rec.pair.peerId);
      if (peerIdx >= 0) manifest.instances[peerIdx] = { ...manifest.instances[peerIdx], pair: null };
    }
    manifest.instances = manifest.instances.filter((item) => item.id !== id);
    await this.writeInstances(manifest.instances);
    delete state[id];
    await this.writeState(state);
    if (deleteFiles && rec.dir && path.resolve(rec.dir).startsWith(path.resolve(this.dataRoot))) {
      await fsp.rm(rec.dir, { recursive: true, force: true });
      await fsp.rm(path.join(this.backupsRoot, id), { recursive: true, force: true });
    }
    return { id, removed: true, deletedFiles: Boolean(deleteFiles) };
  }


  async napcatCredential(rec) {
    if (!rec || rec.type !== 'n') throw Object.assign(new Error('not a NapCat instance'), { status: 400 });
    let token = rec.webuiToken || '';
    if (!token) {
      const config = await readJson(path.join(rec.dir || '', 'config', 'webui.json'), null);
      token = config && typeof config.token === 'string' ? config.token : '';
    }
    if (!token) throw Object.assign(new Error('NapCat WebUI token not found; start the instance first'), { status: 409 });
    const hash = createHash('sha256').update(String(token) + '.napcat').digest('hex');
    const response = await fetch('http://127.0.0.1:' + rec.port + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash, totpCode: '' }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.code !== 0 || !data.data || !data.data.Credential) {
      throw Object.assign(new Error('NapCat WebUI login failed'), { status: 502 });
    }
    return data.data.Credential;
  }

  async napcatApi(rec, action, body = {}) {
    const credential = await this.napcatCredential(rec);
    const response = await fetch('http://127.0.0.1:' + rec.port + '/api/' + action, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.code !== 0) {
      const message = data && data.message ? data.message : 'NapCat API failed: ' + action;
      throw Object.assign(new Error(message), { status: 502 });
    }
    return data.data;
  }

  async napcatStatus(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'n') throw Object.assign(new Error('NapCat instance not found'), { status: 404 });
    if (!(await this.probeTcp(rec.port, 500))) throw Object.assign(new Error('NapCat instance is not running'), { status: 409 });
    const [status, quickList, autoLogin] = await Promise.all([
      this.napcatApi(rec, 'QQLogin/CheckLoginStatus'),
      this.napcatApi(rec, 'QQLogin/GetQuickLoginListNew').catch(() => []),
      this.napcatApi(rec, 'QQLogin/GetQuickLoginQQ').catch(() => null),
    ]);
    const config = await readJson(path.join(rec.dir, 'config', 'webui.json'), null);
    return {
      instanceId: rec.id,
      port: rec.port,
      webuiToken: rec.webuiToken || (config && config.token) || '',
      status,
      quickLoginList: Array.isArray(quickList) ? quickList : [],
      autoLoginQQ: autoLogin || null,
    };
  }

  async napcatQuickLogin(id, uin) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'n') throw Object.assign(new Error('NapCat instance not found'), { status: 404 });
    const account = String(uin || '').trim();
    if (!/^\d{5,12}$/.test(account)) throw Object.assign(new Error('invalid QQ account'), { status: 400 });
    await this.napcatApi(rec, 'QQLogin/SetQuickLogin', { uin: account });
    return { id, uin: account, requested: true };
  }

  async napcatRefreshQr(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'n') throw Object.assign(new Error('NapCat instance not found'), { status: 404 });
    return await this.napcatApi(rec, 'QQLogin/RefreshQRcode');
  }


  async allocateOneBotPort() {
    const manifest = await this.readInstances();
    const used = new Set();
    for (const item of manifest.instances) {
      if (Number(item.port)) used.add(Number(item.port));
      if (item.pair && Number(item.pair.onebotPort)) used.add(Number(item.pair.onebotPort));
    }
    for (let port = 6300; port <= 6499; port += 1) {
      if (used.has(port)) continue;
      if (await this.probeTcp(port, 250)) continue;
      return port;
    }
    throw Object.assign(new Error('no free OneBot port'), { status: 409 });
  }

  async findPairPeer(rec) {
    if (!rec || !rec.pair || !rec.pair.peerId) return null;
    return await this.findInstance(rec.pair.peerId);
  }

  async applyAstrBotPairConfig(rec, pair) {
    if (!rec || rec.type !== 'a' || !pair) return { applied: false };
    const cfgPath = path.join(rec.dir, 'data', 'cmd_config.json');
    if (!existsSync(cfgPath)) throw Object.assign(new Error('start the AstrBot instance once to generate data/cmd_config.json'), { status: 409 });
    const cfg = await readJson(cfgPath, null);
    if (!cfg || typeof cfg !== 'object') throw Object.assign(new Error('invalid AstrBot config'), { status: 500 });
    const platform = Array.isArray(cfg.platform) ? cfg.platform : [];
    const entry = {
      id: 'dsh-pair-' + String(pair.id || ''),
      type: 'aiocqhttp',
      enable: true,
      ws_reverse_host: '0.0.0.0',
      ws_reverse_port: Number(pair.onebotPort),
      ws_reverse_token: String(pair.token || ''),
    };
    cfg.platform = platform.filter((item) => !(item && (item.id === entry.id || item.type === 'aiocqhttp'))).concat(entry);
    await this.writeConfigFile(rec.id, 'data/cmd_config.json', JSON.stringify(cfg, null, 2));
    return { applied: true, file: 'data/cmd_config.json', port: entry.ws_reverse_port };
  }

  async applyNapcatPairConfig(rec, pair) {
    if (!rec || rec.type !== 'n' || !pair) return { applied: false };
    const configDir = path.join(rec.dir, 'config');
    let names = [];
    try { names = await fsp.readdir(configDir); } catch {}
    const files = names.filter((name) => /^onebot11_.*\.json$/i.test(name)).sort();
    if (!files.length) return { applied: false, reason: 'login the QQ account once so NapCat creates onebot11_<QQ>.json' };
    const rel = path.join('config', files[0]);
    const full = path.join(rec.dir, rel);
    const cfg = await readJson(full, null);
    if (!cfg || typeof cfg !== 'object') throw Object.assign(new Error('invalid NapCat OneBot config'), { status: 500 });
    cfg.network = cfg.network && typeof cfg.network === 'object' ? cfg.network : {};
    for (const key of ['httpServers', 'httpSseServers', 'httpClients', 'websocketServers', 'websocketClients', 'plugins']) {
      if (!Array.isArray(cfg.network[key])) cfg.network[key] = [];
    }
    const client = {
      enable: true,
      name: 'DSH-AstrBot',
      url: 'ws://127.0.0.1:' + Number(pair.onebotPort) + '/ws',
      reportSelfMessage: false,
      messagePostFormat: 'array',
      token: String(pair.token || ''),
      debug: false,
      heartInterval: 30000,
      reconnectInterval: 30000,
      verifyCertificate: true,
    };
    cfg.network.websocketClients = cfg.network.websocketClients.filter((item) => !(item && (item.name === client.name || String(item.url || '').includes(':' + pair.onebotPort + '/ws')))).concat(client);
    await this.writeConfigFile(rec.id, rel, JSON.stringify(cfg, null, 2));
    return { applied: true, file: rel, port: pair.onebotPort };
  }

  async pairInstances(aId, nId) {
    const manifest = await this.readInstances();
    const ai = manifest.instances.findIndex((item) => item.id === aId);
    const ni = manifest.instances.findIndex((item) => item.id === nId);
    if (ai < 0 || ni < 0) throw Object.assign(new Error('instance not found'), { status: 404 });
    const a = manifest.instances[ai];
    const n = manifest.instances[ni];
    if (a.type !== 'a' || n.type !== 'n') throw Object.assign(new Error('pair requires one AstrBot and one NapCat instance'), { status: 400 });
    if (a.pair || n.pair) throw Object.assign(new Error('one of the instances is already paired'), { status: 409 });
    const onebotPort = await this.allocateOneBotPort();
    const pair = {
      id: Date.now().toString(36) + '-' + randomBytes(4).toString('hex'),
      astrbotId: a.id,
      napcatId: n.id,
      onebotPort,
      token: randomBytes(24).toString('hex'),
      createdAt: nowIso(),
      napcatConfigApplied: false,
    };
    const aNext = { ...a, pair: { ...pair, peerId: n.id, role: 'astrbot' } };
    const nNext = { ...n, pair: { ...pair, peerId: a.id, role: 'napcat' } };
    manifest.instances[ai] = aNext;
    manifest.instances[ni] = nNext;
    await this.writeInstances(manifest.instances);
    let aResult = null;
    let nResult = null;
    try {
      aResult = await this.applyAstrBotPairConfig(aNext, aNext.pair);
      nResult = await this.applyNapcatPairConfig(nNext, nNext.pair);
    } catch (error) {
      console.error('[astriax-native] pair config failed: ' + (error && error.message ? error.message : error));
      throw error;
    }
    const nextManifest = await this.readInstances();
    const ni2 = nextManifest.instances.findIndex((item) => item.id === n.id);
    const ai2 = nextManifest.instances.findIndex((item) => item.id === a.id);
    if (ni2 >= 0) nextManifest.instances[ni2].pair.napcatConfigApplied = Boolean(nResult && nResult.applied);
    if (ai2 >= 0) nextManifest.instances[ai2].pair.napcatConfigApplied = Boolean(nResult && nResult.applied);
    await this.writeInstances(nextManifest.instances);
    return {
      pair: { ...pair, napcatConfigApplied: Boolean(nResult && nResult.applied) },
      astrbot: aResult,
      napcat: nResult,
      warning: nResult && nResult.applied ? null : (nResult && nResult.reason) || 'NapCat config will be applied after the first QQ login',
    };
  }

  async applyPair(id) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    if (!rec.pair) throw Object.assign(new Error('instance is not paired'), { status: 400 });
    const peer = await this.findPairPeer(rec);
    if (!peer) throw Object.assign(new Error('paired instance not found'), { status: 404 });
    const a = rec.type === 'a' ? rec : peer;
    const n = rec.type === 'n' ? rec : peer;
    const aResult = await this.applyAstrBotPairConfig(a, a.pair);
    const nResult = await this.applyNapcatPairConfig(n, n.pair);
    const manifest = await this.readInstances();
    for (const item of manifest.instances) {
      if (item.id === a.id || item.id === n.id) item.pair = { ...item.pair, napcatConfigApplied: Boolean(nResult && nResult.applied) };
    }
    await this.writeInstances(manifest.instances);
    return { astrbot: aResult, napcat: nResult };
  }

  async unpairInstance(id) {
    const manifest = await this.readInstances();
    const rec = manifest.instances.find((item) => item.id === id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    if (!rec.pair) return { unpaired: true, already: true };
    const peerId = rec.pair.peerId;
    const peer = manifest.instances.find((item) => item.id === peerId);
    const pair = rec.pair;
    const a = rec.type === 'a' ? rec : peer;
    const n = rec.type === 'n' ? rec : peer;
    if (a) {
      try {
        const cfgPath = path.join(a.dir, 'data', 'cmd_config.json');
        const cfg = await readJson(cfgPath, null);
        if (cfg && Array.isArray(cfg.platform)) {
          cfg.platform = cfg.platform.filter((item) => !(item && (item.id === 'dsh-pair-' + pair.id || item.type === 'aiocqhttp')));
          await this.writeConfigFile(a.id, 'data/cmd_config.json', JSON.stringify(cfg, null, 2));
        }
      } catch (error) {
        console.error('[astriax-native] unpair AstrBot config cleanup failed: ' + (error && error.message ? error.message : error));
      }
    }
    if (n) {
      try {
        const files = await this.listConfigFiles(n);
        for (const file of files.filter((item) => /^onebot11_.*\.json$/i.test(path.basename(item.rel)))) {
          const cfg = await readJson(path.join(n.dir, file.rel), null);
          if (cfg && cfg.network && Array.isArray(cfg.network.websocketClients)) {
            cfg.network.websocketClients = cfg.network.websocketClients.filter((item) => !(item && (item.name === 'DSH-AstrBot' || String(item.url || '').includes(':' + pair.onebotPort + '/ws'))));
            await this.writeConfigFile(n.id, file.rel, JSON.stringify(cfg, null, 2));
          }
        }
      } catch (error) {
        console.error('[astriax-native] unpair NapCat config cleanup failed: ' + (error && error.message ? error.message : error));
      }
    }
    for (const item of manifest.instances) if (item.id === id || item.id === peerId) item.pair = null;
    await this.writeInstances(manifest.instances);
    return { unpaired: true, peerId };
  }


  async webUiCredentials(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'a') return null;
    const file = path.join(this.logsDir, String(id) + '.log');
    try {
      const stat = await fsp.stat(file);
      const start = Math.max(0, stat.size - 4 * 1024 * 1024);
      const handle = await fsp.open(file, 'r');
      let text = '';
      try {
        const length = stat.size - start;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, start);
        text = buffer.toString('utf8').replace(/\x1b\[[0-9;]*m/g, '');
      } finally { await handle.close(); }
      const usernames = [...text.matchAll(/Initial username:\s*([^\r\n]+)/gi)];
      const passwords = [...text.matchAll(/Initial password:\s*([^\r\n]+)/gi)];
      const usernameRaw = usernames.length ? usernames[usernames.length - 1][1] : '';
      const passwordRaw = passwords.length ? passwords[passwords.length - 1][1] : '';
      const clean = (value) => String(value || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
      const username = clean(usernameRaw);
      const password = clean(passwordRaw);
      if (!username && !password) return null;
      return { username, password, source: file };
    } catch {
      return null;
    }
  }


  async findNamedFile(root, name) {
    let entries;
    try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch { return null; }
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isFile() && entry.name === name) return full;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const found = await this.findNamedFile(path.join(root, entry.name), name);
      if (found) return found;
    }
    return null;
  }

  async cleanupRestoredPairArtifacts(rec, pair) {
    if (!pair) return;
    if (rec.type === 'a') {
      const file = path.join(rec.dir, 'data', 'cmd_config.json');
      const cfg = await readJson(file, null);
      if (cfg && Array.isArray(cfg.platform)) {
        const before = cfg.platform.length;
        cfg.platform = cfg.platform.filter((item) => !(item && (item.id === 'dsh-pair-' + pair.id || (item.type === 'aiocqhttp' && Number(item.ws_reverse_port) === Number(pair.onebotPort)))));
        if (cfg.platform.length !== before) await fsp.writeFile(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
      }
      return;
    }
    if (rec.type === 'n') {
      const configDir = path.join(rec.dir, 'config');
      let names = [];
      try { names = await fsp.readdir(configDir); } catch {}
      for (const name of names.filter((item) => /^onebot11_.*\.json$/i.test(item))) {
        const file = path.join(configDir, name);
        const cfg = await readJson(file, null);
        if (cfg && cfg.network && Array.isArray(cfg.network.websocketClients)) {
          const before = cfg.network.websocketClients.length;
          cfg.network.websocketClients = cfg.network.websocketClients.filter((item) => !(item && (item.name === 'DSH-AstrBot' || String(item.url || '').includes(':' + pair.onebotPort + '/ws'))));
          if (cfg.network.websocketClients.length !== before) await fsp.writeFile(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
        }
      }
    }
  }

  async backupInstance(id) {
    await this.ensureLayout();
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const state = await this.readState();
    if (state[id] && this.pidAlive(state[id].pid)) throw Object.assign(new Error('stop the instance before creating a backup'), { status: 409 });
    const safeName = String(rec.name || rec.id).replace(/[^0-9A-Za-z._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || rec.id;
    const stamp = nowIso().replace(/[:.]/g, '-');
    const fileName = stamp + '-' + (rec.type === 'a' ? 'astrbot' : 'napcat') + '-' + safeName + '-' + rec.id + '.zip';
    const backupDir = path.join(this.backupsRoot, id);
    await fsp.mkdir(backupDir, { recursive: true });
    const archive = path.join(backupDir, fileName);
    const metaDir = path.join(this.backupsTmp, 'meta-' + process.pid + '-' + Date.now());
    await fsp.mkdir(metaDir, { recursive: true });
    const metaFile = path.join(metaDir, 'meta.json');
    const meta = {
      format: 'astriax-native-backup',
      version: 1,
      appVersion: '0.1.0',
      createdAt: nowIso(),
      sourceDirRel: path.relative(this.dataRoot, rec.dir).split(path.sep).join('/'),
      instance: {
        id: rec.id,
        type: rec.type,
        name: rec.name,
        runtimeTag: rec.runtimeTag,
        port: rec.port,
        createdAt: rec.createdAt,
        autoStart: rec.autoStart,
        autoRestart: rec.autoRestart,
        webuiToken: rec.webuiToken || null,
        pair: rec.pair || null,
      },
    };
    try {
      await fsp.writeFile(metaFile, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      const tool = process.platform === 'win32' ? 'tar.exe' : 'tar';
      const relDir = path.relative(this.dataRoot, rec.dir).split(path.sep).join('/');
      const relMeta = path.relative(this.dataRoot, metaFile).split(path.sep).join('/');
      await execFileAsync(tool, ['-a', '-c', '-f', archive, '-C', this.dataRoot, relDir, relMeta], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
      const stat = await fsp.stat(archive);
      return { file: fileName, size: stat.size, createdAt: stat.birthtime ? stat.birthtime.toISOString() : nowIso(), meta };
    } catch (error) {
      try { await fsp.rm(archive, { force: true }); } catch {}
      throw Object.assign(new Error('backup failed: ' + (error && error.message ? error.message : String(error))), { status: 500 });
    } finally {
      try { await fsp.rm(metaDir, { recursive: true, force: true }); } catch {}
    }
  }

  async listInstanceBackups(id) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const dir = path.join(this.backupsRoot, id);
    let names = [];
    try { names = await fsp.readdir(dir); } catch {}
    const backups = [];
    for (const file of names.filter((name) => /\.zip$/i.test(name))) {
      try {
        const stat = await fsp.stat(path.join(dir, file));
        backups.push({ file, size: stat.size, createdAt: (stat.birthtime || stat.mtime).toISOString() });
      } catch {}
    }
    backups.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { root: dir, backups };
  }

  async backupFile(id, file) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const name = path.basename(String(file || ''));
    if (!name || name !== String(file || '') || !/\.zip$/i.test(name)) throw Object.assign(new Error('invalid backup file'), { status: 400 });
    const full = path.join(this.backupsRoot, id, name);
    if (!existsSync(full)) throw Object.assign(new Error('backup not found'), { status: 404 });
    const stat = await fsp.stat(full);
    return { file: name, path: full, size: stat.size };
  }

  async deleteInstanceBackup(id, file) {
    const found = await this.backupFile(id, file);
    await fsp.rm(found.path, { force: true });
    return { file: found.file, deleted: true };
  }

  async restoreInstanceBackup(id, file, options = {}) {
    const source = await this.findInstance(id);
    if (!source) throw Object.assign(new Error('source instance not found'), { status: 404 });
    const found = await this.backupFile(id, file);
    await this.ensureLayout();
    const extractRoot = path.join(this.backupsTmp, 'restore-' + process.pid + '-' + Date.now());
    await fsp.mkdir(extractRoot, { recursive: true });
    let warning = null;
    try {
      const tool = process.platform === 'win32' ? 'tar.exe' : 'tar';
      await execFileAsync(tool, ['-x', '-f', found.path, '-C', extractRoot], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
      const metaPath = await this.findNamedFile(extractRoot, 'meta.json');
      const meta = metaPath ? await readJson(metaPath, null) : null;
      if (!meta || meta.format !== 'astriax-native-backup' || !meta.instance) throw Object.assign(new Error('backup metadata is invalid'), { status: 400 });
      const type = meta.instance.type === 'n' ? 'n' : meta.instance.type === 'a' ? 'a' : '';
      if (!type) throw Object.assign(new Error('backup instance type is invalid'), { status: 400 });
      const rel = String(meta.sourceDirRel || '').replace(/\\/g, '/').replace(/^\/+/, '');
      let sourceDir = rel ? path.join(extractRoot, ...rel.split('/')) : '';
      if (!sourceDir || !existsSync(sourceDir)) {
        const searchBase = path.join(extractRoot, 'instances', TYPE_DIR[type]);
        let entries = [];
        try { entries = await fsp.readdir(searchBase, { withFileTypes: true }); } catch {}
        const first = entries.find((entry) => entry.isDirectory());
        sourceDir = first ? path.join(searchBase, first.name) : '';
      }
      if (!sourceDir || !existsSync(sourceDir)) throw Object.assign(new Error('instance files not found in backup'), { status: 400 });
      const runtimeOptions = await this.runtimeOptions(type);
      let runtimeTag = normText(meta.instance.runtimeTag, '');
      if (!runtimeOptions.includes(runtimeTag)) {
        runtimeTag = runtimeOptions[0] || '';
        if (runtimeTag) warning = '原运行库不存在，已改用 ' + runtimeTag;
      }
      if (!runtimeTag) throw Object.assign(new Error('no installed runtime for this backup'), { status: 400 });
      const manifest = await this.readInstances();
      let port = Number(options.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535 || manifest.instances.some((item) => Number(item.port) === port) || await this.probeTcp(port, 250)) port = await this.allocatePort(type);
      const newId = (type === 'a' ? 'a_' : 'n_') + randomBytes(5).toString('hex');
      const newDir = path.join(this.dataRoot, 'instances', TYPE_DIR[type], newId);
      await copyDirectory(sourceDir, newDir);
      const rec = {
        id: newId,
        type,
        name: normText(options.name, '') || (normText(meta.instance.name, source.name) + ' (恢复)'),
        port,
        dir: newDir,
        runtimeTag,
        status: 'stopped',
        createdAt: nowIso(),
        lastStartedAt: null,
        autoStart: false,
        autoRestart: true,
        restoredFrom: { sourceId: source.id, file: found.file, at: nowIso() },
        ...(type === 'n' ? { webuiToken: meta.instance.webuiToken || source.webuiToken || randomBytes(6).toString('hex') } : {}),
      };
      await fsp.writeFile(path.join(newDir, 'instance.json'), JSON.stringify(rec, null, 2) + '\n', 'utf8');
      if (meta.instance.pair) {
        try { await this.cleanupRestoredPairArtifacts(rec, meta.instance.pair); warning = warning || '已清理旧配对配置'; }
        catch {}
      }
      manifest.instances.push(rec);
      await this.writeInstances(manifest.instances);
      return { instance: rec, warning };
    } finally {
      try { await fsp.rm(extractRoot, { recursive: true, force: true }); } catch {}
    }
  }


  async readSettings() {
    const data = await readJson(this.settingsFile, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }
  async writeSettings(value) { await writeJson(this.settingsFile, value); }
  async runtimeSources() {
    const settings = await this.readSettings();
    const saved = settings.runtimeSources && typeof settings.runtimeSources === 'object' ? settings.runtimeSources : {};
    const pick = (type) => {
      const item = saved[type] && typeof saved[type] === 'object' ? saved[type] : {};
      return { source: typeof item.source === 'string' ? item.source : (type === 'a' ? 'https://pypi.org/simple/' : 'https://api.github.com/') };
    };
    return { a: pick('a'), n: pick('n') };
  }
  async updateRuntimeSource(type, source) {
    if (type !== 'a' && type !== 'n') throw Object.assign(new Error('invalid runtime type'), { status: 400 });
    const value = typeof source === 'string' ? source.trim() : '';
    if (value.length > 2000) throw Object.assign(new Error('runtime source is too long'), { status: 400 });
    const settings = await this.readSettings();
    const current = settings.runtimeSources && typeof settings.runtimeSources === 'object' ? settings.runtimeSources : {};
    settings.runtimeSources = { ...current, [type]: { source: value } };
    await this.writeSettings(settings);
    return await this.runtimeSources();
  }
  async fetchTextUrl(url, timeoutMs = 15000) {
    const response = await fetch(url, { headers: { 'user-agent': 'astriax-native/0.1' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status + ': ' + url), { status: 502 });
    return await response.text();
  }
  async fetchJsonUrl(url, timeoutMs = 15000) {
    const response = await fetch(url, { headers: { 'user-agent': 'astriax-native/0.1' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status + ': ' + url), { status: 502 });
    return await response.json();
  }
  async scanAstrBotLocal(source) {
    const raw = String(source || '').trim();
    let base = path.resolve(raw);
    let stat;
    try { stat = await fsp.stat(base); } catch { return []; }
    if (stat.isFile()) base = path.dirname(base);
    const versions = new Set();
    let entries = [];
    try { entries = await fsp.readdir(base, { withFileTypes: true }); } catch { return []; }
    for (const entry of entries) {
      if (entry.isFile() && /^astrbot[-_].*\.(whl|tar\.gz|zip)$/i.test(entry.name)) {
        const match = /astrbot[-_](\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i.exec(entry.name);
        if (match) versions.add(normalizeRuntimeVersion(match[1]));
      }
      if (entry.isDirectory() && /^astrbot-.*\.dist-info$/i.test(entry.name)) {
        const metaFile = path.join(base, entry.name, 'METADATA');
        try {
          const text = await fsp.readFile(metaFile, 'utf8');
          const match = /^Version:\s*(.+)$/m.exec(text);
          if (match) versions.add(normalizeRuntimeVersion(match[1]));
        } catch {}
      }
    }
    if (!versions.size) {
      const init = path.join(base, 'astrbot', '__init__.py');
      try {
        const text = await fsp.readFile(init, 'utf8');
        const match = /^\s*__version__\s*=\s*["']([^"']+)["']/m.exec(text);
        if (match) versions.add(normalizeRuntimeVersion(match[1]));
      } catch {}
    }
    return [...versions].filter(Boolean).sort(compareRuntimeTags);
  }
  async astrbotCatalog(source) {
    const raw = String(source || 'https://pypi.org/simple/').trim() || 'https://pypi.org/simple/';
    if (isLocalRuntimeSource(raw)) {
      const versions = await this.scanAstrBotLocal(raw);
      if (!versions.length) throw Object.assign(new Error('local AstrBot runtime versions not found'), { status: 400 });
      return { local: true, source: raw, versions, latest: versions[0] };
    }
    const index = runtimeSourceWithSlash(raw);
    const versions = new Set();
    try {
      const text = await this.fetchTextUrl(index + 'astrbot/');
      const regex = /astrbot[-_](\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)[^"'<>\s]*?\.(?:whl|tar\.gz|zip)/gi;
      for (const match of text.matchAll(regex)) versions.add(normalizeRuntimeVersion(match[1]));
    } catch {}
    if (!versions.size) {
      try {
        const data = await this.fetchJsonUrl('https://pypi.org/pypi/astrbot/json');
        for (const key of Object.keys(data.releases || {})) versions.add(normalizeRuntimeVersion(key));
      } catch {}
    }
    const list = [...versions].filter((value) => value && isStableRuntimeVersion(value)).sort(compareRuntimeTags);
    if (!list.length) throw Object.assign(new Error('could not load AstrBot versions from the update source'), { status: 502 });
    return { local: false, source: raw, versions: list, latest: list[0] };
  }
  async napcatLocalPackage(source) {
    const raw = String(source || '').trim();
    let base = path.resolve(raw);
    let stat;
    try { stat = await fsp.stat(base); } catch { throw Object.assign(new Error('local NapCat source not found'), { status: 400 }); }
    if (stat.isFile()) {
      if (!/\.zip$/i.test(base)) throw Object.assign(new Error('local NapCat source must be a zip file'), { status: 400 });
      return { file: base };
    }
    let entries = [];
    try { entries = await fsp.readdir(base); } catch {}
    const preferred = entries.find((name) => /^NapCat\.Shell\.zip$/i.test(name));
    const any = entries.find((name) => /\.zip$/i.test(name));
    const name = preferred || any;
    if (!name) throw Object.assign(new Error('NapCat.Shell.zip not found in local source'), { status: 400 });
    return { file: path.join(base, name) };
  }
  async napcatCatalog(source) {
    const raw = String(source || '').trim();
    if (isLocalRuntimeSource(raw)) {
      const pkg = await this.napcatLocalPackage(raw);
      return { local: true, source: raw, releases: [], latest: { tag: 'local', local: true, file: pkg.file } };
    }
    const prefix = runtimeSourceWithSlash(raw);
    const apiUrl = /^https:\/\/api\.github\.com\//i.test(raw)
      ? runtimeSourceWithSlash(raw) + 'repos/NapNeko/NapCatQQ/releases?per_page=30'
      : prefix + 'https://api.github.com/repos/NapNeko/NapCatQQ/releases?per_page=30';
    const list = await this.fetchJsonUrl(apiUrl, 20000);
    const releases = [];
    for (const rel of Array.isArray(list) ? list : []) {
      if (!rel || rel.prerelease || !rel.tag_name) continue;
      const asset = (rel.assets || []).find((item) => item && item.name === 'NapCat.Shell.zip');
      if (!asset || !asset.browser_download_url) continue;
      const tag = runtimeTagFor(rel.tag_name);
      if (!tag) continue;
      releases.push({ tag, assetName: asset.name, assetUrl: asset.browser_download_url, sha256: String(asset.digest || '').replace(/^sha256:/i, ''), local: false });
    }
    releases.sort((a, b) => compareRuntimeTags(a.tag, b.tag));
    if (!releases.length) throw Object.assign(new Error('could not load NapCat releases from the update source'), { status: 502 });
    return { local: false, source: raw, releases, latest: releases[0] };
  }
  async runtimeVersions(type) {
    if (type !== 'a' && type !== 'n') throw Object.assign(new Error('invalid runtime type'), { status: 400 });
    const source = (await this.runtimeSources())[type].source;
    const installed = await this.runtimeOptions(type);
    if (type === 'a') {
      const catalog = await this.astrbotCatalog(source);
      return { type, source, local: catalog.local, installed, remote: catalog.versions.map((version) => ({ tag: 'v' + version, version })).slice(0, 50), latest: { tag: 'v' + catalog.latest, version: catalog.latest, local: catalog.local } };
    }
    const catalog = await this.napcatCatalog(source);
    return { type, source, local: catalog.local, installed, remote: catalog.releases.slice(0, 50), latest: catalog.latest };
  }
  async napcatRuntimeVersion(dir) {
    try {
      const text = await fsp.readFile(path.join(dir, 'napcat.mjs'), 'utf8');
      const match = /typeof\s+\w+\s*<\s*"u"\s*&&\s*"([^"]+)"\s*\|\|\s*"1\.0\.0-dev"/.exec(text);
      return normalizeRuntimeVersion(match ? match[1] : '');
    } catch { return ''; }
  }
  async probeDownloadUrl(url, timeoutMs = 8000) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'astriax-native/0.1' }, signal: AbortSignal.timeout(timeoutMs) });
      return response.ok;
    } catch { return false; }
  }
  async downloadRuntimeFile(url, dest, expectedSha, job) {
    const response = await fetch(url, { headers: { 'user-agent': 'astriax-native/0.1' }, signal: AbortSignal.timeout(30 * 60 * 1000) });
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
    const total = Number(response.headers.get('content-length') || 0) || 0;
    const chunks = [];
    let got = 0;
    const hash = createHash('sha256');
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const chunk = Buffer.from(value);
        chunks.push(chunk);
        got += chunk.length;
        hash.update(chunk);
        if (job) { job.bytes = got; job.total = total || undefined; }
      }
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      chunks.push(buffer);
      got = buffer.length;
      hash.update(buffer);
    }
    const digest = hash.digest('hex');
    if (expectedSha && digest.toLowerCase() !== String(expectedSha).toLowerCase()) throw new Error('download checksum mismatch');
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, Buffer.concat(chunks));
    if (job) { job.bytes = got; job.digest = digest; }
    return { bytes: got, digest };
  }
  async startRuntimeInstall(type, tag) {
    if (type !== 'a' && type !== 'n') throw Object.assign(new Error('invalid runtime type'), { status: 400 });
    const active = [...this.jobs.values()].find((job) => job.kind === 'runtime-install' && job.type === type && job.status === 'running');
    if (active) throw Object.assign(new Error('this runtime type is already installing'), { status: 409 });
    const job = { id: 'runtime-' + type + '-' + Date.now(), kind: 'runtime-install', type, tag: runtimeTagFor(tag) || '', status: 'running', step: 'preparing', startedAt: nowIso(), finishedAt: null, error: null, result: null };
    this.jobs.set(job.id, job);
    void this.runRuntimeInstall(job, type, job.tag).catch((error) => {
      job.status = 'error';
      job.error = error && error.message ? error.message : String(error);
      job.finishedAt = nowIso();
      job.step = 'failed';
    });
    return job;
  }
  async runRuntimeInstall(job, type, tag) {
    try {
      const source = (await this.runtimeSources())[type].source;
      job.result = type === 'a' ? await this.installAstrBotRuntime(job, source, tag) : await this.installNapcatRuntime(job, source, tag);
      job.status = 'done';
      job.step = 'done';
      job.finishedAt = nowIso();
    } catch (error) {
      job.status = 'error';
      job.error = error && error.message ? error.message : String(error);
      job.step = 'failed';
      job.finishedAt = nowIso();
    }
  }
  async installAstrBotRuntime(job, source, tag) {
    const catalog = await this.astrbotCatalog(source);
    const version = normalizeRuntimeVersion(tag) || catalog.latest;
    if (!version) throw new Error('AstrBot version is required');
    const finalTag = 'v' + version;
    const finalDir = path.join(this.runtimeRoot, 'a', finalTag);
    if (existsSync(finalDir)) return { type: 'a', tag: finalTag, version, dir: finalDir, alreadyInstalled: true, source };
    const stageDir = finalDir + '.stage-' + randomBytes(3).toString('hex');
    await fsp.rm(stageDir, { recursive: true, force: true });
    await fsp.mkdir(path.dirname(stageDir), { recursive: true });
    job.step = 'pip install ' + finalTag;
    const pythonExe = path.join(this.pythonRoot, 'python.exe');
    if (!existsSync(pythonExe)) throw new Error('Python runtime is not installed');
    const args = ['-m', 'pip', 'install', '--no-warn-script-location', '--disable-pip-version-check', '--target', stageDir, 'astrbot==' + version];
    if (catalog.local) {
      const local = path.resolve(String(source || '').trim());
      let stat;
      try { stat = await fsp.stat(local); } catch { throw new Error('local AstrBot source not found'); }
      args.push('--no-index', '--find-links', stat.isDirectory() ? local : path.dirname(local));
    } else {
      args.push('-i', String(source || 'https://pypi.org/simple/'));
    }
    const env = {
      ...process.env,
      PYTHONHOME: this.pythonRoot,
      PATH: this.pythonRoot + ';' + (process.env.PATH || ''),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PIP_CACHE_DIR: path.join(this.dataRoot, 'cache', 'pip'),
      PIP_DISABLE_PIP_VERSION_CHECK: '1',
    };
    try {
      await execFileAsync(pythonExe, args, { windowsHide: true, timeout: 30 * 60 * 1000, maxBuffer: 64 * 1024 * 1024, env });
    } catch (error) {
      await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => {});
      throw new Error('pip install failed: ' + (error && error.message ? error.message : String(error)));
    }
    if (!existsSync(path.join(stageDir, 'astrbot'))) {
      await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => {});
      throw new Error('pip install finished but astrbot/ was not created');
    }
    job.step = 'verify ' + finalTag;
    await writeJson(path.join(stageDir, 'runtime.json'), { type: 'a', tag: finalTag, version, source, installedAt: nowIso() });
    try { await fsp.rename(stageDir, finalDir); }
    catch (error) {
      if (existsSync(finalDir)) await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => {});
      else throw error;
    }
    let providerAdapter = null;
    let providerAdapterError = null;
    try { providerAdapter = await this.installDshProviderAdapter(finalTag); }
    catch (error) { providerAdapterError = error && error.message ? error.message : String(error); }
    return { type: 'a', tag: finalTag, version, dir: finalDir, source, providerAdapter, providerAdapterError };
  }
  async installNapcatRuntime(job, source, tag) {
    const catalog = await this.napcatCatalog(source);
    let archive = '';
    let release = null;
    let finalTag = runtimeTagFor(tag);
    if (catalog.local) {
      archive = catalog.latest.file;
    } else {
      const wanted = normalizeRuntimeVersion(tag);
      release = wanted ? catalog.releases.find((item) => normalizeRuntimeVersion(item.tag) === wanted) : catalog.latest;
      if (!release) throw new Error('NapCat version not found in the update source');
      finalTag = release.tag;
      archive = path.join(this.downloadDir, 'napcat-' + release.tag + '.zip');
      if (!existsSync(archive)) {
        job.step = 'download NapCat ' + release.tag;
        const assetBase = /^https:\/\/api\.github\.com\//i.test(String(source || '')) ? '' : source;
        let urls;
        if (assetBase) urls = [proxyRuntimeAsset(assetBase, release.assetUrl), release.assetUrl, 'https://gh-proxy.com/' + release.assetUrl, 'https://cors.isteed.cc/' + release.assetUrl];
        else {
          const directReachable = await this.probeDownloadUrl(release.assetUrl, 8000);
          urls = directReachable ? [release.assetUrl, 'https://gh-proxy.com/' + release.assetUrl, 'https://cors.isteed.cc/' + release.assetUrl] : ['https://gh-proxy.com/' + release.assetUrl, 'https://cors.isteed.cc/' + release.assetUrl, release.assetUrl];
        }
        let lastError = null;
        for (const downloadUrl of [...new Set(urls)]) {
          try {
            await this.downloadRuntimeFile(downloadUrl, archive, release.sha256, job);
            lastError = null;
            break;
          } catch (error) { lastError = error; }
        }
        if (lastError) throw lastError;
      }
    }
    const stageDir = path.join(this.runtimeRoot, 'n', finalTag + '.stage-' + randomBytes(3).toString('hex'));
    await fsp.rm(stageDir, { recursive: true, force: true });
    await fsp.mkdir(stageDir, { recursive: true });
    job.step = 'extract NapCat ' + finalTag;
    const tool = process.platform === 'win32' ? 'tar.exe' : 'tar';
    await execFileAsync(tool, ['-x', '-f', archive, '-C', stageDir], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    let contentRoot = stageDir;
    if (!existsSync(path.join(contentRoot, 'napcat.mjs'))) {
      const entries = await fsp.readdir(stageDir, { withFileTypes: true });
      const dirs = entries.filter((entry) => entry.isDirectory());
      if (dirs.length === 1) contentRoot = path.join(stageDir, dirs[0].name);
    }
    const required = ['napcat.mjs', 'NapCatWinBootMain.exe', 'NapCatWinBootHook.dll', 'qqnt.json'];
    for (const name of required) if (!existsSync(path.join(contentRoot, name))) throw new Error('NapCat package is incomplete: ' + name);
    const detected = await this.napcatRuntimeVersion(contentRoot);
    if (!release) finalTag = finalTag || runtimeTagFor(detected) || 'v-local-' + Date.now();
    const finalDir = path.join(this.runtimeRoot, 'n', finalTag);
    if (existsSync(finalDir)) {
      await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => {});
      return { type: 'n', tag: finalTag, version: detected, dir: finalDir, alreadyInstalled: true, source };
    }
    await writeJson(path.join(contentRoot, 'runtime.json'), { type: 'n', tag: finalTag, version: detected, source, installedAt: nowIso() });
    if (contentRoot !== stageDir) {
      await fsp.rename(contentRoot, finalDir);
      await fsp.rm(stageDir, { recursive: true, force: true }).catch(() => {});
    } else {
      await fsp.rename(stageDir, finalDir);
    }
    return { type: 'n', tag: finalTag, version: detected, dir: finalDir, source };
  }


  async startPythonInstall() {
    const active = [...this.jobs.values()].find((job) => job.kind === 'python-install' && job.status === 'running');
    if (active) throw Object.assign(new Error('Python is already installing'), { status: 409 });
    const job = { id: 'python-' + Date.now(), kind: 'python-install', type: 'python', status: 'running', step: 'prepare Python', startedAt: nowIso(), finishedAt: null, error: null, result: null };
    this.jobs.set(job.id, job);
    void this.runPythonInstall(job).catch((error) => {
      job.status = 'error';
      job.step = 'failed';
      job.error = error && error.message ? error.message : String(error);
      job.finishedAt = nowIso();
    });
    return job;
  }
  async runPythonInstall(job) {
    try {
      job.result = await this.installPythonRuntime(job);
      job.status = 'done';
      job.step = 'done';
      job.finishedAt = nowIso();
    } catch (error) {
      job.status = 'error';
      job.step = 'failed';
      job.error = error && error.message ? error.message : String(error);
      job.finishedAt = nowIso();
      throw error;
    }
  }
  async installPythonRuntime(job) {
    const pythonExe = path.join(this.pythonRoot, 'python.exe');
    if (existsSync(pythonExe)) return { alreadyInstalled: true, path: pythonExe };
    const zip = path.join(this.downloadDir, 'python-3.12.10-embed-amd64.zip');
    const urls = [
      'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip',
      'https://mirrors.huaweicloud.com/python/3.12.10/python-3.12.10-embed-amd64.zip',
    ];
    job.step = 'download Python 3.12.10';
    if (!existsSync(zip)) {
      let lastError = null;
      for (const url of urls) {
        try { await this.downloadRuntimeFile(url, zip, '', job); lastError = null; break; }
        catch (error) { lastError = error; }
      }
      if (lastError) throw lastError;
    }
    job.step = 'extract Python';
    await fsp.rm(this.pythonRoot, { recursive: true, force: true });
    await fsp.mkdir(this.pythonRoot, { recursive: true });
    const tool = process.platform === 'win32' ? 'tar.exe' : 'tar';
    await execFileAsync(tool, ['-x', '-f', zip, '-C', this.pythonRoot], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    const entries = await fsp.readdir(this.pythonRoot);
    const pthName = entries.find((name) => /^python\d+\._pth$/i.test(name));
    if (pthName) {
      const pthFile = path.join(this.pythonRoot, pthName);
      let text = await fsp.readFile(pthFile, 'utf8');
      if (!/^import site\s*$/m.test(text)) text += '\nimport site\n';
      if (!/^Lib[\\/]site-packages\s*$/m.test(text)) text += 'Lib\\site-packages\n';
      await fsp.writeFile(pthFile, text, 'utf8');
    }
    const getPip = path.join(this.downloadDir, 'get-pip.py');
    job.step = 'download pip bootstrap';
    if (!existsSync(getPip)) await this.downloadRuntimeFile('https://bootstrap.pypa.io/get-pip.py', getPip, '', job);
    const py = path.join(this.pythonRoot, 'python.exe');
    if (!existsSync(py)) throw new Error('Python executable was not extracted');
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PATH: this.pythonRoot + ';' + (process.env.PATH || '') };
    job.step = 'install pip';
    await execFileAsync(py, [getPip, '--no-warn-script-location'], { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024, env });
    job.step = 'install build tools';
    try { await execFileAsync(py, ['-m', 'pip', 'install', '--no-warn-script-location', '--disable-pip-version-check', 'setuptools', 'wheel'], { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024, env }); } catch {}
    const sitePackages = path.join(this.pythonRoot, 'Lib', 'site-packages');
    await fsp.mkdir(sitePackages, { recursive: true });
    const siteCustomize = [
      'import os, sys',
      '_p = os.environ.get("MXBOT_SITE")',
      'if _p and _p not in sys.path:',
      '    sys.path.insert(0, _p)',
      'if _p:',
      '    for _s in ("win32", os.path.join("win32", "lib"), "pythonwin"):',
      '        _d = os.path.join(_p, _s)',
      '        if os.path.isdir(_d) and _d not in sys.path:',
      '            sys.path.append(_d)',
      '    try:',
      '        import pywin32_bootstrap',
      '    except ImportError:',
      '        pass',
      '',
    ].join('\n');
    await fsp.writeFile(path.join(sitePackages, 'sitecustomize.py'), siteCustomize, 'utf8');
    await writeJson(path.join(this.pythonRoot, 'python-runtime.json'), { version: '3.12.10', installedAt: nowIso() });
    return { path: py, version: '3.12.10' };
  }
  async installAstrBotGateway(recOrId) {
    const rec = typeof recOrId === 'string' ? await this.findInstance(recOrId) : recOrId;
    if (!rec || rec.type !== 'a') throw Object.assign(new Error('AstrBot instance not found'), { status: 404 });
    const source = path.join(this.pluginRoot, 'assets', 'astrbot_plugin_dsh_gateway');
    const target = path.join(rec.dir, 'data', 'plugins', 'astrbot_plugin_dsh_gateway');
    if (!existsSync(source)) throw new Error('DSH AstrBot gateway asset is missing: ' + source);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.cp(source, target, { recursive: true, force: true });
    return { installed: true, dir: target };
  }
  async sendQqMessage(sessionId, text, instanceId) {
    const raw = String(sessionId || '').replace(/^provider:/, '');
    if (!raw) throw Object.assign(new Error('session is required'), { status: 400 });
    if (!String(text || '').trim()) throw Object.assign(new Error('text is required'), { status: 400 });
    const [manifest, state] = await Promise.all([this.readInstances(), this.readState()]);
    const candidates = manifest.instances.filter((item) => item.type === 'a');
    const rec = instanceId ? candidates.find((item) => item.id === instanceId) : (candidates.find((item) => state[item.id] && this.pidAlive(state[item.id].pid)) || candidates.find((item) => state[item.id]));
    if (!rec || rec.type !== 'a') throw Object.assign(new Error('running AstrBot instance not found'), { status: 409 });
    await this.installAstrBotGateway(rec);
    let token = '';
    try { token = (await fsp.readFile(path.join(os.homedir(), '.dsh', 'qq-bridge-token.txt'), 'utf8')).trim(); } catch {}
    if (!token) throw Object.assign(new Error('bridge token not found'), { status: 409 });
    const response = await fetch('http://127.0.0.1:' + (rec.port + 1000) + '/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-gateway-token': token },
      body: JSON.stringify({ session: raw, text: String(text) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || ('AstrBot gateway HTTP ' + response.status)), { status: 502 });
    try {
      await fetch('http://127.0.0.1:' + this.bridgePort + '/transcript', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ conversationId: String(sessionId), role: 'user', text: String(text), senderName: 'DSH Panel' }) });
    } catch {}
    return { ...data, session: raw, instanceId: rec.id };
  }

  async applyAstrBotConsolePatches(tag) {
    const dir = await this.runtimeDir('a', tag);
    const results = [];
    const localFile = path.join(dir, 'astrbot', 'core', 'computer', 'booters', 'local.py');
    if (existsSync(localFile)) {
      const backup = localFile + '.bak-dsh-console';
      if (!existsSync(backup)) await fsp.copyFile(localFile, backup);
      let text = await fsp.readFile(localFile, 'utf8');
      if (!text.includes('CREATE_NO_WINDOW')) {
        text = text.replace('                    stdout=subprocess.DEVNULL,\n                    stderr=subprocess.DEVNULL,\n                )', '                    stdout=subprocess.DEVNULL,\n                    stderr=subprocess.DEVNULL,\n                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),\n                )');
        text = text.replace('                stdout=subprocess.PIPE,\n                stderr=subprocess.PIPE,\n            )', '                stdout=subprocess.PIPE,\n                stderr=subprocess.PIPE,\n                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),\n            )');
        text = text.replace('            process_kwargs["creationflags"] = getattr(\n                subprocess,\n                "CREATE_NEW_PROCESS_GROUP",\n                0,\n            )', '            process_kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)');
        await fsp.writeFile(localFile, text, 'utf8');
      }
      results.push({ file: localFile, patched: true });
    }
    const restartFile = path.join(dir, 'astrbot', 'core', 'process_restart.py');
    if (existsSync(restartFile)) {
      const backup = restartFile + '.bak-dsh-console';
      if (!existsSync(backup)) await fsp.copyFile(restartFile, backup);
      let text = await fsp.readFile(restartFile, 'utf8');
      if (text.includes('CREATE_NEW_CONSOLE')) {
        text = text.replace('subprocess.CREATE_NEW_CONSOLE', 'getattr(subprocess, "CREATE_NO_WINDOW", 0)');
        await fsp.writeFile(restartFile, text, 'utf8');
      }
      results.push({ file: restartFile, patched: true });
    }
    return results;
  }

  async installDshProviderAdapter(tag) {
    if (!existsSync(this.providerAsset)) throw new Error('DSH provider asset is missing: ' + this.providerAsset);
    const tags = tag ? [String(tag)] : await this.runtimeOptions('a');
    const results = [];
    for (const item of tags) {
      const dir = await this.runtimeDir('a', item);
      const providerFile = path.join(dir, 'astrbot', 'core', 'provider', 'sources', 'dsh_bridge_source.py');
      await fsp.mkdir(path.dirname(providerFile), { recursive: true });
      await fsp.copyFile(this.providerAsset, providerFile);
      const managerFile = path.join(dir, 'astrbot', 'core', 'provider', 'manager.py');
      let text = await fsp.readFile(managerFile, 'utf8');
      if (!text.includes('case "dsh_bridge"')) {
        const anchor = '            case "openai_chat_completion":\n';
        const insert = '            case "dsh_bridge":\n                from .sources.dsh_bridge_source import (\n                    ProviderDSHBridge as ProviderDSHBridge,\n                )\n';
        if (!text.includes(anchor)) throw new Error('provider manager anchor not found in ' + item);
        text = text.replace(anchor, insert + anchor);
        await fsp.writeFile(managerFile, text, 'utf8');
      }
      try { await this.applyAstrBotConsolePatches(item); } catch (error) { console.error('[astriax-native] console patch skipped: ' + (error && error.message ? error.message : error)); }
      results.push({ tag: item, dir, installed: true });
    }
    return results;
  }
  async configureDshProvider(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'a') throw Object.assign(new Error('AstrBot instance not found'), { status: 404 });
    const cfgPath = path.join(rec.dir, 'data', 'cmd_config.json');
    if (!existsSync(cfgPath)) throw Object.assign(new Error('start the AstrBot instance once to generate cmd_config.json'), { status: 409 });
    const cfg = await readJson(cfgPath, null);
    if (!cfg || typeof cfg !== 'object') throw Object.assign(new Error('invalid AstrBot config'), { status: 500 });
    const tokenPath = path.join(os.homedir(), '.dsh', 'qq-bridge-token.txt');
    let token = '';
    try { token = (await fsp.readFile(tokenPath, 'utf8')).trim(); } catch {}
    if (!token) throw Object.assign(new Error('bridge token not found; start the DSH bridge first'), { status: 409 });
    if (!Array.isArray(cfg.provider_sources)) cfg.provider_sources = [];
    if (!Array.isArray(cfg.provider)) cfg.provider = [];
    cfg.provider_sources = cfg.provider_sources.filter((item) => !(item && item.id === 'dsh'));
    cfg.provider_sources.push({ id: 'dsh', provider: 'dsh', type: 'dsh_bridge', provider_type: 'chat_completion', api_base: 'http://127.0.0.1:' + this.bridgePort, key: ['dsh'], token, timeout: 390, custom_headers: {}, enable: true });
    cfg.provider = cfg.provider.filter((item) => !(item && item.id === 'dsh/dsh'));
    cfg.provider.push({ id: 'dsh/dsh', enable: true, provider_source_id: 'dsh', model: 'dsh', modalities: ['text', 'tool_use'], custom_extra_body: {}, max_context_tokens: 0 });
    const backup = cfgPath + '.bak-dsh-provider-' + nowIso().replace(/[:.]/g, '-');
    await fsp.copyFile(cfgPath, backup);
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    return { configured: true, backup, provider: 'dsh/dsh' };
  }


  async dshProviderStatus(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'a') throw Object.assign(new Error('AstrBot instance not found'), { status: 404 });
    const runtimeDir = await this.runtimeDir(rec.type, rec.runtimeTag).catch(() => '');
    const providerFile = runtimeDir ? path.join(runtimeDir, 'astrbot', 'core', 'provider', 'sources', 'dsh_bridge_source.py') : '';
    const managerFile = runtimeDir ? path.join(runtimeDir, 'astrbot', 'core', 'provider', 'manager.py') : '';
    let managerPatched = false;
    try { managerPatched = (await fsp.readFile(managerFile, 'utf8')).includes('case "dsh_bridge"'); } catch {}
    const cfgPath = path.join(rec.dir, 'data', 'cmd_config.json');
    const cfg = await readJson(cfgPath, null);
    const sources = cfg && Array.isArray(cfg.provider_sources) ? cfg.provider_sources : [];
    const providers = cfg && Array.isArray(cfg.provider) ? cfg.provider : [];
    const source = sources.find((item) => item && item.id === 'dsh') || null;
    const provider = providers.find((item) => item && item.id === 'dsh/dsh') || null;
    const safeSource = source ? { ...source, token: source.token ? '***' : '' } : null;
    const tokenPath = path.join(os.homedir(), '.dsh', 'qq-bridge-token.txt');
    let tokenExists = false;
    try { tokenExists = Boolean((await fsp.readFile(tokenPath, 'utf8')).trim()); } catch {}
    let bridgeReachable = false;
    try { bridgeReachable = await this.probeHttp('http://127.0.0.1:' + this.bridgePort + '/health', 1500); } catch {}
    return {
      instanceId: rec.id,
      runtimeTag: rec.runtimeTag,
      adapterInstalled: Boolean(providerFile && existsSync(providerFile) && managerPatched),
      providerFile: Boolean(providerFile && existsSync(providerFile)),
      managerPatched,
      configExists: Boolean(cfg),
      providerConfigured: Boolean(provider && source),
      providerSource: safeSource,
      provider,
      tokenExists,
      bridgeReachable,
      bridgePort: this.bridgePort,
      ok: Boolean(providerFile && existsSync(providerFile) && managerPatched && provider && source && tokenExists && bridgeReachable),
    };
  }
  async autoConfigureDshProvider(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'a') throw Object.assign(new Error('AstrBot instance not found'), { status: 404 });
    const adapter = await this.installDshProviderAdapter(rec.runtimeTag);
    const cfgPath = path.join(rec.dir, 'data', 'cmd_config.json');
    if (!existsSync(cfgPath)) {
      return { adapter, configured: false, needsStart: true, status: await this.dshProviderStatus(id) };
    }
    const configured = await this.configureDshProvider(id);
    const state = await this.readState();
    const running = Boolean(state[id] && this.pidAlive(state[id].pid));
    return { adapter, configured: true, configuredProvider: configured, restartRequired: running, status: await this.dshProviderStatus(id) };
  }

  async bridgeHealth() {
    try {
      const response = await fetch('http://127.0.0.1:' + this.bridgePort + '/health');
      const data = await response.json();
      return { http: response.ok, ready: Boolean(data && data.ok !== false && data.ready), data };
    } catch (error) {
      return { http: false, ready: false, error: error && error.message ? error.message : String(error) };
    }
  }

  async getSettings() {
    const settings = await readJson(this.settingsFile, {});
    const defaultRoot = path.join(this.dataRoot, 'qq-work');
    const configured = normText(settings && settings.workspaceRoot, defaultRoot);
    const workspaceRoot = configured.includes('\uFFFD') ? defaultRoot : configured;
    if (configured !== workspaceRoot) await writeJson(this.settingsFile, { ...(settings && typeof settings === 'object' ? settings : {}), workspaceRoot });
    return { ...(settings && typeof settings === 'object' ? settings : {}), workspaceRoot };
  }
  async workspaceInfo() {
    const settings = await this.getSettings();
    return { workspaceRoot: settings.workspaceRoot, defaultRoot: path.join(this.dataRoot, 'qq-work'), exists: existsSync(settings.workspaceRoot) };
  }
  async setWorkspaceRoot(value) {
    const settings = await this.getSettings();
    const next = String(value || '').trim() || path.join(this.dataRoot, 'qq-work');
    if (!path.isAbsolute(next)) throw Object.assign(new Error('workspace path must be absolute'), { status: 400 });
    if (next.includes('\uFFFD')) throw Object.assign(new Error('workspace path contains invalid characters; choose it again'), { status: 400 });
    try {
      const stat = await fsp.stat(next);
      if (!stat.isDirectory()) throw new Error('workspace path is not a directory');
    } catch (error) {
      if (error && error.code === 'ENOENT') await fsp.mkdir(next, { recursive: true });
      else throw error;
    }
    const changed = path.resolve(next) !== path.resolve(settings.workspaceRoot);
    await writeJson(this.settingsFile, { ...settings, workspaceRoot: path.resolve(next) });
    let bridgeRestarted = false;
    if (changed && (await this.bridgeHealth()).ready) {
      const pid = await this.portPid(this.bridgePort);
      if (pid) await this.killPid(pid);
      await sleep(900);
      await this.ensureBridge();
      bridgeRestarted = true;
    }
    return { ...(await this.workspaceInfo()), changed, bridgeRestarted };
  }
  async pickWorkspaceFolder() {
    if (process.platform !== 'win32') throw Object.assign(new Error('folder picker is only available on Windows'), { status: 400 });
    const script = "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '选择 DSH QQ 工作区'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $bytes = [Text.Encoding]::UTF8.GetBytes($d.SelectedPath); [Console]::Write([Convert]::ToBase64String($bytes)) }";
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeout: 120000, windowsHide: false, maxBuffer: 1024 * 1024 });
    const encoded = String(stdout || '').trim();
    const selected = encoded ? Buffer.from(encoded, 'base64').toString('utf8').trim() : '';
    return selected ? { path: selected } : { canceled: true };
  }

  async ensureQqProfile() {
    const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
    const profiles = path.join(dshHome, 'profiles');
    const qqDir = path.join(profiles, 'qq');
    if (existsSync(path.join(qqDir, 'package.json'))) return { created: false, dir: qqDir, profile: 'qq' };
    const sdkDir = path.join(profiles, 'sdk');
    if (!existsSync(path.join(sdkDir, 'package.json'))) throw new Error('DSH sdk profile not found: ' + sdkDir);
    await fsp.mkdir(qqDir, { recursive: true });
    const sdkPkg = await readJson(path.join(sdkDir, 'package.json'), {});
    const desktopModules = path.join(profiles, 'desktop', 'node_modules');
    let desktopDeps = {};
    if (existsSync(desktopModules)) {
      try {
        const desktopPkg = await readJson(path.join(profiles, 'desktop', 'package.json'), {});
        desktopDeps = desktopPkg && desktopPkg.dependencies && typeof desktopPkg.dependencies === 'object' ? desktopPkg.dependencies : {};
      } catch {}
    }
    const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-sdk-app', ...Object.keys(desktopDeps)];
    const pkg = { name: 'dsh-profile-qq', private: true, dependencies: desktopDeps, dsh: { profile: { bundles: [...new Set(bundles)] } } };
    await fsp.writeFile(path.join(qqDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    for (const name of ['cordis.patch.yml', 'cordis.yml', 'pnpm-workspace.yaml']) {
      const src = path.join(sdkDir, name);
      if (existsSync(src)) await fsp.copyFile(src, path.join(qqDir, name));
    }
    if (existsSync(desktopModules)) {
      try { await fsp.symlink(desktopModules, path.join(qqDir, 'node_modules'), 'junction'); } catch {}
    }
    return { created: true, dir: qqDir, profile: 'qq', bundles };
  }
  async ensureBridge() {
    const healthUrl = 'http://127.0.0.1:' + this.bridgePort + '/health';
    if ((await this.bridgeHealth()).ready) return { running: true, alreadyRunning: true, port: this.bridgePort };
    const profileInfo = await this.ensureQqProfile().catch(() => null);
    const profile = process.env.DSH_BRIDGE_PROFILE || (profileInfo ? profileInfo.profile : 'sdk');
    const resources = process.resourcesPath || path.join(path.dirname(process.execPath), 'resources');
    const electron = process.env.DSH_ELECTRON || process.execPath;
    const cliJs = process.env.DSH_CLI_JS || path.join(resources, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
    const nodeFromResources = path.join(resources, 'runtime', 'primary-runtime', 'dependencies', 'node', 'bin', 'node.exe');
    const node = process.env.DSH_NODE || (existsSync(nodeFromResources) ? nodeFromResources : process.execPath);
    const server = path.join(this.pluginRoot, 'bridge', 'server.mjs');
    if (!existsSync(server)) throw new Error('bridge server not found: ' + server);
    const settings = await this.getSettings();
    const workspaceRoot = settings.workspaceRoot;
    await fsp.mkdir(path.join(this.dataRoot, 'bridge'), { recursive: true });
    await fsp.mkdir(workspaceRoot, { recursive: true });
    const env = {
      ...process.env,
      DSH_ASTRIAX_BRIDGE_ROOT: this.dataRoot,
      DSH_WORKSPACE_ROOT: workspaceRoot,
      DSH_BRIDGE_PORT: String(this.bridgePort),
      DSH_BRIDGE_PROFILE: profile,
      DSH_PROFILE: profile,
      DSH_PROVIDER: process.env.DSH_PROVIDER || 'deepseek-official',
      DSH_MODEL: process.env.DSH_MODEL || 'deepseek-flash',
      DSH_ELECTRON: electron,
      DSH_CLI_JS: cliJs,
    };
    const command = node && existsSync(node) ? node : electron;
    if (command === electron && !env.ELECTRON_RUN_AS_NODE) env.ELECTRON_RUN_AS_NODE = '1';
    const logFile = path.join(this.dataRoot, 'bridge', 'auto-start.log');
    const out = fs.openSync(logFile, 'a');
    const child = spawn(command, [server], { cwd: this.dataRoot, env, windowsHide: true, detached: true, stdio: ['ignore', out, out] });
    child.unref();
    try { fs.closeSync(out); } catch {}
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await sleep(1000);
      if ((await this.bridgeHealth()).ready) return { running: true, started: true, port: this.bridgePort, profile, workspaceRoot, pid: child.pid };
    }
    throw new Error('bridge did not become ready; see ' + logFile);
  }

  async configureLocalEmbedding(id) {
    const rec = await this.findInstance(id);
    if (!rec || rec.type !== 'a') throw Object.assign(new Error('AstrBot instance not found'), { status: 404 });
    const cfgPath = path.join(rec.dir, 'data', 'cmd_config.json');
    const cfg = await readJson(cfgPath, null);
    if (!cfg || typeof cfg !== 'object') throw Object.assign(new Error('start AstrBot once first'), { status: 409 });
    if (!Array.isArray(cfg.provider_sources)) cfg.provider_sources = [];
    if (!Array.isArray(cfg.provider)) cfg.provider = [];
    cfg.provider_sources = cfg.provider_sources.filter((item) => !(item && item.id === 'dsh-embedding'));
    cfg.provider_sources.push({ id: 'dsh-embedding', type: 'openai_embedding', provider_type: 'embedding', embedding_api_base: 'http://127.0.0.1:' + this.bridgePort + '/v1', embedding_api_key: 'dsh', embedding_model: 'dsh-local-hash', timeout: 30, enable: true });
    cfg.provider = cfg.provider.filter((item) => !(item && item.id === 'dsh-embedding/dsh-hash'));
    cfg.provider.push({ id: 'dsh-embedding/dsh-hash', enable: true, provider_source_id: 'dsh-embedding', model: 'dsh-local-hash', modalities: ['text'], custom_extra_body: {}, max_context_tokens: 0 });
    const backup = cfgPath + '.bak-dsh-embedding-' + nowIso().replace(/[:.]/g, '-');
    await fsp.copyFile(cfgPath, backup);
    await fsp.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    const memoryPath = path.join(rec.dir, 'data', 'config', 'astrbot_plugin_memory_companion_config.json');
    let memoryUpdated = false;
    const memory = await readJson(memoryPath, null);
    if (memory && typeof memory === 'object') {
      if (!memory.retrieval || typeof memory.retrieval !== 'object') memory.retrieval = {};
      memory.retrieval.embedding_enabled = true;
      memory.retrieval.embedding_provider_id = 'dsh-embedding/dsh-hash';
      if (!memory.retrieval.mode) memory.retrieval.mode = 'auto';
      await fsp.copyFile(memoryPath, memoryPath + '.bak-dsh-embedding-' + nowIso().replace(/[:.]/g, '-'));
      await fsp.writeFile(memoryPath, JSON.stringify(memory, null, 2) + '\n', 'utf8');
      memoryUpdated = true;
    }
    return { configured: true, embeddingProvider: 'dsh-embedding/dsh-hash', memoryUpdated, backup, restartRequired: true, note: 'offline lexical hash embeddings; no external API key' };
  }

  async readLog(id, lines = 240) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const file = path.join(this.logsDir, String(id) + '.log');
    const count = Math.max(1, Math.min(2000, Number(lines) || 240));
    try {
      const stat = await fsp.stat(file);
      const start = Math.max(0, stat.size - 512 * 1024);
      const handle = await fsp.open(file, 'r');
      try {
        const length = stat.size - start;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, start);
        const text = buffer.toString('utf8').replace(/\r\n/g, '\n');
        return { id, path: file, text: text.split('\n').slice(-count).join('\n'), size: stat.size };
      } finally { await handle.close(); }
    } catch {
      return { id, path: file, text: '', size: 0 };
    }
  }

  async portPid(port) {
    if (process.platform !== 'win32') return null;
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true });
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const columns = line.trim().split(/\s+/);
        if (columns.length >= 5 && (columns[1] || '').endsWith(':' + String(port))) return Number(columns[4]);
      }
    } catch {}
    return null;
  }
  async killPid(pid) {
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) return;
    if (process.platform === 'win32') {
      try { await execFileAsync('taskkill.exe', ['/PID', String(n), '/T', '/F'], { windowsHide: true }); } catch {}
    } else { try { process.kill(n, 'SIGTERM'); } catch {} }
  }
  async waitForPort(port, timeoutMs, alive) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.probeTcp(port, 700)) return true;
      if (alive && !alive()) return false;
      await sleep(500);
    }
    return false;
  }

  async startInstance(id) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    if (this.startWaits.has(id)) throw Object.assign(new Error('instance is starting'), { status: 409 });
    const operation = this.startInternal(rec);
    this.startWaits.set(id, operation);
    try { return await operation; } finally { this.startWaits.delete(id); }
  }

  async hideNapcatConsole() {
    const hider = path.join(this.pluginRoot, 'assets', 'napcat-hide-console.ps1');
    if (!existsSync(hider)) return false;
    await execFileAsync('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', hider, '-Seconds', '3'], { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 });
    return true;
  }

  async startInternal(rec) {
    await this.ensureLayout();
    const state = await this.readState();
    if (state[rec.id] && this.pidAlive(state[rec.id].pid)) throw Object.assign(new Error('instance already running'), { status: 409 });
    if (await this.probeTcp(rec.port, 500)) throw Object.assign(new Error('port is already in use: ' + rec.port), { status: 409 });
    const runtimeDir = await this.runtimeDir(rec.type, rec.runtimeTag);
    if (rec.type === 'a') {
      try {
        await this.installDshProviderAdapter(rec.runtimeTag);
        if (existsSync(path.join(rec.dir, 'data', 'cmd_config.json'))) await this.configureDshProvider(rec.id);
      } catch (error) {
        console.error('[astriax-native] provider auto-config skipped: ' + (error && error.message ? error.message : error));
      }
    }
    if (rec.pair) {
      try {
        if (rec.type === 'a') await this.applyAstrBotPairConfig(rec, rec.pair);
        else if (rec.type === 'n') await this.applyNapcatPairConfig(rec, rec.pair);
      } catch (error) {
        console.error('[astriax-native] pre-start pair config failed: ' + (error && error.message ? error.message : error));
      }
    }
    const logFile = path.join(this.logsDir, String(rec.id) + '.log');
    let command = '';
    let args = [];
    let cwd = rec.dir;
    let env = { ...process.env };
    if (rec.type === 'a') {
      const pythonExe = path.join(this.pythonRoot, 'python.exe');
      if (!existsSync(pythonExe)) throw Object.assign(new Error('Python runtime is not installed'), { status: 400 });
      command = pythonExe;
      args = ['-m', 'astrbot.cli', 'run', '--port', String(rec.port)];
      env = {
        ...env,
        MX_PYTHON: pythonExe,
        PYTHONHOME: this.pythonRoot,
        PATH: this.pythonRoot + ';' + (env.PATH || ''),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        MXBOT_SITE: runtimeDir,
        PYTHONPATH: runtimeDir,
        DSH_GATEWAY_PORT: String(rec.port + 1000),
      };
      await fsp.mkdir(path.join(rec.dir, 'data'), { recursive: true });
      await fsp.writeFile(path.join(rec.dir, '.astrbot'), '', 'utf8').catch(() => {});
    } else if (rec.type === 'n') {
      const injector = path.join(runtimeDir, 'NapCatWinBootMain.exe');
      const hook = path.join(runtimeDir, 'NapCatWinBootHook.dll');
      const mainMjs = path.join(runtimeDir, 'napcat.mjs');
      const qqnt = path.join(runtimeDir, 'qqnt.json');
      for (const file of [injector, hook, mainMjs, qqnt]) if (!existsSync(file)) throw Object.assign(new Error('NapCat runtime is incomplete: ' + file), { status: 500 });
      const qqExe = await this.findQQExe();
      const loadPath = path.join(rec.dir, 'loadNapCat.js');
      const uri = 'file:///' + mainMjs.replace(/\\/g, '/');
      await fsp.writeFile(loadPath, '(async () => {await import("' + uri + '")})()\r\n', 'utf8');
      command = injector;
      args = [qqExe, hook];
      cwd = runtimeDir;
      env = {
        ...env,
        NAPCAT_PATCH_PACKAGE: qqnt,
        NAPCAT_LOAD_PATH: loadPath,
        NAPCAT_INJECT_PATH: hook,
        NAPCAT_LAUNCHER_PATH: injector,
        NAPCAT_MAIN_PATH: mainMjs,
        NAPCAT_WORKDIR: rec.dir,
        NAPCAT_WEBUI_PREFERRED_PORT: String(rec.port),
        ...(rec.webuiToken ? { NAPCAT_WEBUI_SECRET_KEY: rec.webuiToken } : {}),
      };
    } else throw Object.assign(new Error('unsupported instance type'), { status: 400 });
    const out = fs.openSync(logFile, 'a');
    let child;
    try {
      child = spawn(command, args, { cwd, env, windowsHide: true, detached: true, stdio: ['ignore', out, out] });
      child.unref();
    } finally { try { fs.closeSync(out); } catch {} }
    if (!child || !child.pid) throw Object.assign(new Error('process did not start'), { status: 500 });
    let exited = false;
    child.once('exit', () => { exited = true; });
    const ready = await this.waitForPort(rec.port, rec.type === 'a' ? 120000 : 60000, () => !exited);
    if (rec.type === 'n' && ready) {
      try { await this.hideNapcatConsole(); } catch {}
    }
    if (!ready) {
      await this.killPid(child.pid);
      const log = await this.readLog(rec.id, 100);
      throw Object.assign(new Error('start failed or timed out\n' + (log.text || '')), { status: 500 });
    }
    const nextState = await this.readState();
    nextState[rec.id] = { pid: child.pid, type: rec.type, port: rec.port, startedAt: nowIso(), desiredRunning: true, command, cwd };
    await this.writeState(nextState);
    const manifest = await this.readInstances();
    const idx = manifest.instances.findIndex((item) => item.id === rec.id);
    if (idx >= 0) {
      manifest.instances[idx] = { ...manifest.instances[idx], status: 'running', lastStartedAt: nowIso() };
      await this.writeInstances(manifest.instances);
    }
    return { id: rec.id, pid: child.pid, port: rec.port, startedAt: nextState[rec.id].startedAt };
  }

  async findQQExe() {
    const candidates = [process.env.QQ_EXE, 'C:\\Program Files\\Tencent\\QQNT\\QQ.exe', 'C:\\Program Files (x86)\\Tencent\\QQNT\\QQ.exe', 'D:\\QQ\\QQ.exe'].filter(Boolean);
    for (const candidate of candidates) if (existsSync(candidate)) return candidate;
    for (const key of ['HKLM\\SOFTWARE\\WOW6432Node\\Tencent\\QQNT', 'HKLM\\SOFTWARE\\Tencent\\QQNT']) {
      try {
        const { stdout } = await execFileAsync('reg.exe', ['query', key, '/v', 'Install'], { windowsHide: true });
        const match = stdout.match(/REG_SZ\s+(.+)/i);
        if (match) {
          const exe = path.join(match[1].trim().replace(/^"|"$/g, ''), 'QQ.exe');
          if (existsSync(exe)) return exe;
        }
      } catch {}
    }
    throw Object.assign(new Error('QQ.exe not found; set QQ_EXE'), { status: 500 });
  }

  async stopInstance(id) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const state = await this.readState();
    const entry = state[id];
    let pid = entry && entry.pid ? Number(entry.pid) : null;
    if (!this.pidAlive(pid)) pid = await this.portPid(rec.port);
    if (pid && this.pidAlive(pid)) {
      await this.killPid(pid);
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline && await this.probeTcp(rec.port, 500)) await sleep(500);
    }
    state[id] = { ...(entry || {}), pid: null, desiredRunning: false, stoppedAt: nowIso(), port: rec.port, type: rec.type };
    await this.writeState(state);
    const manifest = await this.readInstances();
    const idx = manifest.instances.findIndex((item) => item.id === id);
    if (idx >= 0) {
      manifest.instances[idx] = { ...manifest.instances[idx], status: 'stopped' };
      await this.writeInstances(manifest.instances);
    }
    return { id, stopped: true, pid: pid || null };
  }

  async restartInstance(id) {
    await this.stopInstance(id);
    await sleep(1200);
    return await this.startInstance(id);
  }

  async listConfigFiles(rec) {
    const files = [];
    const root = path.resolve(rec.dir || '');
    const add = async (rel, label) => {
      const abs = path.resolve(root, rel);
      const relative = path.relative(root, abs);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return;
      try {
        const stat = await fsp.stat(abs);
        if (stat.isFile()) files.push({ rel, label, size: stat.size });
      } catch {}
    };
    if (rec.type === 'a') {
      await add('data/cmd_config.json', 'AstrBot 主配置');
    } else if (rec.type === 'n') {
      const names = await listDirs(path.join(rec.dir, 'config')).catch(() => []);
      let entries = [];
      try { entries = await fsp.readdir(path.join(rec.dir, 'config')); } catch {}
      for (const name of entries.sort()) {
        if (/^onebot11_.*\.json$/i.test(name)) await add(path.join('config', name), 'OneBot 连接配置');
        else if (/^napcat_.*\.json$/i.test(name)) await add(path.join('config', name), 'NapCat 配置');
        else if (/^webui\.json$/i.test(name)) await add(path.join('config', name), 'WebUI 配置');
      }
    }
    return files;
  }

  async instanceDetail(id) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const state = await this.readState();
    const instance = await this.projectInstance(rec, state[id]);
    const files = await this.listConfigFiles(rec);
    const runtimeOptions = await this.runtimeOptions(rec.type);
    const manifest = await this.readInstances();
    const candidates = manifest.instances
      .filter((item) => item.type !== rec.type && !item.pair)
      .map((item) => ({ id: item.id, name: item.name, type: item.type, status: item.status, port: item.port }));
    let peer = null;
    if (rec.pair && rec.pair.peerId) {
      const found = manifest.instances.find((item) => item.id === rec.pair.peerId);
      if (found) peer = { id: found.id, name: found.name, type: found.type, status: found.status, port: found.port };
    }
    const backupInfo = await this.listInstanceBackups(rec.id);
    return { instance, files, runtimeOptions, candidates, peer, backups: backupInfo.backups, backupRoot: backupInfo.root, editable: true };
  }

  async readConfigFile(id, rel) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const files = await this.listConfigFiles(rec);
    if (!files.some((item) => item.rel === rel)) throw Object.assign(new Error('config file is not editable'), { status: 400 });
    const text = await fsp.readFile(path.resolve(rec.dir, rel), 'utf8');
    return { rel, text: text.replace(/^\uFEFF/, ''), editable: true };
  }

  async writeConfigFile(id, rel, text) {
    const rec = await this.findInstance(id);
    if (!rec) throw Object.assign(new Error('instance not found'), { status: 404 });
    const files = await this.listConfigFiles(rec);
    if (!files.some((item) => item.rel === rel)) throw Object.assign(new Error('config file is not editable'), { status: 400 });
    let value;
    try { value = JSON.parse(String(text || '').replace(/^\uFEFF/, '')); }
    catch (error) { throw Object.assign(new Error('invalid JSON: ' + error.message), { status: 400 }); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('config root must be an object'), { status: 400 });
    const file = path.resolve(rec.dir, rel);
    const backupDir = path.join(this.dataRoot, 'backups', 'config', String(id));
    await fsp.mkdir(backupDir, { recursive: true });
    const stamp = nowIso().replace(/[:.]/g, '-');
    const backup = path.join(backupDir, stamp + '-' + rel.replace(/[\\/]/g, '_') + '.bak');
    try { await fsp.copyFile(file, backup); } catch {}
    const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
    await fsp.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await fsp.rename(tmp, file);
    return { rel, written: true, backup };
  }

  async bootstrapRuntimes() {
    const key = 'bootstrap';
    const existing = this.jobs.get(key);
    if (existing && existing.status === 'running') return existing;
    const job = { id: key, kind: 'bootstrap', status: 'running', step: '准备复制运行时', startedAt: nowIso(), finishedAt: null, error: null, results: [] };
    this.jobs.set(key, job);
    void this.runBootstrap(job).catch((error) => {
      job.status = 'error';
      job.error = error && error.message ? error.message : String(error);
      job.finishedAt = nowIso();
      console.error('[astriax-native] bootstrap failed:', job.error);
    });
    return job;
  }

  async runBootstrap(job) {
    await this.ensureLayout();
    const source = this.bootstrapSource;
    const sourcePython = path.join(source, 'runtime', 'python');
    const targetPython = this.pythonRoot;
    if (!existsSync(path.join(sourcePython, 'python.exe'))) throw new Error('source Python runtime not found: ' + sourcePython);
    if (!existsSync(path.join(targetPython, 'python.exe'))) {
      job.step = '复制 Python 运行时';
      await copyDirectory(sourcePython, targetPython);
      job.results.push({ kind: 'python', target: targetPython });
    }
    for (const type of ['a', 'n']) {
      const sourceBase = path.join(source, 'runtimes', type);
      const targetBase = path.join(this.runtimeRoot, type);
      const tags = sortTags(await listDirs(sourceBase));
      if (!tags.length) continue;
      for (const tag of tags) {
        const target = path.join(targetBase, tag);
        if (existsSync(target)) continue;
        job.step = '复制 ' + (type === 'a' ? 'AstrBot' : 'NapCat') + ' ' + tag;
        await copyDirectory(path.join(sourceBase, tag), target);
        job.results.push({ kind: type, tag, target });
      }
    }
    job.step = '完成';
    job.status = 'done';
    job.finishedAt = nowIso();
  }

  async watchdogTick() {
    if (this.watchdogRunning) return;
    this.watchdogRunning = true;
    try {
      const [manifest, state] = await Promise.all([this.readInstances(), this.readState()]);
      const tasks = [];
      for (const rec of manifest.instances) {
        const entry = state[rec.id] || {};
        const wanted = entry.desiredRunning === true || (rec.autoStart === true && entry.desiredRunning !== false && !entry.stoppedAt);
        if (!wanted) continue;
        if (this.pidAlive(entry.pid) || this.startWaits.has(rec.id)) continue;
        if (await this.probeTcp(rec.port, 400)) continue;
        const lastFailure = this.watchdogFailures.get(rec.id) || 0;
        if (lastFailure && Date.now() - lastFailure < 60000) continue;
        tasks.push(this.startInstance(rec.id).then(() => this.watchdogFailures.delete(rec.id)).catch((error) => {
          this.watchdogFailures.set(rec.id, Date.now());
          console.error('[astriax-native] watchdog start failed for ' + rec.id + ': ' + (error && error.message ? error.message : error));
        }));
      }
      if (tasks.length) await Promise.allSettled(tasks);
    } finally { this.watchdogRunning = false; }
  }
}
