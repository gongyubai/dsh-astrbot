window.__ModuleLoader__.load({
  id: 'dsh-astriax-native',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    let ReactDOM = null
    try { ReactDOM = require('react-dom') } catch {}
    const { useCallback, useEffect, useRef, useState } = React
    const h = React.createElement

    const css = `
.axn-shell{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary,#1f2329)}
.axn-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}
.axn-head-main{flex:1;min-width:0}
.axn-title{margin:0;font-size:18px;font-weight:650}
.axn-sub{margin:5px 0 0;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary,#646a73)}
.axn-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.axn-btn{border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.16));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.72));color:inherit;border-radius:9px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:550;line-height:1.2;cursor:pointer;white-space:nowrap}
.axn-btn:hover:not(:disabled){border-color:var(--dsw-alias-button-info-fill,#2f6fed)}
.axn-btn:disabled{opacity:.45;cursor:not-allowed}
.axn-btn.primary{background:var(--dsw-alias-button-info-fill,#2f6fed);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}
.axn-btn.danger{color:var(--dsw-alias-state-error-primary,#d92d20)}
.axn-tabs{display:flex;gap:6px;padding:4px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.07));width:fit-content;max-width:100%}
.axn-tab{border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#646a73);padding:7px 14px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.axn-tab.active{background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#1f2329);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.axn-summary{display:flex;gap:8px;flex-wrap:wrap}
.axn-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));border-radius:999px;padding:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.58))}
.axn-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#9aa0a6)}
.axn-dot.live{background:var(--dsw-alias-state-success-primary,#12b76a);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary,#12b76a) 14%,transparent)}
.axn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
.axn-card{border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.12));border-radius:14px;padding:14px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.72));display:flex;flex-direction:column;gap:11px;min-width:0}
.axn-card.live{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#12b76a) 40%,transparent)}
.axn-card-head{display:flex;align-items:flex-start;gap:10px}
.axn-card-title{flex:1;min-width:0}
.axn-name{margin:0;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.axn-id{margin-top:3px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a9099);font-family:ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.axn-badge{flex:none;border-radius:6px;padding:3px 7px;font-size:10.5px;font-weight:700;background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#2f6fed) 12%,transparent);color:var(--dsw-alias-button-info-fill,#2f6fed)}
.axn-badge.n{background:color-mix(in srgb,#d97706 13%,transparent);color:var(--dsw-alias-state-warn-primary,#b45309)}
.axn-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#646a73)}
.axn-status.live{color:var(--dsw-alias-state-success-primary,#12b76a)}
.axn-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;font-size:12px}
.axn-meta-label{color:var(--dsw-alias-label-tertiary,#8a9099)}
.axn-meta-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.axn-foot{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:auto;padding-top:3px}
.axn-empty{border:1px dashed var(--dsw-alias-border-l1,rgba(31,35,41,.18));border-radius:13px;padding:30px 20px;text-align:center;color:var(--dsw-alias-label-tertiary,#8a9099);font-size:12.5px}
.axn-notice{border:1px solid color-mix(in srgb,var(--dsw-alias-button-info-fill,#2f6fed) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#2f6fed) 7%,transparent);border-radius:10px;padding:9px 11px;font-size:12px;line-height:1.5;word-break:break-word}
.axn-notice.error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 34%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 7%,transparent);color:var(--dsw-alias-state-error-primary,#d92d20)}
.axn-log{border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.12));border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.04))}
.axn-log-head{display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.08));font-size:12px}
.axn-log-head strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.axn-pre{margin:0;padding:11px;max-height:320px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:11.5px/1.55 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-secondary,#4b5563)}
.axn-backdrop{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,18,24,.48);backdrop-filter:blur(3px)}
.axn-modal{width:min(940px,100%);max-height:min(850px,calc(100vh - 48px));overflow:auto;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.16));border-radius:16px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 20px 60px rgba(0,0,0,.25);padding:18px;display:flex;flex-direction:column;gap:14px}
.axn-modal-head{display:flex;align-items:flex-start;gap:12px}
.axn-modal-head-main{flex:1;min-width:0}
.axn-modal-title{margin:0;font-size:16px;font-weight:650}
.axn-modal-sub{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,#646a73)}
.axn-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.axn-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.axn-field.wide{grid-column:1/-1}
.axn-label{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73)}
.axn-input,.axn-select{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.2));border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#1f2329);font:inherit;font-size:13px;outline:none}
.axn-input:focus,.axn-select:focus{border-color:var(--dsw-alias-button-info-fill,#2f6fed);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-button-info-fill,#2f6fed) 15%,transparent)}
.axn-checkline{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-secondary,#646a73)}
.axn-file-row{display:flex;gap:7px;flex-wrap:wrap}
.axn-pill{border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.15));border-radius:8px;padding:6px 9px;background:transparent;color:var(--dsw-alias-label-secondary,#646a73);font:inherit;font-size:11.5px;cursor:pointer}
.axn-pill.active{border-color:var(--dsw-alias-button-info-fill,#2f6fed);color:var(--dsw-alias-button-info-fill,#2f6fed);background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#2f6fed) 8%,transparent)}
.axn-textarea{width:100%;box-sizing:border-box;min-height:330px;resize:vertical;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.2));border-radius:10px;padding:11px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.03));color:var(--dsw-alias-label-primary,#1f2329);font:12px/1.55 ui-monospace,Consolas,monospace;outline:none}
.axn-runtime-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.axn-mono{font-family:ui-monospace,Consolas,monospace}
@media(max-width:640px){.axn-form{grid-template-columns:1fr}.axn-meta{grid-template-columns:1fr}.axn-backdrop{padding:10px}.axn-modal{max-height:calc(100vh - 20px);padding:14px}}
`

    const webuiCss = `
dialog.axn-qq-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:12px;min-height:460px}
.axn-qq-list{display:flex;flex-direction:column;gap:6px;min-width:0;max-height:620px;overflow:auto;padding-right:2px}
.axn-qq-item{text-align:left;border:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.05));border-radius:10px;padding:9px 10px;color:inherit;font:inherit;cursor:pointer}
.axn-qq-item:hover,.axn-qq-item.active{border-color:var(--dsw-alias-button-info-fill,#2f6fed);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.7))}
.axn-qq-item-title{font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.axn-qq-item-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a9099);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.axn-qq-detail{display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff)}
.axn-qq-detail-head{padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));display:flex;flex-direction:column;gap:3px}
.axn-qq-messages{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:360px;max-height:540px}
.axn-qq-msg{max-width:86%;padding:8px 10px;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.55}
.axn-qq-msg.user{align-self:flex-end;background:var(--dsw-alias-button-info-fill,#2f6fed);color:#fff}
.axn-qq-msg.assistant{align-self:flex-start;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.12));color:inherit}
.axn-qq-msg-time{font-size:10px;opacity:.65;margin-top:4px}
.axn-qq-compose{display:flex;gap:8px;padding:10px;border-top:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));align-items:flex-end}.axn-qq-compose textarea{flex:1;min-height:42px;max-height:120px;resize:vertical;border:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.12));border-radius:8px;padding:8px 10px;font:inherit;background:transparent;color:inherit;outline:none}.axn-qq-empty{padding:28px;text-align:center;color:var(--dsw-alias-label-tertiary,#8a9099);font-size:12.5px}
@media(max-width:760px){.axn-qq-layout{grid-template-columns:1fr}.axn-qq-list{max-height:260px}}
.axn-webui-backdrop{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;margin:0;border:0;background:transparent;color:inherit;overflow:hidden}
dialog.axn-webui-backdrop::backdrop{background:rgba(10,13,18,.72)}
.axn-webui-modal{width:min(1500px,calc(100vw - 40px));height:min(920px,calc(100vh - 40px));max-width:none;max-height:none;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1,rgba(31,35,41,.18));border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 24px 80px rgba(0,0,0,.34)}
dialog.axn-webui-backdrop.is-maximized{padding:0}
dialog.axn-webui-backdrop.is-maximized .axn-webui-modal{width:100vw;height:100vh;border:0;border-radius:0;box-shadow:none}
.axn-webui-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}
.axn-webui-bar-main{flex:1;min-width:180px}
.axn-webui-title{font-size:13px;font-weight:650}
.axn-webui-url{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a9099);font-family:ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.axn-webui-token{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%}
.axn-webui-token code{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px ui-monospace,Consolas,monospace;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.7));border:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));border-radius:6px;padding:3px 6px}
.axn-webui-creds{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.72));font-size:11.5px;color:var(--dsw-alias-label-secondary,#646a73)}
.axn-webui-creds strong{font-size:11.5px;color:var(--dsw-alias-label-primary,#1f2329)}
.axn-webui-creds code{font:11px ui-monospace,Consolas,monospace;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l2,rgba(31,35,41,.1));border-radius:6px;padding:3px 6px;color:var(--dsw-alias-label-primary,#1f2329)}
.axn-webui-creds .warn{color:var(--dsw-alias-state-warn-primary,#b45309)}
.axn-webui-frame-wrap{position:relative;flex:1;min-height:0;background:#fff}
.axn-webui-frame{width:100%;height:100%;border:0;display:block;background:#fff}
.axn-webui-state{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;text-align:center;padding:24px;color:var(--dsw-alias-label-secondary,#646a73);background:var(--dsw-alias-bg-layer-1,#fff)}
.axn-webui-error{color:var(--dsw-alias-state-error-primary,#d92d20);font-size:12.5px;max-width:680px;line-height:1.6}
`

    async function request(path, options) {
      const response = await fetch('/.dsh-astriax-native' + path, {
        cache: 'no-store',
        ...options,
        headers: { accept: 'application/json', ...(options && options.headers ? options.headers : {}) },
      })
      const text = await response.text()
      let body = null
      if (text) { try { body = JSON.parse(text) } catch { body = { error: text.slice(0, 300) } } }
      if (!response.ok) { const error = new Error(body && body.error ? body.error : 'request failed'); error.status = response.status; throw error }
      return body
    }
    function typeName(item) { return item.type === 'a' ? 'AstrBot' : item.type === 'n' ? 'NapCat' : 'Unknown' }
    function statusText(item) {
      const map = { running:'运行中', stopped:'已停止', starting:'启动中', error:'异常', 'port-open':'端口占用' }
      return map[item.status] || item.status || '未知'
    }
    function live(item) { return Boolean(item && (item.live || item.status === 'running' || item.status === 'port-open')) }
    function formatTime(value) { if (!value) return '-'; try { return new Date(value).toLocaleString('zh-CN', { hour12:false }) } catch { return String(value) } }
    function formatBytes(value) { const n = Number(value) || 0; if (n < 1024) return n + ' B'; if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'; if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'; return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB' }

    function Card(props) {
      const item = props.item
      const isLive = live(item)
      const busy = props.busy
      return h('div', { className:'axn-card' + (isLive ? ' live' : '') },
        h('div', { className:'axn-card-head' },
          h('div', { className:'axn-card-title' },
            h('h3', { className:'axn-name', title:item.name }, item.name),
            h('div', { className:'axn-id', title:item.id }, item.id),
          ),
          h('span', { className:'axn-badge ' + item.type }, typeName(item)),
        ),
        h('div', { className:'axn-status' + (isLive ? ' live' : '') }, h('span', { className:'axn-dot' + (isLive ? ' live' : '') }), statusText(item)),
        h('div', { className:'axn-meta' },
          h('span', { className:'axn-meta-label' }, '端口'), h('span', { className:'axn-meta-value axn-mono' }, item.port),
          h('span', { className:'axn-meta-label' }, 'PID'), h('span', { className:'axn-meta-value axn-mono' }, item.pid || '-'),
          h('span', { className:'axn-meta-label' }, '运行时'), h('span', { className:'axn-meta-value', title:item.runtimeTag }, item.runtimeTag || '-'),
          h('span', { className:'axn-meta-label' }, '最近启动'), h('span', { className:'axn-meta-value', title:formatTime(item.lastStartedAt) }, formatTime(item.lastStartedAt)),
        ),
        h('div', { className:'axn-foot' },
          h('button', { className:'axn-btn', disabled:!!busy || !item.webui || !item.webui.url, onClick:()=>props.onWebui(item) }, item.webui && item.webui.reachable ? '内嵌 ' + item.webui.label : 'WebUI 未就绪'),
          h('button', { className:'axn-btn', disabled:!!busy, onClick:()=>props.onLog(item) }, '日志'),
          h('button', { className:'axn-btn', disabled:!!busy, onClick:()=>props.onEdit(item) }, '设置'),
          !isLive ? h('button', { className:'axn-btn primary', disabled:!!busy, onClick:()=>props.onStart(item) }, busy === 'start:' + item.id ? '启动中...' : '启动') : null,
          isLive ? h('button', { className:'axn-btn', disabled:!!busy, onClick:()=>props.onStop(item) }, busy === 'stop:' + item.id ? '停止中...' : '停止') : null,
          isLive ? h('button', { className:'axn-btn', disabled:!!busy, onClick:()=>props.onRestart(item) }, busy === 'restart:' + item.id ? '重启中...' : '重启') : null,
          h('button', { className:'axn-btn danger', disabled:!!busy || isLive, onClick:()=>props.onDelete(item) }, '删除'),
        ),
      )
    }

    function LogPanel(props) {
      if (!props.log) return null
      return h('div', { className:'axn-log' },
        h('div', { className:'axn-log-head' },
          h('strong', null, '日志 · ' + props.log.id),
          h('button', { className:'axn-btn', onClick:props.onRefresh }, '刷新'),
          h('button', { className:'axn-btn', onClick:props.onClose }, '关闭'),
        ),
        h('pre', { className:'axn-pre' }, props.log.text || '日志为空。'),
        h('div', { className:'axn-sub', style:{ padding:'8px 11px' } }, props.log.path || ''),
      )
    }


    function WebUiModal(props) {
      const w = props.webui
      const dialogRef = useRef(null)
      const [maximized, setMaximized] = useState(false)
      useEffect(() => {
        const node = dialogRef.current
        if (node && node.isConnected && !node.open) {
          try { node.showModal() } catch {}
        }
        return () => { try { if (node && node.open) node.close() } catch {} }
      }, [])
      if (!w) return null
      const overlay = h('dialog', { ref:dialogRef, className:'axn-webui-backdrop' + (maximized ? ' is-maximized' : ''), onCancel:(event)=>{ event.preventDefault(); props.onClose() } },
        h('div', { className:'axn-webui-modal', role:'dialog', 'aria-modal':'true' },
          h('div', { className:'axn-webui-bar' },
            h('div', { className:'axn-webui-bar-main' },
              h('div', { className:'axn-webui-title' }, 'WebUI · ' + (w.item && w.item.name || '')),
              h('div', { className:'axn-webui-url', title:w.externalUrl || w.url || '' }, w.externalUrl || w.url || '正在解析 WebUI 地址...'),
            ),
            w.token ? h('div', { className:'axn-webui-token' },
              h('code', { title:w.token }, w.token),
              h('button', { className:'axn-btn', onClick:()=>props.onCopyToken(w.token) }, '复制 Token'),
            ) : null,
            h('button', { className:'axn-btn', onClick:()=>setMaximized((value)=>!value) }, maximized ? '窗口化' : '最大化'),
            h('button', { className:'axn-btn', onClick:props.onReload }, '刷新'),
            h('button', { className:'axn-btn', onClick:()=>props.onExternal(w.externalUrl || w.url) }, '新窗口打开'),
            h('button', { className:'axn-btn', onClick:props.onClose }, '关闭'),
          ),
          w.credentials
            ? h('div', { className:'axn-webui-creds' },
                h('strong', null, 'AstrBot 初始账号'),
                h('code', null, w.credentials.username || '-'),
                h('button', { className:'axn-btn', onClick:()=>props.onCopyText(w.credentials.username || '', '用户名') }, '复制账号'),
                h('strong', null, '密码'),
                h('code', null, w.credentials.password || '-'),
                h('button', { className:'axn-btn', onClick:()=>props.onCopyText(w.credentials.password || '', '密码') }, '复制密码'),
                h('span', { className:'warn' }, '只来自首次启动日志；修改过密码后可能已过期'),
              )
            : (w.item && w.item.type === 'a' ? h('div', { className:'axn-webui-creds' }, h('span', { className:'warn' }, '没有在日志里找到 AstrBot 初始账号密码。首次启动日志生成后可重新打开。')) : null),
          h('div', { className:'axn-webui-frame-wrap' },
            w.loading ? h('div', { className:'axn-webui-state' }, '正在加载 WebUI...') : null,
            w.error ? h('div', { className:'axn-webui-state' }, h('div', { className:'axn-webui-error' }, w.error), h('button', { className:'axn-btn', onClick:props.onReload }, '重试')) : null,
            !w.loading && !w.error && w.url ? h('iframe', {
              key: (w.loadKey || 0) + ':' + w.url,
              className:'axn-webui-frame',
              src:w.url,
              title:'WebUI',
              allow:'clipboard-read; clipboard-write',
              referrerPolicy:'no-referrer',
            }) : null,
          ),
        ),
      )
      return ReactDOM && typeof ReactDOM.createPortal === 'function' ? ReactDOM.createPortal(overlay, document.body) : overlay
    }

    function NewInstanceModal(props) {
      const runtimes = props.runtimes || { a: [], n: [] }
      const firstType = runtimes.a && runtimes.a.length ? 'a' : 'n'
      const [form, setForm] = useState({ type: firstType, name: '', port: '', runtimeTag: (firstType === 'a' ? runtimes.a : runtimes.n)[0] || '', autoStart: false })
      const tags = form.type === 'a' ? (runtimes.a || []) : (runtimes.n || [])
      useEffect(() => {
        if (!tags.includes(form.runtimeTag)) setForm((prev) => ({ ...prev, runtimeTag: tags[0] || '' }))
      }, [form.type])
      function change(key, value) { setForm((prev) => ({ ...prev, [key]: value })) }
      const canSubmit = Boolean(form.runtimeTag && !props.busy)
      return h('div', { className:'axn-backdrop', onMouseDown:(event)=>{ if(event.target===event.currentTarget) props.onClose() } },
        h('div', { className:'axn-modal', role:'dialog', 'aria-modal':'true' },
          h('div', { className:'axn-modal-head' },
            h('div', { className:'axn-modal-head-main' },
              h('h3', { className:'axn-modal-title' }, '新建实例'),
              h('p', { className:'axn-modal-sub' }, '实例使用 DSH 自有数据目录和自有运行时，不会读取或修改 AstriaX 实例。'),
            ),
            h('button', { className:'axn-btn', onClick:props.onClose, disabled:props.busy }, '关闭'),
          ),
          h('div', { className:'axn-form' },
            h('label', { className:'axn-field' },
              h('span', { className:'axn-label' }, '类型'),
              h('select', { className:'axn-select', value:form.type, disabled:props.busy, onChange:(e)=>change('type', e.target.value) },
                h('option', { value:'a' }, 'AstrBot'),
                h('option', { value:'n' }, 'NapCat'),
              ),
            ),
            h('label', { className:'axn-field' },
              h('span', { className:'axn-label' }, '名称'),
              h('input', { className:'axn-input', value:form.name, placeholder:form.type === 'a' ? 'AstrBot 实例' : 'NapCat 实例', disabled:props.busy, onChange:(e)=>change('name', e.target.value) }),
            ),
            h('label', { className:'axn-field' },
              h('span', { className:'axn-label' }, '端口（留空自动分配）'),
              h('input', { className:'axn-input', type:'number', min:1, max:65535, value:form.port, disabled:props.busy, onChange:(e)=>change('port', e.target.value) }),
            ),
            h('label', { className:'axn-field' },
              h('span', { className:'axn-label' }, '运行库版本'),
              h('select', { className:'axn-select', value:form.runtimeTag, disabled:props.busy || !tags.length, onChange:(e)=>change('runtimeTag', e.target.value) },
                tags.length ? tags.map((tag)=>h('option', { key:tag, value:tag }, tag)) : h('option', { value:'' }, '没有已安装运行库'),
              ),
            ),
            h('label', { className:'axn-checkline axn-field wide' },
              h('input', { type:'checkbox', checked:form.autoStart, disabled:props.busy, onChange:(e)=>change('autoStart', e.target.checked) }),
              'DSH 启动时自动运行',
            ),
            !tags.length ? h('div', { className:'axn-notice error axn-field wide' }, '该类型还没有安装运行库。先去运行库页复制或安装。') : null,
            h('div', { className:'axn-field wide', style:{ display:'flex', gap:8, justifyContent:'flex-end' } },
              h('button', { className:'axn-btn', onClick:props.onClose, disabled:props.busy }, '取消'),
              h('button', { className:'axn-btn primary', disabled:!canSubmit, onClick:()=>props.onCreate({ ...form, port:form.port ? Number(form.port) : undefined }) }, props.busy ? '创建中...' : '创建实例'),
            ),
          ),
        ),
      )
    }

    function DetailModal(props) {
      const d = props.detail
      if (!d) return null
      const item = d.instance || d.item || {}
      const tab = d.tab || 'settings'
      const disabled = Boolean(props.busy)
      return h('div', { className:'axn-backdrop', onMouseDown:(event)=>{ if(event.target===event.currentTarget) props.onClose() } },
        h('div', { className:'axn-modal', role:'dialog', 'aria-modal':'true' },
          h('div', { className:'axn-modal-head' },
            h('div', { className:'axn-modal-head-main' },
              h('h3', { className:'axn-modal-title' }, '设置 · ' + (item.name || item.id)),
              h('p', { className:'axn-modal-sub' }, typeName(item) + ' · ' + item.id + ' · ' + (item.dir || '')),
            ),
            h('button', { className:'axn-btn', onClick:props.onClose, disabled }, '关闭'),
          ),
          d.error ? h('div', { className:'axn-notice error' }, d.error) : null,
          h('div', { className:'axn-tabs' },
            h('button', { className:'axn-tab' + (tab==='settings'?' active':''), onClick:()=>props.onTab('settings') }, '运行设置'),
            h('button', { className:'axn-tab' + (tab==='config'?' active':''), onClick:()=>props.onTab('config') }, '配置文件'),
            h('button', { className:'axn-tab' + (tab==='backups'?' active':''), onClick:()=>props.onTab('backups') }, '备份恢复'),
          ),
          tab === 'settings'
            ? h('div', { className:'axn-form' },
                h('label', { className:'axn-field' }, h('span', { className:'axn-label' }, '名称'), h('input', { className:'axn-input', value:d.name, disabled, onChange:(e)=>props.onChange('name', e.target.value) })),
                h('label', { className:'axn-field' }, h('span', { className:'axn-label' }, '端口'), h('input', { className:'axn-input', type:'number', min:1, max:65535, value:d.port, disabled:disabled || item.live, onChange:(e)=>props.onChange('port', e.target.value) })),
                h('label', { className:'axn-field' }, h('span', { className:'axn-label' }, '运行库版本'), h('select', { className:'axn-select', value:d.runtimeTag, disabled:disabled || item.live, onChange:(e)=>props.onChange('runtimeTag', e.target.value) }, (d.runtimeOptions||[]).map((tag)=>h('option', { key:tag, value:tag }, tag)))),
                h('div', { className:'axn-field' },
                  h('label', { className:'axn-checkline' }, h('input', { type:'checkbox', checked:Boolean(d.autoStart), disabled, onChange:(e)=>props.onChange('autoStart', e.target.checked) }), 'DSH 启动时自动运行'),
                  h('label', { className:'axn-checkline' }, h('input', { type:'checkbox', checked:Boolean(d.autoRestart), disabled, onChange:(e)=>props.onChange('autoRestart', e.target.checked) }), '异常退出后自动重启'),
                ),
                h('div', { className:'axn-notice axn-field wide' }, '端口和运行库只能在不运行状态下修改。修改运行库会保留实例数据；OneBot 连接端口在配置文件中修改。'),
                item.type === 'n' ? h('div', { className:'axn-field wide', style:{ border:'1px solid var(--dsw-alias-border-l2, rgba(31,35,41,.12))', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:9 } },
                  h('div', { style:{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' } },
                    h('strong', { style:{ flex:1 } }, 'QQ 登录'),
                    h('button', { className:'axn-btn', disabled:disabled, onClick:props.onNapcatStatus }, '刷新登录状态'),
                    h('button', { className:'axn-btn', disabled:disabled, onClick:props.onNapcatRefreshQr }, '刷新二维码'),
                  ),
                  d.napcatError ? h('div', { className:'axn-notice error' }, d.napcatError) : null,
                  d.napcat && d.napcat.status
                    ? h('div', { className:'axn-sub' },
                        '状态：' + (d.napcat.status.isLogin ? '已登录' : d.napcat.status.isOffline ? '离线' : (d.napcat.status.loginPhase || '等待登录')) +
                        (d.napcat.status.loginError ? ' · ' + d.napcat.status.loginError : '') +
                        (d.napcat.status.qrcodeurl ? ' · 二维码已生成' : '')
                      )
                    : h('div', { className:'axn-sub' }, item.live ? '正在读取 NapCat 登录状态...' : '实例启动后可快速登录或扫码。'),
                  d.napcat && d.napcat.quickLoginList && d.napcat.quickLoginList.length
                    ? h('div', { className:'axn-file-row' }, d.napcat.quickLoginList.map((account)=>h('button', {
                        key: account.uin,
                        className:'axn-pill',
                        disabled,
                        title: '快速登录 ' + account.uin,
                        onClick:()=>props.onNapcatQuickLogin(String(account.uin)),
                      }, (account.nickName || account.uin) + ' (' + account.uin + ')')))
                    : null,
                  d.napcat && d.napcat.status && d.napcat.status.qrcodeurl
                    ? h('button', { className:'axn-btn', disabled, onClick:()=>props.onNapcatCopyQr(d.napcat.status.qrcodeurl) }, '复制二维码登录内容')
                    : null,
                  h('button', { className:'axn-btn', disabled, onClick:props.onOpenWebui }, '打开 WebUI 扫码登录'),
                ) : item.type === 'a' ? h('div', { className:'axn-field wide', style:{ border:'1px solid var(--dsw-alias-border-l2, rgba(31,35,41,.12))', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:9 } },
                  h('div', { style:{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' } },
                    h('strong', { style:{ flex:1 } }, 'DSH \u9ed8\u8ba4\u6a21\u578b'),
                    d.providerStatus && d.providerStatus.ok ? h('span', { className:'axn-badge' }, 'READY') : null,
                  ),
                  d.providerStatus ? h('div', { className:'axn-sub' }, '\u9002\u914d\u5668\uff1a' + (d.providerStatus.adapterInstalled ? '\u5df2\u5b89\u88c5' : '\u672a\u5b89\u88c5') + ' \u00b7 \u914d\u7f6e\uff1a' + (d.providerStatus.providerConfigured ? '\u5df2\u5199\u5165' : '\u672a\u5199\u5165') + ' \u00b7 Bridge\uff1a' + (d.providerStatus.bridgeReachable ? '\u53ef\u7528' : '\u4e0d\u53ef\u7528') + ' \u00b7 Token\uff1a' + (d.providerStatus.tokenExists ? '\u5b58\u5728' : '\u7f3a\u5931')) : h('div', { className:'axn-sub' }, '\u70b9\u51fb\u81ea\u52a8\u68c0\u6d4b AstrBot \u8fd0\u884c\u5e93\u548c Provider \u914d\u7f6e\u3002'),
                  d.providerStatus && d.providerStatus.error ? h('div', { className:'axn-notice error' }, d.providerStatus.error) : null,
                  d.providerStatus && !d.providerStatus.configExists ? h('div', { className:'axn-notice' }, '\u9996\u6b21\u4f7f\u7528\u8bf7\u5148\u542f\u52a8\u4e00\u6b21 AstrBot\uff0c\u751f\u6210 cmd_config.json\u3002') : null,
                  h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                    h('button', { className:'axn-btn primary', disabled, onClick:props.onAutoConfigureProvider }, props.busy === 'provider' ? '\u914d\u7f6e\u4e2d...' : '\u81ea\u52a8\u68c0\u6d4b\u5e76\u914d\u7f6e'),
                  ),
                ) : null,
                h('div', { className:'axn-field wide', style:{ border:'1px solid var(--dsw-alias-border-l2, rgba(31,35,41,.12))', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:9 } },
                  h('div', { style:{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' } },
                    h('strong', { style:{ flex:1 } }, '实例配对'),
                    d.peer ? h('span', { className:'axn-badge' }, 'PAIRED') : null,
                  ),
                  d.peer
                    ? h(React.Fragment, null,
                        h('div', { className:'axn-sub' }, '已配对：' + d.peer.name + ' · ' + (d.peer.type === 'a' ? 'AstrBot' : 'NapCat') + ' · OneBot 端口 ' + (d.instance.pair && d.instance.pair.onebotPort || '-')),
                        d.instance.pair && !d.instance.pair.napcatConfigApplied
                          ? h('div', { className:'axn-notice' }, 'NapCat 还没有 onebot11 配置。让 NapCat 登录一次 QQ，然后点应用配对配置。')
                          : h('div', { className:'axn-sub' }, 'OneBot 配置已写入 AstrBot 和 NapCat。启动两边后即可连接。'),
                        h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                          h('button', { className:'axn-btn primary', disabled, onClick:props.onApplyPair }, props.busy === 'pair-apply' ? '应用中...' : '应用配对配置'),
                          h('button', { className:'axn-btn', disabled, onClick:props.onCopyPairToken }, '复制配对 Token'),
                          h('button', { className:'axn-btn danger', disabled, onClick:props.onUnpair }, '解除配对'),
                        ),
                      )
                    : h(React.Fragment, null,
                        h('div', { className:'axn-sub' }, d.instance.type === 'a' ? '选择一个 NapCat 实例自动生成两边 OneBot 配置。' : '选择一个 AstrBot 实例自动生成两边 OneBot 配置。'),
                        h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                          h('select', { className:'axn-select', style:{ flex:'1 1 220px' }, value:d.pairCandidate || '', disabled:disabled || !(d.candidates && d.candidates.length), onChange:(e)=>props.onChange('pairCandidate', e.target.value) },
                            (d.candidates && d.candidates.length) ? d.candidates.map((item)=>h('option', { key:item.id, value:item.id }, item.name + ' · ' + (item.type === 'a' ? 'AstrBot' : 'NapCat') + ' · ' + item.port)) : h('option', { value:'' }, '没有可配对的实例'),
                          ),
                          h('button', { className:'axn-btn primary', disabled:disabled || !d.pairCandidate, onClick:()=>props.onPair(d.pairCandidate) }, props.busy === 'pair' ? '配对中...' : '配对'),
                        ),
                        h('div', { className:'axn-sub' }, 'AstrBot 需要先启动一次，生成 data/cmd_config.json 后才能写入配对配置。'),
                      ),
                ),
                h('div', { className:'axn-field wide', style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                  h('button', { className:'axn-btn primary', disabled, onClick:props.onSaveSettings }, props.busy === 'settings' ? '保存中...' : '保存运行设置'),
                  h('button', { className:'axn-btn', disabled:disabled || item.live || !(d.runtimeOptions && d.runtimeOptions.length), onClick:props.onUseLatestRuntime }, '使用最新已安装版'),
                  h('button', { className:'axn-btn', disabled, onClick:props.onOpenWebui }, '内嵌 WebUI'),
                  item.webui && item.webui.token ? h('button', { className:'axn-btn', disabled, onClick:props.onCopyToken }, '复制 WebUI Token') : null,
                ),
              )
            : tab === 'config' ? h('div', { style:{ display:'flex', flexDirection:'column', gap:10 } },
                d.files && d.files.length
                  ? h('div', { className:'axn-file-row' }, d.files.map((file)=>h('button', { key:file.rel, className:'axn-pill' + (d.selectedFile === file.rel ? ' active' : ''), disabled, title:file.rel, onClick:()=>props.onLoadFile(file.rel) }, file.label)))
                  : h('div', { className:'axn-empty' }, '没有找到可编辑的配置文件。实例首次启动后通常会自动生成。'),
                d.selectedFile ? h(React.Fragment, null,
                  h('div', { className:'axn-label' }, d.selectedFile + ' · 保存前校验 JSON 并自动备份'),
                  h('textarea', { className:'axn-textarea', value:d.text || '', disabled, spellCheck:false, onChange:(e)=>props.onChange('text', e.target.value) }),
                  h('div', { style:{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' } },
                    h('button', { className:'axn-btn primary', disabled, onClick:props.onSaveConfig }, props.busy === 'config' ? '保存中...' : '保存配置'),
                    h('span', { className:'axn-sub' }, '备份目录：' + d.dataRoot + '\\backups\\config\\' + item.id),
                  ),
                ) : null,
              )
            : h('div', { style:{ display:'flex', flexDirection:'column', gap:10 } },
                h('div', { className:'axn-field wide', style:{ border:'1px solid var(--dsw-alias-border-l2, rgba(31,35,41,.12))', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:9 } },
                  h('div', { style:{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' } },
                    h('strong', { style:{ flex:1 } }, '整包备份'),
                    d.backups && d.backups.length ? h('span', { className:'axn-badge' }, String(d.backups.length) + ' 个') : null,
                  ),
                  h('div', { className:'axn-sub' }, '全量打包实例目录'),
                  h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' } },
                    h('button', { className:'axn-btn primary', disabled:disabled || item.live, onClick:props.onCreateBackup }, props.busy === 'backup' ? '备份中...' : '创建备份'),
                    item.live ? h('span', { className:'axn-sub' }, '运行中请先停止') : null,
                  ),
                  d.backupRoot ? h('div', { className:'axn-sub' }, '备份目录：' + d.backupRoot) : null,
                ),
                d.backups && d.backups.length
                  ? d.backups.map((b)=>h('div', { key:b.file, style:{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', padding:'10px 12px', border:'1px solid var(--dsw-alias-border-l2, rgba(31,35,41,.1))', borderRadius:10 } },
                      h('div', { style:{ flex:'1 1 260px', minWidth:0 } },
                        h('div', { style:{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }, title:b.file }, b.file),
                        h('div', { className:'axn-sub' }, formatBytes(b.size) + ' · ' + formatTime(b.createdAt)),
                      ),
                      h('div', { style:{ display:'flex', gap:6, flexWrap:'wrap' } },
                        h('button', { className:'axn-btn', disabled, onClick:()=>props.onRestoreBackup(b.file) }, props.busy === 'restore' ? '恢复中...' : '恢复为新实例'),
                        h('button', { className:'axn-btn', disabled, onClick:()=>props.onExportBackup(b.file) }, '导出'),
                        h('button', { className:'axn-btn danger', disabled, onClick:()=>props.onDeleteBackup(b.file) }, '删除'),
                      ),
                    ))
                  : h('div', { className:'axn-empty' }, '暂无备份'),
              ),
          h('div', { className:'axn-sub' }, '实例目录：' + (item.dir || '-')),
        ),
      )
    }

    function QqSessionsPanel(props) {
      const sessions = props.sessions || []
      const selected = props.selected || null
      return h('div', { className:'axn-qq-layout' },
        h('div', { className:'axn-card', style:{ gridColumn:'1 / -1' } },
          h('div', { className:'axn-card-head' },
            h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, '专属工作区'), h('div', { className:'axn-id' }, props.workspace && props.workspace.workspaceRoot || '加载中...')),
            h('span', { className:'axn-badge' }, props.workspace && props.workspace.workspaceRoot === props.workspace.defaultRoot ? 'DEFAULT' : 'CUSTOM'),
          ),
          h('div', { className:'axn-sub' }, '新 QQ 会话的文件和临时产物会写入这里；已有会话保留原工作区路径。'),
          h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' } },
            h('input', { className:'axn-input', style:{ flex:'1 1 320px' }, value:props.workspaceDraft || '', placeholder:'例如 D:\\DSH-QQ-Workspace', onChange:(e)=>props.onWorkspaceDraft(e.target.value) }),
            h('button', { className:'axn-btn', disabled:Boolean(props.picking) || Boolean(props.saving), onClick:props.onPickWorkspace }, props.picking ? '选择中...' : '浏览文件夹'),
            h('button', { className:'axn-btn primary', disabled:Boolean(props.saving) || Boolean(props.picking) || !(props.workspaceDraft || '').trim(), onClick:props.onSaveWorkspace }, props.saving ? '保存中...' : '保存工作区'),
          ),
        ),

        h('div', { className:'axn-qq-list' },
          h('div', { style:{ display:'flex', alignItems:'center', gap:8, padding:'4px 2px' } },
            h('strong', { style:{ flex:1, fontSize:13 } }, 'QQ \u4f1a\u8bdd'),
            h('button', { className:'axn-btn', disabled:props.loading, onClick:props.onRefresh }, props.loading ? '\u5237\u65b0\u4e2d...' : '\u5237\u65b0'),
          ),
          sessions.length ? sessions.map((item)=>h('button', {
            key:item.id,
            className:'axn-qq-item' + (selected && selected.id === item.id ? ' active' : ''),
            onClick:()=>props.onSelect(item.id),
            title:item.id,
          },
            h('div', { className:'axn-qq-item-title' }, (item.senderName || item.id) + (item.chatType === 'group' ? ' \u00b7 \u7fa4\u804a' : '')),
            h('div', { className:'axn-qq-item-meta' }, (item.lastMessage || '\u6682\u65e0\u6d88\u606f') + ' \u00b7 ' + (item.messageCount || 0) + ' \u6761'),
          )) : h('div', { className:'axn-qq-empty' }, '\u8fd8\u6ca1\u6709 QQ \u4f1a\u8bdd\u8bb0\u5f55\u3002'),
        ),
        h('div', { className:'axn-qq-detail' },
          selected ? h(React.Fragment, null,
            h('div', { className:'axn-qq-detail-head' },
              h('strong', null, selected.senderName || selected.id),
              h('div', { className:'axn-sub', style:{ margin:0 } }, selected.chatType + ' \u00b7 ' + selected.id),
              h('div', { className:'axn-sub', style:{ margin:0 }, title:selected.workspace || '' }, '\u5de5\u4f5c\u533a\uff1a' + (selected.workspace || '-')),
              h('button', { className:'axn-btn danger', style:{ alignSelf:'flex-start' }, disabled:props.loading, onClick:props.onReset }, '\u6e05\u7a7a\u4f1a\u8bdd'),
            ),
            h('div', { className:'axn-qq-messages' },
              (selected.messages || []).map((message, index)=>h('div', {
                key:String(index),
                className:'axn-qq-msg ' + (message.role === 'user' ? 'user' : 'assistant'),
              },
                message.text,
                h('div', { className:'axn-qq-msg-time' }, message.role + ' \u00b7 ' + (message.at || '')),
              )),
              !(selected.messages && selected.messages.length) ? h('div', { className:'axn-qq-empty' }, '\u8fd9\u4e2a\u4f1a\u8bdd\u8fd8\u6ca1\u6709\u6d88\u606f\u3002') : null,
            ),
            h('div', { className:'axn-qq-compose' },
              h('textarea', { value:props.draft || '', placeholder:'\u4ece\u9762\u677f\u53d1\u9001\u4e00\u6761 QQ \u6d88\u606f', onChange:(e)=>props.onDraft(e.target.value) }),
              h('button', { className:'axn-btn primary', disabled:Boolean(props.sending) || !(props.draft || '').trim(), onClick:props.onSend }, props.sending ? '\u53d1\u9001\u4e2d...' : '\u53d1\u9001'),
            ),
          ) : h('div', { className:'axn-qq-empty' }, '\u9009\u62e9\u5de6\u4fa7\u4e00\u4e2a QQ \u4f1a\u8bdd\u67e5\u770b\u8bb0\u5f55\u3002'),
        ),
      )
    }

    function AstriaXNativePanel() {
      const [data, setData] = useState(null)
      const [tab, setTab] = useState('instances')
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [log, setLog] = useState(null)
      const [webui, setWebui] = useState(null)
      const [detail, setDetail] = useState(null)
      const [createOpen, setCreateOpen] = useState(false)
      const [loading, setLoading] = useState(true)
      const [runtimeStatus, setRuntimeStatus] = useState({ a:null, n:null })
      const [qqSessions, setQqSessions] = useState([])
      const [qqSelected, setQqSelected] = useState(null)
      const [qqLoading, setQqLoading] = useState(false)
      const [qqDraft, setQqDraft] = useState('')
      const [bridge, setBridge] = useState(null)
      const [workspaceInfo, setWorkspaceInfo] = useState(null)
      const [workspaceDraft, setWorkspaceDraft] = useState('')

      const refresh = useCallback(async (silent) => {
        if (!silent) setLoading(true)
        try {
          const [next, bridgeState] = await Promise.all([request('/overview'), request('/bridge/status').catch(()=>null)])
          setData(next)
          if (bridgeState) setBridge(bridgeState)
          if (!silent) setError('')
        } catch (e) {
          if (!silent) setError(e && e.message ? e.message : String(e))
        } finally {
          if (!silent) setLoading(false)
        }
      }, [])

      useEffect(() => {
        void refresh(false)
        const timer = setInterval(() => { void refresh(true) }, 5000)
        return () => clearInterval(timer)
      }, [refresh])

      async function perform(label, path, body, successText) {
        if (busy) return
        setBusy(label)
        setError('')
        setNotice('')
        try {
          await request(path, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body || {}) })
          if (successText) setNotice(successText)
          await refresh(true)
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
        } finally { setBusy('') }
      }

      async function createInstance(form) {
        if (busy) return
        setBusy('create')
        setError('')
        setNotice('')
        try {
          const rec = await request('/create', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(form) })
          setCreateOpen(false)
          setNotice('实例已创建：' + rec.name + ' · 端口 ' + rec.port)
          await refresh(true)
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
        } finally { setBusy('') }
      }

      async function openWebui(item, reload) {
        setError('')
        setWebui((prev) => ({
          item,
          url: reload && prev ? prev.url : '',
          externalUrl: reload && prev ? prev.externalUrl : '',
          token: reload && prev ? prev.token : '',
          credentials: reload && prev ? prev.credentials : null,
          loading: true,
          error: '',
          loadKey: reload && prev ? (prev.loadKey || 0) + 1 : 0,
        }))
        try {
          const info = await request('/webui?id=' + encodeURIComponent(item.id))
          if (!info || !info.url) throw new Error('没有可用的 WebUI 地址')
          if (!info.proxy) throw new Error('当前 DSH 后台仍是旧版本，WebUI 代理尚未加载。请完全退出 DSH，然后重新启动。')
          if (!info.reachable) throw new Error(info.url + ' 还没有监听。先启动实例，或检查端口。')
          let subpath = '/'
          try { subpath = new URL(info.url).pathname || '/' } catch {}
          const proxyUrl = '/.dsh-astriax-native/proxy/' + encodeURIComponent(item.id) + (subpath.startsWith('/') ? subpath : '/' + subpath)
          setWebui({ item, url:proxyUrl, externalUrl:info.url, token:info.token || '', credentials:info.credentials || null, loading:false, error:'', loadKey: reload ? Date.now() : 0 })
        } catch (e) {
          setWebui((prev) => prev ? { ...prev, loading:false, error:e && e.message ? e.message : String(e) } : prev)
        }
      }

      async function reloadWebui() {
        if (webui && webui.item) await openWebui(webui.item, true)
      }

      function openExternalWebui(url) {
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
      }

      async function copyText(text, label) {
        try { await navigator.clipboard.writeText(text); setNotice(label + ' 已复制。') }
        catch { window.prompt('复制' + label, text) }
      }

      async function openLog(item) {
        setError('')
        setLog({ id:item.id, text:'正在读取日志...', path:item.logPath || '' })
        try { setLog(await request('/logs?id=' + encodeURIComponent(item.id) + '&lines=500')) }
        catch (e) { setError(e && e.message ? e.message : String(e)) }
      }

      async function copyToken(item) {
        const token = item && item.webui && item.webui.token
        if (!token) { setError('当前实例没有读取到 WebUI Token。'); return }
        try { await navigator.clipboard.writeText(token); setNotice('WebUI Token 已复制。') }
        catch { window.prompt('复制 WebUI Token', token) }
      }

      async function openDetail(item) {
        setError('')
        setDetail({ instance:item, tab:'settings', files:[], runtimeOptions:[], name:item.name, port:item.port, runtimeTag:item.runtimeTag, autoStart:item.autoStart, autoRestart:item.autoRestart, selectedFile:'', text:'', error:'', napcat:null, napcatError:'', candidates:[], peer:null, pairCandidate:'', dataRoot:data?.info?.dataRoot || '', backups:[], backupRoot:'', providerStatus:null })
        try {
          const next = await request('/detail?id=' + encodeURIComponent(item.id))
          setDetail((prev) => prev ? {
            ...prev,
            instance:next.instance,
            files:next.files || [],
            runtimeOptions:next.runtimeOptions || [],
            name:next.instance.name,
            port:next.instance.port,
            runtimeTag:next.instance.runtimeTag,
            autoStart:next.instance.autoStart,
            autoRestart:next.instance.autoRestart,
            candidates:next.candidates || [],
            peer:next.peer || null,
            pairCandidate:(next.candidates && next.candidates[0] && next.candidates[0].id) || '',
            backups:next.backups || [],
            backupRoot:next.backupRoot || '',
            providerStatus:next.instance && next.instance.type === 'a' ? (prev.providerStatus || null) : null,
          } : prev)
          if (next.files && next.files.length) await loadDetailFile(item.id, next.files[0].rel)
          if (next.instance.type === 'n' && next.instance.live) await loadNapcatStatus(item.id)
          if (next.instance.type === 'a') await loadProviderStatus(item.id)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
      }

      async function loadNapcatStatus(id) {
        try {
          const next = await request('/napcat/status?id=' + encodeURIComponent(id))
          setDetail((prev)=>prev?{...prev,napcat:next,napcatError:''}:prev)
        } catch (e) { setDetail((prev)=>prev?{...prev,napcatError:e && e.message ? e.message : String(e)}:prev) }
      }

      async function quickLoginNapcat(uin) {
        if (!detail) return
        setBusy('napcat-login')
        try {
          await request('/napcat/quick-login', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id, uin }) })
          setNotice('已向 NapCat 发送快速登录请求。')
          await new Promise((resolve)=>setTimeout(resolve, 1500))
          await loadNapcatStatus(detail.instance.id)
        } catch (e) { setDetail((prev)=>prev?{...prev,napcatError:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function refreshNapcatQr() {
        if (!detail) return
        setBusy('napcat-qr')
        try {
          const qr = await request('/napcat/refresh-qr', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id }) })
          await loadNapcatStatus(detail.instance.id)
          if (qr && qr.qrcodeurl) setNotice('二维码已刷新，可在 WebUI 中扫码。')
        } catch (e) { setDetail((prev)=>prev?{...prev,napcatError:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function copyQrPayload(text) {
        try { await navigator.clipboard.writeText(text); setNotice('二维码登录内容已复制。') }
        catch { window.prompt('复制二维码登录内容', text) }
      }

      async function pairInstance(peerId) {
        if (!detail || !peerId) return
        setBusy('pair')
        try {
          const body = detail.instance.type === 'a' ? { astrbotId: detail.instance.id, napcatId: peerId } : { astrbotId: peerId, napcatId: detail.instance.id }
          const result = await request('/pair', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body) })
          setNotice(result.warning ? ('配对已保存：' + result.warning) : '配对完成，两边 OneBot 配置已写入。')
          await refresh(true)
          await openDetail(detail.instance)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function applyPairConfig() {
        if (!detail) return
        setBusy('pair-apply')
        try {
          const result = await request('/pair/apply', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id }) })
          setNotice(result.napcat && result.napcat.applied ? '配对配置已应用到 AstrBot 和 NapCat。' : 'AstrBot 配置已应用；NapCat 还没有 onebot11 配置文件，登录后再点一次。')
          await refresh(true)
          await openDetail(detail.instance)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function unpair() {
        if (!detail) return
        if (!window.confirm('解除这个实例与对端的配对？会清理自动写入的 OneBot 配置。')) return
        setBusy('unpair')
        try {
          await request('/unpair', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id }) })
          setNotice('配对已解除。')
          await refresh(true)
          await openDetail(detail.instance)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function copyPairToken() {
        const token = detail && detail.instance && detail.instance.pair && detail.instance.pair.token
        if (!token) { setError('没有配对 Token。'); return }
        try { await navigator.clipboard.writeText(token); setNotice('配对 Token 已复制。') }
        catch { window.prompt('复制配对 Token', token) }
      }

      async function createBackup() {
        if (!detail) return
        setBusy('backup')
        try {
          const result = await request('/backup', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id }) })
          setNotice('备份已创建：' + result.file + '（' + formatBytes(result.size) + '）')
          await openDetail(detail.instance)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function restoreBackup(file) {
        if (!detail) return
        if (!window.confirm('把这个备份恢复成一个新的实例？不会覆盖当前实例。')) return
        setBusy('restore')
        try {
          const result = await request('/restore', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id, file }) })
          setNotice('已恢复为新实例：' + result.instance.name + '（端口 ' + result.instance.port + '）' + (result.warning ? '；' + result.warning : ''))
          await refresh(true)
          await openDetail(result.instance)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function deleteBackup(file) {
        if (!detail) return
        if (!window.confirm('删除备份 ' + file + '？')) return
        setBusy('backup-delete')
        try {
          await request('/backup/delete', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id, file }) })
          setNotice('备份已删除。')
          await openDetail(detail.instance)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      function exportBackup(file) {
        if (!detail) return
        const url = '/.dsh-astriax-native/backup/export?id=' + encodeURIComponent(detail.instance.id) + '&file=' + encodeURIComponent(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }

      async function saveRuntimeSource(type) {
        const input = document.getElementById('axn-runtime-source-' + type)
        const source = input ? input.value : ''
        setBusy('runtime-source:' + type)
        setError('')
        try {
          await request('/runtime/sources', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ type, source }) })
          setNotice('更新路径已保存。')
          await refresh(true)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function checkRuntimeSource(type) {
        setBusy('runtime-check:' + type)
        setError('')
        try {
          const info = await request('/runtime/versions?type=' + encodeURIComponent(type))
          setRuntimeStatus((prev)=>({ ...prev, [type]: info }))
          const label = type === 'a' ? 'AstrBot' : 'NapCat'
          setNotice(label + ' 更新路径可用，最新版 ' + ((info.latest && info.latest.tag) || '-'))
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function installLatestRuntime(type) {
        if (busy) return
        setBusy('runtime-install:' + type)
        setError('')
        try {
          const job = await request('/runtime/install', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ type, tag:'' }) })
          setNotice((type === 'a' ? 'AstrBot' : 'NapCat') + ' 运行库安装任务已开始：' + job.step)
          await refresh(true)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function useLatestInstalledRuntime() {
        if (!detail || !detail.runtimeOptions || !detail.runtimeOptions.length) return
        if (detail.instance && detail.instance.live) return
        setBusy('settings')
        setError('')
        try {
          const tag = detail.runtimeOptions[0]
          await request('/update', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id, name:detail.name, port:Number(detail.port), runtimeTag:tag, autoStart:Boolean(detail.autoStart), autoRestart:Boolean(detail.autoRestart) }) })
          setNotice('实例已切换到最新已安装运行库：' + tag)
          await refresh(true)
          await openDetail({ ...detail.instance, origin:'managed' })
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function loadProviderStatus(id) {
        try {
          const status = await request('/runtime/provider/status?id=' + encodeURIComponent(id))
          setDetail((prev)=>prev?{...prev,providerStatus:status}:prev)
        } catch (e) {
          setDetail((prev)=>prev?{...prev,providerStatus:{error:e && e.message ? e.message : String(e)}}:prev)
        }
      }

      async function autoConfigureProvider() {
        if (!detail) return
        setBusy('provider')
        setError('')
        try {
          const result = await request('/runtime/provider/autoconfigure', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id }) })
          setNotice(result.needsStart ? '已完成适配器安装。先启动一次 AstrBot 生成配置，再点一次自动配置。' : (result.restartRequired ? 'DSH Provider 已写入；重启 AstrBot 后生效。' : 'DSH Provider 已配置。'))
          await loadProviderStatus(detail.instance.id)
          await refresh(true)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function startLocalBridge() {
        setBusy('bridge')
        setError('')
        try {
          const result = await request('/bridge/ensure', { method:'POST', headers:{ 'content-type':'application/json' }, body:'{}' })
          setNotice(result && result.running ? 'QQ Bridge 已就绪。' : 'QQ Bridge 正在启动。')
          await refresh(true)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function installPython() {
        if (busy) return
        setBusy('python-install')
        setError('')
        try {
          const job = await request('/runtime/python/install', { method:'POST', headers:{ 'content-type':'application/json' }, body:'{}' })
          setNotice('Python 安装任务已开始：' + job.step)
          await refresh(true)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function loadQqSession(id) {
        if (!id) { setQqSelected(null); return }
        try {
          const data = await request('/qq/session?id=' + encodeURIComponent(id))
          setQqSelected(data.session || null)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
      }

      async function loadQqSessions() {
        setQqLoading(true)
        setError('')
        try {
          const [data, workspace] = await Promise.all([request('/qq/sessions'), request('/qq/workspace').catch(()=>null)])
          const sessions = data.sessions || []
          setQqSessions(sessions)
          if (workspace) { setWorkspaceInfo(workspace); setWorkspaceDraft((prev)=>prev || ((workspace.workspaceRoot || '').includes('\uFFFD') ? (workspace.defaultRoot || '') : (workspace.workspaceRoot || ''))) }
          if (qqSelected && sessions.some((item)=>item.id === qqSelected.id)) await loadQqSession(qqSelected.id)
          else if (sessions.length) await loadQqSession(sessions[0].id)
          else setQqSelected(null)
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setQqLoading(false) }
      }

      async function sendQqMessage() {
        if (!qqSelected || !qqDraft.trim()) return
        setBusy('qq-send')
        setError('')
        try {
          await request('/qq/send', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:qqSelected.id, text:qqDraft.trim() }) })
          setQqDraft('')
          setNotice('消息已发送到 QQ。')
          await loadQqSessions()
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function pickQqWorkspace() {
        setBusy('qq-workspace-pick')
        setError('')
        try {
          const result = await request('/qq/workspace/pick', { method:'POST', headers:{ 'content-type':'application/json' }, body:'{}' })
          if (result && result.path) { setWorkspaceDraft(result.path); setNotice('已选择工作区路径，点击保存工作区生效。') }
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function saveQqWorkspace() {
        if (!workspaceDraft.trim()) return
        setBusy('qq-workspace')
        setError('')
        try {
          const result = await request('/qq/workspace', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ path:workspaceDraft.trim() }) })
          setWorkspaceInfo(result)
          setWorkspaceDraft(result.workspaceRoot || workspaceDraft.trim())
          setNotice(result.bridgeRestarted ? '工作区已保存，bridge 已重启。' : '工作区已保存。')
          await loadQqSessions()
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function resetQqSession() {
        if (!qqSelected) return
        if (!window.confirm('清空这个 QQ 会话的 DSH 上下文和面板记录？')) return
        setBusy('qq-reset')
        try {
          await request('/qq/reset', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:qqSelected.id }) })
          setNotice('QQ 会话已清空。')
          setQqSelected(null)
          await loadQqSessions()
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy('') }
      }

      async function loadDetailFile(id, rel) {
        try {
          const file = await request('/config?id=' + encodeURIComponent(id) + '&file=' + encodeURIComponent(rel))
          setDetail((prev)=>prev?{...prev,selectedFile:rel,text:file.text || '',error:''}:prev)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
      }

      function changeDetail(key, value) { setDetail((prev)=>prev?{...prev,[key]:value}:prev) }

      async function saveDetailSettings() {
        if (!detail) return
        setBusy('settings')
        setDetail((prev)=>prev?{...prev,error:''}:prev)
        try {
          await request('/update', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id, name:detail.name, port:Number(detail.port), runtimeTag:detail.runtimeTag, autoStart:Boolean(detail.autoStart), autoRestart:Boolean(detail.autoRestart) }) })
          setNotice('运行设置已保存。')
          await refresh(true)
          await openDetail({ ...detail.instance, origin:'managed' })
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      async function saveDetailConfig() {
        if (!detail || !detail.selectedFile) return
        setBusy('config')
        setDetail((prev)=>prev?{...prev,error:''}:prev)
        try {
          await request('/config', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ id:detail.instance.id, file:detail.selectedFile, text:detail.text || '' }) })
          setDetail((prev)=>prev?{...prev,error:''}:prev)
          setNotice('配置已保存，并已备份原文件。')
          await refresh(true)
        } catch (e) { setDetail((prev)=>prev?{...prev,error:e && e.message ? e.message : String(e)}:prev) }
        finally { setBusy('') }
      }

      function deleteInstance(item) {
        if (!window.confirm('删除实例 ' + item.name + '？\n实例必须已停止。会一并删除 DSH 自有的实例目录。')) return
        void perform('delete:' + item.id, '/delete', { id:item.id, deleteFiles:true }, '实例已删除。')
      }

      const instances = data?.instances || []
      const runtimes = data?.runtimes || { python:{exists:false}, a:[], n:[] }
      const runtimeSources = data?.runtimeSources || { a:{ source:'https://pypi.org/simple/' }, n:{ source:'https://api.github.com/' } }
      const jobs = data?.jobs || []
      const activeJob = jobs.find((job)=>job.status === 'running')
      const activeRuntimeJob = jobs.find((job)=>job.kind === 'runtime-install' && job.status === 'running')
      const activePythonJob = jobs.find((job)=>job.kind === 'python-install' && job.status === 'running')
      const latestRuntimeJob = jobs.find((job)=>job.kind === 'runtime-install')
      const running = instances.filter(live).length
      const info = data?.info || {}
      const canBootstrap = Boolean(info.bootstrapAvailable)
      const runtimeReady = Boolean(runtimes.python && runtimes.python.exists && (runtimes.a||[]).length && (runtimes.n||[]).length)

      return h('div', { className:'axn-shell' },
        h('div', { className:'axn-head' },
          h('div', { className:'axn-head-main' },
            h('h2', { className:'axn-title' }, 'AstriaX Native'),
            h('p', { className:'axn-sub' }, 'DSH 原生实例管理器。自有运行库、自有实例、自有配置，不读取或控制现有 AstriaX 实例。'),
          ),
          h('div', { className:'axn-actions' },
            h('button', { className:'axn-btn', disabled:Boolean(busy), onClick:()=>void refresh(false) }, loading ? '刷新中...' : '刷新'),
            h('button', { className:'axn-btn primary', disabled:Boolean(busy), onClick:()=>setCreateOpen(true) }, '新建实例'),
          ),
        ),
        error ? h('div', { className:'axn-notice error' }, error) : null,
        notice ? h('div', { className:'axn-notice' }, notice) : null,
        h('div', { className:'axn-summary' },
          h('span', { className:'axn-chip' }, h('span', { className:'axn-dot' + (running ? ' live' : '') }), '运行中 ' + running),
          h('span', { className:'axn-chip' }, '实例 ' + instances.length),
          h('span', { className:'axn-chip' }, runtimes.python && runtimes.python.exists ? 'Python 已安装' : 'Python 未安装'),
          h('span', { className:'axn-chip' }, 'AstrBot ' + (runtimes.a||[]).length + ' 版'),
          h('span', { className:'axn-chip' }, 'NapCat ' + (runtimes.n||[]).length + ' 版'),
        ),
        h('div', { className:'axn-tabs' },
          h('button', { className:'axn-tab' + (tab==='instances'?' active':''), onClick:()=>setTab('instances') }, '实例 ' + instances.length),
          h('button', { className:'axn-tab' + (tab==='runtimes'?' active':''), onClick:()=>setTab('runtimes') }, '运行库'),
          h('button', { className:'axn-tab' + (tab==='qq'?' active':''), onClick:()=>{ setTab('qq'); void loadQqSessions() } }, 'QQ 会话'),
        ),
        tab === 'instances'
          ? (instances.length
              ? h('div', { className:'axn-grid' }, instances.map((item)=>h(Card, {
                  key:item.id, item, busy,
                  onWebui:(x)=>void openWebui(x),
                  onLog:(x)=>void openLog(x),
                  onEdit:(x)=>void openDetail(x),
                  onStart:(x)=>void perform('start:' + x.id, '/start', { id:x.id }, '实例已启动。'),
                  onStop:(x)=>void perform('stop:' + x.id, '/stop', { id:x.id }, '实例已停止。'),
                  onRestart:(x)=>void perform('restart:' + x.id, '/restart', { id:x.id }, '实例已重启。'),
                  onDelete:deleteInstance,
                })))
              : h('div', { className:'axn-empty' }, '还没有实例。先在运行库页复制运行时，再点新建实例。'))
          : tab === 'qq' ? h(QqSessionsPanel, { sessions:qqSessions, selected:qqSelected, loading:qqLoading, onRefresh:()=>void loadQqSessions(), onSelect:(id)=>void loadQqSession(id), onReset:()=>void resetQqSession(), draft:qqDraft, sending:busy==='qq-send', onDraft:setQqDraft, onSend:()=>void sendQqMessage(), workspace:workspaceInfo, workspaceDraft, onWorkspaceDraft:setWorkspaceDraft, onSaveWorkspace:()=>void saveQqWorkspace(), onPickWorkspace:()=>void pickQqWorkspace(), saving:busy==='qq-workspace', picking:busy==='qq-workspace-pick' })
          : h('div', { style:{ display:'flex', flexDirection:'column', gap:12 } },
              h('div', { className:'axn-card' },
                h('div', { className:'axn-card-head' }, h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, 'QQ Bridge'), h('div', { className:'axn-id' }, bridge ? ('127.0.0.1:' + (bridge.port || 18081)) : '自动检测中')), h('span', { className:'axn-badge' }, bridge && bridge.running ? 'READY' : 'OFFLINE')),
                h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 } },
                  h('button', { className:'axn-btn primary', disabled:Boolean(busy) || Boolean(bridge && bridge.running), onClick:()=>void startLocalBridge() }, bridge && bridge.running ? 'Bridge 运行中' : '启动 QQ Bridge'),
                ),
                bridge && bridge.health ? h('div', { className:'axn-sub' }, 'provider=' + (bridge.health.provider || '-') + ' · model=' + (bridge.health.model || '-') + ' · ready=' + String(Boolean(bridge.health.ready))) : null,
              ),
              h('div', { className:'axn-runtime-grid' },
                h('div', { className:'axn-card' },
                  h('div', { className:'axn-card-head' }, h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, 'Python 运行时'), h('div', { className:'axn-id' }, runtimes.python && runtimes.python.path || '-')), h('span', { className:'axn-badge' }, runtimes.python && runtimes.python.exists ? 'READY' : 'MISSING')),
                  h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 } },
                    h('button', { className:'axn-btn' + (runtimes.python && runtimes.python.exists ? '' : ' primary'), disabled:Boolean(busy) || Boolean(activePythonJob), onClick:()=>void installPython() }, activePythonJob ? '安装中...' : (runtimes.python && runtimes.python.exists ? '重新安装 Python' : '安装 Python 3.12.10')),
                  ),
                  activePythonJob ? h('div', { className:'axn-notice' }, 'Python 安装：' + activePythonJob.status + ' · ' + activePythonJob.step + (activePythonJob.error ? ' · ' + activePythonJob.error : '')) : null,
                ),
                h('div', { className:'axn-card' },
                  h('div', { className:'axn-card-head' }, h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, 'AstrBot 运行库'), h('div', { className:'axn-id' }, (runtimes.a||[]).join(', ') || '未安装')), h('span', { className:'axn-badge' }, String((runtimes.a||[]).length))),
                ),
                h('div', { className:'axn-card' },
                  h('div', { className:'axn-card-head' }, h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, 'NapCat 运行库'), h('div', { className:'axn-id' }, (runtimes.n||[]).join(', ') || '未安装')), h('span', { className:'axn-badge n' }, String((runtimes.n||[]).length))),
                ),
              ),
              h('div', { className:'axn-card' },
                h('div', { className:'axn-card-head' }, h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, '运行库更新路径'), h('div', { className:'axn-id' }, 'AstrBot / NapCat'))),
                h('div', { className:'axn-form' },
                  h('label', { className:'axn-field wide' },
                    h('span', { className:'axn-label' }, 'AstrBot 更新路径'),
                    h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                      h('input', { id:'axn-runtime-source-a', className:'axn-input', style:{ flex:'1 1 360px' }, defaultValue: runtimeSources.a.source || '', disabled:Boolean(busy), placeholder:'https://pypi.org/simple/ or local wheelhouse' }),
                      h('button', { className:'axn-btn', disabled:Boolean(busy), onClick:()=>void saveRuntimeSource('a') }, busy === 'runtime-source:a' ? '保存中...' : '保存路径'),
                      h('button', { className:'axn-btn primary', disabled:Boolean(busy), onClick:()=>void checkRuntimeSource('a') }, busy === 'runtime-check:a' ? '检测中...' : '检测'),
                      h('button', { className:'axn-btn', disabled:Boolean(busy) || Boolean(activeRuntimeJob), onClick:()=>void installLatestRuntime('a') }, activeRuntimeJob && activeRuntimeJob.type === 'a' ? '安装中...' : '安装最新版'),
                    ),
                  ),
                  runtimeStatus.a ? h('div', { className:'axn-notice axn-field wide' }, '路径可用：' + ((runtimeStatus.a.latest && runtimeStatus.a.latest.tag) || '-') + ' · 已安装：' + ((runtimeStatus.a.installed || []).join(', ') || '-')) : null,
                  h('label', { className:'axn-field wide' },
                    h('span', { className:'axn-label' }, 'NapCat 更新路径'),
                    h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                      h('input', { id:'axn-runtime-source-n', className:'axn-input', style:{ flex:'1 1 360px' }, defaultValue: runtimeSources.n.source || '', disabled:Boolean(busy), placeholder:'https://api.github.com/ or mirror prefix or local NapCat.Shell.zip' }),
                      h('button', { className:'axn-btn', disabled:Boolean(busy), onClick:()=>void saveRuntimeSource('n') }, busy === 'runtime-source:n' ? '保存中...' : '保存路径'),
                      h('button', { className:'axn-btn primary', disabled:Boolean(busy), onClick:()=>void checkRuntimeSource('n') }, busy === 'runtime-check:n' ? '检测中...' : '检测'),
                      h('button', { className:'axn-btn', disabled:Boolean(busy) || Boolean(activeRuntimeJob), onClick:()=>void installLatestRuntime('n') }, activeRuntimeJob && activeRuntimeJob.type === 'n' ? '安装中...' : '安装最新版'),
                    ),
                  ),
                  runtimeStatus.n ? h('div', { className:'axn-notice axn-field wide' }, '路径可用：' + ((runtimeStatus.n.latest && (runtimeStatus.n.latest.tag || runtimeStatus.n.latest.file)) || '-') + ' · 已安装：' + ((runtimeStatus.n.installed || []).join(', ') || '-')) : null,
                  latestRuntimeJob ? h('div', { className:'axn-notice axn-field wide' }, (latestRuntimeJob.type === 'a' ? 'AstrBot' : 'NapCat') + ' 安装任务：' + latestRuntimeJob.status + ' · ' + latestRuntimeJob.step + (latestRuntimeJob.bytes ? ' · ' + formatBytes(latestRuntimeJob.bytes) : '') + (latestRuntimeJob.error ? ' · ' + latestRuntimeJob.error : '')) : null,
                  h('div', { className:'axn-sub axn-field wide' }, 'AstrBot: PyPI index URL / local wheelhouse. NapCat: GitHub API URL / mirror prefix / local zip.'),
                ),
              ),
              h('div', { className:'axn-card' },
                h('div', { className:'axn-card-head' }, h('div', { className:'axn-card-title' }, h('h3', { className:'axn-name' }, '一次性导入本机运行库'), h('div', { className:'axn-id' }, info.bootstrapSource || '-'))),
                h('p', { className:'axn-sub' }, '只复制运行库文件到 DSH 自有目录，不读取实例数据，不修改来源。复制完成后可完全断开对来源目录的依赖。'),
                activeJob ? h('div', { className:'axn-notice' }, '任务：' + activeJob.step + ' · ' + activeJob.status) : null,
                activeJob && activeJob.error ? h('div', { className:'axn-notice error' }, activeJob.error) : null,
                h('div', { style:{ display:'flex', gap:8, flexWrap:'wrap' } },
                  h('button', { className:'axn-btn primary', disabled:Boolean(busy) || !canBootstrap || Boolean(activeJob), onClick:()=>void perform('bootstrap', '/bootstrap', {}, '运行库复制任务已开始。') }, activeJob ? '复制中...' : runtimeReady ? '重新检查/补齐运行库' : '从本机 AstriaX 复制运行库'),
                  h('span', { className:'axn-sub' }, canBootstrap ? '来源可用' : '来源不可用，后续可接下载安装'),
                ),
              ),
              info.dataRoot ? h('div', { className:'axn-sub' }, 'DSH 数据目录：' + info.dataRoot) : null,
            ),
        log ? h(LogPanel, { log, onRefresh:()=>{ const item = instances.find((x)=>x.id===log.id); if(item) void openLog(item) }, onClose:()=>setLog(null) }) : null,
        webui ? h(WebUiModal, { webui, onClose:()=>setWebui(null), onReload:()=>void reloadWebui(), onExternal:(url)=>openExternalWebui(url), onCopyToken:(text)=>void copyText(text, 'WebUI Token'), onCopyText:(text,label)=>void copyText(text, label) }) : null,
        createOpen ? h(NewInstanceModal, { runtimes, busy: busy === 'create', onClose:()=>setCreateOpen(false), onCreate:(form)=>void createInstance(form) }) : null,
        detail ? h(DetailModal, {
          detail, busy,
          onClose:()=>setDetail(null),
          onTab:(next)=>changeDetail('tab', next),
          onChange:changeDetail,
          onLoadFile:(rel)=>void loadDetailFile(detail.instance.id, rel),
          onSaveSettings:()=>void saveDetailSettings(),
          onSaveConfig:()=>void saveDetailConfig(),
          onCopyToken:()=>void copyToken(detail.instance),
          onOpenWebui:()=>void openWebui(detail.instance),
          onNapcatStatus:()=>void loadNapcatStatus(detail.instance.id),
          onNapcatQuickLogin:(uin)=>void quickLoginNapcat(uin),
          onNapcatRefreshQr:()=>void refreshNapcatQr(),
          onNapcatCopyQr:(text)=>void copyQrPayload(text),
          onAutoConfigureProvider:()=>void autoConfigureProvider(),
          onPair:(peerId)=>void pairInstance(peerId),
          onApplyPair:()=>void applyPairConfig(),
          onUnpair:()=>void unpair(),
          onCopyPairToken:()=>void copyPairToken(),
          onCreateBackup:()=>void createBackup(),
          onRestoreBackup:(file)=>void restoreBackup(file),
          onExportBackup:(file)=>void exportBackup(file),
          onDeleteBackup:(file)=>void deleteBackup(file),
          onUseLatestRuntime:()=>void useLatestInstalledRuntime(),
        }) : null,
        h('div', { className:'axn-sub', style:{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' } },
          h('span', null, '数据目录：' + (info.dataRoot || '-')),
          h('span', null, '任务 ' + jobs.length + ' · ' + (data?.time ? formatTime(data.time) : '')),
        ),
      )
    }

    const inject = ['slots']
    function apply(ctx) {
      let styleNode = document.getElementById('dsh-astriax-native-style')
      if (!styleNode) { styleNode = document.createElement('style'); styleNode.id = 'dsh-astriax-native-style'; document.head.append(styleNode) }
      styleNode.textContent = css + webuiCss
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name:'settings.section',
        id:'astriax-native',
        order:26,
        label:()=> 'AstriaX Native',
        inject:()=>({}),
      }, AstriaXNativePanel))
    }
    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
