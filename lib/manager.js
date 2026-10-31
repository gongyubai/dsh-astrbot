import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TYPE_DIR = { a: 'AstrBot', n: 'NapCat' };
const TYPE_LABEL = { a: 'AstrBot', n: 'NapCat' };

function nowIso() { return new Date().toISOString(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function existsSync(p) { try { return fs.existsSync(p); } catch { return false; } }
async function readJson(file, fallback) {
  try {
    const text = (await fsp.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fsp.rename(tmp, file);
}
function normText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function safeId(value) {
  const text = String(value || '');
  return /^[a-zA-Z0-9_-]+$/.test(text) ? text : '';
}
function typeLabel(type) { return TYPE_LABEL[type] || String(type || 'instance'); }

export function defaultDataRoot() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'astriax-manager');
}

export class AstriaxManager {
  constructor(options = {}) {
    this.sourceRoot = path.resolve(options.sourceRoot || 'D:\\astrbot\\AstriaX\\data');
    this.dataRoot = path.resolve(options.dataRoot || defaultDataRoot());
    this.probeTimeoutMs = Number(options.probeTimeoutMs) || 900;
    this.sourceManifest = path.join(this.sourceRoot, 'instances.json');
    this.managedManifest = path.join(this.dataRoot, 'instances.json');
    this.stateFile = path.join(this.dataRoot, 'runtime-state.json');
    this.logsDir = path.join(this.dataRoot, 'logs', 'instances');
    this.startWaits = new Map();
  }

  async ensureLayout() {
    await fsp.mkdir(this.logsDir, { recursive: true });
  }

  info() {
    return {
      sourceRoot: this.sourceRoot,
      dataRoot: this.dataRoot,
      sourceExists: existsSync(this.sourceRoot),
      dataExists: existsSync(this.dataRoot),
      pythonExists: existsSync(path.join(this.sourceRoot, 'runtime', 'python', 'python.exe')),
      runtimesExists: existsSync(path.join(this.sourceRoot, 'runtimes')),
    };
  }

  async readSourceManifest() {
    const data = await readJson(this.sourceManifest, { instances: [] });
    return Array.isArray(data.instances) ? data : { instances: [] };
  }

  async readManagedManifest() {
    const data = await readJson(this.managedManifest, { instances: [] });
    return Array.isArray(data.instances) ? data : { instances: [] };
  }

  async readState() {
    const data = await readJson(this.stateFile, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  async writeState(state) {
    await writeJson(this.stateFile, state);
  }

  async findRecord(id, origin) {
    if (origin === 'external') {
      const manifest = await this.readSourceManifest();
      return manifest.instances.find((item) => item.id === id) || null;
    }
    const manifest = await this.readManagedManifest();
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
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async readWebUiConfig(rec, origin) {
    const candidates = [
      path.join(rec.dir || '', 'config', 'webui.json'),
      path.join(rec.dir || '', 'webui.json'),
    ];
    for (const file of candidates) {
      const data = await readJson(file, null);
      if (data && typeof data === 'object') return data;
    }
    return null;
  }

  async webUiInfo(rec, origin, portOpen) {
    if (rec.type === 'a') {
      const url = `http://127.0.0.1:${rec.port}/`;
      const reachable = portOpen ? await this.probeHttp(url) : false;
      return { kind: 'dashboard', url, reachable, label: 'AstrBot Dashboard' };
    }
    if (rec.type === 'n') {
      const config = await this.readWebUiConfig(rec, origin);
      const ports = [];
      const add = (value) => {
        const n = Number(value);
        if (Number.isInteger(n) && n > 0 && !ports.includes(n)) ports.push(n);
      };
      const token = config && typeof config.token === 'string' ? config.token : '';
      add(rec.port);
      if (config) add(config.port);
      const tested = [];
      for (const port of ports) {
        const url = `http://127.0.0.1:${port}/webui/`;
        const reachable = await this.probeHttp(url);
        tested.push({ port, url, reachable });
        if (reachable) {
          return { kind: 'napcat', url, reachable, port, token, candidates: tested, label: 'NapCat WebUI' };
        }
      }
      return {
        kind: 'napcat',
        url: tested.length ? tested[0].url : `http://127.0.0.1:${rec.port}/webui/`,
        reachable: false,
        token,
        candidates: tested,
        label: 'NapCat WebUI',
      };
    }
    return null;
  }

  async projectRecord(rec, origin, state) {
    const alive = this.pidAlive(state && state.pid);
    const portOpen = await this.probeTcp(rec.port);
    let status = 'stopped';
    if (alive) status = 'running';
    else if (portOpen) status = 'port-open';
    else if (origin === 'external') status = rec.status || 'unknown';
    const webui = await this.webUiInfo(rec, origin, portOpen);
    return {
      id: rec.id,
      name: normText(rec.name, rec.id),
      type: rec.type,
      typeLabel: typeLabel(rec.type),
      origin,
      port: rec.port,
      status,
      live: alive || portOpen,
      pid: alive ? Number(state.pid) : null,
      managed: origin === 'managed',
      runtimeVersion: normText(rec.runtimeVersion, ''),
      runtimeTag: normText(rec.runtimeTag, ''),
      dir: rec.dir || '',
      lastStartedAt: rec.lastStartedAt || (state && state.startedAt) || null,
      webui,
      logPath: path.join(origin === 'managed' ? this.dataRoot : this.sourceRoot, 'logs', 'instances', String(rec.id) + '.log'),
      canStart: origin === 'managed',
      canStop: origin === 'managed',
      canEdit: origin === 'managed',
      autoStart: rec.autoStart === true,
      autoRestart: rec.autoRestart !== false,
      desiredRunning: Boolean(state && state.desiredRunning),
      stoppedAt: (state && state.stoppedAt) || null,
      requiresAdmin: rec.type === 'n',
    };
  }

  async overview() {
    await this.ensureLayout();
    const [source, managed, state] = await Promise.all([
      this.readSourceManifest(),
      this.readManagedManifest(),
      this.readState(),
    ]);
    const [sourceItems, managedItems] = await Promise.all([
      Promise.all(source.instances.map((rec) => this.projectRecord(rec, 'external', state[rec.id]))),
      Promise.all(managed.instances.map((rec) => this.projectRecord(rec, 'managed', state[rec.id]))),
    ]);
    return {
      version: '0.1.0',
      info: this.info(),
      sourceItems,
      managedItems,
      sourceCount: sourceItems.length,
      managedCount: managedItems.length,
      time: nowIso(),
    };
  }

  pidAlive(pid) {
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) return false;
    try {
      process.kill(n, 0);
      return true;
    } catch (error) {
      return error && error.code === 'EPERM';
    }
  }

  async importInstances(ids) {
    const wanted = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    if (!wanted.length) throw Object.assign(new Error('至少选择一个实例'), { status: 400 });
    const [source, managed] = await Promise.all([this.readSourceManifest(), this.readManagedManifest()]);
    const existing = new Set(managed.instances.map((item) => item.id));
    const sourceById = new Map(source.instances.map((item) => [item.id, item]));
    const imported = [];
    for (const id of wanted) {
      const rec = sourceById.get(id);
      if (!rec) throw Object.assign(new Error('源实例不存在: ' + id), { status: 404 });
      if (existing.has(id)) throw Object.assign(new Error('实例已导入: ' + id), { status: 409 });
      const typeDir = TYPE_DIR[rec.type] || 'Other';
      const targetDir = path.join(this.dataRoot, 'instances', typeDir, rec.id);
      if (existsSync(targetDir)) throw Object.assign(new Error('目标目录已存在: ' + targetDir), { status: 409 });
      if (!rec.dir || !existsSync(rec.dir)) throw Object.assign(new Error('源数据目录不存在: ' + rec.dir), { status: 409 });
      await fsp.mkdir(path.dirname(targetDir), { recursive: true });
      await fsp.cp(rec.dir, targetDir, {
        recursive: true,
        force: false,
        errorOnExist: false,
        filter: (srcPath) => {
          const base = path.basename(srcPath);
          if (base === 'astrbot.lock' || base === 'bridge.lock' || base === '.mx-ready') return false;
          if (base === 'temp' || base === 'logs') return false;
          return true;
        },
      });
      const next = {
        ...rec,
        dir: targetDir,
        status: 'stopped',
        lastStartedAt: null,
        lastLogOffset: 0,
        importedFrom: rec.dir,
        importedAt: nowIso(),
      };
      managed.instances.push(next);
      existing.add(id);
      imported.push(next);
    }
    await writeJson(this.managedManifest, { instances: managed.instances });
    return imported.map((rec) => ({ id: rec.id, name: rec.name, type: rec.type, dir: rec.dir }));
  }

  async runtimeDirFor(rec) {
    const base = path.join(this.sourceRoot, 'runtimes', rec.type === 'a' ? 'a' : 'n');
    const tagged = normText(rec.runtimeVersion, normText(rec.runtimeTag, ''));
    if (tagged) {
      const target = path.join(base, tagged);
      if (existsSync(target)) return target;
    }
    let entries = [];
    try {
      entries = await fsp.readdir(base, { withFileTypes: true });
    } catch {
      throw Object.assign(new Error('找不到运行时目录: ' + base), { status: 500 });
    }
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    if (!dirs.length) throw Object.assign(new Error('运行时目录为空: ' + base), { status: 500 });
    return path.join(base, dirs[0]);
  }

  async findPython() {
    const pythonDir = path.join(this.sourceRoot, 'runtime', 'python');
    const pythonExe = path.join(pythonDir, 'python.exe');
    if (!existsSync(pythonExe)) throw Object.assign(new Error('找不到内置 Python: ' + pythonExe), { status: 500 });
    return { pythonDir, pythonExe };
  }

  async findQQExe() {
    const candidates = [
      process.env.QQ_EXE,
      'C:\\Program Files\\Tencent\\QQNT\\QQ.exe',
      'C:\\Program Files (x86)\\Tencent\\QQNT\\QQ.exe',
      'D:\\QQ\\QQ.exe',
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    const keys = [
      ['HKLM\\SOFTWARE\\WOW6432Node\\Tencent\\QQNT', 'Install'],
      ['HKLM\\SOFTWARE\\Tencent\\QQNT', 'Install'],
    ];
    for (const [key, value] of keys) {
      try {
        const { stdout } = await execFileAsync('reg.exe', ['query', key, '/v', value], { windowsHide: true });
        const match = stdout.match(/REG_SZ\s+(.+)/i);
        if (match) {
          const dir = match[1].trim().replace(/^"|"$/g, '');
          const exe = path.join(dir, 'QQ.exe');
          if (existsSync(exe)) return exe;
        }
      } catch {}
    }
    throw Object.assign(new Error('找不到 QQ.exe，请设置 QQ_EXE 环境变量'), { status: 500 });
  }

  async readLog(origin, id, lines = 240) {
    const record = await this.findRecord(id, origin);
    if (!record) throw Object.assign(new Error('实例不存在: ' + id), { status: 404 });
    const file = path.join(origin === 'managed' ? this.dataRoot : this.sourceRoot, 'logs', 'instances', String(id) + '.log');
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
        const all = text.split('\n');
        return { id, origin, path: file, text: all.slice(-count).join('\n'), size: stat.size };
      } finally {
        await handle.close();
      }
    } catch {
      return { id, origin, path: file, text: '', size: 0 };
    }
  }

  async portPid(port) {
    if (process.platform !== 'win32') return null;
    try {
      const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true });
      const wanted = String(port) + '\r';
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const columns = line.trim().split(/\s+/);
        if (columns.length < 5) continue;
        const local = columns[1] || '';
        if (local.endsWith(':' + String(port))) return Number(columns[4]);
      }
    } catch {}
    return null;
  }

  async killPid(pid) {
    const n = Number(pid);
    if (!Number.isInteger(n) || n <= 0) return;
    if (process.platform === 'win32') {
      try { await execFileAsync('taskkill.exe', ['/PID', String(n), '/T', '/F'], { windowsHide: true }); }
      catch {}
    } else {
      try { process.kill(n, 'SIGTERM'); } catch {}
    }
  }

  async waitForPort(port, timeoutMs, processAlive) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.probeTcp(port, 700)) return true;
      if (processAlive && !processAlive()) return false;
      await sleep(500);
    }
    return false;
  }

  async startInstance(id) {
    const record = await this.findRecord(id, 'managed');
    if (!record) throw Object.assign(new Error('只能启动已导入的实例: ' + id), { status: 404 });
    if (this.startWaits.has(id)) throw Object.assign(new Error('实例正在启动'), { status: 409 });
    const operation = this.startInstanceInternal(record);
    this.startWaits.set(id, operation);
    try {
      return await operation;
    } finally {
      this.startWaits.delete(id);
    }
  }

  async startInstanceInternal(record) {
    await this.ensureLayout();
    const state = await this.readState();
    if (state[record.id] && this.pidAlive(state[record.id].pid)) {
      throw Object.assign(new Error('实例已在运行'), { status: 409 });
    }
    if (await this.probeTcp(record.port, 500)) {
      throw Object.assign(new Error('端口已被占用: ' + record.port), { status: 409 });
    }
    const logFile = path.join(this.logsDir, String(record.id) + '.log');
    const runtimeDir = await this.runtimeDirFor(record);
    let child = null;
    let command = '';
    let args = [];
    let cwd = record.dir;
    let env = { ...process.env };
    if (record.type === 'a') {
      const { pythonDir, pythonExe } = await this.findPython();
      command = pythonExe;
      args = ['-m', 'astrbot.cli', 'run', '--port', String(record.port)];
      cwd = record.dir;
      env = {
        ...env,
        MX_PYTHON: pythonExe,
        PYTHONHOME: pythonDir,
        PATH: pythonDir + ';' + (env.PATH || ''),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        MXBOT_SITE: runtimeDir,
        PYTHONPATH: runtimeDir,
      };
    } else if (record.type === 'n') {
      const injector = path.join(runtimeDir, 'NapCatWinBootMain.exe');
      const hook = path.join(runtimeDir, 'NapCatWinBootHook.dll');
      const mainMjs = path.join(runtimeDir, 'napcat.mjs');
      const qqnt = path.join(runtimeDir, 'qqnt.json');
      for (const file of [injector, hook, mainMjs, qqnt]) {
        if (!existsSync(file)) throw Object.assign(new Error('NapCat 运行时不完整: ' + file), { status: 500 });
      }
      const qqExe = await this.findQQExe();
      const loadPath = path.join(record.dir, 'loadNapCat.js');
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
        NAPCAT_WORKDIR: record.dir,
        NAPCAT_WEBUI_PREFERRED_PORT: String(record.port),
      };
    } else {
      throw Object.assign(new Error('不支持的实例类型: ' + record.type), { status: 400 });
    }
    const out = fs.openSync(logFile, 'a');
    try {
      child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        detached: true,
        stdio: ['ignore', out, out],
      });
      child.unref();
    } finally {
      try { fs.closeSync(out); } catch {}
    }
    if (!child || !child.pid) throw Object.assign(new Error('进程未启动'), { status: 500 });
    let exited = false;
    let exitCode = null;
    child.once('exit', (code) => { exited = true; exitCode = code; });
    const ready = await this.waitForPort(record.port, record.type === 'a' ? 90000 : 60000, () => !exited);
    if (!ready) {
      await this.killPid(child.pid);
      const log = await this.readLog('managed', record.id, 80);
      const suffix = log.text ? '\n' + log.text.slice(-2500) : '';
      throw Object.assign(new Error('启动超时或失败' + (exitCode === null ? '' : ' (exit=' + exitCode + ')') + suffix), { status: 500 });
    }
    const nextState = await this.readState();
    nextState[record.id] = {
      pid: child.pid,
      type: record.type,
      port: record.port,
      startedAt: nowIso(),
      desiredRunning: true,
      autoRestart: record.autoRestart !== false,
      command,
      cwd,
    };
    await this.writeState(nextState);
    const managed = await this.readManagedManifest();
    const idx = managed.instances.findIndex((item) => item.id === record.id);
    if (idx >= 0) {
      managed.instances[idx] = { ...managed.instances[idx], status: 'running', lastStartedAt: nowIso() };
      await writeJson(this.managedManifest, { instances: managed.instances });
    }
    return { id: record.id, pid: child.pid, port: record.port, startedAt: nextState[record.id].startedAt };
  }

  async stopInstance(id) {
    const record = await this.findRecord(id, 'managed');
    if (!record) throw Object.assign(new Error('只能停止已导入的实例: ' + id), { status: 404 });
    const state = await this.readState();
    const entry = state[id];
    let pid = entry && entry.pid ? Number(entry.pid) : null;
    if (!this.pidAlive(pid)) pid = await this.portPid(record.port);
    if (pid && this.pidAlive(pid)) {
      await this.killPid(pid);
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline && await this.probeTcp(record.port, 500)) await sleep(500);
    }
    state[id] = { ...(entry || {}), pid: null, desiredRunning: false, stoppedAt: nowIso(), port: record.port, type: record.type };
    await this.writeState(state);
    const managed = await this.readManagedManifest();
    const idx = managed.instances.findIndex((item) => item.id === id);
    if (idx >= 0) {
      managed.instances[idx] = { ...managed.instances[idx], status: 'stopped' };
      await writeJson(this.managedManifest, { instances: managed.instances });
    }
    return { id, stopped: true, pid: pid || null };
  }

  async restartInstance(id) {
    await this.stopInstance(id);
    await sleep(1200);
    return await this.startInstance(id);
  }


  async updateManagedInstance(id, patch = {}) {
    const managed = await this.readManagedManifest();
    const idx = managed.instances.findIndex((item) => item.id === id);
    if (idx < 0) throw Object.assign(new Error('managed instance not found: ' + id), { status: 404 });
    const rec = managed.instances[idx];
    const state = await this.readState();
    if (state[id] && this.pidAlive(state[id].pid) && patch.port !== undefined && Number(patch.port) !== Number(rec.port)) {
      throw Object.assign(new Error('stop the instance before changing its port'), { status: 409 });
    }
    const next = { ...rec };
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) throw Object.assign(new Error('instance name cannot be empty'), { status: 400 });
      next.name = name.slice(0, 120);
    }
    if (patch.port !== undefined) {
      const port = Number(patch.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error('invalid port'), { status: 400 });
      const duplicate = managed.instances.some((item) => item.id !== id && Number(item.port) === port);
      if (duplicate) throw Object.assign(new Error('port already used by another managed instance: ' + port), { status: 409 });
      next.port = port;
    }
    if (patch.autoStart !== undefined) next.autoStart = patch.autoStart === true;
    if (patch.autoRestart !== undefined) next.autoRestart = patch.autoRestart !== false;
    managed.instances[idx] = next;
    await writeJson(this.managedManifest, { instances: managed.instances });
    return next;
  }

  configFileKind(rec) {
    return rec.type === 'a' ? 'astrbot' : rec.type === 'n' ? 'napcat' : 'unknown';
  }

  async listConfigFiles(rec, origin) {
    const files = [];
    const root = path.resolve(rec.dir || '');
    const add = async (rel, label) => {
      const abs = path.resolve(root, rel);
      const relative = path.relative(root, abs);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return;
      try {
        const stat = await fsp.stat(abs);
        if (!stat.isFile()) return;
        files.push({ rel, label, size: stat.size, editable: origin === 'managed' });
      } catch {}
    };
    if (rec.type === 'a') {
      await add('data/cmd_config.json', 'AstrBot 主配置');
    } else if (rec.type === 'n') {
      const configDir = path.join(rec.dir || '', 'config');
      let names = [];
      try { names = await fsp.readdir(configDir); } catch {}
      for (const name of names.sort()) {
        if (/^onebot11_.*\.json$/i.test(name)) await add(path.join('config', name), 'OneBot 连接配置');
        else if (/^napcat_.*\.json$/i.test(name)) await add(path.join('config', name), 'NapCat 配置');
        else if (/^webui\.json$/i.test(name)) await add(path.join('config', name), 'WebUI 配置');
      }
    }
    return files;
  }

  async instanceDetail(id, origin) {
    const rec = await this.findRecord(id, origin);
    if (!rec) throw Object.assign(new Error('instance not found: ' + id), { status: 404 });
    const state = await this.readState();
    const instance = await this.projectRecord(rec, origin, state[id]);
    const files = await this.listConfigFiles(rec, origin);
    return { instance, files, editable: origin === 'managed' };
  }

  async readConfigFile(id, origin, rel) {
    const rec = await this.findRecord(id, origin);
    if (!rec) throw Object.assign(new Error('instance not found: ' + id), { status: 404 });
    const files = await this.listConfigFiles(rec, origin);
    const allowed = files.find((item) => item.rel === rel);
    if (!allowed) throw Object.assign(new Error('config file is not editable: ' + rel), { status: 400 });
    const file = path.resolve(rec.dir, rel);
    const text = await fsp.readFile(file, 'utf8');
    return { rel, text: text.replace(/^\uFEFF/, ''), size: allowed.size, editable: origin === 'managed' };
  }

  async writeConfigFile(id, origin, rel, text) {
    if (origin !== 'managed') throw Object.assign(new Error('external AstriaX instances are read-only'), { status: 403 });
    const rec = await this.findRecord(id, origin);
    if (!rec) throw Object.assign(new Error('instance not found: ' + id), { status: 404 });
    const files = await this.listConfigFiles(rec, origin);
    const allowed = files.find((item) => item.rel === rel);
    if (!allowed) throw Object.assign(new Error('config file is not editable: ' + rel), { status: 400 });
    let value;
    try { value = JSON.parse(String(text || '').replace(/^\uFEFF/, '')); }
    catch (error) { throw Object.assign(new Error('invalid JSON: ' + error.message), { status: 400 }); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('config root must be a JSON object'), { status: 400 });
    const file = path.resolve(rec.dir, rel);
    const backupDir = path.join(this.dataRoot, 'backups', 'config', String(id));
    await fsp.mkdir(backupDir, { recursive: true });
    const stamp = nowIso().replace(/[:.]/g, '-');
    const backupName = stamp + '-' + rel.replace(/[\\/]/g, '_') + '.bak';
    try { await fsp.copyFile(file, path.join(backupDir, backupName)); } catch {}
    const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
    await fsp.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await fsp.rename(tmp, file);
    return { rel, written: true, backup: path.join(backupDir, backupName) };
  }

  async watchdogTick() {
    if (this.watchdogRunning) return;
    this.watchdogRunning = true;
    if (!this.watchdogFailures) this.watchdogFailures = new Map();
    try {
      const [managed, state] = await Promise.all([this.readManagedManifest(), this.readState()]);
      const tasks = [];
      for (const rec of managed.instances) {
        const entry = state[rec.id] || {};
        const wanted = entry.desiredRunning === true || (rec.autoStart === true && entry.desiredRunning !== false && !entry.stoppedAt);
        if (!wanted) continue;
        const alive = this.pidAlive(entry.pid);
        if (alive) continue;
        if (this.startWaits.has(rec.id)) continue;
        if (await this.probeTcp(rec.port, 450)) continue;
        const lastFailure = this.watchdogFailures.get(rec.id) || 0;
        if (lastFailure && Date.now() - lastFailure < 60000) continue;
        tasks.push(this.startInstance(rec.id).then(() => {
          this.watchdogFailures.delete(rec.id);
        }).catch((error) => {
          this.watchdogFailures.set(rec.id, Date.now());
          console.error('[astriax-manager] watchdog start failed for ' + rec.id + ': ' + (error && error.message ? error.message : error));
        }));
      }
      if (tasks.length) await Promise.allSettled(tasks);
    } finally {
      this.watchdogRunning = false;
    }
  }

  async removeManagedInstance(id, deleteFiles = false) {
    const record = await this.findRecord(id, 'managed');
    if (!record) throw Object.assign(new Error('实例不存在: ' + id), { status: 404 });
    const state = await this.readState();
    if (state[id] && this.pidAlive(state[id].pid)) throw Object.assign(new Error('请先停止实例'), { status: 409 });
    const managed = await this.readManagedManifest();
    managed.instances = managed.instances.filter((item) => item.id !== id);
    await writeJson(this.managedManifest, { instances: managed.instances });
    delete state[id];
    await this.writeState(state);
    if (deleteFiles && record.dir && record.dir.startsWith(this.dataRoot)) {
      await fsp.rm(record.dir, { recursive: true, force: true });
    }
    return { id, removed: true, deletedFiles: Boolean(deleteFiles) };
  }
}
