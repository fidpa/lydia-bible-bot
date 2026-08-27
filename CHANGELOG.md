# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.4] - 2026-08-27: Release notes rewritten to lead with effect, and three wrong numbers corrected

Every entry in this file was rewritten against the release-message rules this portfolio
works to: each entry now opens with a bold line that says what changes for an operator, the
implementation follows in the paragraph below it, and every entry about code names a file,
function or config variable. Before this pass, none of the 61 entries had a bold line at all.

The rewrite also checked the numbers, and three of them did not hold. Two had been public
since February 2026, one since August. They are corrected below and listed here because a
correction that is not announced is indistinguishable from a silent edit.

No measured value, path or function name was changed other than the three corrections named
here. Version 1.2.4 received the section it never had.

### Fixed
- **The security audit arithmetic did not add up, and said so on the release page since February.**
  The 1.0.0 entry, its release body and `README.md` all stated "17 findings, 13 of which I
  hardened directly, with the remaining 7 documented transparently", which totals 20.
  Recounted against `docs/security-limitations.md` at tag `v1.0.0`: the file lists seven
  limitations, of which five carry an audit ID (C1, C2, C3, M3, M5) and two carry none. So
  twelve of the seventeen findings were fixed outright and five are documented as accepted
  limitations. The 1.0.0 entry also claimed the findings were "all addressed", which
  contradicts the same file's opening sentence, "deliberately left unresolved".
- **The em-dash density that justified the 1.4.1 rewrite was roughly twice the measured value.**
  The entry claimed 31.0 em dashes per 10,000 characters in `CLAUDE.md`. Counted against tag
  `v1.4.0`, the state that entry describes, `CLAUDE.md` held 12 em dashes in 7,353 characters,
  which is 16.3 per 10,000; across all four files the entry names it is 14.6. The figure for
  the bot's own replies (35.2 per 10,000 across 48 answers) is a one-off sample taken outside
  this repository and cannot be reproduced from it; it is now marked as such.
- **The 1.1.0 voice trigger window was stated as five minutes and is 5.5.**
  `VOICE_TRIGGER_EXPIRY_MS` in `src/security.ts` has been `5.5 * 60 * 1000` since that
  release. The release body had the reasoning right (30 seconds of reaction time plus up to
  five minutes of recording), the changelog entry rounded it down.

### Added
- **Version 1.2.4 has a changelog section.** The release that added the missing 1.1.0 to
  1.2.3 sections omitted its own. Its link reference at the foot of this file had existed
  since February, the section had not. It is reconstructed below from the release body and
  the tag.

### Changed
- **Release bodies on GitHub are now the verbatim changelog section, and the titles carry a
  headline.** All fifteen releases had a title that repeated the version number already shown
  next to it in the release list. The bodies of 1.0.0 through 1.2.4 had drifted from their
  sections, and the bodies of 1.2.2 and 1.2.3 were written in German while the rest of the
  repository is English.
- **This file is plain ASCII.** Em dashes, arrows, the greater-or-equal sign and emoji are
  replaced by the words or punctuation they stood for. Where an entry quoted a German status
  string containing emoji, it now describes the string instead of reproducing it.

## [1.5.3] - 2026-08-16: Adaptive thinking, and the Bible status line tells lookup from original-language work

### Changed
- **The default model is `claude-sonnet-5`.** It was `claude-sonnet-4-6`. The variable that
  sets it was undocumented before; `CLAUDE_MODEL` is now listed in `.env.example`,
  `README.md` ("Configuration") and `AGENTS.md`.
- **Thinking depth is no longer capped by a token budget, so short questions cost less and
  hard ones are not cut off.** `maxThinkingTokens` (0 / 10,000 / 50,000) in `src/session.ts`
  is replaced by `thinking: { type: "adaptive" }` plus an `effort` level, so the model decides
  when to think and the keyword tiers only set how deep: no match gives `low`,
  `THINKING_KEYWORDS` gives `high`, `THINKING_DEEP_KEYWORDS` gives `xhigh`. The `/status`
  label (`off` / `normal` / `deep`) is unchanged. `.env.example` no longer advertises
  "50k tokens" for the deep tier.
