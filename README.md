# DSH AstriaX Native

A native DSH plugin that manages its own AstrBot and NapCat runtimes, connects
AstrBot to DSH as the default model provider, and exposes a QQ session panel.

## Included in this version

- AstrBot / NapCat instance lifecycle, logs, config editing and backups.
- Python 3.12.10, AstrBot and NapCat runtime provisioning.
- AstrBot dashboard and NapCat WebUI proxying.
- OneBot pairing and QQ login helpers.
- DSH provider adapter and AstrBot tool gateway.
- QQ session list, transcripts, per-session workspace, clear and send controls.
- User-selectable QQ workspace root from the plugin panel.
- Automatic local bridge startup through the DSH host plugin.
- A generated shared `qq` DSH profile for headless QQ processing.

## Requirements

- Windows 10/11.
- DeepSeek Harness desktop installed.
- QQ NT installed if you want to use QQ.
- Internet access for first runtime installation.
- PowerShell 5.1 or newer.

Python, AstrBot and NapCat runtimes are not bundled. They are downloaded and
installed into the plugin data directory on first use.

## Install
Recommended installation is through DSH itself:

1. Open DSH -> Plugins -> Add plugin.
2. Enter `dsh-astriax-native`.
3. Install and fully restart DSH.

Do **not** run `install.cmd` when the plugin was installed from npm. Choose one
installation method only; mixing a manual junction with the DSH package manager
can make the profile dependency layout inconsistent.

For a manual portable install only:

1. Extract this folder to a stable ASCII path, for example
   `D:\DSH-Plugins\dsh-astriax-native`.
2. Double-click `install.cmd`.
3. Fully restart DSH.
4. Open `Settings -> AstriaX Native`.

Default data root:

`%USERPROFILE%\.dsh\astriax-native`

The installer backs up `cordis.patch.yml` before writing its marked block.

## First setup

In `Settings -> AstriaX Native -> Runtimes`:

1. Install Python 3.12.10.
2. Install latest AstrBot.
3. Install latest NapCat.
4. Create an AstrBot instance.
5. Start AstrBot once so it generates `data/cmd_config.json`.
6. Open the instance settings and click `Auto detect and configure DSH Provider`.
7. Restart the AstrBot instance. The model provider page should show the DSH
   provider as the default.
8. Create a NapCat instance, start it, log in to QQ, then pair it with AstrBot.

The DSH provider is also checked and refreshed automatically every time an AstrBot instance starts once its cmd_config.json exists.

Do not log the same QQ account into two NapCat instances at the same time.

## Bridge

Check health:

`http://127.0.0.1:18081/health`

If it is not running, double-click `start-bridge.cmd` or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-bridge.ps1
```

Bridge configuration is stored at:

`%USERPROFILE%\.dsh\astriax-native\bridge-config.json`

The bridge token is stored at:

`%USERPROFILE%\.dsh\qq-bridge-token.txt`

Never share that token.

## Provider adapter

The native AstrBot runtime needs a small provider adapter. The UI can install it
automatically. For manual repair:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-provider.ps1 `
  -AstrBotRuntimeDir "C:\Users\you\.dsh\astriax-native\runtimes\a\v4.28.2"
```

If an instance already exists, pass `-InstanceDir` as well to write the provider
entry into its `cmd_config.json`.

The adapter must be reapplied after replacing the AstrBot runtime version.

## Notes

- No external model API key is required for the DSH chat provider.
- Memory embedding is disabled by default; enabling it needs an embedding model.
- NapCat asset downloads may need a mirror prefix in the runtime update path.
- Existing AstriaX installations and instances are never modified.


## QQ session panel

The AstriaX Native settings page has a `QQ Sessions` tab.

- Each QQ conversation is listed separately.
- Each entry stores recent user messages and DSH replies.
- A per-session workspace is created under `qq-work/sessions/<session-key>`.
- The bridge persists transcripts in `bridge/transcripts.json`.
- A selected session can be cleared, which resets its DSH context and removes its panel record.

The bridge records provider requests that have a non-empty AstrBot session ID.
Internal memory-summary calls without a session ID are not added to the QQ panel.

## From the DSH plugin marketplace

Install the plugin from the marketplace and fully restart DSH. The host plugin
starts the local bridge automatically. Open AstriaX Native and install Python,
AstrBot and NapCat from the Runtimes tab.

## From the zip

Extract the folder, run `install.cmd`, then fully restart DSH. The zip is a
portable fallback for environments that do not install marketplace bundles.

## Tool gateway

When AstrBot exposes LLM tools, the DSH provider sends their schemas to DSH and
accepts a single JSON tool call back. AstrBot then executes the tool and returns
the result on the next turn. This covers memory recall/remember, meme tools and
other AstrBot plugin tools without giving DSH the AstrBot process internals.



## QQ workspace

Open `AstriaX Native -> QQ Sessions`. The workspace card shows the current root.
Enter any absolute Windows directory, or use `Browse folder` on Windows, then click `Save workspace`. The plugin
creates the directory, persists it in `settings.json`, restarts the local bridge
and applies the new root to new QQ sessions. Existing sessions keep the
workspace path recorded in their transcript.

Default root:

`%USERPROFILE%\.dsh\astriax-native\qq-work`
