# Security

- Never commit bridge tokens, dashboard passwords, QQ credentials or instance data.
- The plugin only listens on loopback for the bridge and AstrBot outbound gateway.
- The DSH tool gateway intentionally filters shell, Python, file and computer-use tools by default.
- If you expose the AstrBot dashboard, change the generated dashboard password and restrict the host.
- Report security issues privately to the repository owner instead of opening a public issue with secrets.

The data directory contains private conversations and is ignored by Git.
