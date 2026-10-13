// Pure text filtering for unmean.
//
// Nothing in this file touches Claude Code's API, so the same code runs under
// `claude plugin test` and plain `node --test`.

import { DEFAULT_WORDS, DEFAULT_ALLOW } from './wordlist.js'

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  mode: 'remove', // 'remove' drops the word, 'mask' replaces each letter with maskChar
  maskChar: '*',
  add: Object.freeze([]),
  remove: Object.freeze([]),
  allow: Object.freeze([]),
  notify: false, // true adds a dim transcript line whenever something was softened
  emptyReplacement: '(frustrated sigh)', // what Claude reads when the whole prompt was profanity
})

// Endings accepted after a listed word: "fucks", "shitty", "bitches", "pissed".
const SUFFIXES = ['', 's', 'es', 'ed', 'ing', 'in', 'er', 'ers', 'y', 'ies', 'ier', 'iest']

// Leetspeak and symbol substitutions, applied before matching.
const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '5': 's', '$': 's', '7': 't' }

// A token is a run of word-ish characters. Apostrophes and exclamation marks
// may appear inside a token ("fuckin'", "sh!t") but not at its edges, so
// "idiot!" tokenizes as "idiot". Underscores join, so snake_case stays whole.
const TOKEN_SOURCE = String.raw`[A-Za-z0-9@$_][A-Za-z0-9@$_*]*(?:['!][A-Za-z0-9@$_*]+)*`

