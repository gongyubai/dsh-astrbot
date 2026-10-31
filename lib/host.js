import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AstriaXNativeManager } from './native.js';
import { proxyWebUi } from './proxy.js';

export const name = 'astriax-native-host';
export const inject = ['webServer', 'connection'];
const PREFIX = '/.dsh-astriax-native';

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
function rejectionStatus(ctx, req) {
  if (typeof ctx.connection.admit === 'function') {
    const admitted = ctx.connection.admit(req);
    if (admitted && typeof admitted === 'object' && 'rejection' in admitted && typeof admitted.rejection === 'number') return admitted.rejection;
    return;
  }
  if (typeof ctx.connection.isAuthenticated === 'function') return ctx.connection.isAuthenticated(req) ? undefined : 401;
  return 401;
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(Object.assign(new Error('too-large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const bytes = await readBody(req, 256 * 1024);
  if (!bytes.length) return {};
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw Object.assign(new Error('invalid-json'), { status: 400 }); }
}
function stringField(body, key) { return body && typeof body[key] === 'string' ? body[key] : ''; }

async function bridgeGet(manager, route) {
  const tokenPath = path.join(os.homedir(), '.dsh', 'qq-bridge-token.txt');
  let token = '';
  try { token = fs.readFileSync(tokenPath, 'utf8').trim(); } catch {}
  if (!token) throw Object.assign(new Error('bridge token not found'), { status: 409 });
  const response = await fetch('http://127.0.0.1:' + manager.bridgePort + route, { headers: { authorization: 'Bearer ' + token } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || ('bridge HTTP ' + response.status)), { status: 502 });
  return data;
}

async function bridgePost(manager, route, body) {
  const tokenPath = path.join(os.homedir(), '.dsh', 'qq-bridge-token.txt');
  let token = '';
  try { token = fs.readFileSync(tokenPath, 'utf8').trim(); } catch {}
  if (!token) throw Object.assign(new Error('bridge token not found'), { status: 409 });
  const response = await fetch('http://127.0.0.1:' + manager.bridgePort + route, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || ('bridge HTTP ' + response.status)), { status: 502 });
  return data;
}

async function handle(ctx, manager, req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith(PREFIX)) { sendJson(res, 404, { error: 'not-found' }); return; }
  const rejection = rejectionStatus(ctx, req);
  if (rejection !== undefined) { res.writeHead(rejection); res.end(); return; }
  const method = req.method || 'GET';
  const route = url.pathname.slice(PREFIX.length) || '/';

  if (route.indexOf('/proxy/') === 0) { await proxyWebUi(manager, req, res, route, url); return; }
  if (method === 'GET' && route === '/runtime/sources') {
    sendJson(res, 200, await manager.runtimeSources());
    return;
  }
  if (method === 'POST' && route === '/runtime/sources') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.updateRuntimeSource(stringField(body, 'type'), stringField(body, 'source')));
    return;
  }
  if (method === 'GET' && route === '/runtime/versions') {
    sendJson(res, 200, await manager.runtimeVersions(url.searchParams.get('type') || 'a'));
    return;
  }
  if (method === 'POST' && route === '/runtime/install') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.startRuntimeInstall(stringField(body, 'type'), stringField(body, 'tag')));
    return;
  }
  if (method === 'GET' && route === '/runtime/provider/status') {
    sendJson(res, 200, await manager.dshProviderStatus(url.searchParams.get('id') || ''));
    return;
  }
  if (method === 'POST' && route === '/runtime/embedding/configure') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.configureLocalEmbedding(stringField(body, 'id')));
    return;
  }
  if (method === 'POST' && route === '/runtime/provider/autoconfigure') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.autoConfigureDshProvider(stringField(body, 'id')));
    return;
  }
  if (method === 'POST' && route === '/runtime/python/install') {
    sendJson(res, 200, await manager.startPythonInstall());
    return;
  }
  if (method === 'POST' && route === '/runtime/provider/install') {
    const body = await readJson(req);
    const adapter = await manager.installDshProviderAdapter(stringField(body, 'tag'));
    let configured = null;
    if (stringField(body, 'instanceId')) configured = await manager.configureDshProvider(stringField(body, 'instanceId'));
    sendJson(res, 200, { adapter, configured });
    return;
  }
  if (method === 'POST' && route === '/runtime/provider/configure') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.configureDshProvider(stringField(body, 'id')));
    return;
  }
  if (method === 'POST' && route === '/qq/send') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.sendQqMessage(stringField(body, 'id'), stringField(body, 'text'), stringField(body, 'instanceId')));
    return;
  }
  if (method === 'POST' && route === '/qq/reset') {
    const body = await readJson(req);
    sendJson(res, 200, await bridgePost(manager, '/reset', { conversationId: stringField(body, 'id') }));
    return;
  }
  if (method === 'GET' && route === '/bridge/status') {
    const health = await manager.bridgeHealth();
    sendJson(res, 200, { running: health.ready, http: health.http, port: manager.bridgePort, health: health.data || null });
    return;
  }
  if (method === 'POST' && route === '/bridge/ensure') {
    sendJson(res, 200, await manager.ensureBridge());
    return;
  }
  if (method === 'GET' && route === '/qq/workspace') {
    sendJson(res, 200, await manager.workspaceInfo());
    return;
  }
  if (method === 'POST' && route === '/qq/workspace/pick') {
    sendJson(res, 200, await manager.pickWorkspaceFolder());
    return;
  }
  if (method === 'POST' && route === '/qq/workspace') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.setWorkspaceRoot(stringField(body, 'path')));
    return;
  }
  if (method === 'GET' && route === '/qq/sessions') {
    sendJson(res, 200, await bridgeGet(manager, '/sessions'));
    return;
  }
  if (method === 'GET' && route === '/qq/session') {
    sendJson(res, 200, await bridgeGet(manager, '/session?id=' + encodeURIComponent(url.searchParams.get('id') || '')));
    return;
  }
  if (method === 'GET' && route === '/overview') { sendJson(res, 200, await manager.overview()); return; }
  if (method === 'GET' && route === '/backups') {
    sendJson(res, 200, await manager.listInstanceBackups(url.searchParams.get('id') || ''));
    return;
  }
  if (method === 'POST' && route === '/backup') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.backupInstance(stringField(body, 'id')));
    return;
  }
  if (method === 'GET' && route === '/backup/export') {
    const found = await manager.backupFile(url.searchParams.get('id') || '', url.searchParams.get('file') || '');
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(found.file),
      'content-length': found.size,
      'cache-control': 'no-store',
    });
    fs.createReadStream(found.path).pipe(res);
    return;
  }
  if (method === 'POST' && route === '/backup/delete') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.deleteInstanceBackup(stringField(body, 'id'), stringField(body, 'file')));
    return;
  }
  if (method === 'POST' && route === '/restore') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.restoreInstanceBackup(stringField(body, 'id'), stringField(body, 'file'), body));
    return;
  }
  if (method === 'GET' && route === '/logs') {
    sendJson(res, 200, await manager.readLog(url.searchParams.get('id') || '', Number(url.searchParams.get('lines') || 240)));
    return;
  }
  if (method === 'GET' && route === '/detail') { sendJson(res, 200, await manager.instanceDetail(url.searchParams.get('id') || '')); return; }
  if (method === 'GET' && route === '/config') {
    sendJson(res, 200, await manager.readConfigFile(url.searchParams.get('id') || '', url.searchParams.get('file') || ''));
    return;
  }
  if (method === 'GET' && route === '/webui') {
    const rec = await manager.findInstance(url.searchParams.get('id') || '');
    if (!rec) { sendJson(res, 404, { error: 'instance-not-found' }); return; }
    const info = await manager.webUiInfo(rec, await manager.probeTcp(rec.port));
    info.credentials = await manager.webUiCredentials(rec.id);
    info.proxy = true;
    info.hostVersion = 2;
    sendJson(res, 200, info);
    return;
  }
  if (method === 'POST' && route === '/pair') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.pairInstances(stringField(body, 'astrbotId'), stringField(body, 'napcatId')));
    return;
  }
  if (method === 'POST' && route === '/pair/apply') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.applyPair(stringField(body, 'id')));
    return;
  }
  if (method === 'POST' && route === '/unpair') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.unpairInstance(stringField(body, 'id')));
    return;
  }
  if (method === 'GET' && route === '/napcat/status') {
    sendJson(res, 200, await manager.napcatStatus(url.searchParams.get('id') || ''));
    return;
  }
  if (method === 'POST' && route === '/napcat/quick-login') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.napcatQuickLogin(stringField(body, 'id'), stringField(body, 'uin')));
    return;
  }
  if (method === 'POST' && route === '/napcat/refresh-qr') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.napcatRefreshQr(stringField(body, 'id')));
    return;
  }
  if (method === 'POST' && route === '/bootstrap') { sendJson(res, 200, await manager.bootstrapRuntimes()); return; }
  if (method === 'POST' && route === '/create') { sendJson(res, 200, await manager.createInstance(await readJson(req))); return; }
  if (method === 'POST' && route === '/update') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.updateInstance(stringField(body, 'id'), body));
    return;
  }
  if (method === 'POST' && route === '/delete') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.deleteInstance(stringField(body, 'id'), body.deleteFiles === true));
    return;
  }
  if (method === 'POST' && route === '/config') {
    const body = await readJson(req);
    sendJson(res, 200, await manager.writeConfigFile(stringField(body, 'id'), stringField(body, 'file'), typeof body.text === 'string' ? body.text : ''));
    return;
  }
  if (method === 'POST' && route === '/start') { sendJson(res, 200, await manager.startInstance(stringField(await readJson(req), 'id'))); return; }
  if (method === 'POST' && route === '/stop') { sendJson(res, 200, await manager.stopInstance(stringField(await readJson(req), 'id'))); return; }
  if (method === 'POST' && route === '/restart') { sendJson(res, 200, await manager.restartInstance(stringField(await readJson(req), 'id'))); return; }
  sendJson(res, 404, { error: 'not-found' });
}

