# Bible MCP Server — Recherche & Planung

**Ziel**: MCP Server für wortwortgetreue Bibelzitate (primär Schlachter 2000) in Lydias Antworten.
**Problem**: Claude zitiert aus dem Gedächtnis und mischt Übersetzungen. Ein MCP Tool `bible_lookup` liefert exakte Texte.
**Stand**: Implementiert seit v1.2.0 (2026-02-16).

---

## Warum

Claude (und LLMs generell) zitieren Bibelstellen aus dem Training — dabei werden Übersetzungen vermischt. Verifizierter Abgleich mit schlachterbibel.de zeigte bei 4 Versen 3 Abweichungen vom Schlachter-2000-Wortlaut (Wörter aus Luther eingemischt, Satzstellung verändert). Für einen Bibelstudien-Bot ist Worttreue essenziell.

## Urheberrecht

- **Schlachter 2000**: © Genfer Bibelgesellschaft — urheberrechtlich geschützt
- **Privatkopie §53 UrhG**: Lokale Datenbank auf eigenem Server für privaten Kreis (Bibelstudiengruppe) — zulässig
- **Zitatrecht §51 UrhG**: Einzelne Verse mit Quellenangabe im Rahmen inhaltlicher Auseinandersetzung — zulässig
- **CLAUDE.md schreibt bereits vor**: Übersetzung angeben, auf Zitatrecht beschränken, keine ganzen Kapitel
- **Nicht zulässig**: MCP Server öffentlich hosten, Datenbank weiterverteilen, ganze Bücher ausgeben

## Architektur-Entscheidung

**MCP Server mit lokalem Datenbestand** (nicht API-basiert):
- Ein Tool: `bible_lookup(book, chapter, verses, translation)`
- Lokale SQLite-DB oder JSON-Dateien
- System Prompt Ergänzung: "Zitiere NIEMALS aus dem Gedächtnis, nutze IMMER bible_lookup"
- TypeScript/Bun (passt zum bestehenden Stack)
- Einbindung über `mcp-config.ts` (wie ask-user MCP bereits existiert)

---

## Existierende Bible MCP Server

Keiner unterstützt Schlachter 2000. Übersicht der relevantesten:

