# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/fidpa/lydia-bible-bot/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/fidpa/lydia-bible-bot/releases/tag/v1.0.0
