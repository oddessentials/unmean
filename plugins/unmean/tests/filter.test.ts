import { expect, test } from 'claude-code/testing'
import { clean, compile, DEFAULT_CONFIG, isFlagged } from '../hooks/filter.js'
import { parseConfigText } from '../hooks/config.js'
import { CASES, FLAGGED, NOT_FLAGGED } from './cases.js'

const defaults = compile(DEFAULT_CONFIG)

for (const c of CASES) {
  test(c.name, async () => {
    const compiled = c.config ? compile({ ...DEFAULT_CONFIG, ...c.config }) : defaults
    expect(clean(c.input, compiled).text).toBe(c.expected)
  })
}

test('listed words are flagged', async () => {
  for (const t of FLAGGED) expect(isFlagged(t, defaults)).toBe(true)
})

test('innocent words are not flagged', async () => {
  for (const t of NOT_FLAGGED) expect(isFlagged(t, defaults)).toBe(false)
})

test('malformed input: a non-string prompt passes through', async () => {
  expect(clean(undefined as any, defaults).text).toBeUndefined()
  expect(clean(42 as any, defaults).changed).toBe(false)
})

test('malformed config: invalid JSON falls back to the defaults and says why', async () => {
  const { config, error } = parseConfigText('{ this is not json')
  expect(error).toMatch(/invalid JSON/)
  expect(config.enabled).toBe(true)
  expect(clean('damn it', compile(config)).text).toBe('it')
})

test('malformed config: wrong-typed fields keep their defaults', async () => {
  const { config, error } = parseConfigText('{"add": "heck", "mode": 7, "enabled": false, "bogus": 1}')
  expect(config.add).toEqual([])
  expect(config.mode).toBe('remove')
  expect(config.enabled).toBe(false)
  expect(error).toMatch(/unknown option "bogus"/)
})
