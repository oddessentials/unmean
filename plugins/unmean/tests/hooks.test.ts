import { expect, mock, test } from 'claude-code/testing'

const COMPOSER = { kind: 'composer' } as const

type Arranged = { env?: Record<string, string>; config?: string; unreadable?: boolean; log?: unknown[]; debug?: string[] }

function arrange(on: any, { env = {}, config, unreadable, log, debug }: Arranged = {}) {
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
    const isDebug = JSON.stringify(e).includes('"debug"')
    if (log && !isDebug) log.push(e)
    if (debug && isDebug) debug.push(JSON.stringify(e))
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

test('phrase removal reports the number of words, preserving code', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { config: '{ "add": ["purple turtle"] }', log })
  expect(await submit($, 'a purple turtle near `purple turtle`')).toBe('a near `purple turtle`')
  expect(JSON.stringify(log)).toContain('removed 2 words')
})

const USAGE = { input_tokens: 120, output_tokens: 3, cache_read_input_tokens: 7, cache_creation_input_tokens: 9 }
const NO_USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type Reply = string | { reason: 'api-error' | 'empty-reply' | 'aborted' } | null

function smallModel(on: any, reply: Reply, seen: any[] = []) {
  on('model.complete', ($: any, e: any) => {
    seen.push(e)
    if (reply === null) return { deny: 'model blocked' }
    if (typeof reply === 'string') return { value: { isAnswered: true, text: reply, usage: USAGE } }
    if (reply.reason === 'api-error') {
      return { value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: NO_USAGE } }
    }
    return { value: { isAnswered: false, reason: reply.reason, usage: NO_USAGE } }
  })
  return seen
}

test('smartFilter is off by default and calls no model', async ($, on) => {
  arrange(on)
  const seen = smallModel(on, 'DEMEANING')
  expect(await submit($, 'you are useless, fix it')).toBe('you are useless, fix it')
  expect(seen.length).toBe(0)
})

test('smartFilter replaces a clearly demeaning prompt as if every word were removed', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { config: '{ "smartFilter": true }', log })
  smallModel(on, 'DEMEANING')
  expect(await submit($, 'you are a worthless idiot')).toBe('(frustrated sigh)')
  expect(JSON.stringify(log)).toContain('removed the prompt')
})

test('smartFilter lets anything else through', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  smallModel(on, 'OK')
  expect(await submit($, 'this is broken again, please fix it')).toBe('this is broken again, please fix it')
})

test('smartFilter asks the haiku model for one short, low-effort label', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  const seen = smallModel(on, 'OK')
  await submit($, 'please fix it')
  expect(seen.length).toBe(1)
  expect(seen[0].model).toBe('haiku')
  expect(seen[0].maxTokens).toBe(16)
  expect(seen[0].effort).toBe('low')
  expect(seen[0].system).toContain('Reply with one word: DEMEANING or OK.')
})

test('the small model only ever reads the filtered prompt', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  const seen = smallModel(on, 'OK')
  expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
  expect(seen.length).toBe(1)
  expect(seen[0].prompt).toBe('<prompt>\nfix this bug\n</prompt>')
  expect(seen[0].prompt + seen[0].system).not.toMatch(/fuck/)
})

test('external words and custom phrases are removed before smartFilter reads the prompt', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true, "add": ["purple turtle"] }' })
  const seen = smallModel(on, 'OK')
  expect(await submit($, 'fix this dumb purple turtle bug')).toBe('fix this bug')
  expect(seen.length).toBe(1)
  expect(seen[0].prompt).toBe('<prompt>\nfix this bug\n</prompt>')
})

for (const reply of ['DEMEANING', ' demeaning.\n', '`DEMEANING`', '"Demeaning!"', '**DEMEANING**']) {
  test(`smartFilter reads ${JSON.stringify(reply)} as demeaning`, async ($, on) => {
    arrange(on, { config: '{ "smartFilter": true }' })
    smallModel(on, reply)
    expect(await submit($, 'you are a worthless idiot')).toBe('(frustrated sigh)')
  })
}

for (const reply of ['OK', 'NOT DEMEANING', 'DEMEANING OK', '', 'This prompt is demeaning.']) {
  test(`smartFilter lets the prompt through on ${JSON.stringify(reply)}`, async ($, on) => {
    arrange(on, { config: '{ "smartFilter": true }' })
    smallModel(on, reply)
    expect(await submit($, 'you are worthless, fix it')).toBe('you are worthless, fix it')
  })
}

for (const reason of ['api-error', 'empty-reply', 'aborted'] as const) {
  test(`smartFilter lets the filtered prompt through after ${reason}`, async ($, on) => {
    const debug: string[] = []
    arrange(on, { config: '{ "smartFilter": true }', debug })
    smallModel(on, { reason })
    expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
    expect(debug.join('\n')).toContain(`smartFilter let a prompt through after ${reason}`)
  })
}

test('smartFilter lets the filtered prompt through when the small model call is refused', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  smallModel(on, null)
  expect(await submit($, 'fix this fucking bug')).toBe('fix this bug')
})

test('smartFilter writes each call\'s token usage to the debug log', async ($, on) => {
  const debug: string[] = []
  arrange(on, { config: '{ "smartFilter": true }', debug })
  smallModel(on, 'OK')
  await submit($, 'please fix it')
  expect(debug.join('\n')).toContain('smartFilter used 120 input, 3 output, 7 cache-read, 9 cache-write tokens')
})

test('smartFilter writes token usage to the debug log when the call fails', async ($, on) => {
  const debug: string[] = []
  arrange(on, { config: '{ "smartFilter": true }', debug })
  smallModel(on, { reason: 'api-error' })
  await submit($, 'please fix it')
  expect(debug.join('\n')).toContain('smartFilter used 0 input, 0 output, 0 cache-read, 0 cache-write tokens')
})

test('token usage never reaches the transcript', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { config: '{ "smartFilter": true }', log })
  smallModel(on, 'DEMEANING')
  expect(await submit($, 'you are a worthless idiot')).toBe('(frustrated sigh)')
  expect(JSON.stringify(log)).not.toMatch(/tokens|input|output/)
})

test('smartFilter makes no call when every word was already removed', async ($, on) => {
  arrange(on, { config: '{ "smartFilter": true }' })
  const seen = smallModel(on, 'DEMEANING')
  expect(await submit($, 'fuck')).toBe('(frustrated sigh)')
  expect(seen.length).toBe(0)
})
