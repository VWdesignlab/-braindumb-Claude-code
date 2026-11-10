import { expect, test } from 'claude-code/testing'

const fills: string[] = []
const sent: string[] = []

const setup = (on: any) => {
  fills.length = 0
  sent.length = 0
  on('clock.sleep', () => ({ value: undefined }))
  on('prompt.fill', (_: unknown, e: any) => {
    fills.push(e.text)

    return { isFilled: true }
  })
  on('prompt.read', () => ({ value: { text: fills[fills.length - 1] ?? '' } }))
  on('model.complete', (_: unknown, e: any) => {
    sent.push(e.prompt)

    return { value: { isAnswered: true, text: 'Ich möchte die Mod heute testen.' } }
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Die Mod soll meinen Text aufräumen.', toolUses: [] },
      { role: 'assistant', text: 'Ich baue die Mod um, die Mod lädt jetzt.', toolUses: [] },
    ],
  }))
  on('fs.read', () => ({ value: '# Kommentar\nMord → Mod\nGitHub' }))
  on('command.register', () => ({ value: { command: 'braindump' } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text }))
}

test('Text mit /braindump am Ende wird nicht gesendet, sondern aufgeräumt', async ($, on) => {
  setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const r: any = await $.prompt.submit({ text: 'ähm also die Mord testen /braindump' })
  expect(r.drop).toBe('Wird aufgeräumt …')

  // Warten, bis die aufgeräumte Fassung im Feld steht.
  for (let i = 0; i < 50 && fills[fills.length - 1] !== 'Ich möchte die Mod heute testen.'; i++) {
    await new Promise(res => setTimeout(res, 10))
  }
  expect(fills[fills.length - 1]).toBe('Ich möchte die Mod heute testen.')

  // Chatverlauf, häufige Begriffe und Wortliste gehen mit ans Modell.
  expect(sent[0]).toContain('Assistent: Ich baue die Mod um')
  expect(sent[0]).toContain('HÄUFIGE BEGRIFFE IM CHAT:\nMod')
  expect(sent[0]).toContain('Mord → Mod')
  expect(sent[0]).not.toContain('# Kommentar')
  expect(sent[0]).toContain('TEXT ZUM AUFRÄUMEN (nur diesen ausgeben, bereinigt):\nähm also die Mord testen')
})

test('vertippt /braindumb löst auch aus', async ($, on) => {
  setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const r: any = await $.prompt.submit({ text: 'ähm also die Mord testen /braindumb' })
  expect(r.drop).toBe('Wird aufgeräumt …')
})

test('ohne /braindump am Ende geht der Text normal raus', async ($, on) => {
  setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const r: any = await $.prompt.submit({ text: 'normaler Text /braindump mittendrin' })
  expect(r.text).toBe('normaler Text /braindump mittendrin')
})

const HEAD = '**Noch ergänzen** (Antwort hinter → schreiben, dann senden oder erneut /braindump):'

test('beim Senden fallen unbeantwortete Lücken weg', async ($, on) => {
  setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const text = `Schreib mir einen Newsletter.\n\n${HEAD}\n- **Rahmen:** Wie lang? → \n- **Fertig wenn:** Woran erkennst du es? → `
  const r: any = await $.prompt.submit({ text })
  expect(r.text).toBe('Schreib mir einen Newsletter.')
})

test('beim Senden bleiben beantwortete Lücken als Ergänzungen', async ($, on) => {
  setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const text = `Schreib mir einen Newsletter.\n\n${HEAD}\n- **Rahmen:** Wie lang? → 300 Wörter, locker\n- **Fertig wenn:** Woran erkennst du es? → `
  const r: any = await $.prompt.submit({ text })
  expect(r.text).toBe('Schreib mir einen Newsletter.\n\n**Ergänzungen:**\n- **Rahmen:** Wie lang? → 300 Wörter, locker')
})
