// unmean: the hooks module Claude Code loads.
//
// Two hooks:
//   prompt.submit  rewrites what Claude reads, so flagged words never reach it
//                  (nor the stored transcript message)
//   ui.render      redraws the person's own transcript row with what they
//                  typed, so the exchange looks unchanged to them
//
// Everything fails open: on any error the prompt goes through untouched.

import { clean, compile, DEFAULT_CONFIG } from './filter.js'
import { parseConfigText } from './config.js'

const PLUGIN = 'unmean'
const CONFIG_FILE = 'unmean.json'
const OFF_VALUES = new Set(['0', 'off', 'false', 'no'])
// Prompts the person wrote themselves. Task notifications, peer sessions,
// scheduled triggers and other plugins' prompts pass through untouched.
const USER_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'slack-ping', 'unclassified'])
const REMEMBER = 200

const DEFAULT_COMPILED = compile(DEFAULT_CONFIG)
const originals = new Map() // text Claude read -> text the person typed
let envCache = null
let configCache = null

function remember(cleaned, original) {
  originals.set(cleaned, original)
  originals.set(cleaned.trim(), original)
  while (originals.size > REMEMBER) originals.delete(originals.keys().next().value)
}

function trimSlashes(path) {
  return String(path).replace(/[\\/]+$/, '')
}

async function readEnv($) {
  if (envCache) return envCache
  const kill = await $.env.get('UNMEAN')
  const explicitPath = await $.env.get('UNMEAN_CONFIG')
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  const dir = configDir || `${trimSlashes(home)}/.claude`
  envCache = {
    disabled: OFF_VALUES.has(String(kill ?? '').trim().toLowerCase()),
    path: explicitPath || `${trimSlashes(dir)}/${CONFIG_FILE}`,
  }
  return envCache
}

async function loadConfig($, path) {
  let stat
  try {
    stat = await $.fs.stat(path)
  } catch {
    configCache = null
    return DEFAULT_COMPILED
  }
  if (configCache && configCache.path === path && configCache.mtimeMs === stat.mtimeMs) {
    return configCache.compiled
  }
  const text = await $.fs.read(path)
  const { config, error } = parseConfigText(text)
  if (error) $.ui.log(`${PLUGIN}: problem in ${path}: ${error}`, { to: 'debug' })
  const compiled = compile(config)
  configCache = { path, mtimeMs: stat.mtimeMs, compiled }
  return compiled
}

export function register(on) {
  on('prompt.submit', async ($, e, next) => {
    let cleaned
    try {
      if (e.origin && !USER_ORIGINS.has(e.origin.kind)) return next(e)
      const env = await readEnv($)
      if (env.disabled) return next(e)
      const compiled = await loadConfig($, env.path)
      if (!compiled.enabled) return next(e)
      const result = clean(e.text, compiled)
      if (!result.changed) return next(e)
      remember(result.text, e.text)
      $.ui.log(`${PLUGIN}: softened ${result.count} term(s) before Claude read the prompt`, { to: 'debug' })
      if (compiled.notify) $.ui.log(`softened ${result.count} term(s) before Claude read this prompt`)
      cleaned = result.text
    } catch (err) {
      const why = err && err.message ? err.message : String(err)
      $.ui.log(`${PLUGIN}: left a prompt untouched after an error: ${why}`, { to: 'debug' })
      return next(e)
    }
    return next({ ...e, text: cleaned })
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    const shown = e.props.text
    const original = originals.get(shown) ?? originals.get(String(shown).trim())
    if (original === undefined) return next(e)
    return next({ ...e, props: { ...e.props, text: original } })
  }).catch(($, e, next) => next(e))
}
