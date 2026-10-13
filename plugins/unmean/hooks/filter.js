// Pure text filtering for unmean.
//
// Nothing in this file touches Claude Code's API, so the same code runs under
// `claude plugin test` and plain `node --test`.

import { DEFAULT_WORDS } from './wordlist.js'

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  mode: 'remove', // 'remove' drops the word, 'mask' replaces each letter with maskChar
  maskChar: '*',
  add: Object.freeze([]),
  remove: Object.freeze([]),
  allow: Object.freeze([]),
  notify: true, // adds a dim transcript line naming the removed words; Claude does not read it
  emptyReplacement: '(frustrated sigh)', // what Claude reads when the whole prompt was profanity
})

// A token is a run of letters, digits and underscores, with apostrophes allowed
// inside ("asshole's"). Digits and underscores keep "A55" and snake_case whole,
// and a token with anything but letters is never flagged.
const TOKEN_SOURCE = String.raw`[A-Za-z0-9_]+(?:'[A-Za-z0-9_]+)*`

// Spans the filter never touches: code, URLs, paths, dotted names.
const PROTECTED = [
  /```[\s\S]*?(?:```|$)/g, // fenced code, an unclosed fence runs to the end
  /`[^`\n]+`/g, // inline code
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, // URLs
  /\S*[\/\\]\S*/g, // anything path-like
  /[A-Za-z0-9_$@]+(?:\.[A-Za-z0-9_$@]+)+/g, // obj.prop, file.ext, host.name
]

// Wrappers that are removed when a removal leaves them empty: ("fuck") → ()
const PAIRS = { '"': '"', "'": "'", '(': ')', '[': ']', '{': '}', '*': '*' }

export function normalizeWord(word) {
  return String(word).toLowerCase().replace(/[^a-z]/g, '')
}

/**
 * Turns a config object into the structure `clean` consumes. Call it once per
 * config change, not per prompt.
 */
export function compile(config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const removed = new Set((cfg.remove ?? []).map(normalizeWord))
  const allow = new Set((cfg.allow ?? []).map(normalizeWord).filter(Boolean))
  const words = new Set(
    [...DEFAULT_WORDS, ...(cfg.add ?? [])].map(normalizeWord).filter(w => w && !removed.has(w) && !allow.has(w)),
  )
  return { ...cfg, words, allow }
}

/**
 * Whether one token (as it appears in the text) is on the list. Exact match
 * only, ignoring case and apostrophes: no spelling variants are inferred.
 */
export function isFlagged(token, compiled) {
  const norm = token.toLowerCase().replace(/'/g, '')
  return compiled.words.has(norm)
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
