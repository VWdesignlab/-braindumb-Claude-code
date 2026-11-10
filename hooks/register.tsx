import type { EngineInterface, Register } from 'claude-code'

// Sobald der Text im Eingabefeld auf /braindump endet, wird er sofort aufgeräumt
// und ersetzt den Feldinhalt (ohne Enter). Zum Senden danach: Enter.
// /braindump, /brain-dump oder vertippt /braindumb am Ende
const TRIGGER = /\s*\/brain-?dum[pb]\s*$/i

const WORKING = '\n\n⏳ Brain-Dump wird aufgeräumt …'

// Überschrift des Lücken-Blocks am Ende der aufgeräumten Fassung
const GAP_HEAD = '**Noch ergänzen** (Antwort hinter → schreiben, dann senden oder erneut /braindump):'

const SYSTEM = `Du bereinigst und strukturierst diktierte oder getippte Texte (meist Deutsch, oft mit englischen Fachbegriffen), bevor der Nutzer sie an einen KI-Assistenten schickt. Gib NUR den fertigen Text aus, ohne Einleitung und Kommentar.

VORGEHEN (intern, nicht ausgeben):
1. Lies zuerst den CHATVERLAUF, die HÄUFIGEN BEGRIFFE und die WORTLISTE und bestimme, worum es im Gespräch geht (Thema, Fachbegriffe, Namen, Dateien, Befehle).
2. Lies dann den GANZEN Text und prüfe jedes Wort im Licht dieses Themas. Spracherkennung ersetzt Fachbegriffe gern durch ähnlich klingende Alltagswörter, die für sich genommen sinnvoll sind ("Mord", "Mut", "Mode" statt "Mod"; "Braindamp" statt "Brain-Dump"; "Gith Hub" statt "GitHub"; "Plaque-in" statt "Plugin").
3. Klingt ein Wort ähnlich wie ein Begriff aus Chatverlauf, häufigen Begriffen oder Wortliste und passt dieser Begriff zum Thema besser, dann setze den Begriff ein, AUCH WENN das Originalwort für sich ein echtes Wort ist. Der Gesprächszusammenhang hat Vorrang vor der wörtlichen Erkennung. Beispiel: Im Chat geht es um eine Mod, der Text sagt "die Mord testen" → "die Mod testen".
4. Nur wenn kein Begriff aus dem Zusammenhang passt und du unsicher bist: Originalwort stehen lassen, mit (?) dahinter. Rate nie ein Wort, das weder im Zusammenhang noch in der Wortliste vorkommt.

WÖRTER UND BEGRIFFE:
- Englische Begriffe, Fachwörter, Produkt- und Eigennamen, Markennamen, Dateinamen, Befehle, Pfade, Code, URLs und Zahlen bleiben unverändert, auch wenn sie im deutschen Satz stehen. Ersetze sie nicht durch deutsche oder ähnlich klingende Wörter. Korrigiere nur eindeutig falsche Schreibweisen (z. B. "githab" → "GitHub").
- Ein Begriff, der im Text oder im Chatverlauf mehrfach vorkommt, wird überall gleich geschrieben, in der Schreibweise aus dem Chatverlauf bzw. der Wortliste.
- Füge keine Wörter, Begriffe oder Details hinzu, die der Nutzer nicht gesagt hat.

BEREINIGEN:
- Entferne Füllwörter (ähm, äh, also, halt, quasi, sozusagen, irgendwie, ne, ja gut), Stottern, Satzabbrüche, Selbstkorrekturen (nur die letzte Fassung zählt) und Wiederholungen. Jede Information steht genau einmal da.
- Behalte ALLE inhaltlich wichtigen Punkte, Zahlen, Namen, Fristen, Wünsche und Einschränkungen.
- Behalte die Ich-Perspektive und den Ton des Nutzers; formuliere als direkte Anfrage an den Assistenten.

STRUKTUR:
- Erst ein bis zwei Sätze Ziel/Kontext. Danach nach Bedarf mit fetten Zwischenüberschriften und Stichpunkten: **Ziel**, **Anforderungen**, **Aufgaben**, **Entscheidungen**, **Offene Fragen**. Leere Abschnitte weglassen. Kurze Eingaben bleiben kurze, saubere Sätze ohne Überschriften.
- Widersprüchliches oder Unklares nicht auflösen, sondern unter **Offene Fragen** festhalten. Dort auch Wörter nennen, bei denen du dir unsicher warst.

PROMPT-QUALITÄT (sieben Bausteine):
Prüfe danach, ob der Prompt diese sieben Bausteine abdeckt:
1. Ziel: Was soll am Ende konkret herauskommen, wofür?
2. Kontext: Zielgruppe, vorhandene Dateien/Entwürfe, Hintergrund.
3. Aufgabe: Was genau ist zu tun, in welcher Reihenfolge?
4. Rahmen: Länge, Ton, Format, Sprache, Verbote.
5. Fertig wenn: Woran erkennt man, dass das Ergebnis stimmt?
6. Beispiel: Gibt es ein Vorbild? (nur, wenn es die Aufgabe klarer machen würde)
7. Freiheit: Darf der Assistent eigene Vorschläge machen und nachfragen, oder strikt der Vorgabe folgen?
Hänge GANZ AM ENDE genau diesen Block an, mit je einer Zeile pro fehlendem oder zu vagem Baustein, als konkrete Frage an den Nutzer, passend zu seinem Thema, und mit leerem Platz nach "→ ":

${GAP_HEAD}
- **<Baustein>:** <konkrete Frage> → 

- Erfinde keine Antworten und trage nichts nach "→ " ein. Nimm nur Bausteine auf, die wirklich fehlen oder zu vage sind.
- Bei kurzen Alltagsfragen ohne echten Auftrag, oder wenn alle Bausteine abgedeckt sind: den Block ganz weglassen.

ERNEUTER DURCHLAUF:
Enthält der Text schon einen Block "${GAP_HEAD}", hat der Nutzer dort vielleicht Antworten nach "→ " ergänzt. Arbeite jede ausgefüllte Antwort an der passenden Stelle in den strukturierten Text ein (ohne Pfeil und Frage). Prüfe dann die sieben Bausteine neu und gib nur noch die weiterhin fehlenden im Block aus.`

