import { clean, compile, DEFAULT_CONFIG } from './filter.js'
import { parseConfigText } from './config.js'

const PLUGIN = 'unmean'
const CONFIG_FILE = 'unmean.json'
const OFF_VALUES = new Set(['0', 'off', 'false', 'no'])
const USER_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'slack-ping', 'unclassified'])

const DEFAULT_COMPILED = compile(DEFAULT_CONFIG)
let envCache = null
let configCache = null

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
  let text
  try {
    text = await $.fs.read(path)
  } catch (err) {
    $.ui.log(`${PLUGIN}: could not read ${path}, using defaults: ${err && err.message ? err.message : err}`, { to: 'debug' })
    configCache = null
    return DEFAULT_COMPILED
  }
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
      $.ui.log(`${PLUGIN}: removed ${result.count} word(s) before Claude read the prompt`, { to: 'debug' })
      if (compiled.notify) $.ui.log(`removed ${result.count} ${result.count === 1 ? 'word' : 'words'}`)
      cleaned = result.text
    } catch (err) {
      const why = err && err.message ? err.message : String(err)
      $.ui.log(`${PLUGIN}: left a prompt untouched after an error: ${why}`, { to: 'debug' })
      return next(e)
    }
    return next({ ...e, text: cleaned })
  }).catch(($, e, next) => next(e))
}
