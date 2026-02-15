/**
 * Command handlers for Claude Telegram Bot.
 *
 * /start, /new, /stop, /status, /resume, /restart
 */

import type { Context } from "grammy";
import { getSession } from "../session";
import { ALLOWED_USERS, RESTART_FILE } from "../config";
import { isAuthorized } from "../security";

/**
 * /start - Show welcome message and status.
 */
export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || "unknown";

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized. Contact the bot owner for access.");
    return;
  }

  const session = getSession(userId!);
  const status = session.isActive ? "Aktive Sitzung" : "Keine aktive Sitzung";

  await ctx.reply(
    `📖 <b>Lydia — Bibelstudien-Assistent</b>\n\n` +
      `Status: ${status}\n\n` +
      `<b>Befehle:</b>\n` +
      `/new - Neue Sitzung starten\n` +
      `/stop - Aktuelle Anfrage abbrechen\n` +
      `/status - Status anzeigen\n` +
      `/resume - Letzte Sitzung fortsetzen\n` +
      `/retry - Letzte Nachricht wiederholen\n` +
      `/restart - Bot neu starten\n\n` +
      `<b>Tipps:</b>\n` +
      `• Mit <code>!</code> vorangestellt aktuelle Anfrage unterbrechen\n` +
      `• "think" fuer ausfuehrliches Nachdenken\n` +
      `• Fotos, Sprachnachrichten oder Dokumente senden`,
    { parse_mode: "HTML" }
  );
}

/**
 * /new - Start a fresh session.
 */
export async function handleNew(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  const session = getSession(userId!);

  // Stop any running query
  if (session.isRunning) {
    const result = await session.stop();
    if (result) {
      await Bun.sleep(100);
      session.clearStopRequested();
    }
  }

  // Clear session
  await session.kill();

  await ctx.reply("🆕 Sitzung beendet. Die naechste Nachricht startet eine neue Sitzung.");
}

/**
 * /stop - Stop the current query (silently).
 */
export async function handleStop(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  const session = getSession(userId!);

  if (session.isRunning) {
    const result = await session.stop();
    if (result) {
      // Wait for the abort to be processed, then clear stopRequested so next message can proceed
      await Bun.sleep(100);
      session.clearStopRequested();
    }
    // Silent stop - no message shown
  }
  // If nothing running, also stay silent
}

/**
 * /status - Show detailed status.
 */
export async function handleStatus(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  const session = getSession(userId!);

  const lines: string[] = ["📊 <b>Status</b>\n"];

  // Session status
  if (session.isActive) {
    lines.push(`✅ Sitzung: Aktiv`);
  } else {
    lines.push("⚪ Sitzung: Keine");
  }

  // Query status
  if (session.isRunning) {
    const elapsed = session.queryStarted
      ? Math.floor((Date.now() - session.queryStarted.getTime()) / 1000)
      : 0;
    lines.push(`🔄 Anfrage: Läuft (${elapsed}s)`);
    if (session.currentTool) {
      lines.push(`   └─ ${session.currentTool}`);
    }
  } else {
    lines.push("⚪ Anfrage: Bereit");
    if (session.lastTool) {
      lines.push(`   └─ Zuletzt: ${session.lastTool}`);
    }
  }

  // Last activity
  if (session.lastActivity) {
    const ago = Math.floor(
      (Date.now() - session.lastActivity.getTime()) / 1000
    );
    lines.push(`\n⏱️ Letzte Aktivität: vor ${ago}s`);
  }

  // Usage stats
  if (session.lastUsage) {
    const usage = session.lastUsage;
    lines.push(
      `\n📈 Letzte Anfrage:`,
      `   Input: ${usage.input_tokens?.toLocaleString() || "?"} Tokens`,
      `   Output: ${usage.output_tokens?.toLocaleString() || "?"} Tokens`
    );
    if (usage.cache_read_input_tokens) {
      lines.push(
        `   Cache: ${usage.cache_read_input_tokens.toLocaleString()}`
      );
    }
  }

  // Error status (sanitized — no file paths)
  if (session.lastError) {
    const ago = session.lastErrorTime
      ? Math.floor((Date.now() - session.lastErrorTime.getTime()) / 1000)
      : "?";
    lines.push(`\n⚠️ Letzter Fehler (vor ${ago}s)`);
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

/**
 * /resume - Show list of sessions to resume with inline keyboard.
 */
export async function handleResume(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  const session = getSession(userId!);

  if (session.isActive) {
    await ctx.reply("Sitzung bereits aktiv. Nutze /new fuer eine neue Sitzung.");
    return;
  }

  // Get saved sessions
  const sessions = session.getSessionList(userId!);

  if (sessions.length === 0) {
    await ctx.reply("❌ Keine gespeicherten Sitzungen.");
    return;
  }

  // Build inline keyboard with session list
  const buttons = sessions.map((s) => {
    // Format date: "15.02 10:30"
    const date = new Date(s.saved_at);
    const dateStr = date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
    });
    const timeStr = date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Truncate title for button (max ~40 chars to fit)
    const titlePreview =
      s.title.length > 35 ? s.title.slice(0, 32) + "..." : s.title;

    return [
      {
        text: `📅 ${dateStr} ${timeStr} - "${titlePreview}"`,
        callback_data: `resume:${s.session_id}`,
      },
    ];
  });

  await ctx.reply("📋 <b>Gespeicherte Sitzungen</b>\n\nWaehle eine Sitzung zum Fortsetzen:", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

/**
 * /restart - Restart the bot process.
 */
export async function handleRestart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  const msg = await ctx.reply("🔄 Restarting bot...");

  // Save message info so we can update it after restart
  if (chatId && msg.message_id) {
    try {
      await Bun.write(
        RESTART_FILE,
        JSON.stringify({
          chat_id: chatId,
          message_id: msg.message_id,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      console.warn("Failed to save restart info:", e);
    }
  }

  // Give time for the message to send
  await Bun.sleep(500);

  // Exit - launchd will restart us
  process.exit(0);
}

/**
 * /retry - Retry the last message (resume session and re-send).
 */
export async function handleRetry(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (!isAuthorized(userId, ALLOWED_USERS)) {
    await ctx.reply("Unauthorized.");
    return;
  }

  const session = getSession(userId!);

  // Check if there's a message to retry
  if (!session.lastMessage) {
    await ctx.reply("❌ Keine Nachricht zum Wiederholen.");
    return;
  }

  // Check if something is already running
  if (session.isRunning) {
    await ctx.reply("⏳ Anfrage laeuft noch. Nutze /stop zuerst.");
    return;
  }

  const lastMessage = session.lastMessage;
  await ctx.reply("🔄 Wird wiederholt...");

  // Simulate sending the message again by emitting a fake text message event
  // We do this by directly calling the text handler logic
  const { handleText } = await import("./text");

  // Create a modified context with the last message
  const fakeCtx = {
    ...ctx,
    message: {
      ...ctx.message,
      text: lastMessage,
    },
  } as Context;

  await handleText(fakeCtx);
}