// Spans the filter never touches: code, URLs, paths, dotted names.
const PROTECTED = [
  /```[\s\S]*?(?:```|$)/g, // fenced code, an unclosed fence runs to the end
  /`[^`\n]+`/g, // inline code
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, // URLs
  /\S*[\/\\]\S*/g, // anything path-like
  /[A-Za-z0-9_$@]+(?:\.[A-Za-z0-9_$@]+)+/g, // obj.prop, file.ext, host.name
]

// Wrappers that are removed when a removal leaves them empty: ("fuck") → ()
const PAIRS = { '"': '"', "'": "'", '(': ')', '[': ']', '{': '}' }

export function normalizeWord(word) {
  return String(word).toLowerCase().replace(/[^a-z]/g, '')
}

function toRuns(s) {
  const runs = []
  for (const ch of s) {
    const last = runs[runs.length - 1]
    if (last && last[0] === ch) last[1] += 1
    else runs.push([ch, 1])
  }
  return runs
}

const squeeze = runs => runs.map(r => r[0]).join('')

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Turns a config object into the structure `clean` consumes. Call it once per
 * config change, not per prompt.
 */
export function compile(config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const removed = new Set((cfg.remove ?? []).map(normalizeWord))
  const allow = new Set([...DEFAULT_ALLOW, ...(cfg.allow ?? [])].map(normalizeWord).filter(Boolean))
  const words = new Set(
    [...DEFAULT_WORDS, ...(cfg.add ?? [])].map(normalizeWord).filter(w => w && !removed.has(w)),
  )
  // Every word+suffix target, keyed by its letters with repeats collapsed, so a
  // token's lookup is one Map read. Each target keeps its run lengths so that
  // "as" never matches "ass" while "asssss" does.
  const targets = new Map()
  for (const word of words) {
    for (const suffix of SUFFIXES) {
      const full = word + suffix
      if (allow.has(full)) continue
      const runs = toRuns(full)
      const key = squeeze(runs)
      const list = targets.get(key)
      if (list) list.push(runs)
      else targets.set(key, [runs])
    }
  }
  return { ...cfg, words, allow, targets }
}

function normalizeToken(token) {
  let out = ''
  for (const ch of token.toLowerCase()) {
    if (ch === "'") continue
    out += LEET[ch] ?? ch
  }
  return out
}

function matchesWildcard(norm, compiled) {
  // "f***", "sh*t", "a**hole": each star run stands for one or more letters.
  if (norm.length < 3 || !/[a-z]/.test(norm)) return false
  const parts = norm.split(/\*+/)
  if (parts.some(p => /[^a-z]/.test(p))) return false
  const re = new RegExp('^' + parts.map(escapeRegExp).join('[a-z]+') + '$')
  for (const word of compiled.words) if (re.test(word)) return true
  return false
}

/** Whether one token (as it appears in the text) is on the list. */
export function isFlagged(token, compiled) {
  if (token.includes('_')) return false
  const norm = normalizeToken(token)
  if (compiled.allow.has(norm)) return false
  if (norm.includes('*')) return matchesWildcard(norm, compiled)
  if (/[^a-z]/.test(norm)) return false
  const runs = toRuns(norm)
  const candidates = compiled.targets.get(squeeze(runs))
  if (!candidates) return false
  return candidates.some(target => target.every((r, i) => runs[i][1] >= r[1]))
}

function protectedMask(text) {
  const mask = new Uint8Array(text.length)
  for (const re of PROTECTED) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1
        continue
      }
      mask.fill(1, m.index, m.index + m[0].length)
    }
  }
  return mask
}

/** Every flagged token in `text` as { start, end, token }, in order. */
export function findMatches(text, compiled) {
  const mask = protectedMask(text)
  const matches = []
  const tokens = new RegExp(TOKEN_SOURCE, 'g')
  let m
  while ((m = tokens.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    let isProtected = false
    for (let i = start; i < end; i += 1) {
      if (mask[i]) {
        isProtected = true
        break
      }
    }
    if (isProtected) continue
    if (isFlagged(m[0], compiled)) matches.push({ start, end, token: m[0] })
  }
  return matches
}

// Removes text[s, e) and tidies the join so the sentence still reads.
function removeSpan(text, s, e) {
  let a = s
  let b = e
  const token = text.slice(s, e)

  // "**fuck**": the token swallowed the closing stars, take the opening ones too.
  const stars = token.match(/\*+$/)
  if (stars && text.slice(a - stars[0].length, a) === stars[0]) a -= stars[0].length

  // Hyphenated compounds: "dumb-ass" → "dumb", "fucking-great" → "great".
  if (a > 1 && text[a - 1] === '-' && /\S/.test(text[a - 2])) a -= 1
  else if (b + 1 < text.length && text[b] === '-' && /\S/.test(text[b + 1])) b += 1

  // Wrappers left empty: ("fuck") and "fuck" in quotes go too.
  while (a > 0 && b < text.length && PAIRS[text[a - 1]] === text[b]) {
    a -= 1
    b += 1
  }

  const pre = text.slice(0, a)
  const post = text.slice(b)
  const lineStart = pre.slice(pre.lastIndexOf('\n') + 1)
  const atSentenceStart = /^[ \t"'(\[{]*$/.test(lineStart) || /[.!?]["')\]]*[ \t]+$/.test(pre)
  const punctAfter = post.match(/^[ \t]*[,;:!.?]+[ \t]*/)
  const capitalize = atSentenceStart && /^[A-Z]/.test(token)

  if (atSentenceStart && punctAfter) {
    // "Fuck, it broke" → "It broke"; "Damn!" → ""
    b += punctAfter[0].length
  } else if (/,[ \t]*$/.test(pre) && /^[ \t]*(?:[.!?]|\n|$)/.test(post)) {
    // "it broke, damn." → "it broke."
    a -= pre.length - pre.replace(/[ \t]*,[ \t]*$/, '').length
  } else if (/^[ \t]/.test(post) && (/[ \t]$/.test(pre) || atSentenceStart)) {
    // "the fucking build" → "the build"
    b += 1
  } else if (/[ \t]$/.test(pre)) {
    // "the build is fucked." → "the build is."
    a -= 1
  }

  let tail = text.slice(b)
  if (capitalize && /^[a-z]/.test(tail)) tail = tail[0].toUpperCase() + tail.slice(1)
  return text.slice(0, a) + tail
}

/**
 * Cleans `text`. Returns { text, changed, count, matches }; `text` is the
 * input itself when nothing was flagged, the filter is disabled, or the input
 * is not a string.
 */
export function clean(text, compiled = compile()) {
  const untouched = { text, changed: false, count: 0, matches: [] }
  if (typeof text !== 'string' || !compiled.enabled) return untouched
  const matches = findMatches(text, compiled)
  if (matches.length === 0) return untouched

  let out = text
  if (compiled.mode === 'mask') {
    const ch = Array.from(String(compiled.maskChar || '*'))[0] ?? '*'
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const { start, end } = matches[i]
      out = out.slice(0, start) + ch.repeat(end - start) + out.slice(end)
    }
  } else {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      out = removeSpan(out, matches[i].start, matches[i].end)
    }
    out = out.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '')
    if (out === '') out = String(compiled.emptyReplacement ?? '')
  }
  return { text: out, changed: out !== text, count: matches.length, matches }
}
