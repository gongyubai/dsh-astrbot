import { Buffer } from 'node:buffer';

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('request too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isTextContentType(type) {
  const value = String(type || '').toLowerCase();
  return value.includes('text/') || value.includes('javascript') || value.includes('json') || value.includes('xml') || value.includes('css') || value.includes('svg');
}

function replaceQuotedPrefix(text, prefix, pathname) {
  const quote = String.fromCharCode(34);
  const single = String.fromCharCode(39);
  const tick = String.fromCharCode(96);
  let out = String(text);
  for (const q of [quote, single, tick]) out = out.split(q + pathname).join(q + prefix + pathname.slice(1));
  return out;
}

function rewriteProxyText(text, prefix, instanceId, contentType) {
  let out = String(text);
  const type = String(contentType || '').toLowerCase();
  const isHtml = type.includes('html') || out.indexOf('<html') >= 0 || out.indexOf('<head') >= 0;
  const isCss = type.includes('css');
  if (isHtml) {
    out = out.replace(/(\b(?:src|href|action|poster)\s*=\s*")\/(?!\/)/gi, '$1' + prefix);
    out = out.replace(/(\b(?:src|href|action|poster)\s*=\s*')\/(?!\/)/gi, '$1' + prefix);
    out = out.replace(/(\b(?:src|href|action|poster)\s*=\s*)(?!["'`])\/(?!\/)/gi, '$1' + prefix);
  }
  if (isHtml || isCss) out = out.replace(/url\(\/(?!\/)/gi, 'url(' + prefix);
  if (isHtml) out = out.replace(/<script\b([^>]*\bsrc\s*=\s*["']https?:\/\/[^"']+["'][^>]*)>/gi, (match, attrs) => /\basync\b/i.test(attrs) ? match : '<script async' + attrs + '>');
  for (const pathname of ['/api/', '/api', '/assets/', '/webui/', '/favicon', '/plugin/', '/files/']) {
    out = replaceQuotedPrefix(out, prefix, pathname);
  }
  out = out.replace(/(return\s*["'])\/(["']\s*\+)/g, '$1' + prefix + '$2');
  out = out.replace(/(=>\s*["'])\/(["']\s*\+)/g, '$1' + prefix + '$2');
  if (isHtml) {
    const storageKey = '__axn_' + instanceId + '__';
    const base = JSON.stringify(prefix);
    const bootstrap = '<script>(function(){var p=' + JSON.stringify(storageKey) + ';var s=Storage.prototype;var g=s.getItem,w=s.setItem,r=s.removeItem;s.getItem=function(k){return g.call(this,p+k)};s.setItem=function(k,v){return w.call(this,p+k,v)};s.removeItem=function(k){return r.call(this,p+k)};var b=' + base + ';var of=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf(b)!==0)u=b+u.slice(1);return of.call(this,u,o)};var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){var a=[].slice.call(arguments);if(typeof a[1]==="string"&&a[1].charAt(0)==="/"&&a[1].indexOf(b)!==0)a[1]=b+a[1].slice(1);return xo.apply(this,a)};var OE=window.EventSource;if(OE){var NE=function(u,c){if(typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf(b)!==0)u=b+u.slice(1);return new OE(u,c)};NE.prototype=OE.prototype;window.EventSource=NE}var ph=history.pushState,rh=history.replaceState;history.pushState=function(st,t,u){if(typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf(b)!==0)u=b+u.slice(1);return ph.call(this,st,t,u)};history.replaceState=function(st,t,u){if(typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf(b)!==0)u=b+u.slice(1);return rh.call(this,st,t,u)};})();</script>';
    out = out.replace(/<head([^>]*)>/i, '<head$1><base href="' + prefix + '">' + bootstrap);
  }
  return out;
}

function rewriteLocation(location, prefix, targetOrigin) {
  if (!location) return location;
  if (location.indexOf(targetOrigin) === 0) return prefix + location.slice(targetOrigin.length).replace(/^\//, '');
  if (location.charAt(0) === '/') return prefix + location.slice(1);
  return location;
}

function rewriteSetCookie(cookie, prefix) {
  return String(cookie)
    .replace(/;\s*Domain=[^;]*/ig, '')
    .replace(/;\s*Path=\/[^;]*/ig, '; Path=' + prefix.replace(/\/$/, ''));
}

export async function proxyWebUi(manager, req, res, route, url) {
  const rest = route.slice('/proxy/'.length);
  const slash = rest.indexOf('/');
  const id = decodeURIComponent(slash < 0 ? rest : rest.slice(0, slash));
  const tail = slash < 0 ? '/' : rest.slice(slash);
  const rec = await manager.findInstance(id);
  if (!rec) { sendJson(res, 404, { error: 'instance-not-found' }); return; }
  const prefix = '/.dsh-astriax-native/proxy/' + encodeURIComponent(id) + '/';
  const targetOrigin = 'http://127.0.0.1:' + rec.port;
  const targetUrl = targetOrigin + (tail || '/') + (url.search || '');
  const headers = {};
  for (const key of ['accept','accept-language','content-type','authorization','cookie','range','if-none-match','if-modified-since','user-agent','x-requested-with','cache-control']) {
    if (req.headers[key] !== undefined) headers[key] = req.headers[key];
  }
  headers.origin = targetOrigin;
  headers.referer = targetOrigin + (tail || '/');
  let body;
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') body = await readBody(req, 50 * 1024 * 1024);
  let upstream;
  try {
    upstream = await fetch(targetUrl, { method: req.method || 'GET', headers, body, redirect: 'manual' });
  } catch (error) {
    sendJson(res, 502, { error: 'WebUI proxy request failed: ' + (error && error.message ? error.message : String(error)) });
    return;
  }
  const responseHeaders = {};
  for (const [key, value] of upstream.headers) {
    if (['content-length','content-encoding','transfer-encoding','content-security-policy','x-frame-options'].includes(key.toLowerCase())) continue;
    if (key.toLowerCase() === 'set-cookie') continue;
    responseHeaders[key] = value;
  }
  const setCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);
  if (setCookies.length) responseHeaders['set-cookie'] = setCookies.map((cookie) => rewriteSetCookie(cookie, prefix));
  if (responseHeaders.location) responseHeaders.location = rewriteLocation(responseHeaders.location, prefix, targetOrigin);
  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.indexOf('text/event-stream') >= 0) {
    res.writeHead(upstream.status, responseHeaders);
    if (upstream.body) {
      try { for await (const chunk of upstream.body) res.write(chunk); } catch {}
    }
    res.end();
    return;
  }
  const raw = Buffer.from(await upstream.arrayBuffer());
  let output = raw;
  if (isTextContentType(contentType) && raw.length <= 8 * 1024 * 1024) {
    output = Buffer.from(rewriteProxyText(raw.toString('utf8'), prefix, id, contentType), 'utf8');
  }
  responseHeaders['content-length'] = Buffer.byteLength(output);
  responseHeaders['cache-control'] = 'no-store';
  res.writeHead(upstream.status, responseHeaders);
  res.end(output);
}
