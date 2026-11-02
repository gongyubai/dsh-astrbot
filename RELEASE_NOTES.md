# DSH AstriaX Native v0.3.9

NapCat has been rebuilt around what AstriaX actually does, instead of working around symptoms.

## Fixed

- **NapCat never started (the real cause).** DSH itself runs with `ELECTRON_RUN_AS_NODE=1`; the injected `QQ.exe` inherited that variable, came up as a plain Node process, and NapCat's worker died instantly — which is what produced `start failed or timed out`, a silent `6202`, and a permanently blank WebUI. The NapCat child process now gets a sanitized environment, and the WebUI port binds within a couple of seconds.
- **QQ login window popping up.** Two causes removed: the plugin now launches `NapCatWinBootMain.exe` directly instead of the official `launcher.bat` (which probes `net session` and elevates through `wt.exe`), and every instance is aligned on start to `bypass.window=true` / `o3HookMode=0`, matching a working AstriaX instance. Login stays inside the WebUI QR flow.
- **Instances fighting over port 6099.** Each instance now gets its own `config/webui.json` (port + token) before launch, exactly like AstriaX does with `NAPCAT_WEBUI_PREFERRED_PORT`.
- **Orphan QQ after a failed start.** The plugin records the injected QQ and injector PIDs and reaps the whole tree on stop or failed start, so a crashed NapCat can no longer leave a QQ login window behind.

## Changed

- Instances are re-aligned on every start: runtime template `config`/`plugins`/`cache`/`logs`, `.mx-ready`, `napcat.json`, and per-instance `webui.json`.
- The WebUI port wait is now 60s, while a live process still counts as started.

## Install

```text
npm install dsh-astriax-native
```

or add `dsh-astriax-native` in DSH → Plugins → Add plugin.
