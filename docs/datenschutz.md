# Datenschutzhinweis - Lydia Bible Bot

## Kurzbeschreibung (fuer Telegram-Gruppenbeschreibung)

> Bibelstudium trifft Sprachmodell (Sonnet 4.5). Bot reagiert auf
> @lydia_bible_bot. Nachrichten an den Bot werden an Anthropic (Claude)
> gesendet und nicht dauerhaft gespeichert. Nutzung freiwillig, Zugang nur
> nach Freischaltung.

## Ausfuehrlicher Datenschutzhinweis (fuer Pinned Message)

### Was ist dieser Bot?

Lydia ist ein KI-gestuetzter Bibelstudien-Assistent, der auf dem Sprachmodell
Claude (Anthropic, Sonnet 4.5) basiert. Er antwortet nur, wenn er direkt
angesprochen wird (@lydia_bible_bot oder Reply auf seine Nachrichten).

### Verantwortlicher

Der Bot wird vom Gruppenadministrator betrieben. Bei Fragen zum Datenschutz
wende dich direkt an den Admin dieser Gruppe.

### Welche Daten werden verarbeitet?

Wenn du dem Bot eine Nachricht schickst:
- **Nachrichteninhalt** - dein Text, Sprachnachricht oder Bild
- **Telegram-ID und Username** - zur Zuordnung und Zugriffskontrolle
- **Zeitstempel** - wann die Nachricht gesendet wurde

Nachrichten, die den Bot NICHT erwaehnen (@mention oder Reply), werden vom
Bot vollstaendig ignoriert und nicht verarbeitet.

### Wohin gehen die Daten?

- **Anthropic (USA)** - Nachrichteninhalte werden an Anthropic's Claude API
  gesendet. Anthropic verarbeitet diese gemaess ihrer
  [Datenschutzrichtlinie](https://www.anthropic.com/privacy).
  Anthropic speichert API-Anfragen nicht fuer Trainingszwecke.
- **Sprachnachrichten** - werden lokal auf dem Server des Betreibers
  transkribiert (whisper.cpp). Audio-Daten verlassen nicht das lokale Netzwerk.
- **Lokaler Server** - Ein Audit-Log auf dem Server des Betreibers erfasst
  Interaktionen (Telegram-ID, Zeitstempel, gekuerzter Nachrichteninhalt).

### Wie lange werden Daten gespeichert?

- **Anthropic**: Daten werden laut deren API-Richtlinien transient
  verarbeitet und nicht dauerhaft gespeichert. Es gibt KEINE Moeglichkeit,
  einzelne API-Anfragen nachtraeglich zu loeschen - die Daten sind nach
  Verarbeitung nicht mehr abrufbar.
- **Lokales Audit-Log**: Wird vom Betreiber verwaltet. Kann auf Anfrage
  bereinigt werden.
- **Session-Daten**: Maximal 5 Sessions werden lokal vorgehalten, aeltere
  werden automatisch ueberschrieben.
- **Telegram-Nachrichten**: Verbleiben auf Telegram-Servern gemaess deren
  Nutzungsbedingungen. Darauf hat der Bot-Betreiber keinen Einfluss.

### Deine Rechte

Du kannst jederzeit:
- **Auskunft verlangen** - welche Daten lokal ueber dich gespeichert sind
  (Audit-Log, Sessions)
- **Lokale Loeschung verlangen** - Entfernung deiner Eintraege aus dem
  Audit-Log und den Session-Daten
- **Widerspruch einlegen** - deine Telegram-ID wird aus der Freischaltliste
  entfernt, sodass keine zukuenftigen Daten verarbeitet werden
- **Den Bot nicht nutzen** - der Bot reagiert nur auf direkte Ansprache,
  deine normalen Gruppennachrichten werden nicht verarbeitet

**Wichtig:** Bereits an Anthropic gesendete Nachrichten koennen nicht
nachtraeglich geloescht werden, da die API Daten nicht persistent pro
Nutzer speichert und kein Loeschmechanismus existiert. Die Daten werden
transient verarbeitet und sind danach nicht mehr zugreifbar.
Sprachnachrichten werden ausschliesslich lokal verarbeitet und nicht
an Drittanbieter weitergegeben.

Wende dich fuer Anfragen an den Gruppenadministrator.

### Freiwilligkeit

Die Nutzung des Bots ist vollstaendig freiwillig. Du kannst die Gruppe
nutzen, ohne jemals mit dem Bot zu interagieren. Der Bot liest keine
Nachrichten mit, die nicht an ihn gerichtet sind.

### Aenderungen

Bei wesentlichen Aenderungen an der Datenverarbeitung wird die Gruppe
informiert.

---

## Pinned Message (zum Kopieren)

```
Datenschutzhinweis - @lydia_bible_bot

Dieser Bot ist ein KI-Assistent (Claude/Anthropic, Sonnet 4.5) fuer Bibelstudium.

Was passiert mit euren Daten?
- Nur Nachrichten an den Bot (@mention oder Reply) werden verarbeitet
- Normale Gruppennachrichten werden NICHT gelesen
- Nachrichteninhalt wird an Anthropic (USA) gesendet und dort transient
  verarbeitet (nicht dauerhaft gespeichert)
- Sprachnachrichten werden lokal transkribiert (keine Weitergabe an Dritte)
- Interaktionen werden im lokalen Audit-Log erfasst

Was kann geloescht werden?
- Lokales Audit-Log und Session-Daten: Ja, auf Anfrage beim Gruppenadmin
- Bereits an Anthropic gesendete Daten: Nein - diese werden transient
  verarbeitet und sind danach nicht mehr zugreifbar

Nutzung ist freiwillig. Ihr koennt die Gruppe nutzen, ohne den Bot
anzusprechen. Bei Fragen: Gruppenadmin kontaktieren.
```
