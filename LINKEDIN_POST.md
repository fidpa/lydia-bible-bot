🤖 Eigenentwicklung: Security-gehärteter AI Telegram Bot (MIT Lizenz)

Ein Telegram Bot für die Bibelstudien-Gruppe, aufgebaut auf linuz90/claude-telegram-bot. Der Agent nutzt Claude Code als Backend — Grund genug für einen systematischen Security Audit.

**Das Problem**: Das Open-Source-Basisprojekt ist ein exzellenter Telegram-zu-Claude-Code-Bridge. Aber einen AI-Agenten mit `bypassPermissions` für eine Gruppe zu deployen, erfordert systematische Sicherheitsarbeit — also: Security Audit + systematische Härtung.

🛡️ **Security: 17 Findings, 13 gehärtet**
• Rate Limiting (Token Bucket)
• Path Validation mit Symlink-Auflösung
• Command Blocklist (Fork Bombs, Disk-Zerstörung, Pipe-to-Shell)
• Anti-Prompt-Injection im System Prompt
• Audit Logging mit automatischer Secret-Redaktion
• Document Safety Tagging gegen eingebettete Anweisungen
• 7 verbleibende Limitierungen transparent dokumentiert

📖 **Domain-Spezialisierung**
• Theologischer System Prompt (Zitatrichtlinien, Multi-Traditions-Bewusstsein)
• Lokale Spracherkennung via whisper.cpp (keine Cloud-API, DSGVO-konform)
• Gruppen-Chat-Filterung (@mentions, Replies, /voice-Trigger für Sprachnachrichten)
• DSGVO-Datenschutzhinweis + EU AI Act KI-Transparenz
• Deutsche Lokalisierung

🎓 **Was ich gelernt habe**: AI-Agent-Security ist Defense-in-Depth, keine Silver Bullet. Und: Gute UX in Gruppen-Chats braucht kreative Trigger-Patterns — Voice Messages haben keinen Text für @mentions.

💬 Wie balanciert ihr Security und UX bei AI-Agents? Und: Habt ihr schon mal einen Bot für eine Nischen-Community gebaut? Feedback willkommen.

📊 ~4.800 Zeilen TypeScript · ~1.100 Zeilen Dokumentation · produktiv im Einsatz
🔧 Stack: TypeScript, Bun, Claude Agent SDK, whisper.cpp, grammY, Zod
🔗 GitHub: github.com/fidpa/lydia-bible-bot

Marc | IT · Datenschutz · Psychologie

#Security #TypeScript #AI #OpenSource #TechPortfolio #DevSecOps #Bun #Telegram
