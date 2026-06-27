#!/usr/bin/env bun
/**
 * export-chat.ts — Export a Lydia chat transcript into readable documents.
 *
 * Source are the JSONL transcripts that Claude Code stores per session:
 *   ~/.claude/projects/<encoded-working-dir>/<session-id>.jsonl
 * Bot (Telegram) and terminal sessions live in the same folder.
 *
 * From a transcript the script produces:
 *   - a cleaned-up Markdown file (question/answer dialogue),
 *   - optionally Word (.docx) and PDF via pandoc.
 * PDF uses --pdf-engine=weasyprint (Unicode/Hebrew capable).
 *
 * The rendered document keeps Lydia's German wording (the bot speaks German);
 * only this developer-facing tooling is in English.
 *
 * Examples:
 *   bun run scripts/export-chat.ts --list
 *   bun run scripts/export-chat.ts a1b2c3d4
 *   bun run scripts/export-chat.ts --latest --formats md,pdf
 *   bun run scripts/export-chat.ts a1b2c3d4 --heading "Shalom & shalam"
 */

import { homedir } from "os";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "fs";
import { tmpdir } from "os";
import { resolve, join, basename } from "path";

// ============== Configuration ==============

const HOME = homedir();
// Working directory of the bot (= project folder). Used to derive the transcript
// folder; overridable via env.
const WORKING_DIR =
  process.env.CLAUDE_WORKING_DIR || resolve(import.meta.dir, "..");

// Claude Code encodes the path by replacing every non-alphanumeric char with "-":
// /Users/x/Repos/y -> -Users-x-Repos-y
function encodeProjectDir(dir: string): string {
  return dir.replace(/[^a-zA-Z0-9]/g, "-");
}

const PROJECTS_ROOT = join(HOME, ".claude", "projects");
const TRANSCRIPT_DIR = join(PROJECTS_ROOT, encodeProjectDir(WORKING_DIR));
const SESSIONS_FILE = join(HOME, ".lydia-bibel-bot", "sessions.json");

// ============== Types ==============

type Mode = "conversation" | "verses" | "full";

const VALID_MODES: readonly Mode[] = ["conversation", "verses", "full"];

function isMode(value: string): value is Mode {
  return (VALID_MODES as readonly string[]).includes(value);
}

interface CliArgs {
  selector?: string; // session id (full or prefix)
  byTitle?: string;
  latest: boolean;
  list: boolean;
  mode: Mode;
  outDir: string;
  formats: string[];
  name?: string;
  heading?: string;
  pdfEngine: string;
  color: boolean;
  colorQuestion: string; // hex without '#'
  colorAnswer: string; // hex without '#'
}

interface Verse {
  reference: string;
  translation: string;
  text: string;
}

type Event =
  | { kind: "user"; text: string }
  | { kind: "lydia"; text: string }
  | { kind: "verse"; verse: Verse }
  | { kind: "tool"; name: string; input: unknown }
  | { kind: "tool_result"; text: string };

