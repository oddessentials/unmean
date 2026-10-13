// Default wordlist for unmean.
//
// Lowercase letters only. Matching is exact (ignoring case and apostrophes),
// so every form to catch is listed: "fucks", "bitches" and "pissed" are
// entries of their own, and spellings like "fuuuck" or "sh1t" pass through.
//
// The default list is profanity and common vulgar insults. It deliberately
// stops there: add anything else you want caught, including slurs, through
// the "add" list in ~/.claude/unmean.json (see README).

export const DEFAULT_WORDS = [
  // f-words
  'fuck', 'fucks', 'fucked', 'fucking', 'fuckin', 'fucker', 'fuckers',
  'motherfucker', 'motherfuckers', 'motherfucking', 'motherfuckin',
  'fuckface', 'fuckhead', 'fuckheads', 'fuckwit', 'fuckwits', 'fuckup', 'fuckups', 'clusterfuck',
  'fuk', 'fukin', 'fuking', 'fcuk', 'phuck',
  // s-words
  'shit', 'shits', 'shitting', 'shitted', 'shitty', 'shitter', 'shite',
  'shithead', 'shitheads', 'shitshow', 'shitbag',
  'bullshit', 'bullshitting', 'horseshit', 'dipshit', 'apeshit', 'batshit', 'dumbshit',
  'shyt',
  // a-words
  'ass', 'asses', 'asshole', 'assholes', 'arse', 'arses', 'arsehole', 'arseholes',
  'dumbass', 'dumbasses', 'jackass', 'jackasses', 'asswipe', 'asshat', 'asshats', 'smartass',
  'azz',
  // other profanity and insults
  'bitch', 'bitches', 'bitched', 'bitching', 'bitchy', 'biatch',
  'bastard', 'bastards', 'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'dickheads', 'dickwad',
  'prick', 'pricks',
  'piss', 'pissed', 'pisses', 'pissing',
  'damn', 'damned', 'dammit', 'damnit', 'goddamn', 'goddammit', 'goddamned',
  'crap', 'crappy', 'crapped', 'twat', 'twats', 'wanker', 'wankers', 'bollocks',
  'tosser', 'tossers', 'slut', 'sluts', 'whore', 'whores',
  'douche', 'douchebag', 'douchebags', 'scumbag', 'scumbags',
  // acronyms
  'wtf', 'stfu', 'omfg', 'lmfao', 'ffs', 'mofo',
]
