/**
 * Formatting module for Claude Telegram Bot.
 *
 * Markdown conversion and tool status display formatting.
 */

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Strip markdown formatting markers from text.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(.+?)\*(?!\*)/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!_)_(.+?)_(?!_)/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

/**
 * Convert inline markdown (bold/italic) to Telegram HTML.
 */
function inlineToHtml(text: string): string {
  // Use control chars as temporary tag placeholders (survive escapeHtml)
  let result = text.replace(/\*\*(.+?)\*\*/g, "\x01b\x02$1\x01/b\x02");
  result = result.replace(/(?<!\*)\*(.+?)\*(?!\*)/g, "\x01i\x02$1\x01/i\x02");
  result = escapeHtml(result);
  return result.replace(/\x01/g, "<").replace(/\x02/g, ">");
}

// Max total column width for <pre> table layout (wider → card layout)
// Telegram mobile chat bubbles fit ~35 monospace chars. Only use <pre>
// for tables that genuinely fit without wrapping.
const MAX_PRE_TABLE_WIDTH = 35;

/**
 * Convert markdown table lines to Telegram-compatible HTML.
 *
 * Narrow tables → aligned <pre> block (stripped markdown).
 * Wide tables → vertical card layout with inline bold/italic.
 */
function formatMarkdownTable(lines: string[]): string {
  const rawRows: string[][] = [];
  let hasHeader = false;

  for (const line of lines) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.every((c) => /^[-:]+$/.test(c))) {
      hasHeader = true;
      continue;
    }

    rawRows.push(cells);
  }

  if (rawRows.length === 0) return "";

  const colCount = Math.max(...rawRows.map((r) => r.length));

  // Strip markdown for width calculation
  const strippedRows = rawRows.map((row) =>
    row.map((cell) => stripMarkdown(cell))
  );

  const colWidths: number[] = Array.from({ length: colCount }, () => 0);
  for (const row of strippedRows) {
    for (let i = 0; i < colCount; i++) {
      colWidths[i] = Math.max(colWidths[i]!, (row[i] || "").length);
    }
  }

  const totalWidth =
    colWidths.reduce((a, b) => a + b, 0) + (colCount - 1) * 2;

  // ── Layout decision ──
  // Narrow tables (≤ 35 chars): <pre> aligned — fits on mobile without wrapping.
  // Wide tables: card layout — wraps naturally with bold/italic formatting.
  // Telegram <pre> WRAPS text (no horizontal scroll), so wide <pre> is unusable.
  const usePreLayout = totalWidth <= MAX_PRE_TABLE_WIDTH;

  if (usePreLayout) {
    const output: string[] = [];
    for (let r = 0; r < strippedRows.length; r++) {
      const row = strippedRows[r]!;
      const cells: string[] = [];
      for (let i = 0; i < colCount; i++) {
        cells.push((row[i] || "").padEnd(colWidths[i]!));
      }
      output.push(cells.join("  "));

      if (hasHeader && r === 0) {
        output.push(colWidths.map((w) => "\u2500".repeat(w)).join("  "));
      }
    }
    return "<pre>" + escapeHtml(output.join("\n")) + "</pre>";
  }

  // ── Wide table → card layout (wraps naturally on all screens) ──
  const headerLabels = hasHeader ? rawRows[0]! : [];
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  // 2 columns → bold heading + content on next line
  if (colCount === 2) {
    const cards: string[] = [];
    for (const row of dataRows) {
      const heading = escapeHtml(stripMarkdown(row[0] || ""));
      const value = inlineToHtml(row[1] || "");
      cards.push(`<b>${heading}</b>\n${value}`);
    }
    return cards.join("\n\n");
  }

  // 3+ columns → bold heading + labeled fields
  const cards: string[] = [];
  for (const row of dataRows) {
    const cardLines: string[] = [];

    cardLines.push(`<b>${escapeHtml(stripMarkdown(row[0] || ""))}</b>`);

    for (let i = 1; i < colCount; i++) {
      const value = inlineToHtml(row[i] || "");
      const label = stripMarkdown(headerLabels[i] || "");

      if (label) {
        cardLines.push(`${escapeHtml(label)}: ${value}`);
      } else {
        cardLines.push(value);
      }
    }

    cards.push(cardLines.join("\n"));
  }

  return cards.join("\n\n");
}

/**
 * Convert standard markdown to Telegram-compatible HTML.
 *
 * HTML is more reliable than Telegram's Markdown which breaks on special chars.
 * Telegram HTML supports: <b>, <i>, <code>, <pre>, <a href="">
 */
