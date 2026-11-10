# Claude Braindump Mod

Mod für Claude Code (Desktop-App und Terminal), die diktierte oder getippte Texte automatisch aufräumt, strukturiert und als Prompt verbessert, bevor du sie absendest.

## Was sie macht

Schreibe oder diktiere deinen Text ins Eingabefeld und hänge am Ende `/braindump` an. Sobald der Befehl fertig getippt ist (spätestens beim Enter), wird der Text bereinigt und ersetzt den Inhalt des Feldes. Gesendet wird nichts: Du prüfst den Text und schickst ihn selbst mit Enter ab.

- Entfernt Füllwörter, Wiederholungen und Satzabbrüche
- Korrigiert Versprecher und Spracherkennungsfehler aus dem Gesprächszusammenhang: Die Mod liest den bisherigen Chatverlauf, die dort häufigen Begriffe und eine Wortliste mit. So wird aus „die Mord testen“ in einem Chat über Mods „die Mod testen“. Unsichere Stellen bekommen ein `(?)`.
- Gliedert in Ziel, Anforderungen, Aufgaben, Entscheidungen und offene Fragen
- Prüft den Prompt auf sieben Bausteine (Ziel, Kontext, Aufgabe, Rahmen, Fertig wenn, Beispiel, Freiheit) und hängt für fehlende einen Block **Noch ergänzen** mit konkreten Fragen an
- Erfindet nichts und lässt nichts Wichtiges weg

Auch `/brain-dump` und vertippt `/braindumb` lösen das Aufräumen aus.

## Fehlende Bausteine ergänzen

Schreib deine Antworten hinter das `→` der jeweiligen Frage. Dann entweder:

- **senden:** Unbeantwortete Fragen werden automatisch entfernt, deine Antworten gehen als „Ergänzungen“ mit, oder
- **erneut `/braindump` ans Ende:** Die Antworten werden in den Text eingearbeitet, gefragt wird nur noch, was weiterhin fehlt.

## Eigene Wörter

In `woerter.txt` steht ein Begriff pro Zeile, oder ein typischer Hörfehler als `falsch → richtig` (z. B. `Mord → Mod`). Ergänze dort deine Fachbegriffe und Namen.

## Installation

```
/plugin install braindump --marketplace VWdesignlab/-braindumb-Claude-code
```

Danach `y` für das Hinzufügen des Marketplace und einen Geltungsbereich wählen.