- **The Telegram status line now says whether Lydia is looking a verse up or working in the
  original languages.** `bible_lookup`, `bible_search` and `bible_crossrefs` render as the
  scripture-browsing line, `bible_original`, `bible_concordance` and `bible_compare` as the
  original-text line; before, all six shared one line. The match in `src/formatting.ts` is on
  the tool name rather than the server prefix, since one server serves both, and both the
  `mcp__bible__` and `mcp__bibelstudium__` prefixes are recognised, so renaming the server key
  in `mcp-config.ts` or adding a second Bible server no longer falls back to the generic MCP
  format without saying so. `bible_search` shows its search term again, which the shared
  branch had lost.
- **Installing no longer emits a peer-dependency warning.** `@anthropic-ai/claude-agent-sdk`
  goes from `^0.3.158` to `^0.3.233` (required for `effort` and adaptive thinking),
  `@modelcontextprotocol/sdk` from `^1.25.1` to `^1.30.0`, `grammy` from `^1.38.4` to
  `^1.45.1`, `zod` from `^4.2.1` to `^4.4.3`, and the `typescript` peer range from `^5` to
  `^5.9.3`. This clears the warning noted in 1.5.2: the SDK asks for
  `@modelcontextprotocol/sdk` `^1.29.0` and now gets 1.30.0. Verified with the CI commands:
  `bun install --frozen-lockfile` reports no changes, `bun run typecheck` passes, and the
  bundle build of all three entry points succeeds.

### Added
- **A second Bible server can be added without the weaker of two answers winning by chance.**
  `DISALLOWED_TOOLS` in `src/config.ts` is wired to the SDK's `disallowedTools` option. It is
  empty by default, since only one Bible server is configured. It exists for the case where a
  second one is enabled: two servers mean two plausible candidates for the same question, and
  the weaker answer is indistinguishable from the better one once it arrives. Blocking the
  redundant tools by name is reliable in a way a system-prompt rule is not.
- **The seven Bible tools are documented well enough to tell a complete citation from a
  truncated one.** The Bible section of `AGENTS.md` documents each tool in full instead of
  only naming them. It covers the response fields that decide whether a citation is complete
  or truncated without notice (`gekuerzt`, `abschnitt_gekuerzt`, `verse_einzeln`,
  `fussnoten`), and the four traps that cost time when read wrong: `treffer` counts verses
  rather than word occurrences, `kjv_woerter` describes the King James rather than the
  original-language word, a missing `bezeugung` means "no data" rather than "unattested", and
  STEPBible's "Byz" is not the same text as the byzantine edition the same call returns. A
  new section covers the four MCP resources, naming `bible://uebersetzungen` as the authority
  for which edition requires which attribution.
- **Seven behaviours that break on innocent-looking edits are written down.** `AGENTS.md`
  gains "Architecture Decisions" and "Gotchas & Anti-Patterns", documenting the handler guard
  sequence, the streaming state machine, sequentialize bypasses and the file-based ask_user
  IPC. Among the seven: a single `*` becomes bold in `markdownToHtml` but italic in
  `inlineToHtml`, and chunk splitting can cut an HTML tag in half.
- **Switching Claude accounts no longer requires reading the source.**
  `docs/sessions.md` gains a "Claude-Authentifizierung" section covering CLI OAuth versus
  `ANTHROPIC_API_KEY`, how to switch accounts, and where the token is and is not stored.

## [1.5.2] - 2026-08-11: A lockfile eleven months out of date, and CI that will now catch the next one

The lockfile still described the dependency tree of May 2026. Its workspace block recorded
`@anthropic-ai/claude-agent-sdk: ^0.1.76` and resolved 0.1.77, the range that 1.3.0 had
replaced with `^0.3.158`; the file had not been regenerated since. CI did not notice because
the lockfile check had been switched off with a comment explaining why.

