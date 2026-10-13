// Pure filter tests for plain Node (`node --test`). No Claude Code needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clean, compile, DEFAULT_CONFIG, isFlagged } from '../hooks/filter.js'
import { parseConfigText } from '../hooks/config.js'
import { CASES, FLAGGED, NOT_FLAGGED } from './cases.js'

const defaults = compile(DEFAULT_CONFIG)

for (const c of CASES) {
  test(c.name, () => {
    const compiled = c.config ? compile({ ...DEFAULT_CONFIG, ...c.config }) : defaults
    assert.deepEqual(clean(c.input, compiled).text, c.expected)
  })
}

test('listed words are flagged', () => {
  for (const t of FLAGGED) assert.equal(isFlagged(t, defaults), true, t)
})

test('innocent words are not flagged', () => {
  for (const t of NOT_FLAGGED) assert.equal(isFlagged(t, defaults), false, t)
})

test('malformed input: a non-string prompt passes through', () => {
  assert.equal(clean(undefined, defaults).text, undefined)
  assert.equal(clean(null, defaults).changed, false)
  assert.equal(clean(42, defaults).changed, false)
})

test('malformed config: invalid JSON falls back to the defaults and says why', () => {
  const { config, error } = parseConfigText('{ this is not json')
  assert.match(error, /invalid JSON/)
  assert.equal(config.enabled, true)
  assert.equal(clean('damn it', compile(config)).text, 'it')
})

test('malformed config: wrong-typed fields keep their defaults', () => {
  const { config, error } = parseConfigText('{"add": "heck", "mode": 7, "notify": "yes", "enabled": false, "bogus": 1}')
  assert.deepEqual(config.add, [])
  assert.equal(config.mode, 'remove')
  assert.equal(config.notify, true)
  assert.equal(config.enabled, false)
  assert.match(error, /add must be a list/)
  assert.match(error, /unknown option "bogus"/)
})

test('malformed config: a non-object is rejected, filter stays on', () => {
  const { config, error } = parseConfigText('[1, 2]')
  assert.match(error, /JSON object/)
  assert.equal(config.enabled, true)
})

test('config words are normalized to lowercase letters', () => {
  const { config } = parseConfigText('{"add": ["  Heck! ", "", 7, "dang-it"]}')
  assert.deepEqual(config.add, ['heck', 'dangit'])
})

test('a 25 KB prompt filters well under the 100ms budget', () => {
  const big = 'please fix the build, it is broken again and the tests fail. '.repeat(400) + ' fucking hell'
  const started = performance.now()
  clean(big, defaults)
  assert.ok(performance.now() - started < 100)
})

test('hostile 100 KB pastes with no whitespace filter in milliseconds', () => {
  const blob = {}
  for (let i = 0; i < 1500; i += 1) blob[`key${i}`] = { id: i, name: `item${i}`, tags: ['a', 'b', 'c'] }
  const shapes = {
    'single token': 'x'.repeat(100_000),
    hex: 'deadbeef'.repeat(12_500),
    'base64 data URI': `data:image/png;base64,${'QUJD'.repeat(25_000)}`,
    'minified JSON': JSON.stringify(blob),
    dashes: 'a-'.repeat(50_000),
    dots: 'a.'.repeat(50_000),
    pluses: 'a+'.repeat(50_000),
    'at signs': 'a@'.repeat(50_000),
    backticks: '`'.repeat(99_996),
    fences: '```'.repeat(33_000),
    slashes: '/'.repeat(100_000),
  }
  for (const [shape, body] of Object.entries(shapes)) {
    const started = performance.now()
    const result = clean(`${body} fucking hell`, defaults)
    const took = performance.now() - started
    assert.ok(took < 100, `${shape} took ${took.toFixed(0)}ms`)
    assert.equal(result.count, 1, shape)
  }
})
