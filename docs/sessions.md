# Session-Verhalten

Wie Lydia sich an Unterhaltungen erinnert und wann sie vergisst.

## Eine Session pro User

Jeder Telegram-User hat genau eine Claude-Session (`getSession(userId)` in
`src/session.ts`). Diese Session wird fuer Gruppen- UND Privatnachrichten
gleichermassen verwendet. Es gibt keine separate Gruppen- oder Privat-Session.

## Gedaechtnis

Innerhalb einer aktiven Session erinnert sich Lydia an alle vorherigen
Nachrichten des Users. Das gilt fuer:

- Textnachrichten
- Dokumente, Fotos, Sprachnachrichten
- Antworten von Lydia selbst
- Tool-Nutzung (z.B. Bash-Befehle, Datei-Operationen)

Der Session-Kontext wird ueber `resume: this.sessionId` an das Claude Agent
SDK uebergeben (`src/session.ts`, Zeile 226). Jede Nachricht setzt die
bestehende Session fort.

## Session-Ende

Eine Session wird beendet durch:

| Ausloeser | Befehl/Aktion |
|---|---|
| Manuell | `/new` im Chat |
| Bot-Neustart | Prozess wird beendet und neu gestartet |
| Crash | Claude-Fehler fuehrt zu `session.kill()` |
| Session-Wechsel | `/resume` laedt eine andere gespeicherte Session |

**Wichtig:** `/new` im Privatchat beendet auch die Gruppen-Session desselben
Users, und umgekehrt, denn es ist dieselbe Session.

## Gruppen vs. Privatnachrichten

| | Gruppe | Privatchat |
|---|---|---|
| Session | Geteilt pro User | Geteilt pro User |
| Gedaechtnis | Ja, innerhalb Session | Ja, innerhalb Session |
| Reagiert auf | Nur @mention oder Reply-to-Bot | Jede Nachricht |
| Antwortlaenge | Kuerzer (Gruppenkontext) | Ausfuehrlicher |

## Session-Persistenz

Sessions werden in `~/.lydia-bibel-bot/sessions.json` gespeichert und
koennen nach einem Bot-Neustart mit `/resume` wiederhergestellt werden.
Es werden maximal 5 Sessions pro User aufbewahrt.

## CLAUDE.md und Sessions

Die CLAUDE.md (System-Prompt) wird bei **jedem** `query()`-Aufruf neu
gelesen (`settingSources: ["user", "project"]`). Aenderungen an der
CLAUDE.md wirken sich sofort auf die naechste Nachricht aus.

**Aber:** Die bisherige Konversationshistorie bleibt bestehen. Wenn Lydia
sich in einer alten Session als "technischer Assistent" vorgestellt hat,
beeinflusst das ihr Verhalten trotz neuer CLAUDE.md. In solchen Faellen
hilft nur `/new`.