// ============== External data: type-safe access ==============
// JSONL transcripts are external data — never access via `any`, always
// `unknown` + type guards (no `any`; guards for external data).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Returns the value as a string or undefined — never throws. */
function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Reads a property from an unknown value (undefined if not an object). */
function readField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/** Parses a JSONL line into an object — null on error or non-object. */
function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ============== Argument parsing ==============

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    latest: false,
    list: false,
    mode: "verses",
    outDir: resolve(import.meta.dir, "..", "exports"),
    formats: ["md", "docx", "pdf"],
    pdfEngine: "weasyprint",
    color: true,
    colorQuestion: "C0392B", // red
    colorAnswer: "1E7A34", // green
  };

  const normHex = (s: string): string => s.replace(/^#/, "").trim().toUpperCase();

  let i = 0;
  // Reads and consumes the value after a flag. Exits cleanly if it is missing —
  // instead of `argv[++i]!` with an unsafe non-null assertion on user input.
  const takeValue = (flag: string): string => {
    const next = argv[i + 1];
    if (next === undefined) {
      console.error(`Missing value for ${flag}`);
      process.exit(1);
    }
    i += 1;
    return next;
  };

  for (i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue; // guaranteed by loop bound, keeps the type clean
    switch (a) {
      case "--list":
        args.list = true;
        break;
      case "--latest":
        args.latest = true;
        break;
      case "--title":
        args.byTitle = takeValue("--title");
        break;
      case "--mode": {
        const m = takeValue("--mode");
        if (!isMode(m)) {
          console.error(
            `Invalid mode: "${m}" (allowed: ${VALID_MODES.join(", ")})`
          );
          process.exit(1);
        }
        args.mode = m;
        break;
      }
      case "--out":
        args.outDir = resolve(takeValue("--out"));
        break;
      case "--formats":
        args.formats = takeValue("--formats")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--name":
        args.name = takeValue("--name");
        break;
      case "--heading":
        args.heading = takeValue("--heading");
        break;
      case "--pdf-engine":
        args.pdfEngine = takeValue("--pdf-engine");
        break;
      case "--no-color":
        args.color = false;
        break;
      case "--color-question":
        args.colorQuestion = normHex(takeValue("--color-question"));
        break;
      case "--color-answer":
        args.colorAnswer = normHex(takeValue("--color-answer"));
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (!a.startsWith("-") && !args.selector) {
          args.selector = a;
        } else {
          console.warn(`Ignoring unknown argument: ${a}`);
        }
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
export-chat.ts — Lydia chat transcript -> Markdown / Word / PDF

Selection (pick one):
  <session-id>         Full or prefix id of the session
  --title <text>       Match by title (from sessions.json)
  --latest             Most recently modified transcript
  --list               List available transcripts and exit

Options:
  --mode <m>           conversation | verses | full   (default: verses)
  --out <dir>          Output directory               (default: ./exports)
  --formats <list>     md,docx,pdf                    (default: md,docx,pdf)
  --name <base>        File name without extension     (default: from title/date)
  --heading <text>     Heading inside the document     (default: title)
  --pdf-engine <e>     PDF engine for pandoc           (default: weasyprint)

Colors (questions red, answers green; applies to PDF and Word):
  --no-color           Black & white, no coloring
  --color-question <hex>  Color of user questions      (default: C0392B)
  --color-answer <hex>    Color of Lydia's answers     (default: 1E7A34)

Transcript folder: ${TRANSCRIPT_DIR}
`);
}

// ============== Session metadata ==============

interface SavedSession {
  session_id: string;
  saved_at?: string;
  title?: string;
}

function loadSessionTitles(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const data = JSON.parse(readFileSync(SESSIONS_FILE, "utf-8")) as {
      sessions?: SavedSession[];
    };
    for (const s of data.sessions ?? []) {
      if (s.session_id && s.title) map.set(s.session_id, s.title);
    }
  } catch {
    /* sessions.json missing/stale — not a problem */
  }
  return map;
}

interface TranscriptInfo {
  id: string;
  file: string;
  mtime: Date;
  title: string;
  firstLine: string;
}

function stripDatePrefix(text: string): string {
  // Removes the "[Current date/time: ...]" prefix injected by the bot.
  return text.replace(/^\[Current date\/time:[^\]]*\]\s*/, "").trim();
}

function firstUserLine(file: string): string {
  let lines: string[];
  try {
    lines = readFileSync(file, "utf-8").split("\n");
  } catch {
    return "(no text)";
  }

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = parseJsonLine(line);
    if (!entry) continue;
    if (asString(entry.type) !== "user") continue;

    const message = readField(entry, "message");
    if (asString(readField(message, "role")) !== "user") continue;

    const content = readField(message, "content");
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (asString(readField(block, "type")) !== "text") continue;
      const text = asString(readField(block, "text"));
      if (text === undefined) continue;
      const firstTextLine = stripDatePrefix(text).split("\n")[0] ?? "";
      return firstTextLine.slice(0, 80);
    }
  }
  return "(no text)";
}

function listTranscripts(): TranscriptInfo[] {
  const titles = loadSessionTitles();
  let files: string[];
  try {
    files = readdirSync(TRANSCRIPT_DIR).filter((f) => f.endsWith(".jsonl"));
  } catch {
    console.error(`Transcript folder not found: ${TRANSCRIPT_DIR}`);
    process.exit(1);
  }
  const infos: TranscriptInfo[] = files
    .filter((f) => !f.startsWith("agent-")) // skip internal sub-agent logs
    .map((f) => {
      const file = join(TRANSCRIPT_DIR, f);
      const id = basename(f, ".jsonl");
      const mtime = statSync(file).mtime;
      const first = firstUserLine(file);
      return {
        id,
        file,
        mtime,
        title: titles.get(id) ?? first,
        firstLine: first,
      };
    });
  infos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return infos;
}

// ============== Transcript -> events ==============

function tryParseVerse(text: string): Verse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null; // not a JSON verse
  }
  if (!isRecord(parsed)) return null;

  const reference = asString(parsed.reference);
  const verseText = asString(parsed.text);
  if (reference === undefined || verseText === undefined) return null;

  return {
    reference,
    text: verseText,
    translation: asString(parsed.translation) ?? "",
  };
}

function parseTranscript(file: string): { events: Event[]; firstTs?: string } {
  const lines = readFileSync(file, "utf-8").split("\n");
  const events: Event[] = [];
  let firstTs: string | undefined;

  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = parseJsonLine(line);
    if (!entry) continue;

    const type = asString(entry.type);
    if (type !== "user" && type !== "assistant") continue;

    if (firstTs === undefined) {
      const ts = asString(entry.timestamp);
      if (ts !== undefined) firstTs = ts;
    }

    const message = readField(entry, "message");
    const role = asString(readField(message, "role"));
    const content = readField(message, "content");
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      const blockType = asString(readField(block, "type"));

      if (blockType === "text") {
        const text = asString(readField(block, "text"));
        if (text === undefined) continue;
        if (role === "user") {
          const t = stripDatePrefix(text);
          if (t) events.push({ kind: "user", text: t });
        } else if (role === "assistant") {
          const t = text.trim();
          if (t) events.push({ kind: "lydia", text: t });
        }
      } else if (blockType === "tool_use") {
        events.push({
          kind: "tool",
          name: asString(readField(block, "name")) ?? "",
          input: readField(block, "input"),
        });
      } else if (blockType === "tool_result") {
        // Merge result content into text
        const blockContent = readField(block, "content");
        let resultText = "";
        if (Array.isArray(blockContent)) {
          for (const c of blockContent) {
            if (asString(readField(c, "type")) !== "text") continue;
            const ctext = asString(readField(c, "text"));
            if (ctext !== undefined) resultText += ctext;
          }
        } else {
          resultText = asString(blockContent) ?? "";
        }
        const verse = tryParseVerse(resultText);
        if (verse) events.push({ kind: "verse", verse });
        else if (resultText) events.push({ kind: "tool_result", text: resultText });
      }
    }
  }
  return { events, firstTs };
}

// ============== Events -> Markdown ==============

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function blockquote(text: string): string {
  return text
    .split("\n")
    .map((l) => (l.length ? `> ${l}` : ">"))
    .join("\n");
}

function renderMarkdown(
  events: Event[],
  opts: {
    heading: string;
    date: string;
    sessionId: string;
    mode: Mode;
    color: boolean;
  }
): string {
  // Derive translation from the first verse (default Schlachter 2000)
  const firstVerse = events.find(
    (e): e is Extract<Event, { kind: "verse" }> => e.kind === "verse"
  );
  const translation = firstVerse?.verse.translation || "Schlachter 2000";

  // Note: the rendered document keeps Lydia's German wording (the bot speaks
  // German). Only labels below are German on purpose; the code is English.
  const out: string[] = [];
  out.push(`# Gespräch mit Lydia`);
  out.push("");
  out.push(`**${opts.heading}**`);
  out.push("");
  out.push(
    `*${opts.date} · Telegram-Bot „Lydia" · Bibelübersetzung: ${translation}*`
  );
  out.push("");
  out.push("---");
  out.push("");

  let lastVerseKey = "";
  let lastSpeaker: "user" | "lydia" | null = null;
  let divOpen = false;

  // When coloring is active, each speaker passage is wrapped in a pandoc fenced
  // div. The div carries BOTH markers: a CSS class (.question/.answer) for the
  // HTML/PDF path and custom-style="Question|Answer" for the Word path.
  const closeDiv = (): void => {
    if (divOpen) {
      out.push(":::");
      out.push("");
      divOpen = false;
    }
  };
  const openDiv = (speaker: "user" | "lydia"): void => {
    const cls = speaker === "user" ? "question" : "answer";
    const style = speaker === "user" ? "Question" : "Answer";
    out.push(`::: {.${cls} custom-style="${style}"}`);
  };

  for (const ev of events) {
    if (ev.kind === "tool" && opts.mode !== "full") continue;
    if (ev.kind === "tool_result" && opts.mode !== "full") continue;
    if (ev.kind === "verse" && opts.mode === "conversation") continue;

    if (ev.kind === "user" || ev.kind === "lydia") {
      const speaker = ev.kind;
      if (speaker !== lastSpeaker) {
        closeDiv();
        if (opts.color) openDiv(speaker);
        divOpen = opts.color;
        out.push(speaker === "user" ? "**Frage**" : "**Lydia**");
        out.push("");
        lastSpeaker = speaker;
      }
      out.push(ev.text);
      out.push("");
    } else if (ev.kind === "verse") {
      const key = `${ev.verse.reference}|${ev.verse.text}`;
      if (key === lastVerseKey) continue; // skip direct duplicates
      lastVerseKey = key;
      closeDiv(); // verses stay neutral, outside the speaker div
      const head = ev.verse.translation
        ? `**${ev.verse.reference}** (${ev.verse.translation})`
        : `**${ev.verse.reference}**`;
      out.push(blockquote(`${head}\n${ev.verse.text}`));
      out.push("");
      lastSpeaker = null; // re-emit the speaker label after a verse
    } else if (ev.kind === "tool") {
      closeDiv();
      out.push(`\`\`\`text\n[Tool: ${ev.name}] ${JSON.stringify(ev.input)}\n\`\`\``);
      out.push("");
      lastSpeaker = null;
    } else if (ev.kind === "tool_result") {
      closeDiv();
      out.push(`\`\`\`text\n${ev.text}\n\`\`\``);
      out.push("");
      lastSpeaker = null;
    }
  }
  closeDiv();

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ============== pandoc conversion ==============

function runPandoc(args: string[]): boolean {
  const proc = Bun.spawnSync(["pandoc", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    console.error(`  pandoc failed: ${proc.stderr.toString().trim()}`);
    return false;
  }
  return true;
}

/**
 * CSS for the PDF path (weasyprint). Colors the speaker divs and renders the
 * labels (first paragraph in the div) as small caps.
 */
function buildCss(questionHex: string, answerHex: string): string {
  return `
.question { color: #${questionHex}; }
.answer { color: #${answerHex}; }
.question > p:first-child, .answer > p:first-child {
  font-variant: small-caps;
  letter-spacing: 0.04em;
}
blockquote { color: #222; border-left: 3px solid #bbb; }
`;
}

/**
 * Builds a pandoc reference template (.docx) with two colored paragraph styles
 * "Question" and "Answer". Uses the system tools unzip/zip because the docx is a
 * ZIP container and styles.xml needs to be extended.
 * Returns the path to the generated template, or null on error.
 */
function buildReferenceDocx(
  questionHex: string,
  answerHex: string,
  tmpDir: string
): string | null {
  const refPath = join(tmpDir, "reference.docx");

  // 1. Fetch the pandoc default template (binary stdout)
  const def = Bun.spawnSync(
    ["pandoc", "--print-default-data-file", "reference.docx"],
    { stdout: "pipe", stderr: "pipe" }
  );
  if (def.exitCode !== 0) {
    console.error(`  Fetching reference template failed: ${def.stderr.toString().trim()}`);
    return null;
  }
  Bun.write(refPath, def.stdout);

  // 2. Extract styles.xml
  const unz = Bun.spawnSync(
    ["unzip", "-o", "reference.docx", "word/styles.xml"],
    { cwd: tmpDir, stdout: "pipe", stderr: "pipe" }
  );
  const stylesPath = join(tmpDir, "word", "styles.xml");
  if (unz.exitCode !== 0 || !existsSync(stylesPath)) {
    console.error(`  Extracting styles.xml failed`);
    return null;
  }

  // 3. Insert colored paragraph styles
  let styles = readFileSync(stylesPath, "utf-8");
  const newStyles =
    `<w:style w:type="paragraph" w:styleId="Question"><w:name w:val="Question"/>` +
    `<w:basedOn w:val="BodyText"/><w:qFormat/><w:rPr><w:color w:val="${questionHex}"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Answer"><w:name w:val="Answer"/>` +
    `<w:basedOn w:val="BodyText"/><w:qFormat/><w:rPr><w:color w:val="${answerHex}"/></w:rPr></w:style>`;
  styles = styles.replace("</w:styles>", newStyles + "</w:styles>");
  writeFileSync(stylesPath, styles, "utf-8");

  // 4. Write styles.xml back into the docx
  const zip = Bun.spawnSync(["zip", "reference.docx", "word/styles.xml"], {
    cwd: tmpDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (zip.exitCode !== 0) {
    console.error(`  Repacking styles.xml failed: ${zip.stderr.toString().trim()}`);
    return null;
  }
  return refPath;
}

// ============== Main flow ==============

function pickTranscript(args: CliArgs, infos: TranscriptInfo[]): TranscriptInfo {
  if (args.latest) {
    const latest = infos[0];
    if (!latest) {
      console.error("No transcripts found in folder.");
      process.exit(1);
    }
    return latest;
  }
  if (args.byTitle) {
    const q = args.byTitle.toLowerCase();
    const hit = infos.find((i) => i.title.toLowerCase().includes(q));
    if (!hit) {
      console.error(`No transcript matched title: "${args.byTitle}"`);
      process.exit(1);
    }
    return hit;
  }
  if (args.selector) {
    const selector = args.selector; // hoist so no `!` is needed in the closure
    const hits = infos.filter((i) => i.id.startsWith(selector));
    if (hits.length === 0) {
      console.error(`No session id starts with: "${selector}"`);
      process.exit(1);
    }
    if (hits.length > 1) {
      console.error(`Ambiguous — multiple sessions start with "${selector}":`);
      for (const h of hits) console.error(`  ${h.id}  ${h.title}`);
      process.exit(1);
    }
    const only = hits[0];
    if (!only) process.exit(1); // unreachable (exactly 1 hit), keeps the type without `!`
    return only;
  }
  console.error("No selection given. Use --list, --latest, --title or a session id.");
  printHelp();
  process.exit(1);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const infos = listTranscripts();

  if (args.list) {
    console.log(`Transcripts in ${TRANSCRIPT_DIR}:\n`);
    for (const i of infos) {
      const d = i.mtime.toISOString().slice(0, 16).replace("T", " ");
      console.log(`  ${i.id.slice(0, 8)}  ${d}  ${i.title}`);
    }
    return;
  }

  const chosen = pickTranscript(args, infos);
  console.log(`Selected: ${chosen.id}\n  Title: ${chosen.title}`);

  const { events, firstTs } = parseTranscript(chosen.file);
  const date = firstTs
    ? new Date(firstTs).toLocaleString("de-DE", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "";
  const heading = args.heading ?? chosen.title;
  const markdown = renderMarkdown(events, {
    heading,
    date,
    sessionId: chosen.id,
    mode: args.mode,
    color: args.color,
  });

  mkdirSync(args.outDir, { recursive: true });
  const datePart = firstTs ? new Date(firstTs).toISOString().slice(0, 10) : "chat";
  const base = args.name ?? `${datePart}_${slugify(heading)}`;
  const mdPath = join(args.outDir, `${base}.md`);

  Bun.write(mdPath, markdown);
  console.log(`\n✅ Markdown: ${mdPath}`);
  if (args.color) {
    console.log(
      `   Colors: questions #${args.colorQuestion}, answers #${args.colorAnswer}`
    );
  }

  // Temp folder for CSS / Word reference template
  const tmpDir = mkdtempSync(join(tmpdir(), "lydia-export-"));
  try {
    if (args.formats.includes("docx")) {
      const docxPath = join(args.outDir, `${base}.docx`);
      const pandocArgs = [mdPath, "-o", docxPath];
      if (args.color) {
        const ref = buildReferenceDocx(args.colorQuestion, args.colorAnswer, tmpDir);
        if (ref) pandocArgs.push("--reference-doc", ref);
      }
      if (runPandoc(pandocArgs)) console.log(`✅ Word:     ${docxPath}`);
    }

    if (args.formats.includes("pdf")) {
      const pdfPath = join(args.outDir, `${base}.pdf`);
      const pandocArgs = [
        mdPath,
        "-o",
        pdfPath,
        `--pdf-engine=${args.pdfEngine}`,
      ];
      if (args.color) {
        const cssPath = join(tmpDir, "style.css");
        writeFileSync(cssPath, buildCss(args.colorQuestion, args.colorAnswer), "utf-8");
        pandocArgs.push("-c", cssPath, "--embed-resources", "--standalone");
      }
      if (runPandoc(pandocArgs)) console.log(`✅ PDF:      ${pdfPath}`);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
