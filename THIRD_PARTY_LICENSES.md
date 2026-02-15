# Third-Party Licenses

## Upstream Project

**claude-telegram-bot**
- Author: Fabrizio Rinaldi
- License: MIT
- Repository: https://github.com/linuz90/claude-telegram-bot
- Copyright: (c) 2025 Fabrizio Rinaldi

### What was adopted

The original project provides a Telegram bot that controls Claude Code from
mobile devices. The core architecture was adopted:

- Grammy-based Telegram bot with message handlers (text, voice, photo, document, video)
- Claude Agent SDK integration with streaming responses
- Session management with persistence
- MCP server configuration
- Telegram message formatting (Markdown to HTML)

### What was added in lydia-bible-bot

- **Domain specialization**: Theological system prompt (CLAUDE.md) for use as a
  Bible study assistant in German-speaking Telegram groups
- **Security hardening**: 13 measures identified and implemented via systematic
  security audit (see [SECURITY.md](SECURITY.md) and
  [docs/security-limitations.md](docs/security-limitations.md))
  - Rate limiting (token bucket)
  - Path validation with symlink resolution
  - Command blocklist (fork bombs, disk destruction, privilege escalation)
  - Anti-prompt-injection in system prompt
  - Document safety tagging
  - Audit logging with secret redaction
  - File permission checks on MCP config
  - Restart message authorization
  - Temp file cleanup
- **Group chat filtering**: Bot only responds when mentioned or replied to
- **Session isolation**: Per-chat session management with configurable limits
- **GDPR documentation**: Privacy notice for Telegram group use (docs/datenschutz.md)
- **German localization**: Bot messages and documentation in German
