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

### Architecture Decisions

- **Handler-per-type**: every Telegram message type (text, photo, voice, video, document,
  audio, callback) has its own handler file, all following the same guard sequence:
  `userId/chatId check → groupFilter → auth → rateLimit → session → process`.
- **Streaming state machine**: `createStatusCallback()` (`handlers/streaming.ts`) returns a
  `StatusCallback` driving a 5-state machine: `thinking → tool → text → segment_end → done`.
  Tool messages are ephemeral (deleted on `done`), text messages persist.
- **Per-user sessions**: `const sessions = new Map<number, ClaudeSession>()` in `session.ts`.
  Each user gets isolated Claude session state; nothing is shared between users.
- **Sequentialize middleware**: `@grammyjs/runner` sequentializes per `chat.id` to prevent
  races. Commands (`/`-prefix), interrupts (`!`-prefix) and callbacks bypass sequentialization
  so they still work while a request is in flight.
- **File-based IPC for ask_user**: the `ask_user` MCP server writes JSON files to
  `~/.lydia-bibel-bot/ask-user/`; the bot polls for pending requests after the tool call.
  A `user_id` field in the request file prevents cross-user hijacking.
- **Media-group buffering**: `createMediaGroupBuffer()` collects album items with a 1s timeout
  (`MEDIA_GROUP_TIMEOUT`). The first item triggers the rate limit; later items only append.
- **Reasoning effort instead of a token budget**: `getEffortLevel()` in `session.ts` maps
  keywords to `low` / `high` / `xhigh` and passes them as `effort` alongside
  `thinking: { type: "adaptive" }`. There is no fixed `maxThinkingTokens` any more; the model
  decides when to think, the effort level only sets how deep.
- **`config.ts` import side effects**: importing it runs top-level `await` (mkdir, `Bun.write`),
  PATH mutation and env validation with `process.exit(1)`. Always import it at module top
  level, never lazily.

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
- `CLAUDE_MODEL` - Model id (default `claude-sonnet-5`)
- `ALLOWED_PATHS` - Directories Claude can access
- `WHISPER_MODE` - Voice transcription mode (`local` or `off`)

MCP servers defined in `mcp-config.ts`.

### Bible Tools (hosted MCP server)

