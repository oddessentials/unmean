import { DEFAULT_CONFIG, normalizeWord } from './filter.js'

const MODES = new Set(['remove', 'mask'])

export function parseConfigText(text) {
  let raw
  try {
    raw = JSON.parse(String(text).replace(/^﻿/, ''))
  } catch (err) {
    return { config: { ...DEFAULT_CONFIG }, error: `invalid JSON (${err.message})` }
  }
  return validateConfig(raw)
}

export function validateConfig(raw) {
  const config = { ...DEFAULT_CONFIG }
  const problems = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { config, error: 'the config must be a JSON object' }
  }
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case 'enabled':
      case 'notify':
        if (typeof value === 'boolean') config[key] = value
        else problems.push(`${key} must be true or false`)
        break
      case 'mode':
        if (MODES.has(value)) config.mode = value
        else problems.push('mode must be "remove" or "mask"')
        break
      case 'maskChar':
        if (typeof value === 'string' && value.length > 0 && value.length <= 4) config.maskChar = value
        else problems.push('maskChar must be a short, non-empty string')
        break
      case 'emptyReplacement':
        if (typeof value === 'string') config.emptyReplacement = value
        else problems.push('emptyReplacement must be a string')
        break
      case 'add':
      case 'remove':
      case 'allow':
        if (Array.isArray(value)) {
          config[key] = value.filter(v => typeof v === 'string').map(normalizeWord).filter(Boolean)
        } else problems.push(`${key} must be a list of words`)
        break
      case '$schema':
      case '//':
        break
      default:
        problems.push(`unknown option "${key}"`)
    }
  }
  return { config, error: problems.length > 0 ? problems.join('; ') : undefined }
}
