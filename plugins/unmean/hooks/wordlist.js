// Default wordlist for unmean.
//
// Base forms only, lowercase letters only. The matcher also catches common
// endings (s, es, ed, ing, in, er, ers, y, ies, ier, iest), mixed case,
// repeated letters ("shiiit"), simple leetspeak ("sh1t", "@ss", "a$$") and
// self-censoring with asterisks ("f***", "sh*t").
//
// The default list is profanity and common vulgar insults. It deliberately
// stops there: add anything else you want caught, including slurs, through
// the "add" list in ~/.claude/unmean.json (see README).

export const DEFAULT_WORDS = [
  // f-words
  'fuck', 'fucker', 'fucking', 'fuckin', 'fucked', 'fucks',
  'motherfucker', 'motherfucking', 'motherfuckin',
  'fuckface', 'fuckhead', 'fuckwit', 'fuckup', 'clusterfuck',
  'fuk', 'fukin', 'fuking', 'fcuk', 'phuck',
  // s-words
  'shit', 'shite', 'shitty', 'shithead', 'shitshow', 'shitbag',
  'bullshit', 'horseshit', 'dipshit', 'apeshit', 'batshit', 'dumbshit',
  'shyt',
  // a-words
  'ass', 'asshole', 'arse', 'arsehole', 'dumbass', 'jackass', 'asswipe', 'asshat', 'smartass',
  'azz',
  // other profanity and insults
  'bitch', 'biatch', 'bastard', 'cunt', 'dick', 'dickhead', 'dickwad', 'prick',
  'piss', 'damn', 'dammit', 'damnit', 'goddamn', 'goddammit', 'goddamned',
  'crap', 'twat', 'wanker', 'bollocks', 'tosser', 'slut', 'whore',
  'douche', 'douchebag', 'scumbag',
  // acronyms
  'wtf', 'stfu', 'omfg', 'lmfao', 'ffs', 'mofo',
]

// Forms the suffix rules would otherwise catch but that are ordinary words.
export const DEFAULT_ALLOW = ['assess', 'assesses', 'assessed', 'assessing', 'assessment', 'assessments', 'reassess', 'damning', 'dicky', 'dickey', 'dickens', 'dicker', 'dickers']
