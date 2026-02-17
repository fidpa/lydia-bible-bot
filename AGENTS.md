# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run start      # Run the bot
bun run dev        # Run with auto-reload (--watch)
bun run typecheck  # Run TypeScript type checking
bun install        # Install dependencies
```

## Architecture

This is a Telegram bot (~6,000 lines TypeScript) that serves as a Bible study assistant, controllable from your phone via text, voice, photos, and documents. Built with Bun and grammY.

### Message Flow

```
Telegram message → Handler → Auth check → Rate limit → Claude session → Streaming response → Audit log
```

### Key Modules

- **`src/index.ts`** - Entry point, registers handlers, starts polling
- **`src/config.ts`** - Environment parsing, MCP loading, safety prompts
- **`src/session.ts`** - `ClaudeSession` class wrapping Agent SDK with streaming, session persistence (`~/.lydia-bibel-bot/sessions.json`), and defense-in-depth safety checks
- **`src/security.ts`** - `RateLimiter` (token bucket), path validation, command safety checks
- **`src/formatting.ts`** - Markdown→HTML conversion for Telegram, tool status emoji formatting
- **`src/utils.ts`** - Audit logging, voice transcription (local whisper-cli), typing indicators
- **`src/types.ts`** - Shared TypeScript types

### Handlers (`src/handlers/`)

Each message type has a dedicated async handler:
- **`commands.ts`** - `/start`, `/new`, `/stop`, `/status`, `/resume`, `/restart`, `/retry`, `/voice`
- **`text.ts`** - Text messages with intent filtering
- **`voice.ts`** - Voice→text via local whisper-cli, then same flow as text
- **`audio.ts`** - Audio file transcription via local whisper-cli (mp3, m4a, ogg, wav, etc.), also handles audio sent as documents
- **`photo.ts`** - Image analysis with album detection
- **`media-group.ts`** - Album/media group buffering (1s timeout for collecting album items)
- **`document.ts`** - PDF extraction (pdftotext CLI), text files, archives, routes audio files to `audio.ts`
- **`video.ts`** - Video messages and video notes
- **`callback.ts`** - Inline keyboard button handling for ask_user MCP
- **`streaming.ts`** - Shared `StreamingState` and status callback factory

### Security Layers

1. User allowlist (`TELEGRAM_ALLOWED_USERS`)
2. Rate limiting (token bucket, configurable)
3. Path validation (`ALLOWED_PATHS`)
4. Command safety (blocked patterns)
5. System prompt constraints
6. Audit logging

### Configuration

All config via `.env` (copy from `.env.example`). Key variables:
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS` (required)
- `CLAUDE_WORKING_DIR` - Working directory for Claude
- `ALLOWED_PATHS` - Directories Claude can access
- `WHISPER_MODE` - Voice transcription mode (`local` or `off`)

MCP servers defined in `mcp-config.ts`.

### Bible MCP Server (`bible_mcp/`)

Local MCP server providing exact Bible verse lookups from SQLite.

- **`bible_mcp/server.ts`** - MCP server with `bible_lookup` tool
- **`bible_mcp/download.ts`** - One-time download: fetches Schlachter 2000 from bolls.life → SQLite
- **`bible_mcp/aliases.ts`** - German book name aliases (Jesaja→23, 1. Mose→1, Röm→45, etc.)
- **`bible_mcp/data/bible.db`** - SQLite database (~31k verses, ~5 MB, gitignored)

Setup: `bun run bible_mcp/download.ts` (one-time), then add `"bible"` server to `mcp-config.ts`.

### Runtime Files

- `~/.lydia-bibel-bot/sessions.json` - Session persistence for `/resume`
- `~/.lydia-bibel-bot/audit.log` - Audit log (configurable via `AUDIT_LOG_PATH`)
- `/tmp/telegram-bot/` - Downloaded photos/documents (cleaned up automatically)

## Patterns

**Adding a command**: Create handler in `commands.ts`, register in `index.ts` with `bot.command("name", handler)`

**Adding a message handler**: Create in `handlers/`, export from `index.ts`, register in `index.ts` with appropriate filter

**Streaming pattern**: All handlers use `createStatusCallback()` from `streaming.ts` and `session.sendMessageStreaming()` for live updates.

**Type checking**: Run `bun run typecheck` periodically while editing TypeScript files. Fix any type errors before committing.

**After code changes**: Restart the bot so changes can be tested (`bun run start`).

### External Dependencies

PDF extraction uses `pdftotext` CLI instead of an npm package (to avoid bundling issues):

```bash
brew install poppler  # Provides pdftotext
```

### PATH Requirements

When running as a standalone binary (especially from a macOS app), the PATH may not include Homebrew. The launcher must ensure PATH includes:
- `/opt/homebrew/bin` (Apple Silicon Homebrew)
- `/usr/local/bin` (Intel Homebrew)

Without this, `pdftotext` won't be found and PDF parsing will fail silently with an error message.

## Commit Style

Do not add "Generated with Claude Code" footers or "Co-Authored-By" trailers to commit messages.
