/**
 * Security module for Claude Telegram Bot.
 *
 * Rate limiting, path validation, command safety.
 */

import { resolve, normalize } from "path";
import { realpathSync } from "fs";
import type { Context } from "grammy";
import type { RateLimitBucket } from "./types";
import {
  ALLOWED_PATHS,
  BLOCKED_PATTERNS,
  RATE_LIMIT_ENABLED,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW,
  TEMP_PATHS,
} from "./config";

// ============== Rate Limiter ==============

// Max message length (matches Telegram's own limit)
export const MAX_MESSAGE_LENGTH = 4096;

class RateLimiter {
  private buckets = new Map<number, RateLimitBucket>();
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private cleanupInterval: Timer;

  constructor() {
    this.maxTokens = RATE_LIMIT_REQUESTS;
    this.refillRate = RATE_LIMIT_REQUESTS / RATE_LIMIT_WINDOW;

    // Periodic cleanup of stale buckets (M5: prevent memory leak)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Remove buckets inactive for more than 10 minutes.
   */
  private cleanup(): void {
    const staleThreshold = Date.now() - 10 * 60 * 1000;
    for (const [userId, bucket] of this.buckets) {
      if (bucket.lastUpdate < staleThreshold) {
        this.buckets.delete(userId);
      }
    }
  }

  check(userId: number): [allowed: boolean, retryAfter?: number] {
    if (!RATE_LIMIT_ENABLED) {
      return [true];
    }

    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastUpdate: now };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsed = (now - bucket.lastUpdate) / 1000;
    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + elapsed * this.refillRate
    );
    bucket.lastUpdate = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return [true];
    }

    // Calculate time until next token
    const retryAfter = (1 - bucket.tokens) / this.refillRate;
    return [false, retryAfter];
  }

  getStatus(userId: number): {
    tokens: number;
    max: number;
    refillRate: number;
  } {
    const bucket = this.buckets.get(userId);
    return {
      tokens: bucket?.tokens ?? this.maxTokens,
      max: this.maxTokens,
      refillRate: this.refillRate,
    };
  }
}

export const rateLimiter = new RateLimiter();

// ============== Path Validation ==============

export function isPathAllowed(path: string): boolean {
  try {
    // Expand ~ and resolve to absolute path
    const expanded = path.replace(/^~/, process.env.HOME || "");
    const normalized = normalize(expanded);

    // Try to resolve symlinks (may fail if path doesn't exist yet)
    let resolved: string;
    try {
      resolved = realpathSync(normalized);
    } catch {
      resolved = resolve(normalized);
    }

    // Always allow temp paths (for bot's own files)
    for (const tempPath of TEMP_PATHS) {
      if (resolved.startsWith(tempPath)) {
        return true;
      }
    }

    // Check against allowed paths using proper containment
    for (const allowed of ALLOWED_PATHS) {
      const allowedResolved = resolve(allowed);
      if (
        resolved === allowedResolved ||
        resolved.startsWith(allowedResolved + "/")
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ============== Command Safety ==============

// Regex patterns for more robust detection (harder to bypass than string matching)
const BLOCKED_REGEX_PATTERNS: Array<[RegExp, string]> = [
  // rm -rf with variable expansion or quoting tricks
  [/rm\s+(-[a-z]*f[a-z]*\s+)?["']?\/["']?\s*$/i, "rm targeting root"],
  [/rm\s+(-[a-z]*f[a-z]*\s+)?["']?~["']?\s*$/i, "rm targeting home"],
  // Pipe to shell variants (with optional whitespace)
  [/\|\s*(ba|z|da|k|tc)?sh(\s|$)/i, "pipe to shell"],
  // curl/wget piped to execution
  [/(curl|wget)\s+.*\|\s*(ba|z)?sh/i, "remote code execution"],
  // Process substitution for execution
  [/(ba|z)?sh\s*<\s*\(/i, "process substitution execution"],
  // Overwriting system files
  [/>\s*\/etc\//i, "overwriting system files"],
  // Crontab manipulation
  [/crontab\s+-r/i, "crontab removal"],
  // Environment manipulation to bypass PATH restrictions
  [/env\s+.*PATH=/i, "PATH manipulation"],
];

export function checkCommandSafety(
  command: string
): [safe: boolean, reason: string] {
  const lowerCommand = command.toLowerCase();

  // Check string-based blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      return [false, `Blocked pattern: ${pattern}`];
    }
  }

  // Check regex-based patterns (more robust)
  for (const [regex, reason] of BLOCKED_REGEX_PATTERNS) {
    if (regex.test(command)) {
      return [false, `Blocked: ${reason}`];
    }
  }

  // Special handling for rm commands - validate paths
  if (lowerCommand.includes("rm ")) {
    try {
      // Simple parsing: extract arguments after rm
      const rmMatch = command.match(/rm\s+(.+)/i);
      if (rmMatch) {
        const args = rmMatch[1]!.split(/\s+/);
        for (const arg of args) {
          // Skip flags
          if (arg.startsWith("-") || arg.length <= 1) continue;
          // Skip variable references (can't validate at parse time)
          if (arg.includes("$")) {
            return [false, "rm with variable expansion not allowed"];
          }

          // Check if path is allowed
          if (!isPathAllowed(arg)) {
            return [false, `rm target outside allowed paths: ${arg}`];
          }
        }
      }
    } catch {
      // If parsing fails, be cautious
      return [false, "Could not parse rm command for safety check"];
    }
  }

  return [true, ""];
}

// ============== Authorization ==============

export function isAuthorized(
  userId: number | undefined,
  allowedUsers: number[]
): boolean {
  if (!userId) return false;
  if (allowedUsers.length === 0) return false;
  return allowedUsers.includes(userId);
}

// ============== Group Mention Filter (SEC-008) ==============

interface GroupFilterResult {
  shouldProcess: boolean;
  cleanedText?: string;
}

/**
 * Check if a message in a group chat should be processed.
 *
 * In private chats, always process. In groups, only process if the bot
 * is mentioned (@botUsername) or the message is a reply to the bot.
 */
export function checkGroupFilter(
  ctx: Context,
  text?: string
): GroupFilterResult {
  const chatType = ctx.chat?.type;

  // Private chats: always process
  if (chatType !== "group" && chatType !== "supergroup") {
    return { shouldProcess: true, cleanedText: text };
  }

  // Group: check reply-to-bot
  const isReplyToBot =
    ctx.message?.reply_to_message?.from?.id === ctx.me.id;

  // Group: check @mention in text
  const botUsername = ctx.me.username;
  const isMentioned =
    botUsername && text
      ? text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)
      : false;

  if (!isMentioned && !isReplyToBot) {
    return { shouldProcess: false };
  }

  // Strip @mention from text
  let cleanedText = text;
  if (isMentioned && botUsername && cleanedText) {
    cleanedText = cleanedText
      .replace(new RegExp(`@${botUsername}`, "gi"), "")
      .trim();
  }

  return { shouldProcess: true, cleanedText };
}
