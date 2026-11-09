# Claude Braindump Mod

Mod für Claude Code (Desktop-App und Terminal), die diktierte oder getippte Texte automatisch aufräumt und strukturiert, bevor du sie absendest.

## Was sie macht

Schreibe oder diktiere deinen Text ins Eingabefeld und hänge am Ende `/braindump` an. Sobald der Befehl fertig getippt ist, wird der Text bereinigt und ersetzt den Inhalt des Feldes. Danach prüfst du ihn und sendest ihn mit Enter ab.

- Entfernt Füllwörter, Wiederholungen und Satzabbrüche
- Korrigiert Versprecher und Spracherkennungsfehler (unsichere mit `(?)`)
- Gliedert in Ziel, Anforderungen, Aufgaben, Entscheidungen und offene Fragen
- Erfindet nichts und lässt nichts Wichtiges weg

Auch `/brain` und `/brain-dump` lösen das Aufräumen aus.

## Installation

```
/plugin install braindump --marketplace <github-name>/claude-braindump-mod
```

Danach `y` für das Hinzufügen des Marketplace und einen Geltungsbereich wählen.
