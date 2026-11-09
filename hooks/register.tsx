import type { EngineInterface, Register } from 'claude-code'

// Sobald der Text im Eingabefeld auf /braindump endet, wird er sofort aufgeräumt
// und ersetzt den Feldinhalt (ohne Enter). Zum Senden danach: Enter.
const TRIGGER = /\s*\/brain-?dump\s*$/i

const WORKING = '\n\n⏳ Brain-Dump wird aufgeräumt …'

const SYSTEM = `Du bereinigst und strukturierst diktierte oder getippte Texte (meist Deutsch, oft mit englischen Fachbegriffen), bevor der Nutzer sie an einen KI-Assistenten schickt. Gib NUR den fertigen Text aus, ohne Einleitung und Kommentar.

VORGEHEN (intern, nicht ausgeben):
1. Lies den GANZEN Text zuerst und bestimme Thema, Fachgebiet und worum es dem Nutzer geht.
2. Prüfe jedes auffällige Wort im Licht dieses Themas. Ein Wort gilt nur als Fehler, wenn es im Satz und im Gesamtthema keinen Sinn ergibt. Klingt ein Wort wie ein anderes, das thematisch passt (Spracherkennung: "Mord" statt "Mod", "Braindamp" statt "Brain-Dump", "Gith Hub" statt "GitHub"), setze das passende ein.
3. Ändere NIE ein Wort, das sinnvoll sein kann. Im Zweifel bleibt das Originalwort stehen, mit (?) dahinter. Rate nie ein anderes Wort.

WÖRTER UND BEGRIFFE:
- Englische Begriffe, Fachwörter, Produkt- und Eigennamen, Markennamen, Dateinamen, Befehle, Pfade, Code, URLs und Zahlen bleiben unverändert, auch wenn sie im deutschen Satz stehen. Ersetze sie nicht durch deutsche oder ähnlich klingende Wörter. Korrigiere nur eindeutig falsche Schreibweisen (z. B. "githab" → "GitHub").
- Ein Begriff, der im Text mehrfach vorkommt, wird überall gleich geschrieben (die am besten passende Schreibweise).
- Füge keine Wörter, Begriffe oder Details hinzu, die der Nutzer nicht gesagt hat.

BEREINIGEN:
- Entferne Füllwörter (ähm, äh, also, halt, quasi, sozusagen, irgendwie, ne, ja gut), Stottern, Satzabbrüche, Selbstkorrekturen (nur die letzte Fassung zählt) und Wiederholungen. Jede Information steht genau einmal da.
- Behalte ALLE inhaltlich wichtigen Punkte, Zahlen, Namen, Fristen, Wünsche und Einschränkungen.
- Behalte die Ich-Perspektive und den Ton des Nutzers; formuliere als direkte Anfrage an den Assistenten.

STRUKTUR:
- Erst ein bis zwei Sätze Ziel/Kontext. Danach nach Bedarf mit fetten Zwischenüberschriften und Stichpunkten: **Ziel**, **Anforderungen**, **Aufgaben**, **Entscheidungen**, **Offene Fragen**. Leere Abschnitte weglassen. Kurze Eingaben bleiben kurze, saubere Sätze ohne Überschriften.
- Widersprüchliches oder Unklares nicht auflösen, sondern unter **Offene Fragen** festhalten. Dort auch Wörter nennen, bei denen du dir unsicher warst.`

let isBusy = false

async function tidy($: EngineInterface, full: string, raw: string) {
  // Sofort im Eingabefeld zeigen, dass etwas passiert.
  const working = raw + WORKING
  await $.clock.sleep(60)
  await $.prompt.fill({ text: working, mode: 'replace' })
  $.ui.status('Brain-Dump wird aufgeräumt …')

  const r = await $.model.complete({
    model: 'sonnet',
    system: SYSTEM,
    prompt: raw,
    maxTokens: 4000,
    effort: 'medium',
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'braindump',
      description: 'Text diktieren, am Ende /braindump tippen: wird sofort aufgeräumt und strukturiert im Eingabefeld ersetzt',
    })

    return next(e)
  })

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
    void tidy($, r.text, raw).finally(() => {
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
      return next(e)
    }

    const raw = e.text.replace(TRIGGER, '').trim()

    if (raw === '') {
      return { drop: 'Kein Text vor /braindump.' }
    }

    if (isBusy) {
      return { drop: 'Brain-Dump läuft noch.' }
    }

    isBusy = true
    void (async () => {
      await $.clock.sleep(150)
      await $.prompt.fill({ text: e.text, mode: 'replace' })
      await tidy($, e.text, raw)
    })().finally(() => {
      isBusy = false
    })

    return { drop: 'Wird aufgeräumt …' }
  })
}
