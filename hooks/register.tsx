import type { EngineInterface, Register } from 'claude-code'

// Sobald der Text im Eingabefeld auf /braindump endet, wird er sofort aufgeräumt
// und ersetzt den Feldinhalt (ohne Enter). Zum Senden danach: Enter.
const TRIGGER = /\s*\/brain-?dump\s*$/i

const SYSTEM = `Du bereinigst und strukturierst diktierte deutsche Texte (Spracheingabe), bevor der Nutzer sie an einen KI-Assistenten schickt. Gib NUR den fertigen Text aus, ohne Einleitung und Kommentar.

Regeln:
- Entferne Füllwörter (ähm, äh, also, halt, quasi, sozusagen, irgendwie, ne, ja gut), Stottern, Satzabbrüche, Selbstkorrekturen (nur die letzte Fassung zählt) und alle Wiederholungen. Jede Information steht genau einmal da.
- Korrigiere Versprecher und Spracherkennungsfehler aus dem Kontext (z. B. "Mord" statt "Mod", "Braindamp" statt "Brain-Dump", falsch erkannte Namen/Fachbegriffe). Ist eine Korrektur unsicher, schreibe das Wort mit (?) dahinter.
- Behalte ALLE inhaltlich wichtigen Punkte, Zahlen, Namen, Fristen, Wünsche und Einschränkungen. Nichts erfinden, nichts Wichtiges weglassen.
- Behalte die Ich-Perspektive und den Ton des Nutzers; formuliere als direkte Anfrage an den Assistenten.
- Struktur: erst ein bis zwei Sätze Ziel/Kontext. Danach nach Bedarf mit fetten Zwischenüberschriften und Stichpunkten: **Ziel**, **Anforderungen**, **Aufgaben**, **Entscheidungen**, **Offene Fragen**. Leere Abschnitte weglassen. Kurze Eingaben bleiben kurze, saubere Sätze ohne Überschriften.
- Widersprüchliches oder Unklares nicht auflösen, sondern unter **Offene Fragen** festhalten.`

let isBusy = false

async function tidy($: EngineInterface, full: string, raw: string) {
  $.ui.status('Brain-Dump wird aufgeräumt …')
  const r = await $.model.complete({
    model: 'sonnet',
    system: SYSTEM,
    prompt: raw,
    maxTokens: 4000,
    effort: 'low',
    timeoutMs: 60000,
  })
  $.ui.status(undefined)

  if (!r.isAnswered) {
    $.ui.toast('Aufräumen fehlgeschlagen, dein Originaltext steht wieder im Feld.')
  }

  // Nur ersetzen, wenn das Feld noch unverändert ist.
  const box = await $.prompt.read()
  if (box.text === full) {
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
    if (e.command || e.isMeta || !TRIGGER.test(e.text)) {
      return next(e)
    }

    const raw = e.text.replace(TRIGGER, '').trim()

    if (raw === '') {
      return { drop: 'Kein Text vor /braindump.' }
    }

    void (async () => {
      await $.clock.sleep(150)
      await $.prompt.fill({ text: e.text, mode: 'replace' })
      await tidy($, e.text, raw)
    })()

    return { drop: 'Wird aufgeräumt …' }
  })
}