export function convertMarkdownToHtml(text: string): string {
  // Store code blocks temporarily to avoid processing their contents
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Save code blocks first (```code```)
  text = text.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code);
    return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`;
  });

  // Save markdown tables (consecutive | lines → aligned <pre>)
  const tables: string[] = [];
  {
    const allLines = text.split("\n");
    const result: string[] = [];
    const tableLines: string[] = [];

    for (const line of allLines) {
      const trimmed = line.trim();
      const isTableLine =
        trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;

      if (isTableLine) {
        tableLines.push(trimmed);
      } else {
        if (tableLines.length >= 2) {
          tables.push(formatMarkdownTable(tableLines));
          result.push(`\x00TABLE${tables.length - 1}\x00`);
        } else if (tableLines.length > 0) {
          result.push(...tableLines);
        }
        tableLines.length = 0;
        result.push(line);
      }
    }

    if (tableLines.length >= 2) {
      tables.push(formatMarkdownTable(tableLines));
      result.push(`\x00TABLE${tables.length - 1}\x00`);
    } else if (tableLines.length > 0) {
      result.push(...tableLines);
    }

    text = result.join("\n");
  }

  // Save inline code (`code`)
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(code);
    return `\x00INLINECODE${inlineCodes.length - 1}\x00`;
  });

  // Escape HTML entities in the remaining text
  text = escapeHtml(text);

  // Headers: ## Header -> <b>Header</b>
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>\n");

  // Bold: **text** -> <b>text</b>
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // Also handle *text* as bold (single asterisk)
  text = text.replace(/(?<!\*)\*(.+?)\*(?!\*)/g, "<b>$1</b>");

  // Double underscore: __text__ -> <b>text</b>
  text = text.replace(/__([^_]+)__/g, "<b>$1</b>");

  // Italic: _text_ -> <i>text</i> (but not __text__)
  text = text.replace(/(?<!_)_([^_]+)_(?!_)/g, "<i>$1</i>");

  // Blockquotes: &gt; text -> <blockquote>text</blockquote>
  text = convertBlockquotes(text);

  // Bullet lists: - item or * item -> • item
  text = text.replace(/^[-*] /gm, "• ");

  // Horizontal rules: --- or *** -> blank line
  text = text.replace(/^[-*]{3,}$/gm, "");

  // Links: [text](url) -> <a href="url">text</a>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    const escapedCode = escapeHtml(codeBlocks[i]!);
    text = text.replace(`\x00CODEBLOCK${i}\x00`, `<pre>${escapedCode}</pre>`);
  }

  // Restore inline code
  for (let i = 0; i < inlineCodes.length; i++) {
    const escapedCode = escapeHtml(inlineCodes[i]!);
    text = text.replace(
      `\x00INLINECODE${i}\x00`,
      `<code>${escapedCode}</code>`
    );
  }

  // Restore tables
  for (let i = 0; i < tables.length; i++) {
    text = text.replace(`\x00TABLE${i}\x00`, tables[i]!);
  }

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

/**
 * Convert blockquotes (handles multi-line).
 */
function convertBlockquotes(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inBlockquote = false;
  const blockquoteLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("&gt; ") || line === "&gt;") {
      if (line === "&gt;") {
        blockquoteLines.push("");
      } else {
        // Remove '&gt; ' and strip # from hashtags (Telegram mobile bug workaround)
        const content = line.slice(5).replace(/#/g, "");
        blockquoteLines.push(content);
      }
      inBlockquote = true;
    } else {
      if (inBlockquote) {
        result.push(
          "<blockquote>" + blockquoteLines.join("\n") + "</blockquote>"
        );
        blockquoteLines.length = 0;
        inBlockquote = false;
      }
      result.push(line);
    }
  }

  // Handle blockquote at end
  if (inBlockquote) {
    result.push("<blockquote>" + blockquoteLines.join("\n") + "</blockquote>");
  }

  return result.join("\n");
}

// Legacy alias
export const convertMarkdownForTelegram = convertMarkdownToHtml;

// ============== Tool Status Formatting ==============

/**
 * Shorten a file path for display (last 2 components).
 */
function shortenPath(path: string): string {
  if (!path) return "file";
  const parts = path.split("/");
  if (parts.length >= 2) {
    return parts.slice(-2).join("/");
  }
  return parts[parts.length - 1] || path;
}

/**
 * Truncate text with ellipsis.
 */
function truncate(text: string, maxLen = 60): string {
  if (!text) return "";
  // Clean up newlines for display
  const cleaned = text.replace(/\n/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + "...";
}

/**
 * Wrap text in HTML code tags, escaping special chars.
 */
function code(text: string): string {
  return `<code>${escapeHtml(text)}</code>`;
}

/**
 * Format tool use for display in Telegram with HTML formatting.
 */
export function formatToolStatus(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  const emojiMap: Record<string, string> = {
    Read: "📖",
    Write: "📝",
    Edit: "✏️",
    Bash: "▶️",
    Glob: "🔍",
    Grep: "🔎",
    WebSearch: "🔍",
    WebFetch: "🌐",
    Task: "🎯",
    TodoWrite: "📋",
    mcp__: "🔧",
  };

  // Find matching emoji
  let emoji = "🔧";
  for (const [key, val] of Object.entries(emojiMap)) {
    if (toolName.includes(key)) {
      emoji = val;
      break;
    }
  }

  // Format based on tool type
  if (toolName === "Read") {
    const filePath = String(toolInput.file_path || "file");
    const shortPath = shortenPath(filePath);
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
      ".ico",
    ];
    if (imageExtensions.some((ext) => filePath.toLowerCase().endsWith(ext))) {
      return "👀 Viewing";
    }
    return `${emoji} Reading ${code(shortPath)}`;
  }

  if (toolName === "Write") {
    const filePath = String(toolInput.file_path || "file");
    return `${emoji} Writing ${code(shortenPath(filePath))}`;
  }

  if (toolName === "Edit") {
    const filePath = String(toolInput.file_path || "file");
    return `${emoji} Editing ${code(shortenPath(filePath))}`;
  }

  if (toolName === "Bash") {
    const cmd = String(toolInput.command || "");
    const desc = String(toolInput.description || "");
    if (desc) {
      return `${emoji} ${escapeHtml(desc)}`;
    }
    return `${emoji} ${code(truncate(cmd, 50))}`;
  }

  if (toolName === "Grep") {
    const pattern = String(toolInput.pattern || "");
    const path = String(toolInput.path || "");
    if (path) {
      return `${emoji} Searching ${code(truncate(pattern, 30))} in ${code(
        shortenPath(path)
      )}`;
    }
    return `${emoji} Searching ${code(truncate(pattern, 40))}`;
  }

  if (toolName === "Glob") {
    const pattern = String(toolInput.pattern || "");
    return `${emoji} Finding ${code(truncate(pattern, 50))}`;
  }

  if (toolName === "WebSearch") {
    const query = String(toolInput.query || "");
    return `${emoji} Searching: ${escapeHtml(truncate(query, 50))}`;
  }

  if (toolName === "WebFetch") {
    const url = String(toolInput.url || "");
    return `${emoji} Fetching ${code(truncate(url, 50))}`;
  }

  if (toolName === "Task") {
    const desc = String(toolInput.description || "");
    if (desc) {
      return `${emoji} Agent: ${escapeHtml(desc)}`;
    }
    return `${emoji} Running agent...`;
  }

  if (toolName === "Skill") {
    const skillName = String(toolInput.skill || "");
    if (skillName) {
      return `💭 Using skill: ${escapeHtml(skillName)}`;
    }
    return `💭 Using skill...`;
  }

  if (toolName.startsWith("mcp__")) {
    // Bible MCP — custom Lydia-style status.
    //
    // Split by tool name, not by server prefix: the same server serves both the
    // German wording and the original-language text, and the two deserve
    // different lines. bible_lookup/_search/_crossrefs are "the Scripture",
    // bible_original/_concordance/_compare are "the original text".
    // Both prefixes are matched so the lines survive renaming the server key in
    // mcp-config.ts or adding a second Bible server.
    const isBibleServer =
      toolName.startsWith("mcp__bible__") ||
      toolName.startsWith("mcp__bibelstudium__");

    if (isBibleServer) {
      const isOriginalTextTool =
        toolName.endsWith("__bible_original") ||
        toolName.endsWith("__bible_concordance") ||
        toolName.endsWith("__bible_compare");

      const book = toolInput.book ? String(toolInput.book) : "";
      const chapter = toolInput.chapter ? String(toolInput.chapter) : "";

      if (isOriginalTextTool) {
        // Concordance and compare carry a word rather than a reference.
        const word = toolInput.strong || toolInput.lemma;
        const ref = word
          ? String(word)
          : book && chapter
          ? `${book} ${chapter}`
          : book;
        if (ref) {
          return `📜 prüft den Grundtext... ${escapeHtml(ref)}`;
        }
        return "📜 prüft den Grundtext...";
      }

      // bible_search knows no book/chapter, only the search term.
      const query = toolInput.query ? String(toolInput.query) : "";
      const ref = query ? query : book && chapter ? `${book} ${chapter}` : book;
      if (ref) {
        return `📖 blättert in der Schrift... ${escapeHtml(ref)}`;
      }
      return "📖 blättert in der Schrift...";
    }

    // Generic MCP tool formatting
    const parts = toolName.split("__");
    if (parts.length >= 3) {
      const server = parts[1]!;
      let action = parts[2]!;
      // Remove redundant server prefix from action
      if (action.startsWith(`${server}_`)) {
        action = action.slice(server.length + 1);
      }
      action = action.replace(/_/g, " ");

      // Try to get meaningful summary
      const summary =
        toolInput.title ||
        toolInput.query ||
        toolInput.content ||
        toolInput.text ||
        toolInput.id ||
        "";

      if (summary) {
        return `⚙️ ${escapeHtml(truncate(String(summary), 40))}`;
      }
      return `⚙️ ${escapeHtml(action)}`;
    }
    return `⚙️ arbeitet...`;
  }

  return `${emoji} ${escapeHtml(toolName)}`;
}