### Fixed
- **A clean checkout now installs the dependencies the project actually declares.**
  `bun.lock` was regenerated and matches `package.json`. It resolves
  `@anthropic-ai/claude-agent-sdk` 0.3.227, with the SDK's platform packages in place of the
  `sharp` optional dependencies the old version pulled in, and `@anthropic-ai/sdk` 0.116.0 as
  a new transitive dependency. `grammy`, `zod` and `@modelcontextprotocol/sdk` are unchanged.
  Verified afterwards: `bun install --frozen-lockfile` reports no changes, `bun run typecheck`
  and the bundle build of all three entry points pass. One warning remains: the SDK declares a
  peer dependency on `@modelcontextprotocol/sdk` `^1.29.0`, while this project pins `^1.25.1`
  and resolves 1.26.0. Nothing observed has broken, and raising that range is a separate
  change.
- **CI fails on a drifted lockfile again instead of resolving whatever is current.**
  `.github/workflows/lint.yml` installs with `--frozen-lockfile`. The comment explaining why
  the flag had been omitted is gone with it.

## [1.5.1] - 2026-08-09: The Bible endpoint and its English-language alternative are findable from the README

### Changed
- **Readers can now find the Bible server this bot queries, and one that serves English.**
  The "See Also" section of `README.md` names
  [bibelstudium-mcp](https://github.com/fidpa/bibelstudium-mcp), the endpoint in use since
  1.5.0, and points readers who need English text at
  [studybible-mcp](https://github.com/djayatillake/studybible-mcp), the most-starred Bible MCP
  server on GitHub (72 stars, checked 2026-08-09). Neither was discoverable from that section
  before.
- **The English-language server can be enabled without hitting its two known traps first.**
  `mcp-config.example.ts` carries a commented-out entry for it. Its hosted endpoint needs the
  trailing slash, because `/mcp` answers 307 and redirects to plain `http://`, and its 22
  tools are named `word_study`, `lookup_verse`, `search_by_strongs` and so on rather than
  `bible_*`, which means the citation rules in `CLAUDE.md` do not cover them until they are
  extended.

## [1.5.0] - 2026-08-09: Bible data comes from a hosted endpoint, and the repository has CI

Verse lookups no longer read from a SQLite database built at setup time. They go to the
hosted [bibelstudium-mcp](https://github.com/fidpa/bibelstudium-mcp) endpoint, which serves
seven read-only tools where the embedded server served one. The embedded server and its
download step are removed, which is a breaking change for anyone upgrading from 1.4.x: verse
lookups now require network access.

### Added
- **A push or pull request against `main` is checked before it is merged.**
  `.github/workflows/lint.yml` is the first CI this repository has had. It runs
  `bun install`, `bun run typecheck` and a bundle build of all three entry points, with the
  same commands the release checklist runs locally. The eleven releases before this one were
  cut without an automated check; verified by `git ls-tree`, which finds no
  `.github/workflows/` entry at any tag before `v1.5.0`.

### Changed
- **Lydia can now work in the original languages, compare editions and search the full text,
  where she could only look verses up.** Bible data comes from the hosted
  [bibelstudium-mcp](https://github.com/fidpa/bibelstudium-mcp) endpoint
  (`https://mcp.bibelstudium-mcp.de/mcp`, verified against server version 0.6.15) instead of
  the embedded MCP server. Seven read-only tools replace the single `bible_lookup`: verse
  text, original-language text with morphology, concordance, cross-references, full-text
  search, edition comparison, server info. The default translation stays Schlachter 2000, and
  each response carries the attribution its licence requires in `quellen`.
- **The translations Lydia offers are the ones a source actually serves.** `CLAUDE.md` names
  Schlachter 2000, Schlachter 1951, Luther 1912, Elberfelder 1871 and Menge 1939. The old
  entry offered Lutherbibel 2017 and Elberfelder 2006, which no configured source ever
  delivered. New rules cover the other six tools, the verbatim cap of the Schlachter editions,
  and the attribution field.
- **The privacy notice names the Bible endpoint as a data destination.**
  `docs/datenschutz.md` records that it receives a reference or a search term, and not the
  message text, the name or the Telegram ID.
- **Word study and search show their subject in the Telegram status line**, which the
  book-and-chapter format could not display because those two calls carry neither.
- **The licence file states where Bible text comes from now that it is not in the
  repository.** `THIRD_PARTY_LICENSES.md` gains a "Bible Data" section naming the endpoint,
  the editions it serves and the licence each one carries, and points at that project's own
  licence table for the original-language, lexicon and cross-reference data.

### Removed
- **Breaking: verse lookups require network access, and the local Bible database is gone.**
  `bible_mcp/` (server, one-time download script, book-name aliases) and the setup step that
  built its SQLite database are removed. Anyone upgrading from 1.4.x can delete the directory
  and its `bible_mcp/data/` database. Without network access Lydia says so instead of quoting
  from memory.

### Upgrade notes
- Delete `bible_mcp/` and `bible_mcp/data/` after upgrading; nothing reads them any more.
- The host running the bot needs outbound access to `https://mcp.bibelstudium-mcp.de/mcp`.
  There is no local fallback: without it, verse lookups fail and Lydia reports the failure
  rather than answering from the model's memory.

## [1.4.1] - 2026-08-01: The em-dash tic is removed at its source, the system prompt

Lydia reproduced the punctuation habits of her own system prompt. A one-off sample of 48 bot
answers, taken outside this repository and therefore not reproducible from it, put the em-dash
density of her replies at 35.2 per 10,000 characters. `CLAUDE.md` at tag `v1.4.0` held 12 em
dashes in 7,353 characters, which is 16.3 per 10,000; across the four files this release
touches it is 14.6. The prompt was the source of the tic, so the prompt is where it was fixed.

### Changed
- **Lydia stops writing em dashes, because the files that shape her voice no longer contain
  them.** The em dashes are removed from `CLAUDE.md`, `README.md`, `docs/lydia-quellen.md` and
  `docs/sessions.md`, and the affected passages are rewritten as full sentences. Four remain
  in `CLAUDE.md` and five in `docs/lydia-quellen.md`: the first four are the before-and-after
  examples of the new rule itself, the other five sit inside the titles of cited external
  pages, which are quoted as published.
- **The rule is written down so it survives the next edit of the prompt.** A new "Sprachlicher
  Stil" section in `CLAUDE.md` bans em and en dashes, gives before-and-after examples, and
  exempts Bible wording returned by `bible_lookup` so quotations are not reworded. It also
  covers filler openings and the "not X, but Y" formula.

### Removed
- **`docs/bible-mcp-research.md`**, internal research and planning notes that were not
  intended for a public showcase. The file stays reachable through earlier commits and tags;
  history was left untouched deliberately.

## [1.4.0] - 2026-06-27: Chat transcripts export to Markdown, Word and PDF

### Added
- **A stored chat can be handed to someone who does not use Telegram.**
  `scripts/export-chat.ts` exports a transcript to Markdown and, optionally, Word (`.docx`)
  and PDF through pandoc. The output is a cleaned-up question-and-answer dialogue with
  looked-up Bible verses as block quotes; questions are red (`C0392B`), answers green
  (`1E7A34`) in PDF and Word. PDF rendering uses `--pdf-engine=weasyprint`, which handles
  Hebrew and Greek where the default engine does not. Driven by the new `export-chat` package
  script; see the README section "Exporting Chat Transcripts".

## [1.3.1] - 2026-06-20: Lydia has a face in the Telegram contact list

### Added
- **A profile image**, `assets/Lydia.png`, also used as the Telegram avatar. It is
  AI-generated with DALL-E (OpenAI); the provenance is documented in
  `docs/lydia-quellen.md`.

## [1.3.0] - 2026-05-30: Answers come back again on current Claude CLI versions

### Changed
- **The bot stopped returning answers on Claude CLI 2.1.156 and later, without an error to
  show for it.** `@anthropic-ai/claude-agent-sdk` goes from `^0.1.76` to `^0.3.158`; the older
  SDK returned empty responses against those CLI versions, and returned them as success
  rather than as a failure.
- **The default model is `claude-sonnet-4-6`**, up from `claude-sonnet-4-5`.

## [1.2.4] - 2026-02-17: The documentation matches the code it describes

An audit of the project's own documentation found it describing an earlier state of the code
in several places, including a changelog that skipped five releases.

### Added
- **`docs/sessions.md`**, documenting how session state behaves.
- **`docs/lydia-quellen.md`**, the biblical sources behind the Lydia persona.
- **`docs/bible-mcp-research.md`**, Bible API research and implementation notes. Removed
  again in 1.4.1 as internal material.

### Fixed
- **The changelog covers every released version except this one.** The 1.1.0 to 1.2.3
  sections were reconstructed from git history, five releases in total. The section for 1.2.4
  itself was omitted and is supplied by 1.5.4.
- **`AGENTS.md` describes the current architecture.** Its title, line count, and session path
  were corrected, and the `/voice` command and the `media-group.ts` handler were added.
- **`README.md` lists the handlers and documents that exist.** `media-group.ts` and the three
  new documents were added to the architecture tree, and the security finding count was made
  unambiguous. The count itself remained wrong until 1.5.4.
- **`CONTRIBUTING.md`** names `bible_mcp/` in the project structure.

## [1.2.3] - 2026-02-17: Markdown tables survive the trip into a Telegram chat bubble

### Added
- **Tables render legibly on a phone instead of wrapping into noise.**
  `formatMarkdownTable()` in `src/formatting.ts` converts markdown tables to Telegram HTML:
  tables up to 35 characters of total column width become an aligned `<pre>` block, wider ones
  a vertical card layout. Telegram wraps `<pre>` rather than scrolling it, which is what makes
  a wide `<pre>` table unreadable.
- **Bold and italic survive inside table cells**, through `inlineToHtml()` in the same file.

### Changed
- **The persona in `CLAUDE.md`** gained Bible citation guidelines, copyright compliance rules
  and formatting rules.

## [1.2.2] - 2026-02-17: Every user-facing message is German

### Changed
- **The messages a user is most likely to hit when something goes wrong are no longer
  English.** Rate limit, crash retry and stop confirmation were the last English strings; they
  are German across `src/handlers/`.
- **The thinking indicator is a static line** instead of preview text.
- **Status text for non-Bible MCP tools is a single generic line**, since the tool names it
  showed before meant nothing to a reader in a Bible study group.
- **Handler code was made consistent across all message types**, without a change in
  behaviour (`src/handlers/`, 10 files, 43 insertions and 52 deletions).

## [1.2.1] - 2026-02-16: The status line names the passage Lydia is looking up

### Changed
- **A Bible lookup shows the book and chapter it is fetching** instead of the generic MCP tool
  label, through a Bible-specific branch in `src/formatting.ts`.
- **The theological system prompt in `CLAUDE.md`** was refined across persona, formatting
  rules and citation guidelines.

## [1.2.0] - 2026-02-16: Bible verses are looked up, not recalled

### Added
- **Lydia quotes Schlachter 2000 from a database instead of from the model's memory.** A local
  MCP server, `bible_mcp/server.ts`, exposes a `bible_lookup` tool that resolves German book
  names and abbreviations and returns the verse text.
  - `bible_mcp/download.ts`: one-time download of roughly 31,000 verses from the bolls.life
    API into SQLite.
  - `bible_mcp/aliases.ts`: 275 German book-name aliases covering all 66 books, counted at
    this tag (for example "1Mo" for Genesis, "Ps" for Psalms).
- **A ready-made config entry** for the Bible server in `mcp-config.example.ts`. Setup is
  `bun run bible_mcp/download.ts` once, then adding the `"bible"` server to `mcp-config.ts`.

## [1.1.0] - 2026-02-16: Voice messages are transcribed on the machine, not at OpenAI

Voice transcription went to the OpenAI Whisper API, which meant audio from a Bible study group
left the machine. It is now transcribed locally by whisper.cpp, and the OpenAI dependency is
gone from `package.json`.

### Added
- **Audio no longer leaves the machine.** Transcription runs through local whisper.cpp
  (`whisper-cli`) with a German-tuned GGML model (`ggml-german-turbo-q5_0.bin`), fed by an
  ffmpeg pipeline that converts Telegram's OGG/Opus to 16 kHz mono WAV. Configured through
  `WHISPER_MODE`, `WHISPER_CLI_PATH` and `WHISPER_MODEL_PATH` in `src/config.ts`, which warns
  at startup if the binary or the model is missing.
- **A group member can send a voice message without replying to the bot.** The `/voice`
  command sets a one-shot trigger, so the next voice or audio message in that group is
  processed. The trigger is scoped per user and per chat, so two people using it at once do
  not interfere, and it covers voice messages, native audio and audio files sent as documents.
  `VOICE_TRIGGER_EXPIRY_MS` in `src/security.ts` gives it 5.5 minutes: 30 seconds of reaction
  time plus up to five minutes of recording.
- **Unconsumed voice triggers no longer accumulate in memory.** A cleanup pass in
  `src/security.ts` runs every 60 seconds and drops expired triggers.
- **A crafted `audio.file_name` cannot escape the temp directory.** The extension is stripped
  of non-alphanumeric characters before use.
- **Two concurrent voice messages cannot overwrite each other's temp file**, which now carries
  a `crypto.randomUUID()` component.

### Removed
- **The `openai` dependency**, and with it the OpenAI API key from secret redaction.

### Changed
- **Voice and audio handlers check the `/voice` trigger before the group mention filter.**
  `consumePendingVoiceTrigger()` runs ahead of the `shouldProcess` guard in
  `src/handlers/voice.ts`; in the other order the filter would return first and the trigger
  would not be reached in a group.
- **Error messages name `WHISPER_MODE`** where they named `OPENAI_API_KEY`.
- **`docs/datenschutz.md` records that voice data is processed locally** and no longer sent to
  OpenAI. The remaining OpenAI references were removed from the data processing
  documentation.
- **`README.md` and `AGENTS.md`** cover the `/voice` command, the whisper.cpp prerequisites
  and the corrected tech stack. `.env.example` gained the whisper options.

## [1.0.0] - 2026-02-15: Initial release

A security-hardened AI Bible study assistant for Telegram groups, built on
[linuz90/claude-telegram-bot](https://github.com/linuz90/claude-telegram-bot). The bot runs
Claude with `bypassPermissions`, which is a deliberate choice for mobile use and the reason
the security work below exists: the measures are guardrails around an intentionally
unrestricted agent, and `docs/security-limitations.md` says where they stop.

### Added
- **Security audit with 17 findings** (3 Critical, 5 High, 5 Medium, 4 Low). Twelve were
  fixed outright; five (C1, C2, C3, M3, M5) are documented in `docs/security-limitations.md`
  as accepted limitations, alongside two further limitations that carry no audit number.
- **Defense in depth across six layers**: user allowlist, rate limiting (token bucket), path
  validation with symlink resolution, command blocklist (fork bombs, disk destruction,
  privilege escalation, pipe-to-shell), the system prompt, and audit logging.
- **Prompt injection is treated as expected input**: the system prompt carries
  anti-injection rules, and untrusted documents are tagged before they reach the model.
- **What the bot did is reconstructable after the fact**: audit logging in JSON format, with
  automatic secret redaction.
- **A world-readable MCP config is refused**, not read: `mcp-config.ts` permissions are
  checked at startup.
- **A restart can only be triggered by a listed user**, checked against the same allowlist.
- **Downloaded media does not accumulate on disk**; temp files are cleaned up after use.
- **In a group, the bot stays quiet unless addressed**: it responds only to mentions and
  replies.
- **One group's conversation cannot leak into another's**: sessions are isolated per chat,
  with configurable limits.
- **Lydia answers as a Bible study companion**, through the theological system prompt in
  `CLAUDE.md`, with German bot messages throughout.
- **The legal disclosures a German-language group needs are shipped with the bot**: a GDPR
  privacy notice for Telegram groups (`docs/datenschutz.md`) and an EU AI Act transparency
  disclosure in the system prompt.
- **Where the guardrails stop is written down** in `docs/security-limitations.md`, with the
  accepted risks named.
- **Community files**: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.

### Based on
- [linuz90/claude-telegram-bot](https://github.com/linuz90/claude-telegram-bot) (MIT License)
- Core architecture: Grammy Telegram bot, Claude Agent SDK integration, streaming responses,
  multi-modal input (text, voice, photo, document, video), MCP support

[Unreleased]: https://github.com/fidpa/lydia-bible-bot/compare/v1.5.4...HEAD
[1.5.4]: https://github.com/fidpa/lydia-bible-bot/compare/v1.5.3...v1.5.4
[1.5.3]: https://github.com/fidpa/lydia-bible-bot/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/fidpa/lydia-bible-bot/compare/v1.5.1...v1.5.2
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