export function apply(ctx, config = {}) {
  const manager = new AstriaXNativeManager(config);
  console.error('[astriax-native] dataRoot=' + manager.dataRoot);
  console.error('[astriax-native] bootstrapSource=' + manager.bootstrapSource);
  ctx.effect(() => {
    const intervalMs = Math.max(3000, Number(config.watchdogMs) || 10000);
    let watchdogBusy = false;
    const runWatchdog = () => {
      if (watchdogBusy) return;
      watchdogBusy = true;
      manager.watchdogTick().catch((error) => {
        console.error('[astriax-native] watchdog failed: ' + (error && error.message ? error.message : error));
      }).finally(() => { watchdogBusy = false; });
    };
    const timer = setInterval(runWatchdog, intervalMs);
    const bootTimer = setTimeout(runWatchdog, 2500);
    const bridgeTimer = config.autoBridge === false ? null : setTimeout(() => {
      manager.ensureBridge().catch((error) => console.error('[astriax-native] bridge auto-start failed: ' + (error && error.message ? error.message : error)));
    }, 1800);
    const detach = ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler: (req, res) => handle(ctx, manager, req, res).catch((error) => {
        if (res.headersSent) { try { res.end(); } catch {} return; }
        const status = Number(error && error.status);
        const code = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
        if (code >= 500) console.error('[astriax-native] route failed: ' + (error && error.stack ? error.stack : error));
        sendJson(res, code, { error: error && error.message ? error.message : 'internal-error' });
      }),
    });
    return () => { clearInterval(timer); clearTimeout(bootTimer); if (bridgeTimer) clearTimeout(bridgeTimer); detach(); };
  });
}
