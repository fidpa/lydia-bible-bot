#!/usr/bin/env bun
/**
 * Bible MCP Server — Provides exact Bible verse lookups from local SQLite.
 *
 * Tool: bible_lookup
 *   - Resolves German book names/abbreviations to book IDs
 *   - Queries local SQLite database for exact verse text
 *   - Returns formatted reference with translation attribution
 *
 * Supports: Schlachter 2000 (primary), with extensible translation support.
 * Data source: bolls.life (downloaded via download.ts)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Database } from "bun:sqlite";
import { dirname, resolve } from "path";

// Database path relative to this file
const DB_PATH = resolve(dirname(import.meta.path), "data/bible.db");

// Open database read-only
let db: Database;
try {
  db = new Database(DB_PATH, { readonly: true });
  // No WAL pragma — database is read-only; WAL sidecar files could be tampered with.
  // The download script checkpoints WAL before closing so the DB is self-contained.
  console.error(`Bible DB loaded: ${DB_PATH}`);
} catch (error) {
  console.error(`Failed to open Bible database at ${DB_PATH}: ${error}`);
  console.error("Run 'bun run bible_mcp/download.ts' first to download the data.");
  process.exit(1);
}

// Prepare statements
const stmtAlias = db.prepare<{ book_id: number }, [string]>(
  "SELECT book_id FROM aliases WHERE alias = ? COLLATE NOCASE"
);

const stmtVerses = db.prepare<{ verse: number; text: string }, [number, number]>(
  "SELECT verse, text FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse"
);

const stmtVerse = db.prepare<{ verse: number; text: string }, [number, number, number]>(
  "SELECT verse, text FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?"
);

const stmtVerseRange = db.prepare<
  { verse: number; text: string },
  [number, number, number, number]
>(
  "SELECT verse, text FROM verses WHERE book_id = ? AND chapter = ? AND verse >= ? AND verse <= ? ORDER BY verse"
);

const stmtBookName = db.prepare<{ name: string }, [number]>(
  "SELECT name FROM books WHERE book_id = ?"
);

const stmtBookByName = db.prepare<{ book_id: number }, [string]>(
  "SELECT book_id FROM books WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE"
);

/**
 * Strip remaining HTML tags from verse text (e.g. <i> for psalm superscriptions).
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

/**
 * Escape LIKE wildcard characters in user input.
 */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Resolve a book name or abbreviation to a book ID.
 */
function resolveBook(book: string): number | null {
  const normalized = book.trim().toLowerCase();

  // Try exact alias match first
  const aliasResult = stmtAlias.get(normalized);
  if (aliasResult) return aliasResult.book_id;

  // Try fuzzy match on full book names (LIKE '%search%')
  const nameResult = stmtBookByName.get(`%${escapeLike(normalized)}%`);
  if (nameResult) return nameResult.book_id;

  return null;
}

/**
 * Get the display name for a book.
 */
function getBookDisplayName(bookId: number): string {
  const result = stmtBookName.get(bookId);
  return result?.name ?? `Buch ${bookId}`;
}

/**
 * Parse a verse reference string like "4", "16-17", "1,3,5", "1-3,7".
 * Returns an array of individual verse numbers.
 */
function parseVerses(versesStr: string): number[] {
  const MAX_VERSE = 200; // Longest chapter (Psalm 119) has 176 verses
  const MAX_PARTS = 30; // Limit comma-separated segments to prevent excessive DB queries
  const verses: number[] = [];
  const parts = versesStr.split(",").map((p) => p.trim()).slice(0, MAX_PARTS);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr ?? "", 10);
      const end = parseInt(endStr ?? "", 10);
      if (!isNaN(start) && !isNaN(end) && start >= 1 && end >= 1 && start <= end && end <= MAX_VERSE) {
        for (let v = start; v <= end; v++) {
          verses.push(v);
        }
      }
    } else {
      const v = parseInt(part, 10);
      if (!isNaN(v) && v >= 1 && v <= MAX_VERSE) {
        verses.push(v);
      }
    }
  }

  return verses;
}

/**
 * Look up verses from the database.
 */
function lookupVerses(
  bookId: number,
  chapter: number,
  versesStr: string
): ReadonlyArray<{ verse: number; text: string }> {
  // If no specific verses requested, return entire chapter
  if (!versesStr || versesStr.trim() === "") {
    return stmtVerses.all(bookId, chapter);
  }

  // Check if it's a simple range (e.g., "3-7") — use range query for efficiency
  const rangeMatch = versesStr.trim().match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]!, 10);
    const end = parseInt(rangeMatch[2]!, 10);
    return stmtVerseRange.all(bookId, chapter, start, end);
  }

  // Parse complex verse references and query individually
  const verseNums = parseVerses(versesStr);
  const results: Array<{ verse: number; text: string }> = [];
  for (const v of verseNums) {
    const row = stmtVerse.get(bookId, chapter, v);
    if (row) {
      results.push(row);
    }
  }
  return results;
}

