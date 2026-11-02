# Changelog

## 0.3.9

- NapCat: fixed the root cause of "start failed or timed out" — DSH runs with `ELECTRON_RUN_AS_NODE=1`, the injected `QQ.exe` inherited it, degraded to a plain Node process, and NapCat's worker died on launch, so the WebUI port never bound. The NapCat child now gets a sanitized environment.
- NapCat: launch `NapCatWinBootMain.exe` directly instead of the official `launcher.bat`, matching AstriaX and avoiding the elevation console window plus registry-based QQ lookup.
- NapCat: every start aligns the instance with AstriaX — runtime template `config`/`plugins`/`cache`/`logs`, `bypass.window=true`, `o3HookMode=0`, and a per-instance `webui.json` with its own port and token, so instances no longer fight over 6099.
- NapCat: the QQ login window no longer pops up; login stays in the WebUI QR flow.
- NapCat: record the injected QQ and injector PIDs and reap reparented orphan QQ processes on stop or failed start.
- NapCat: wait up to 60s for the WebUI port while still treating a live process as started.

## 0.3.8

- Guard client registration and host setup so incompatible DSH versions cannot throw out of the plugin.
- Back up and atomically replace the profile patch during manual installation.
- Refuse manual install.cmd when the same plugin is already installed from npm.

## 0.3.7

- Add built-in PyPI mirrors (Tencent, Tsinghua) with automatic fallback.
- Add NapCat GitHub proxy mirrors (gh-proxy.com, cors.isteed.cc, ghfast.top, ghproxy.net).
- Add runtime version list and install-selected-version controls.
- Add Python runtime mirrors (Huawei, Aliyun, npmmirror) and get-pip fallback.

## 0.3.6

- Fully automatic DSH Provider configuration after the first AstrBot startup, with one automatic restart.

## 0.3.5

- npm package release (same plugin code as 0.3.4).

## 0.3.4

- Hidden native NapCat/QQNT console windows while preserving NapCat logs.
- Kept native NapCat direct startup for reliable login and OneBot pairing.

## 0.3.3

- Fixed Unicode workspace paths selected through the Windows folder picker (UTF-8 Base64 transport).
- Invalid replacement characters in persisted workspace paths now fall back to the default and self-heal.

## 0.3.2

- Added native AstrBot console-window suppression for local shell and restart subprocesses.
- Added default tool-gateway filtering for shell/Python/file execution tools.
- Fixed workspace path persistence and restored the default workspace.

## 0.3.1

- Added user-selectable QQ workspace root, Windows folder picker and automatic bridge restart.

## 0.3.0

- Added native AstrBot/NapCat pairing and OneBot cutover helpers.
- Added automatic local bridge startup from the DSH host plugin.
- Added generated shared `qq` DSH profile.
- Added AstrBot tool gateway: DSH can request registered AstrBot tools.
- Added AstrBot outbound gateway plugin and QQ panel send control.
- Added QQ transcript persistence, per-session workspaces and clear action.
- Added portable package metadata, icon, install/start scripts and marketplace metadata.

## 0.2.0

- Added Python/AstrBot/NapCat runtime provisioning.
- Added DSH provider adapter and auto-configuration.
- Added embedded WebUI proxy, backups and QQ session panel foundation.