Bible data comes from [bibelstudium-mcp](https://github.com/fidpa/bibelstudium-mcp) over HTTP,
configured as the `"bible"` entry in `mcp-config.ts`:

```ts
"bible": { type: "http", url: "https://mcp.bibelstudium-mcp.de/mcp" }
```

Nothing to install and no local database. The endpoint is read-only and exposes seven
tools, all prefixed `mcp__bible__` inside the Agent SDK. Five German editions are
selectable per call via `translation` (SLT default, plus LUT/ELB/MB/SCH), alongside the
original-language tools. Every response carries a `quellen` array with the attribution the
licence requires. Editions with a verbatim cap say so in `gekuerzt` and `hinweis`; the
persona rules in `CLAUDE.md` tell Lydia to pass that on instead of filling the gap from
memory. Status lines for these tools are built in `formatting.ts` (see "Bible MCP tool
status" under Patterns), and `DISALLOWED_TOOLS` in `config.ts` is where a redundant second
Bible server would be blocked.

#### The seven tools

- **`bible_lookup`** - exact German verses by book/chapter/verses/translation.
  SLT and SCH are capped at **20 verses of wording per call**; beyond that the
  response carries `gekuerzt` (`verse_max`, `im_wortlaut`, `ohne_wortlaut`) and
  `reference` names what was actually returned. The cap applies per call, not
  per conversation, so a second call fetches the rest, but never let the model
  fill the gap from memory. Footnote markers are stripped from `text` and the
  content arrives in `fussnoten`. Bracketed *words* like `[sehr]` are different:
  they are the edition's supplied words and must stay. Editions number Psalms
  differently (Ps 22: SLT/MB 32 verses, LUT/ELB/SCH 31); `hinweis` warns about it,
  and cross-edition comparison must match on wording, not on verse number.
- **`bible_original`** - one verse word-by-word from the original text with lemma,
  Strong number and morphology. OT → Hebrew (WLC); NT → Greek, with `texttyp`
  selectable: `byzantine` (Majority Text, default), `sblgnt` (critical),
  `tr` (Textus Receptus).
- **`bible_crossrefs`** - cross-references for one verse (Treasury of Scripture
  Knowledge expanded, OpenBible.info, CC-BY), ranked by votes, each with its German
  text. For multi-verse targets quote from `verse_einzeln` (one entry per verse)
  rather than from `text`: the latter embeds verse numbers in the string, and
  quoting from it dropped the opening and closing verse (observed on Jn 11:25-26).
  Where `abschnitt_gekuerzt` appears, the passage reaches further than the verses
  delivered, so the citation covers only what is present.
- **`bible_concordance`** - all occurrences of an original-language word (by Strong's
  number like `G26`/`H7225`, or exact lemma) with totals, per-book distribution,
  surface forms and English lexicon data: Tyndale gloss, Strong's definition, and
  (Greek only) the full Abbott-Smith entry in `lexikon`. Note that `kjv_woerter`
  describes the King James wording, not the original-language word; "charity" for
  ἀγάπη misleads in German, so do not relay it as a gloss.
- **`bible_search`** - full-text search over the German text: words, "phrases",
  prefix with `*`, optional book filter, umlauts folded. `treffer` counts verses,
  not word occurrences, because a verse can match several times; the occurrence
  count is `vorkommen_gesamt`, which is omitted above 1000 hits and must not be
  extrapolated. Matches are marked `⟦…⟧` in the verse text; strip the markers when
  quoting.
- **`bible_compare`** - word-diff of one NT verse across the three Greek editions
  (accent-normalised), which is what surfaces variants like the Comma Johanneum.
  The response also carries `bezeugung`: per-word attestation across eight editions
  (NA27/28, Tyndale House, SBL, Westcott-Hort, Tregelles, TR, Byzantine; STEPBible
  TAGNT), listing only words whose witness set deviates. Two traps here. First, the
  TAGNT notes are not the edition text: they name only STEPBible's own witnesses,
  and its "Byz" is not Robinson-Pierpont 2005 (the two disagree in roughly 11 % of
  NT verses) even though the same call labels its own byzantine text "Byz" under
  `editionen`, so do not infer one from the other. Second, a missing `bezeugung`
  means "no data", not "unattested": nine NT verses have no TAGNT row (e.g. Jn 7:53),
  and the verse itself may well be present in byzantine and TR, as it is there.
  When `warnung` and `quellenkonflikte` appear at the top of a response, relay them,
  because they qualify the answer about that verse.
- **`bible_server_info`** - server version and configuration.

#### MCP resources

Four MCP resources answer what `bible_server_info` leaves open, and they are worth
reading rather than merely listing: `bible://uebersetzungen` (per edition: licence,
required attribution, `verse_max`), `bible://quellen`, `bible://editionen`,
`bible://buecher`. `bible://uebersetzungen` is the authority for attribution: SLT
requires "© 2000 Genfer Bibelgesellschaft" and SCH its own line, while LUT/ELB/MB
carry `nennung: null` and need none. This matters for anything written to `exports/`.

#### Operational facts

Two things worth knowing before measuring against the endpoint: Cloudflare in front of
it rate-limits at roughly 17 requests per 10 seconds (HTTP 429), and a bare `curl` needs
both `Content-Type: application/json` and `Accept: application/json, text/event-stream`,
because responses come back as SSE.

### Runtime Files

- `~/.lydia-bibel-bot/sessions.json` - Session persistence for `/resume`
- `~/.lydia-bibel-bot/audit.log` - Audit log (configurable via `AUDIT_LOG_PATH`)
- `/tmp/telegram-bot/` - Downloaded photos/documents (cleaned up automatically)

## Patterns

**Adding a command**: Create handler in `commands.ts`, register in `index.ts` with `bot.command("name", handler)`

**Adding a message handler**: Create in `handlers/`, export from `index.ts`, register in `index.ts` with appropriate filter

**Streaming pattern**: All handlers use `createStatusCallback()` from `streaming.ts` and `session.sendMessageStreaming()` for live updates.

**Bible MCP tool status (Lydia-style)**: in `formatting.ts`, Bible tools get their own status
lines instead of the generic MCP format. The split is by *tool name*, not by server prefix,
because one server serves both the German wording and the original-language text:
`bible_lookup`/`_search`/`_crossrefs` render as `📖 blättert in der Schrift... {ref}`,
`bible_original`/`_concordance`/`_compare` as `📜 prüft den Grundtext... {ref}`. Both the
`mcp__bible__` and `mcp__bibelstudium__` prefixes are matched, so renaming the server key in
`mcp-config.ts` or adding a second Bible server leaves the lines intact. Calls without a
usable reference fall back to the ref-less variant.

**Type checking**: Run `bun run typecheck` periodically while editing TypeScript files. Fix any type errors before committing.

**After code changes**: Restart the bot so changes can be tested (`bun run start`).

## Gotchas & Anti-Patterns

These cost real debugging time. Locations are given as file + a searchable anchor rather than
line numbers (which drift); grep the snippet to jump there.

- **A single `*` means two different things** (`formatting.ts`, search `(?<!\*)\*(.+?)\*(?!\*)`).
  In `markdownToHtml` it becomes `<b>` (Telegram convention, not standard Markdown), but in
  `inlineToHtml` (used for table cells) it becomes `<i>`. Do not assume one rule covers both
  paths; check which converter the text goes through.
- **Chunk splitting can break HTML tags** (`handlers/streaming.ts`, search `TELEGRAM_SAFE_LIMIT`).
  `sendChunkedMessages` splits on character count, so a tag can be cut across chunks; the
  fallback catches the parse failure and re-sends as plain text. Do not remove that fallback.
- **Callback data splits on colons** (`handlers/callback.ts`, search `askuser:`). Format is
  `askuser:{requestId}:{optionIndex}` and the code does `split(":")` with a strict length check;
  it only works because `requestId` is a UUID and carries no colons. If the format changes,
  use `split(":", 3)`.
- **`#` is stripped inside blockquotes** (`formatting.ts`, search `slice(5).replace(/#/g`). A
  Telegram-mobile workaround removes *all* `#` characters in blockquote lines, not just header
  markers.
- **Circular dependency `utils.ts ↔ session.ts`** (`utils.ts`, search `sessionModule`).
  `checkInterrupt()` needs `getSession()`, but `session.ts` already imports `utils.ts`; it is
  resolved with a lazy `await import("./session")`. Do not turn it into a top-level import.
- **`handleRetry` builds a fake context via shallow spread** (`handlers/commands.ts`, search
  `fakeCtx`). It works only because `handleText` reads just `ctx.message.text`, `ctx.from` and
  `ctx.chat`. Widen the spread if that ever changes.
- **Temp files are not cleaned up by the handlers**: downloads land in `/tmp/telegram-bot/` and
  are reaped only by the periodic `cleanupTempFiles()` in `utils.ts` (10-minute interval,
  30-minute max age).

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