// Translation display names
const TRANSLATION_NAMES: Record<string, string> = {
  schlachter2000: "Schlachter 2000",
  s2000: "Schlachter 2000",
  schlachter: "Schlachter 2000",
};

// Create MCP server
const server = new Server(
  {
    name: "bible",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "bible_lookup",
      description:
        "Look up Bible verses by reference. Returns exact text from Schlachter 2000. " +
        "Use this for ALL Bible quotes — never quote from memory.",
      inputSchema: {
        type: "object" as const,
        properties: {
          book: {
            type: "string",
            description:
              'Book name in German (e.g. "Jesaja", "1. Mose", "Römer", "Ps", "Mt")',
          },
          chapter: {
            type: "number",
            description: "Chapter number",
          },
          verses: {
            type: "string",
            description:
              'Verse(s): single "4", range "16-17", list "1,3,5", or combined "1-3,7". Omit for full chapter.',
          },
          translation: {
            type: "string",
            description:
              'Translation (default: "schlachter2000"). Currently only Schlachter 2000 available.',
            default: "schlachter2000",
          },
        },
        required: ["book", "chapter"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "bible_lookup") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments as {
    book?: string;
    chapter?: number;
    verses?: string;
    translation?: string;
  };

  const { book, chapter, verses, translation } = args;

  // Validate required inputs
  const MAX_BOOK_LENGTH = 50; // Longest German book name is ~20 chars
  if (!book || typeof book !== "string" || book.length > MAX_BOOK_LENGTH) {
    return {
      content: [{ type: "text" as const, text: "Error: 'book' is required and must be under 50 characters (e.g. 'Jesaja', '1. Mose')" }],
      isError: true,
    };
  }

  const MAX_CHAPTER = 150; // Psalms has the most chapters (150)
  if (chapter === undefined || typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1 || chapter > MAX_CHAPTER) {
    return {
      content: [{ type: "text" as const, text: `Error: 'chapter' must be an integer between 1 and ${MAX_CHAPTER}` }],
      isError: true,
    };
  }

  // Validate verses string length
  const MAX_VERSES_LENGTH = 200;
  if (verses && verses.length > MAX_VERSES_LENGTH) {
    return {
      content: [{ type: "text" as const, text: `Error: 'verses' string too long (max ${MAX_VERSES_LENGTH} characters)` }],
      isError: true,
    };
  }

  // Resolve book name to ID
  const bookId = resolveBook(book);
  if (bookId === null) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Book "${book}" not found. Try the full German name (e.g. "Jesaja", "1. Mose", "Römer") or an abbreviation (e.g. "Jes", "1Mo", "Röm").`,
        },
      ],
      isError: true,
    };
  }

  // Look up verses
  const results = lookupVerses(bookId, chapter, verses ?? "");
  if (results.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `No verses found for ${book} ${chapter}${verses ? "," + verses : ""}. Check chapter and verse numbers.`,
        },
      ],
      isError: true,
    };
  }

  // Build response
  const bookName = getBookDisplayName(bookId);
  const translationName =
    TRANSLATION_NAMES[(translation ?? "schlachter2000").toLowerCase()] ?? "Schlachter 2000";

  // Format verse reference
  const verseNums = results.map((r) => r.verse);
  const verseRef = formatVerseReference(verseNums);
  const reference = `${bookName} ${chapter},${verseRef}`;

  // Format text (strip any remaining HTML tags from the database)
  const text = results
    .map((r) => {
      const clean = stripHtml(r.text);
      return results.length > 1 ? `${r.verse} ${clean}` : clean;
    })
    .join(" ");

  const response = {
    reference,
    translation: translationName,
    text,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
});

/**
 * Format verse numbers into a compact reference string.
 * [1,2,3,5,7,8,9] → "1-3.5.7-9"
 */
function formatVerseReference(verses: number[]): string {
  if (verses.length === 0) return "";
  if (verses.length === 1) return String(verses[0]);

  const sorted = [...verses].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0]!;
  let rangePrev = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (current === rangePrev + 1) {
      rangePrev = current;
    } else {
      ranges.push(rangeStart === rangePrev ? String(rangeStart) : `${rangeStart}-${rangePrev}`);
      rangeStart = current;
      rangePrev = current;
    }
  }
  ranges.push(rangeStart === rangePrev ? String(rangeStart) : `${rangeStart}-${rangePrev}`);

  return ranges.join(".");
}

// Run the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bible MCP server running on stdio");
}

main().catch(console.error);