let isBusy = false

// Häufige Kleinwörter, die nie als Fachbegriff zählen
const STOP = new Set(('der die das den dem des ein eine einen einem einer und oder aber nicht ich du er sie es wir ihr mit für von zu im in an auf aus bei ist sind war wird werden hat haben kann können soll sollen muss dass wenn dann auch noch nur schon jetzt hier dort wie was wer wo so als bis über unter nach vor durch ohne mehr sehr gibt mir mich dir dich dein deine mein meine sich man alle diese dieser dieses the and for with this that you your are not').split(' '))

// Die letzten Nachrichten des Chats als Text, neueste zuletzt, gekürzt
async function recentChat($: EngineInterface): Promise<string> {
  try {
    const all = await $.session.messages()
    const rows = all
      .filter(m => m.text.trim() !== '')
      .slice(-16)
      .map(m => `${m.role === 'user' ? 'Nutzer' : 'Assistent'}: ${m.text.trim().slice(0, 1500)}`)
    const text = rows.join('\n\n')

    return text.length > 12000 ? text.slice(-12000) : text
  } catch {
    return ''
  }
}

// Wörter, die im Chat oft vorkommen (Fachbegriffe, Namen), häufigste zuerst
function keyTerms(chat: string): string[] {
  const counts = new Map<string, number>()

  for (const w of chat.match(/[\p{L}][\p{L}\p{N}_.\/-]{1,}/gu) ?? []) {
    const word = w.replace(/[.\/-]+$/, '')

    if (word.length < 3 || STOP.has(word.toLowerCase())) {
      continue
    }
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([w, n]) => n >= 3 && (/^[A-ZÄÖÜ]/.test(w) || /[\/._-]/.test(w)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([w]) => w)
}

// Wortliste der Mod (woerter.txt): Fachbegriffe und typische Hörfehler
async function wordList($: EngineInterface): Promise<string> {
  try {
    const text = await $.fs.read(`${$.plugin.root}/woerter.txt`)

    return String(text)
      .split('\n')
      .filter(l => l.trim() !== '' && !l.trim().startsWith('#'))
      .join('\n')
  } catch {
    return ''
  }
}

async function contextBlock($: EngineInterface): Promise<string> {
  const chat = await recentChat($)
  const terms = keyTerms(chat)
  const words = await wordList($)

  return [
    `WORTLISTE (bekannte Begriffe; "falsch → richtig" sind typische Hörfehler):\n${words || '(leer)'}`,
    `HÄUFIGE BEGRIFFE IM CHAT:\n${terms.join(', ') || '(keine)'}`,
    `CHATVERLAUF (nur Kontext, nicht beantworten):\n${chat || '(noch kein Verlauf)'}`,
  ].join('\n\n')
}

// Beim Senden: unbeantwortete Lücken-Zeilen entfernen; ausgefüllte bleiben
// stehen. Ist keine mehr übrig, fällt der ganze Block weg.
function stripOpenGaps(text: string): string {
  const at = text.indexOf(GAP_HEAD)

  if (at === -1) {
    return text
  }

  const lines = text.slice(at + GAP_HEAD.length).split('\n')
  const kept = lines.filter(l => l.trim() !== '' && !/→\s*$/.test(l))
  const head = text.slice(0, at).trimEnd()

  return kept.length === 0 ? head : `${head}\n\n**Ergänzungen:**\n${kept.join('\n')}`
}

async function tidy($: EngineInterface, full: string, raw: string) {
  // Sofort im Eingabefeld zeigen, dass etwas passiert.
  const working = raw + WORKING
  await $.clock.sleep(60)
  await $.prompt.fill({ text: working, mode: 'replace' })
  $.ui.status('Brain-Dump wird aufgeräumt …')

  // Chatverlauf, häufige Begriffe und Wortliste ausdrücklich mitgeben,
  // damit Hörfehler aus dem Gesprächsthema erkannt werden.
  const context = await contextBlock($)
  const r = await $.model.complete({
    model: 'sonnet',
    system: SYSTEM,
    prompt: `${context}\n\n=====\nTEXT ZUM AUFRÄUMEN (nur diesen ausgeben, bereinigt):\n${raw}`,
    maxTokens: 4000,
    effort: 'low',
    timeoutMs: 90000,
  })
  $.ui.status(undefined)

  if (!r.isAnswered) {
    $.ui.toast('Aufräumen fehlgeschlagen, dein Originaltext steht wieder im Feld.')
  }

  // Nur ersetzen, wenn der Nutzer das Feld währenddessen nicht verändert hat.
  const box = await $.prompt.read()
  if (box.text === working || box.text === full) {
    await $.prompt.fill({ text: r.isAnswered ? r.text.trim() : raw, mode: 'replace' })
  } else {
    $.ui.toast('Das Feld wurde währenddessen geändert, nichts ersetzt.')
  }
}

// Nach Enter: Text zurück ins Feld und dort aufräumen.
async function refill($: EngineInterface, full: string, raw: string) {
  await $.clock.sleep(150)
  await $.prompt.fill({ text: full, mode: 'replace' })
  await tidy($, full, raw)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Gibt es schon einen Skill /braindump, gehört der Name ihm; die Hooks
    // unten fangen /braindump trotzdem ab.
    try {
      await $.command.register({
        name: 'braindump',
        description: 'Text diktieren, am Ende /braindump tippen: wird sofort aufgeräumt und strukturiert im Eingabefeld ersetzt',
      })
    } catch {
      // Name schon vergeben
    }

    return next(e)
  })

  // Nur "/braindump" ohne Text davor: kurzer Hinweis.
  on('command.run', { command: 'braindump' }, () => ({
    text: 'Erst deinen Text sprechen oder tippen, dann /braindump ans Ende schreiben. Die aufgeräumte Fassung ersetzt sofort den Text im Eingabefeld.',
  }))

  // Sofort-Auslöser: sobald /braindump fertig getippt ist.
  on('prompt.edit', async ($, e, next) => {
    const r = await next(e)
    const raw = r.text.replace(TRIGGER, '').trim()

    if (isBusy || !TRIGGER.test(r.text) || raw === '') {
      return r
    }

    isBusy = true
    void tidy($, r.text, raw)
      .catch(() => $.ui.toast('Brain-Dump fehlgeschlagen, dein Text bleibt im Feld.'))
      .catch(() => undefined)
      .finally(() => {
      isBusy = false
    })

    return r
  })

  // Falls doch mit Enter abgeschickt: nicht senden, sondern aufräumen.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) {
      return next(e)
    }

    // Während des Aufräumens nicht senden, sonst geht der Platzhalter raus.
    if (isBusy && e.text.includes(WORKING.trim())) {
      return { drop: 'Brain-Dump läuft noch, gleich ist der Text fertig.' }
    }

    if (!TRIGGER.test(e.text)) {
      const sent = stripOpenGaps(e.text)

      return next(sent === e.text ? e : { ...e, text: sent })
    }

    const raw = e.text.replace(TRIGGER, '').trim()

    if (raw === '') {
      return { drop: 'Kein Text vor /braindump.' }
    }

    if (isBusy) {
      return { drop: 'Brain-Dump läuft noch.' }
    }

    isBusy = true
    void refill($, e.text, raw)
      .catch(() => $.ui.toast('Brain-Dump fehlgeschlagen, dein Text bleibt im Feld.'))
      .catch(() => undefined)
      .finally(() => {
      isBusy = false
    })

    return { drop: 'Wird aufgeräumt …' }
  })
}