### FHL Bible MCP Server (ausgereiftester)
- **Repo**: [ytssamuel/FHL-MCP-Server](https://github.com/ytssamuel/FHL-MCP-Server)
- **Stack**: Python
- **Übersetzungen**: Chinese Union Version, KJV, weitere chinesische
- **Tools**: 27 Funktionen (Verse, Kapitel, Suche, Griechisch/Hebräisch-Wortanalyse, Kommentare)
- **Reife**: v0.1.2, 160 Tests, 83% Coverage
- **Fazit**: Architektur-Referenz, aber chinesisch-fokussiert

### Trevato/bible-mcp (einfachstes Beispiel)
- **Repo**: [Trevato/bible-mcp](https://github.com/Trevato/bible-mcp)
- **Stack**: Python, PyPI: `pip install bible-mcp`
- **Übersetzungen**: WEB, KJV, ASV via bible-api.com — kein Deutsch
- **Tools**: `get_verse_by_reference()`, `get_random_verse_tool()`, `list_available_translations()`
- **Fazit**: Gute Referenz für minimale Tool-Struktur

### geosp/mcp-bible (BibleGateway-basiert)
- **Repo**: [geosp/mcp-bible](https://github.com/geosp/mcp-bible)
- **Stack**: Python
- **Übersetzungen**: ESV, NIV, KJV, NASB (nur Englisch)
- **Ansatz**: Scraped BibleGateway.com
- **Fazit**: BibleGateway hat Schlachter 2000, aber Scraping = ToS-Risiko

### Weitere (weniger relevant)
- [HarunGuclu/bible-mcp](https://github.com/HarunGuclu/bible-mcp) — Python, bible-api.com, 16+ Übersetzungen, kein Deutsch
- [batson-j/kairos_codex_mcp_server](https://github.com/batson-j/kairos_codex_mcp_server) — Python, bible.helloao.org API (1000+ Übersetzungen, Deutsch unklar)
- [AdbC99/ai-bible](https://github.com/AdbC99/ai-bible) — JavaScript, lokale Daten, Web-Frontend
- [sprider/cloudflare-mcp-server-bible](https://github.com/sprider/cloudflare-mcp-server-bible) — TypeScript, Cloudflare Workers, nur Englisch
- [cmathgit/biblegateway-votd-mcp](https://github.com/cmathgit/biblegateway-votd-mcp) — Python, nur Vers des Tages

---

## Datenquellen für deutsche Übersetzungen

### APIs

| API | Deutsche Übersetzungen | Auth | Rate Limits |
|-----|----------------------|------|-------------|
| [bolls.life/api](https://bolls.life/api/) | Elberfelder 1871, Schlachter 1951, Luther 1912, **evtl. S2000** | Nein | Unklar |
| [bible.helloao.org](https://bible.helloao.org/) | 1000+ Übersetzungen, Deutsch unklar | Nein | Keine |
| [api.getbible.net/v2](https://github.com/getbible/v2) | Schlachter 1951, Luther 1545 | Nein | Nein |
| [scripture.api.bible](https://scripture.api.bible/) | 2500+ Versionen, vermutlich Deutsch | **Ja** (API Key) | Ja |
| [bible-api.com](https://bible-api.com/) | **Kein Deutsch** | Nein | 15 req/30s |
| [BibleGateway.com](https://www.biblegateway.com/) | **Schlachter 2000**, Luther 2017 | Kein API (Scraping) | N/A |

### Downloadbare Datenbanken

| Quelle | Deutsche Übersetzungen | Formate |
|--------|----------------------|---------|
| [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Schlachter 1951, Elberfelder 1871/1905, Luther 1545, Menge, Albrecht | SQLite, MySQL, JSON, CSV, YAML, XML |
| [godlytalias/Bible-Database](https://github.com/godlytalias/Bible-Database) | Mehrere Sprachen inkl. Deutsch | XML, JSON, SQL, SQLite3 |
| [Bible SuperSearch (SourceForge)](https://sourceforge.net/projects/biblesuper/files/) | Elberfelder 1871, Elberfelder 1905, Luther 1545 | SQLite3, JSON |
| [bolls.life Downloads](https://bolls.life/api/) | Wie API | JSON, ZIP |

### Schlachter 2000 Verfügbarkeit — GEFUNDEN

**bolls.life hat Schlachter 2000** (Code: `S00`). Verifiziert am 16.02.2026.

API-Endpunkt: `https://bolls.life/get-text/S00/{book_id}/{chapter}/`

Verifizierung: Jesaja 46,4 liefert exakt denselben Wortlaut wie schlachterbibel.de.

Alle verfügbaren deutschen Übersetzungen auf bolls.life:

| Code | Übersetzung |
|------|-------------|
| **S00** | **Schlachter 2000** |
| SCH | Schlachter 1951 |
| ELB | Elberfelder 1871 |
| LUT | Luther 1912 |
| HFA | Hoffnung für Alle 2015 |
| MB | Menge-Bibel |

**Empfohlener Ansatz**: bolls.life API als Backend für den MCP Server. Kein Scraping, kein API-Key, kein ToS-Risiko. Alternativ: JSON-Download von bolls.life für vollständig lokalen Betrieb (offline-fähig).

---

## Nächste Schritte

1. [x] bolls.life API prüfen: **Schlachter 2000 verfügbar** (Code `S00`, verifiziert 16.02.2026)
2. [x] bolls.life Download → lokale SQLite (bible_mcp/download.ts, ~31.000 Verse, ~5 MB)
3. [x] MCP Server aufgesetzt (bible_mcp/server.ts, TypeScript/Bun, Tool: bible_lookup)
4. [x] System Prompt in CLAUDE.md ergänzt: bible_lookup Pflicht bei Zitaten
5. [x] Getestet: Jes 46,4, Joh 3,16-17, 1Mo 1,1, Ps 23,1-3, Röm 8,28 — alle exakt

---

## bolls.life API-Struktur (verifiziert 16.02.2026)

### Verse abrufen
`GET https://bolls.life/get-text/{translation}/{bookid}/{chapter}/`

Beispiel: `GET https://bolls.life/get-text/S00/23/46/` (Jesaja 46, Schlachter 2000)

```json
[
  { "pk": 3914216, "verse": 1, "text": "Bel krümmt sich; Nebo ist zusammengebrochen..." },
  { "pk": 3914217, "verse": 2, "text": "Sie sind miteinander zusammengebrochen..." },
  { "pk": 3914218, "verse": 3, "text": "Hört auf mich, o du Haus Jakob..." }
]
```

Felder: `pk` (Primary Key), `verse` (Versnummer), `text` (Bibeltext, enthält HTML-Fußnoten `<f>&#2009;[###]</f>` die gestripped werden müssen).

### Bücher abrufen
`GET https://bolls.life/get-books/{translation}/`

```json
{ "bookid": 23, "name": "Das Buch des Propheten Jesaja", "chronorder": 25, "chapters": 66 }
```

66 Bücher, Standard-Reihenfolge (1 = Genesis, 66 = Offenbarung). Vollständige Liste in der API verfügbar.

### Übersetzungen
`GET https://bolls.life/static/bolls/app/views/languages.json`

Deutsche Codes: S00 (Schlachter 2000), SCH (Schlachter 1951), ELB (Elberfelder 1871), LUT (Luther 1912), HFA (Hoffnung für Alle 2015), MB (Menge-Bibel).

---

## SQLite-Datenbank (Entwurf)

### Empfehlung: Offline mit initialem Download

Einmal alle ~31.000 Verse von bolls.life herunterladen und lokal in SQLite speichern. Vorteile:
- Schnell (lokale DB-Query statt HTTP-Roundtrip)
- Offline-fähig (keine Abhängigkeit von bolls.life-Verfügbarkeit)
- Keine Rate-Limit-Sorgen
- Deterministisch (API-Änderungen brechen nichts)

### Schema

```sql
CREATE TABLE books (
  book_id    INTEGER PRIMARY KEY,  -- 1-66 (bolls.life bookid)
  name       TEXT NOT NULL,        -- "Das Buch des Propheten Jesaja"
  chapters   INTEGER NOT NULL      -- Anzahl Kapitel
);

CREATE TABLE aliases (
  alias      TEXT PRIMARY KEY,     -- "Jesaja", "Jes", "Isa", "Isaiah"
  book_id    INTEGER NOT NULL REFERENCES books(book_id)
);

CREATE TABLE verses (
  book_id    INTEGER NOT NULL REFERENCES books(book_id),
  chapter    INTEGER NOT NULL,
  verse      INTEGER NOT NULL,
  text       TEXT NOT NULL,        -- Bibeltext (HTML-Fußnoten gestripped)
  PRIMARY KEY (book_id, chapter, verse)
);
```

Die `aliases`-Tabelle ist entscheidend: Claude sagt "Jesaja", "2. Korinther", "1. Mose", "Ps", "Röm" etc. — der MCP Server muss diese Kurzformen auf die korrekte `book_id` auflösen.

### Download-Script (einmalig)

Für jedes Buch (1-66) alle Kapitel von bolls.life abrufen, Fußnoten-HTML strippen, in SQLite einfügen. Geschätztes Volumen: ~31.000 Verse, ~5 MB SQLite-Datei.

---

## Tool-Interface (Entwurf)

```typescript
// MCP Tool: bible_lookup
{
  name: "bible_lookup",
  description: "Look up Bible verses by reference. Returns exact text from the specified translation.",
  inputSchema: {
    type: "object",
    properties: {
      book: { type: "string", description: "Book name (e.g. 'Jesaja', '1. Mose', '2. Korinther')" },
      chapter: { type: "number", description: "Chapter number" },
      verses: { type: "string", description: "Verse(s), e.g. '4' or '16-17'" },
      translation: { type: "string", enum: ["schlachter2000", "elberfelder", "luther2017"], default: "schlachter2000" }
    },
    required: ["book", "chapter", "verses"]
  }
}

// Beispiel-Aufruf
bible_lookup({ book: "Jesaja", chapter: 46, verses: "4", translation: "schlachter2000" })

// Beispiel-Antwort
{
  reference: "Jesaja 46,4",
  translation: "Schlachter 2000",
  text: "Bis in euer Greisenalter bin ich derselbe, und bis zu eurem Ergrauen will ich euch tragen. Ich habe es getan, und ich will auch fernerhin heben, tragen und erretten."
}
```

## System Prompt Ergänzung (Entwurf)

```
## Bibelzitate
- Zitiere NIEMALS Bibelverse aus dem Gedächtnis
- Nutze IMMER das bible_lookup Tool für exakte Zitate
- Falls bible_lookup nicht verfügbar: paraphrasiere und kennzeichne als "sinngemäß"
- Gib immer die Übersetzung an (z.B. "Schlachter 2000")
```
