/**
 * MCP Servers Configuration for Claude Telegram Bot.
 *
 * Copy this file and customize for your setup.
 * Each MCP server gives Claude access to external tools/data.
 *
 * Format matches Claude's MCP config schema.
 * See: https://docs.anthropic.com/en/docs/build-with-claude/mcp
 */

import { homedir } from "os";
import { dirname } from "path";

const HOME = homedir();
const REPO_ROOT = dirname(import.meta.path);

export const MCP_SERVERS: Record<
  string,
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> }
> = {
  // Bible - exact verse lookups via the hosted bibelstudium-mcp service.
  // No setup, no local database. Seven read-only tools: verse lookup,
  // original text, concordance, cross-references, search, edition compare,
  // server info. Default translation of that endpoint is Schlachter 2000.
  // Source: https://github.com/fidpa/bibelstudium-mcp
  "bible": {
    type: "http",
    url: "https://mcp.bibelstudium-mcp.de/mcp",
  },

  // Example: studybible-mcp - English-language alternative, hosted by its
  // author. Deeper free lexica (BDB, Abbott-Smith, LSJ), a knowledge graph
  // over people and places, and study notes; 22 tools, English text only.
  // Not affiliated with this project.
  // Source: https://github.com/djayatillake/studybible-mcp
  //
  // Two caveats before enabling it:
  //   1. The trailing slash is required. https://studybible-mcp.fly.dev/mcp
  //      answers 307 and redirects to plain http:// - a protocol downgrade.
  //   2. Its tools are named word_study, lookup_verse, search_by_strongs and
  //      so on, not bible_*. The citation rules in CLAUDE.md address the
  //      bible_* tools by name, so they do not apply to this server until
  //      you extend them. Without that, Lydia has no rule telling her to
  //      quote from it rather than from memory.
  // "studybible": {
  //   type: "http",
  //   url: "https://studybible-mcp.fly.dev/mcp/"
  // },

  // Ask User - present options as Telegram inline keyboard buttons
  // Uncomment to enable interactive button prompts
  // "ask-user": {
  //   command: "bun",
  //   args: ["run", `${REPO_ROOT}/ask_user_mcp/server.ts`]
  // },

  // Example: Typefully - draft and schedule social posts
  // Docs: https://support.typefully.com/en/articles/13128440-typefully-mcp-server
  // "typefully": {
  //   type: "http",
  //   url: `https://mcp.typefully.com/mcp?TYPEFULLY_API_KEY=${process.env.TYPEFULLY_API_KEY || ""}`
  // },

  // Example: Things 3 task manager (macOS)
  // Requires: https://github.com/hald/things-mcp
  // "things": {
  //   command: "uv",
  //   args: ["--directory", `${HOME}/Dev/things-mcp`, "run", "things_server.py"]
  // },
};
