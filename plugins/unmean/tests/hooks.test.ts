import { expect, mock, test } from 'claude-code/testing'

const COMPOSER = { kind: 'composer' } as const

type Arranged = { env?: Record<string, string>; config?: string; unreadable?: boolean; log?: unknown[] }

function arrange(on: any, { env = {}, config, unreadable, log }: Arranged = {}) {
  mock.env(on, env)
  if (unreadable) {
    on('fs.stat', () => ({ value: { kind: 'file', size: 10, mtimeMs: 1, isLink: false } }))
    on('fs.read', () => ({ deny: 'EACCES: permission denied' }))
  } else if (config === undefined) {
    on('fs.stat', () => ({ deny: 'ENOENT: no such file or directory' }))
  } else {
    on('fs.stat', () => ({ value: { kind: 'file', size: config.length, mtimeMs: 1, isLink: false } }))
    on('fs.read', () => ({ value: config }))
  }
  on('ui.log', ($: any, e: any) => {
    if (log && !JSON.stringify(e).includes('"debug"')) log.push(e)
    return { value: undefined }
  })
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
}

async function submit($: any, text: string, origin: unknown = COMPOSER): Promise<string> {
  const result = await $.prompt.submit({ text, wait: false, origin })
  return result.text
}

test('a clean prompt reaches Claude unchanged', async ($, on) => {
  arrange(on)
  expect(await submit($, 'please fix the classic Scunthorpe bug')).toBe('please fix the classic Scunthorpe bug')
})

test('profanity is removed before Claude reads the prompt', async ($, on) => {
  arrange(on)
  expect(await submit($, 'fix this fucking bug, you useless shit')).toBe('fix this bug, you useless')
})

test('UNMEAN=off in the environment turns the filter off', async ($, on) => {
  arrange(on, { env: { UNMEAN: 'off' } })
  expect(await submit($, 'fix this fucking bug')).toBe('fix this fucking bug')
})

test('"enabled": false in the config file turns the filter off', async ($, on) => {
  arrange(on, { config: '{ "enabled": false }' })
  expect(await submit($, 'fix this fucking bug')).toBe('fix this fucking bug')
})

test('the config file can add and remove words', async ($, on) => {
  arrange(on, { config: '{ "add": ["heck"], "remove": ["shit"] }' })
  expect(await submit($, 'what the heck, this shit')).toBe('what the, this shit')
})

test('a malformed config file falls back to the defaults', async ($, on) => {
  arrange(on, { config: '{ this is not json' })
  expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
})

test('an unreadable config file falls back to the defaults', async ($, on) => {
  arrange(on, { unreadable: true })
  expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
})

test('prompts that are not the person\'s own words are left alone', async ($, on) => {
  arrange(on)
  expect(await submit($, 'the fucking build failed', { kind: 'task-notification' })).toBe('the fucking build failed')
})

test('by default a transcript line says how many words were removed, never which', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { log })
  expect(await submit($, 'fix this damn bug')).toBe('fix this bug')
  expect(await submit($, 'wtf, fix this fucking bug')).toBe('fix this bug')
  expect(log.length).toBe(2)
  expect(JSON.stringify(log[0])).toContain('removed 1 word')
  expect(JSON.stringify(log[1])).toContain('removed 2 words')
  for (const line of log) expect(JSON.stringify(line)).not.toMatch(/damn|wtf|fuck/)
})

test('"notify": false removes silently', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { config: '{ "notify": false }', log })
  expect(await submit($, 'fix this damn bug')).toBe('fix this bug')
  expect(log.length).toBe(0)
})

function smallModel(on: any, reply: string | null, seen: string[] = []) {
  on('model.classify', ($: any, e: any) => {
    seen.push(e.text)
    if (reply === null) throw new Error('overloaded')
    return { value: reply }
  })
  return seen
}

test('smartFilter is off by default and calls no model', async ($, on) => {
  arrange(on)
  const seen = smallModel(on, 'clearly demeaning or unconstructive')
  expect(await submit($, 'you are useless, fix it')).toBe('you are useless, fix it')
  expect(seen.length).toBe(0)
})

test('smartFilter replaces a clearly demeaning prompt as if every word were removed', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { config: '{ "smartFilter": true }', log })
  smallModel(on, 'clearly demeaning or unconstructive')
  expect(await submit($, 'you are a worthless idiot')).toBe('(frustrated sigh)')
  expect(JSON.stringify(log)).toContain('removed the prompt')
})

test('smartFilter lets anything else through', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  smallModel(on, 'anything else')
  expect(await submit($, 'this is broken again, please fix it')).toBe('this is broken again, please fix it')
})

test('the small model only ever reads the filtered prompt', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  const seen = smallModel(on, 'anything else')
  expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
  expect(seen.length).toBe(1)
  expect(seen[0]).toBe('fix this bug')
  expect(seen[0]).not.toMatch(/fuck/)
})

test('smartFilter lets the filtered prompt through when the small model fails', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  smallModel(on, null)
  expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
})

test('smartFilter makes no call when every word was already removed', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  const seen = smallModel(on, 'clearly demeaning or unconstructive')
  expect(await submit($, 'fuck')).toBe('(frustrated sigh)')
  expect(seen.length).toBe(0)
})
