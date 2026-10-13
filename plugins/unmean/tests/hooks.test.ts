// Hook tests under `claude plugin test`: the module is loaded by Claude Code's
// own engine and events are fired through it, with the engine's answers stubbed.
import { expect, mock, test } from 'claude-code/testing'

const COMPOSER = { kind: 'composer' } as const

// `log` collects the transcript lines the module writes, leaving out debug-log lines.
type Arranged = { env?: Record<string, string>; config?: string; log?: unknown[] }

// Stubs for everything the module asks the engine for. A test with no `config`
// has no config file on disk.
function arrange(on: any, { env = {}, config, log }: Arranged = {}) {
  mock.env(on, env)
  if (config === undefined) {
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

// Stands for what Claude Code draws at a transcript row: the row's text.
function drawRows(on: any) {
  on('ui.render', ($: any, e: any) => ({ type: 'Text', props: {}, children: [e.props.text] }))
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

test('prompts that are not the person\'s own words are left alone', async ($, on) => {
  arrange(on)
  expect(await submit($, 'the fucking build failed', { kind: 'task-notification' })).toBe('the fucking build failed')
})

test('the transcript row shows what the person typed, on every surface', async ($, on) => {
  arrange(on)
  drawRows(on)
  await submit($, 'fix this fucking bug')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'unmean',
      surface,
      component: 'UserMessage',
      requestId: 'msg-1',
      props: { text: 'fix this bug', origin: COMPOSER, isExpanded: true },
    })
    expect(await ui.find({ type: 'Text', text: 'fix this fucking bug' })).toBeDefined()
    await ui.unmount()
  }
})

test('other transcript rows are drawn as they are', async ($, on) => {
  arrange(on)
  drawRows(on)
  const ui = await $.ui.mount({
    plugin: 'unmean',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: 'msg-2',
    props: { text: 'hello there', origin: COMPOSER, isExpanded: true },
  })
  expect(await ui.find({ type: 'Text', text: 'hello there' })).toBeDefined()
  await ui.unmount()
})


test('by default a transcript line names the removed words', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { log })
  expect(await submit($, 'wtf, install flask-wtf and fix this damn bug')).toBe('install flask and fix this bug')
  expect(log.length).toBe(1)
  expect(JSON.stringify(log[0])).toContain('removed before Claude read this prompt: wtf, damn')
})

test('"notify": false removes silently', async ($, on) => {
  const log: unknown[] = []
  arrange(on, { config: '{ "notify": false }', log })
  expect(await submit($, 'fix this damn bug')).toBe('fix this bug')
  expect(log.length).toBe(0)
})
