# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-06-27

### Added
- `scripts/export-chat.ts` — export a stored chat transcript to Markdown and, optionally, Word (`.docx`) and PDF via pandoc. Cleaned-up question/answer dialogue with looked-up Bible verses as block quotes; questions colored red, answers green (PDF and Word); PDF uses `--pdf-engine=weasyprint` for clean Unicode/Hebrew rendering. New `export-chat` package script; see README section "Exporting Chat Transcripts".

## [1.3.1] - 2026-06-20

### Added
- Profile image (`assets/Lydia.png`, also used as the Telegram avatar), AI-generated with DALL-E (OpenAI); provenance documented in `docs/lydia-quellen.md`

## [1.3.0] - 2026-05-30

### Changed
- Bump `@anthropic-ai/claude-agent-sdk` from `^0.1.76` to `^0.3.158` (required for compatibility with Claude CLI ≥ 2.1.156; older SDK returned empty responses silently)
- Change default model from `claude-sonnet-4-5` to `claude-sonnet-4-6`

## [1.2.3] - 2026-02-17

### Added
- Markdown table rendering for Telegram (narrow tables as `<pre>` block, wide tables as vertical card layout)
- Inline markdown-to-HTML conversion for table cells (bold, italic)

### Changed
- Extended Lydia persona in CLAUDE.md (Bible citation guidelines, copyright compliance, formatting rules)

## [1.2.2] - 2026-02-17

### Changed
- German localization for remaining English-language user messages (rate limit, crash retry, stop confirmation)
- Simplified thinking indicator to static "denkt nach..." instead of preview text
- Simplified MCP tool status display (generic "arbeitet..." for non-Bible tools)
- Handler code cleanup and consistency improvements across all message types

## [1.2.1] - 2026-02-16

### Changed
- Refined theological system prompt in CLAUDE.md (persona, formatting rules, citation guidelines)

## [1.2.0] - 2026-02-16

### Added
- Bible MCP Server (`bible_mcp/`) for exact verse lookups from local SQLite database
  - `bible_lookup` tool: resolves German book names/abbreviations, returns Schlachter 2000 text
  - `download.ts`: one-time download of ~31k verses from bolls.life API
  - `aliases.ts`: German book name aliases for all 66 books (e.g. "1Mo" → Genesis, "Ps" → Psalms)
- MCP config example for Bible server in `mcp-config.example.ts`

## [1.1.0] - 2026-02-16

### Added
- `/voice` command for group voice message trigger (5-minute window)
- Pending voice trigger system in security module (one-shot, per-user, per-chat)
- Local voice transcription via whisper-cli (whisper.cpp) with German-tuned GGML model
- Audio-to-WAV conversion via ffmpeg for whisper-cli compatibility
- Randomized temp file names for concurrent request safety

### Removed
- OpenAI API dependency for voice transcription (replaced by local whisper.cpp)

### Changed
- Voice/audio handlers now check `/voice` trigger before group mention filter
- Updated error messages to reference `WHISPER_MODE` instead of `OPENAI_API_KEY`

## [1.0.0] - 2026-02-15

### Added
- Security audit with 17 findings (3 Critical, 5 High, 5 Medium, 4 Low), all addressed
- Security hardening: rate limiting (token bucket), path validation with symlink resolution, command blocklist (fork bombs, disk destruction, privilege escalation, pipe-to-shell)
- Anti-prompt-injection rules in system prompt with document safety tagging
- Audit logging with automatic secret redaction and JSON format
- MCP config file permission checks
- Restart message authorization against user allowlist
- Temp file cleanup for downloaded media
- Group chat filtering (bot only responds to @mentions and replies)
- Per-chat session isolation with configurable limits
- Theological system prompt (CLAUDE.md) for Bible study use case
- German localization for bot messages
- GDPR privacy notice for Telegram groups (docs/datenschutz.md)
- EU AI Act transparency disclosure in system prompt
- Security limitations documentation with accepted risks (docs/security-limitations.md)
- Community files: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md

### Based on
- [linuz90/claude-telegram-bot](https://github.com/linuz90/claude-telegram-bot) (MIT License)
- Core architecture: Grammy Telegram bot, Claude Agent SDK integration, streaming responses, multi-modal input (text, voice, photo, document, video), MCP support

[Unreleased]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fidpa/lydia-bible-bot/releases/tag/v1.0.0
