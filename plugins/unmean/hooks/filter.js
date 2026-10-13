import { DEFAULT_WORDS } from './wordlist.js'

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  mode: 'remove',
  maskChar: '*',
  add: Object.freeze([]),
  remove: Object.freeze([]),
  allow: Object.freeze([]),
  notify: true,
  emptyReplacement: '(frustrated sigh)',
})

const TOKEN_SOURCE = String.raw`[A-Za-z0-9_]+(?:'[A-Za-z0-9_]+)*`

const FENCE = '```'
const CHUNKS = /\S+/g
const NAME_CHAR = /[A-Za-z0-9_$@]/

const PAIRS = { '"': '"', "'": "'", '(': ')', '[': ']', '{': '}', '*': '*' }

export function normalizeWord(word) {
  return String(word).toLowerCase().replace(/[^a-z]/g, '')
}

export function compile(config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const removed = new Set((cfg.remove ?? []).map(normalizeWord))
  const allow = new Set((cfg.allow ?? []).map(normalizeWord).filter(Boolean))
  const words = new Set(
    [...DEFAULT_WORDS, ...(cfg.add ?? [])].map(normalizeWord).filter(w => w && !removed.has(w) && !allow.has(w)),
  )
  return { ...cfg, words, allow }
}

export function isFlagged(token, compiled) {
  const norm = token.toLowerCase().replace(/'/g, '')
  return compiled.words.has(norm)
}

function markFences(text, mask) {
  let open = text.indexOf(FENCE)
  while (open !== -1) {
    const close = text.indexOf(FENCE, open + FENCE.length)
    if (close === -1) {
      mask.fill(1, open)
      return
    }
    mask.fill(1, open, close + FENCE.length)
    open = text.indexOf(FENCE, close + FENCE.length)
  }
}

function markInlineCode(text, mask) {
  let open = text.indexOf('`')
  while (open !== -1) {
    let end = open + 1
    while (end < text.length && text[end] !== '`' && text[end] !== '\n') end += 1
    if (end > open + 1 && text[end] === '`') {
      mask.fill(1, open, end + 1)
      open = text.indexOf('`', end + 1)
    } else {
      open = text.indexOf('`', open + 1)
    }
  }
}

function markDottedNames(text, mask, start, end) {
  let i = start
  while (i < end) {
    if (!NAME_CHAR.test(text[i])) {
      i += 1
      continue
    }
    const from = i
    let dots = 0
    while (i < end && NAME_CHAR.test(text[i])) i += 1
    while (i + 1 < end && text[i] === '.' && NAME_CHAR.test(text[i + 1])) {
      dots += 1
      i += 1
      while (i < end && NAME_CHAR.test(text[i])) i += 1
    }
    if (dots > 0) mask.fill(1, from, i)
  }
}

function markChunks(text, mask) {
  CHUNKS.lastIndex = 0
  let m
  while ((m = CHUNKS.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (m[0].includes('/') || m[0].includes('\\')) mask.fill(1, start, end)
    else markDottedNames(text, mask, start, end)
  }
}

function protectedMask(text) {
  const mask = new Uint8Array(text.length)
  markFences(text, mask)
  markInlineCode(text, mask)
  markChunks(text, mask)
  return mask
}

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

function removeSpan(text, s, e) {
  let a = s
  let b = e
  const token = text.slice(s, e)

  if (a > 1 && text[a - 1] === '-' && /\S/.test(text[a - 2])) a -= 1
  else if (b + 1 < text.length && text[b] === '-' && /\S/.test(text[b + 1])) b += 1

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
    b += punctAfter[0].length
  } else if (/,[ \t]*$/.test(pre) && /^[ \t]*(?:[.!?]|\n|$)/.test(post)) {
    a -= pre.length - pre.replace(/[ \t]*,[ \t]*$/, '').length
  } else if (/^[ \t]/.test(post) && (/[ \t]$/.test(pre) || atSentenceStart)) {
    b += 1
  } else if (/[ \t]$/.test(pre)) {
    a -= 1
  }

  let tail = text.slice(b)
  if (capitalize && /^[a-z]/.test(tail)) tail = tail[0].toUpperCase() + tail.slice(1)
  return text.slice(0, a) + tail
}

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
