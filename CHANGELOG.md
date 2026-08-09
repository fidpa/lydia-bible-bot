# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.1] - 2026-08-09

### Changed
- `README.md`: the "See Also" section now names [bibelstudium-mcp](https://github.com/fidpa/bibelstudium-mcp), the Bible MCP server this bot has queried since 1.5.0, and points readers who need English text at [studybible-mcp](https://github.com/djayatillake/studybible-mcp), the most-starred Bible MCP server on GitHub (72 stars, checked 2026-08-09). Neither the endpoint nor the alternative was discoverable from that section before.
- `mcp-config.example.ts`: commented-out entry for the same English-language server, with the two things that bite in practice. Its hosted endpoint needs the trailing slash, because `/mcp` answers 307 and redirects to plain `http://`, and its 22 tools are named `word_study`, `lookup_verse`, `search_by_strongs` and so on rather than `bible_*`, which means the citation rules in `CLAUDE.md` do not cover them until they are extended.

## [1.5.0] - 2026-08-09

### Added
- `.github/workflows/lint.yml` — the first CI this repository has ever had. It runs `bun install`, `bun run typecheck` and a bundle build of all three entry points on every push and pull request against `main`, with the same commands the release checklist runs locally. The eleven releases before this one were cut without any automated check.

### Changed
- Bible data now comes from the hosted [bibelstudium-mcp](https://github.com/fidpa/bibelstudium-mcp) endpoint (`https://mcp.bibelstudium-mcp.de/mcp`, verified against server version 0.6.15) instead of the embedded MCP server. Seven read-only tools replace the single `bible_lookup`: verse text, original-language text with morphology, concordance, cross-references, full-text search, edition comparison, server info. Default translation stays Schlachter 2000, and each response carries the attribution its licence requires in `quellen`.
- `CLAUDE.md`: the available translations are now named correctly (Schlachter 2000, Schlachter 1951, Luther 1912, Elberfelder 1871, Menge 1939). The old entry offered Lutherbibel 2017 and Elberfelder 2006, which no configured source ever delivered. New rules cover the other six tools, the verbatim cap of the Schlachter editions, and the attribution field.
- `docs/datenschutz.md`: names the Bible endpoint as a data destination. It receives a reference or a search term, never the message text, the name or the Telegram ID.
- Tool status line in Telegram also shows the subject for word study and search, which carry no book/chapter.
- `THIRD_PARTY_LICENSES.md`: new "Bible Data" section. Bible text is no longer part of this repository, so the section names the endpoint, the editions it serves and the licence each one carries, and points at that project's own licence table for the original-language, lexicon and cross-reference data.

### Removed
- `bible_mcp/` (server, one-time download script, book-name aliases) and the setup step that built its local SQLite database. Anyone upgrading from 1.4.x can delete the directory and its `bible_mcp/data/` database; verse lookups now need network access to the endpoint, and without it Lydia says so instead of quoting from memory.

## [1.4.1] - 2026-08-01

### Changed
- Removed em dashes from the persona and documentation files (`CLAUDE.md`, `README.md`, `docs/lydia-quellen.md`, `docs/sessions.md`) and rewrote the affected passages as full sentences. Measurement across 48 real bot answers showed Lydia reproducing the em-dash density of her own system prompt almost exactly (31.0 per 10k characters in `CLAUDE.md` versus 35.2 in her replies), so the prompt itself was the source of the tic.
- New "Sprachlicher Stil" section in `CLAUDE.md`: bans em and en dashes, gives before/after examples, and explicitly exempts Bible wording returned by `bible_lookup` so quotations are never reworded. Also covers filler openings and the "not X, but Y" formula.

### Removed
- `docs/bible-mcp-research.md` (internal research and planning notes, not intended for the public showcase). The file remains reachable through earlier commits and tags; history was left untouched deliberately.

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

[Unreleased]: https://github.com/fidpa/lydia-bible-bot/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/fidpa/lydia-bible-bot/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/fidpa/lydia-bible-bot/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/fidpa/lydia-bible-bot/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.4...v1.3.0
[1.2.4]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/fidpa/lydia-bible-bot/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fidpa/lydia-bible-bot/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fidpa/lydia-bible-bot/releases/tag/v1.0.0
