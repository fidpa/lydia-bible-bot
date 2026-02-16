#!/usr/bin/env bun
/**
 * Download Schlachter 2000 from bolls.life API into local SQLite database.
 *
 * Run once: bun run bible_mcp/download.ts
 *
 * Downloads all 66 books (~31,000 verses) and stores them locally.
 * Strips HTML footnotes (<f>...</f> tags) from verse text.
 *
 * Copyright note: The downloaded text is (c) Genfer Bibelgesellschaft.
 * Local storage for private Bible study use under §53 UrhG (Privatkopie).
 * Do NOT redistribute the database file.
 */

import { Database } from "bun:sqlite";
import { dirname, resolve } from "path";
import { BOOK_ALIASES } from "./aliases.ts";

const TRANSLATION = "S00"; // Schlachter 2000
const API_BASE = "https://bolls.life";
const DB_PATH = resolve(dirname(import.meta.path), "data/bible.db");
const DELAY_MS = 200; // Polite rate limiting between requests

interface BollsBook {
  readonly bookid: number;
  readonly name: string;
  readonly chapters: number;
}

interface BollsVerse {
  readonly pk: number;
  readonly verse: number;
  readonly text: string;
}

/**
 * Strip HTML tags from verse text.
 * bolls.life uses <f>&#2009;[123]</f> for footnotes and <i>...</i> for psalm superscriptions.
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

async function fetchJson<T>(path: string, retries = 3): Promise<T> {
  const url = `${API_BASE}${path}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${url}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      const backoff = Math.pow(2, attempt) * 1000;
      console.warn(`  Retry ${attempt + 1}/${retries} after ${backoff}ms: ${error}`);
      await sleep(backoff);
    }
  }

  throw new Error(`Failed after ${retries} attempts: ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log("=== Schlachter 2000 Download ===");
  console.log(`Database: ${DB_PATH}`);

  // Fetch book list
  console.log("\nFetching book list...");
  const books = await fetchJson<BollsBook[]>(`/get-books/${TRANSLATION}/`);

  // Validate response shape and expected Bible structure
  if (!Array.isArray(books) || books.length !== 66) {
    throw new Error(
      `Expected 66 books from API, got ${Array.isArray(books) ? books.length : typeof books}. ` +
      "The API may have changed or returned unexpected data."
    );
  }
  for (const book of books) {
    if (typeof book.bookid !== "number" || book.bookid < 1 || book.bookid > 66) {
      throw new Error(`Invalid book ID: ${book.bookid} for "${book.name}"`);
    }
    if (typeof book.name !== "string" || book.name.length === 0 || book.name.length > 100) {
      throw new Error(`Invalid book name for ID ${book.bookid}: "${book.name}"`);
    }
    if (typeof book.chapters !== "number" || book.chapters < 1 || book.chapters > 150) {
      throw new Error(`Invalid chapter count ${book.chapters} for "${book.name}"`);
    }
  }
  console.log(`Found ${books.length} books (validated)`);

  // Create database
  const db = new Database(DB_PATH, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      book_id    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      chapters   INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS aliases (
      alias      TEXT PRIMARY KEY COLLATE NOCASE,
      book_id    INTEGER NOT NULL REFERENCES books(book_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS verses (
      book_id    INTEGER NOT NULL REFERENCES books(book_id),
      chapter    INTEGER NOT NULL,
      verse      INTEGER NOT NULL,
      text       TEXT NOT NULL,
      PRIMARY KEY (book_id, chapter, verse)
    )
  `);

  // Clear existing data for clean re-download
  db.exec("DELETE FROM verses");
  db.exec("DELETE FROM aliases");
  db.exec("DELETE FROM books");

  // Insert books
  const insertBook = db.prepare(
    "INSERT INTO books (book_id, name, chapters) VALUES (?, ?, ?)"
  );
  for (const book of books) {
    insertBook.run(book.bookid, book.name, book.chapters);
  }
  console.log(`Inserted ${books.length} books`);

  // Insert aliases
  const insertAlias = db.prepare(
    "INSERT OR IGNORE INTO aliases (alias, book_id) VALUES (?, ?)"
  );
  for (const [alias, bookId] of BOOK_ALIASES) {
    insertAlias.run(alias, bookId);
  }
  console.log(`Inserted ${BOOK_ALIASES.length} aliases`);

  // Download all verses
  const insertVerse = db.prepare(
    "INSERT INTO verses (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)"
  );

  let totalVerses = 0;
  const totalChapters = books.reduce((sum, b) => sum + b.chapters, 0);
  let completedChapters = 0;

  for (const book of books) {
    const bookStart = totalVerses;

    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const verses = await fetchJson<BollsVerse[]>(
        `/get-text/${TRANSLATION}/${book.bookid}/${chapter}/`
      );

      db.transaction(() => {
        for (const v of verses) {
          const cleanText = stripHtml(v.text);
          insertVerse.run(book.bookid, chapter, v.verse, cleanText);
          totalVerses++;
        }
      })();

      completedChapters++;
      await sleep(DELAY_MS);
    }

    const bookVerses = totalVerses - bookStart;
    const pct = ((completedChapters / totalChapters) * 100).toFixed(1);
    console.log(
      `  [${pct}%] ${book.name}: ${bookVerses} verses (${book.chapters} chapters)`
    );
  }

  // Verify
  const count = db.query("SELECT COUNT(*) as n FROM verses").get() as { n: number };
  console.log(`\nDone! ${count.n} verses in database.`);

  // Checkpoint WAL into main database file so the read-only server
  // does not depend on (potentially tampered) WAL/SHM sidecar files.
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

  // Database size
  const { statSync, unlinkSync: rmSync } = await import("fs");

  db.close();

  // Remove WAL/SHM sidecar files — the DB is now self-contained
  for (const suffix of ["-wal", "-shm"]) {
    try {
      rmSync(`${DB_PATH}${suffix}`);
    } catch {
      // Files may not exist
    }
  }

  // Restrict file permissions to owner-only (prevents local tampering)
  const { chmodSync } = await import("fs");
  chmodSync(DB_PATH, 0o600);
  chmodSync(dirname(DB_PATH), 0o700);

  const stats = statSync(DB_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`Database size: ${sizeMB} MB`);
}

main().catch((error) => {
  console.error("Download failed:", error);
  process.exit(1);
});
