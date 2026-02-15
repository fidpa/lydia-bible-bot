# Lydia Bible Bot

[![Release](https://img.shields.io/github/v/release/fidpa/lydia-bible-bot)](https://github.com/fidpa/lydia-bible-bot/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1%2B-black?logo=bun)](https://bun.sh/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)](https://bun.sh/)
[![Maintenance](https://img.shields.io/badge/Maintained-yes-brightgreen.svg)](https://github.com/fidpa/lydia-bible-bot/commits/)
![Last Commit](https://img.shields.io/github/last-commit/fidpa/lydia-bible-bot)

Security-hardened AI Bible study assistant for Telegram groups, built on [linuz90/claude-telegram-bot](https://github.com/linuz90/claude-telegram-bot). Uses Claude (Anthropic) for theological discussion, with local voice transcription via whisper.cpp.

**The Problem**: Running an AI assistant in a Telegram group requires more than just connecting an API. The upstream project provides an excellent foundation for controlling Claude Code via Telegram, but deploying it for a group of users demands systematic security hardening: rate limiting, path validation, command safety checks, prompt injection defenses, and audit logging. After conducting a full security audit and implementing 13 hardening measures, this repository documents the entire process transparently, including the limitations that remain.

## Features

- **Security-First** - 13 hardening measures from a documented security audit (see [Security](#security))
- **Bible Study Focus** - Theological system prompt with citation guidelines, multi-tradition awareness, and copyright-compliant Bible quoting (Schlachter 2000, Elberfelder, Luther 2017)
- **Group Chat Aware** - Only responds when @mentioned or replied to, keeps responses concise in groups
- **Multi-Modal Input** - Text, voice messages (local whisper.cpp transcription), photos, documents (PDF extraction), video
- **Streaming Responses** - Live message updates as Claude generates, with tool status indicators
- **Session Management** - Per-chat sessions with persistence, `/new`, `/stop`, `/resume` commands
- **MCP Integration** - Extensible via Model Context Protocol servers (ask-user inline keyboard, custom tools)
- **GDPR Documentation** - Privacy notice for German Telegram groups (see [docs/datenschutz.md](docs/datenschutz.md))
- **EU AI Act Compliance** - Mandatory AI transparency disclosure in system prompt

## Known Limitations

> **IMPORTANT**: The bot runs Claude Code with `bypassPermissions` mode. This is intentional for mobile UX, but means all security measures are defense-in-depth guardrails, not hard boundaries.
>
> - The command blocklist is best-effort (string matching cannot prevent all shell injection vectors)
> - The Bash tool bypasses path validation (Claude can `cat` any file via shell)
> - Rate limiter state resets on restart
>
> See [docs/security-limitations.md](docs/security-limitations.md) for the full analysis with accepted risks and recommended mitigations.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.1+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- Claude Code CLI installed and authenticated (or Anthropic API key)
- Optional: `whisper-cpp` for voice transcription (`brew install whisper-cpp`) + GGML model
- Optional: `ffmpeg` for voice message conversion (`brew install ffmpeg`)
- Optional: `poppler` for PDF extraction (`brew install poppler`)

### Setup

```bash
git clone https://github.com/fidpa/lydia-bible-bot.git
cd lydia-bible-bot

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your tokens and user IDs

# Run
bun run start
```

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/new` | Start a new conversation (clears session) |
| `/stop` | Stop the current Claude session |
| `/status` | Show session info and rate limit status |
| `/resume` | Resume previous conversation |
| `/restart` | Restart the bot process |
| `/retry` | Retry the last failed message |
| `/voice` | Activate voice processing in groups (5min window) |

## Configuration

All configuration via environment variables (see [.env.example](.env.example)):

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_ALLOWED_USERS` | Yes | Comma-separated Telegram user IDs |
| `CLAUDE_WORKING_DIR` | Recommended | Working directory for Claude (loads CLAUDE.md) |
| `WHISPER_MODE` | Optional | `local` (default) or `off` — voice transcription mode |
| `WHISPER_MODEL_PATH` | Optional | Path to GGML whisper model (default: `models/ggml-*.bin`) |
| `ALLOWED_PATHS` | Optional | Directories Claude can access (default: working dir, ~/Documents, ~/Downloads, ~/Desktop) |
| `RATE_LIMIT_REQUESTS` | Optional | Requests per window (default: 20) |
| `RATE_LIMIT_WINDOW` | Optional | Window in seconds (default: 60) |
| `AUDIT_LOG_PATH` | Optional | Audit log location (default: ~/.lydia-bibel-bot/audit.log) |

MCP servers are configured in `mcp-config.ts` (see [mcp-config.example.ts](mcp-config.example.ts)).

## Security

The bot implements defense-in-depth with 6 security layers:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| 1 | User allowlist | Only authorized Telegram user IDs can interact |
| 2 | Rate limiting | Token bucket prevents abuse (configurable) |
| 3 | Path validation | File operations restricted to allowed directories |
| 4 | Command safety | Dangerous shell patterns blocked (fork bombs, rm -rf /, disk ops) |
| 5 | System prompt | Anti-prompt-injection rules, document safety tagging |
| 6 | Audit logging | All interactions logged with secret redaction |

Additional hardening measures:
- MCP config file permission checks (warns on world-writable)
- Restart message authorization (validates chat ID against allowlist)
- Temp file cleanup for downloaded media
- Symlink resolution in path validation
- Log injection prevention (JSON audit format)

Full details: [SECURITY.md](SECURITY.md)
Architectural limitations: [docs/security-limitations.md](docs/security-limitations.md)

## Architecture

```
lydia-bible-bot/
├── src/
│   ├── index.ts           # Entry point, handler registration, bot startup
│   ├── config.ts          # Environment parsing, MCP loading, safety prompts
│   ├── session.ts         # ClaudeSession class (Agent SDK, streaming, persistence)
│   ├── security.ts        # RateLimiter, path validation, command safety
│   ├── formatting.ts      # Markdown → Telegram HTML conversion
│   ├── utils.ts           # Audit logging, voice transcription, typing indicators
│   ├── types.ts           # Shared TypeScript types
│   └── handlers/
│       ├── text.ts        # Text messages with group mention filtering
│       ├── voice.ts       # Voice → local whisper-cli transcription → Claude
│       ├── photo.ts       # Image analysis with media group buffering
│       ├── document.ts    # PDF extraction, text files, archives
│       ├── audio.ts       # Audio file transcription
│       ├── video.ts       # Video messages and video notes
│       ├── callback.ts    # Inline keyboard (MCP ask-user)
│       ├── streaming.ts   # Shared streaming state and status callbacks
│       ├── commands.ts    # Bot command handlers
│       └── index.ts       # Handler exports
├── ask_user_mcp/          # MCP server for interactive Telegram buttons
├── docs/
│   ├── security-limitations.md  # Architectural security analysis
│   └── datenschutz.md           # GDPR privacy notice (German)
├── CLAUDE.md              # Theological system prompt (loaded by Claude)
├── SECURITY.md            # Security model documentation
└── THIRD_PARTY_LICENSES.md
```

### Message Flow

```
Telegram → grammY handler → Auth check → Group filter → Rate limit
    → ClaudeSession (Agent SDK) → Streaming response → Audit log → Telegram
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | [Bun](https://bun.sh/) |
| Language | TypeScript 5 (strict mode) |
| AI Backend | [Claude Agent SDK](https://docs.anthropic.com/en/docs/build-with-claude/agent-sdk) |
| Voice Transcription | [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (local, GGML model) |
| Telegram Library | [grammY](https://grammy.dev/) |
| Tool Integration | [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) |
| Validation | [Zod](https://zod.dev/) |

### Design Decisions

**Why `bypassPermissions`?** The bot is designed for mobile use, where confirming every file read or shell command would be impractical. Instead of per-action prompts, security relies on defense-in-depth layers (allowlist, rate limiting, path validation, command safety, audit logging).

**Why string-based command blocking?** Full shell AST parsing is impractical, and OS-level sandboxing (containers, bubblewrap) would be the proper solution. The blocklist is a pragmatic guardrail that catches common destructive patterns while documenting its limitations transparently.

**Why German?** The bot serves a German-speaking Bible study group. The system prompt, privacy documentation, and bot messages are in German. The codebase and technical documentation remain in English.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Credits & Attribution

This project is a derivative work based on [claude-telegram-bot](https://github.com/linuz90/claude-telegram-bot) by [Fabrizio Rinaldi](https://github.com/linuz90), licensed under the MIT License.

The original project provides the Telegram-to-Claude-Code bridge architecture. This derivative adds domain specialization (Bible study), systematic security hardening (13 measures from a documented audit), group chat filtering, GDPR documentation, and German localization.

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for full attribution details.

## License

MIT License - see [LICENSE](LICENSE)

Copyright (c) 2025 Fabrizio Rinaldi (original)
Copyright (c) 2025-2026 Marc Allgeier (derivative)

## Author

Marc Allgeier ([@fidpa](https://github.com/fidpa))

**Why I Built This**: I wanted a Bible study assistant for our Telegram group that goes beyond a simple API wrapper. The upstream project gave me the foundation, but deploying an AI agent with `bypassPermissions` for multiple users required a systematic security approach. The audit uncovered 17 findings, 13 of which I hardened directly, with the remaining 7 documented transparently as architectural limitations. This project demonstrates that security work is as much about honest documentation as it is about writing code.

## See Also

- [ubuntu-server-security](https://github.com/fidpa/ubuntu-server-security) - Server hardening (14 components, CIS Benchmark)
- [step-ca-internal-pki](https://github.com/fidpa/step-ca-internal-pki) - Internal PKI with auto-renewal and monitoring
- [bash-production-toolkit](https://github.com/fidpa/bash-production-toolkit) - Production-ready Bash libraries
