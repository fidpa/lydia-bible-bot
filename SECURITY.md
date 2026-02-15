# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. **Use GitHub Security Advisories**: Navigate to the [Security tab](https://github.com/fidpa/lydia-bible-bot/security/advisories) and click "Report a vulnerability"
3. **Provide details**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Response Timeline

- **Initial Response**: Within 72 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (critical issues prioritized)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

# Security Model

This document describes the security architecture of Lydia Bible Bot.

## Permission Mode: Full Bypass

**This bot runs Claude Code with all permission prompts disabled.**

```typescript
// src/session.ts
permissionMode: "bypassPermissions"
allowDangerouslySkipPermissions: true
```

This means Claude can:
- **Read and write files** without asking for confirmation
- **Execute shell commands** without permission prompts
- **Use all tools** (Bash, Edit, Write, etc.) autonomously

This is intentional. The bot is designed for personal use from mobile, where confirming every file read or command would be impractical. Instead of per-action prompts, we rely on defense-in-depth with multiple security layers described below.

**This is not configurable** - the bot always runs in bypass mode. If you need permission prompts, use Claude Code directly instead.

## Threat Model

The bot is designed for **personal use by trusted users**. The primary threats we defend against:

1. **Unauthorized access** - Someone discovers or steals your bot token
2. **Prompt injection** - Malicious content in messages tries to manipulate Claude
3. **Accidental damage** - Legitimate users accidentally running destructive commands
4. **Credential exposure** - Attempts to extract API keys, passwords, or secrets

## Defense in Depth

The bot implements multiple layers of security:

### Layer 1: User Allowlist

Only Telegram users whose IDs are in `TELEGRAM_ALLOWED_USERS` can interact with the bot.

```
User sends message → Check user ID in allowlist → Reject if not authorized
```

- User IDs are numeric and cannot be spoofed in Telegram
- Get your ID from [@userinfobot](https://t.me/userinfobot)
- Unauthorized attempts are logged

### Layer 2: Rate Limiting

Token bucket rate limiting prevents abuse even if credentials are compromised.

```
Default: 20 requests per 60 seconds per user
```

Configure via:
- `RATE_LIMIT_ENABLED` - Enable/disable (default: true)
- `RATE_LIMIT_REQUESTS` - Requests per window (default: 20)
- `RATE_LIMIT_WINDOW` - Window in seconds (default: 60)

### Layer 3: Path Validation

File operations are restricted to explicitly allowed directories.

```
Default allowed paths:
- CLAUDE_WORKING_DIR
- ~/Documents
- ~/Downloads
- ~/Desktop
```

Customize via `ALLOWED_PATHS` (comma-separated).

**Validation uses proper path containment checks:**
- Symlinks are resolved before checking
- Path traversal attacks (../) are prevented
- Only exact directory matches are allowed

**Exception for temp files:**
- Reading from /tmp/ and /var/folders/ is allowed
- This enables handling of Telegram-downloaded files

### Layer 4: Command Safety

Dangerous shell commands are blocked as defense-in-depth.

#### Completely Blocked Patterns

These patterns are **always rejected**, regardless of context:

| Pattern | Reason |
|---------|--------|
| `rm -rf /` | System destruction |
| `rm -rf ~` | Home directory wipe |
| `rm -rf $HOME` | Home directory wipe |
| `sudo rm` | Privileged deletion |
| `:(){ :\|:& };:` | Fork bomb |
| `> /dev/sd` | Disk overwrite |
| `mkfs.` | Filesystem formatting |
| `dd if=` | Raw disk operations |

#### Path-Validated Commands

`rm` commands (that don't match blocked patterns above) are **allowed but path-validated**:

```bash
rm file.txt              # Allowed if in ALLOWED_PATHS
rm /etc/passwd           # Blocked - outside ALLOWED_PATHS
rm -rf ./node_modules    # Allowed if cwd is in ALLOWED_PATHS
rm -r /tmp/mydir         # Allowed - /tmp is always permitted
```

Each path argument is checked against `ALLOWED_PATHS` before execution.

### Layer 5: System Prompt

Claude receives a safety prompt that instructs it to:

1. **Never delete files without explicit confirmation** - Must ask "Are you sure?"
2. **Only access allowed directories** - Refuse operations outside them
3. **Never run dangerous commands** - Even if asked
4. **Ask for confirmation on destructive actions**

This is the primary protection layer. The other layers are defense-in-depth.

### Layer 6: Audit Logging

All interactions are logged for security review.

```
Log location: ~/.lydia-bibel-bot/audit.log (configurable via AUDIT_LOG_PATH)
```

Logged events:
- `message` - User messages and Claude responses
- `auth` - Authorization attempts
- `tool_use` - Claude tool usage
- `error` - Errors during processing
- `rate_limit` - Rate limit events

Enable JSON format for easier parsing: `AUDIT_LOG_JSON=true`

## Known Limitations

For a detailed analysis of architectural security limitations - including what
the blocklist cannot prevent, which tools bypass path validation, and
recommendations for high-security deployments - see
**[docs/security-limitations.md](docs/security-limitations.md)**.

## What This Doesn't Protect Against

1. **Malicious authorized users** - If you add someone to the allowlist, they have full access
2. **Zero-day vulnerabilities** - Unknown bugs in Claude, the SDK, or dependencies
3. **Physical access** - Someone with access to the machine running the bot
4. **Network interception** - Though Telegram uses encryption

## Recommendations

1. **Keep the allowlist small** - Only add users you fully trust
2. **Use a dedicated working directory** - Don't point at `/` or `~`
3. **Review audit logs periodically** - Look for suspicious patterns
4. **Keep dependencies updated** - Security patches for the SDK and Telegram library
5. **Use a dedicated API key** - Create a separate Anthropic API key for the bot
6. **Enable email alerts** - Get notified when new sessions start

## Incident Response

If you suspect unauthorized access:

1. **Stop the bot**: Terminate the running process (Ctrl+C, or stop the service)
2. **Revoke the Telegram bot token**: Message @BotFather and create a new token
3. **Review audit logs**: Check the audit log (default: `~/.lydia-bibel-bot/audit.log`)
4. **Check for file changes**: Review recent activity in allowed directories
5. **Update credentials**: Rotate any API keys that may have been exposed

## Disclosure Policy

We follow responsible disclosure:
- Security issues are fixed before public disclosure
- Credit is given to reporters (unless they prefer anonymity)
- See [Reporting a Vulnerability](#reporting-a-vulnerability) at the top of this document
