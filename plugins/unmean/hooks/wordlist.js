// Claude's module loader requires relative imports, including installed packages.
import { cuss } from '../node_modules/cuss/index.js'

export const DEFAULT_WORDS = [
  'fuck', 'fucks', 'fucked', 'fucking', 'fuckin', 'fucker', 'fuckers',
  'motherfucker', 'motherfuckers', 'motherfucking', 'motherfuckin',
  'fuckface', 'fuckhead', 'fuckheads', 'fuckwit', 'fuckwits', 'fuckup', 'fuckups', 'clusterfuck',
  'fuk', 'fukin', 'fuking', 'fcuk', 'phuck',
  'shit', 'shits', 'shitting', 'shitted', 'shitty', 'shitter', 'shite',
  'shithead', 'shitheads', 'shitshow', 'shitbag',
  'bullshit', 'bullshitting', 'horseshit', 'dipshit', 'apeshit', 'batshit', 'dumbshit',
  'shyt',
  'ass', 'asses', 'asshole', 'assholes', 'arse', 'arses', 'arsehole', 'arseholes',
  'dumbass', 'dumbasses', 'jackass', 'jackasses', 'asswipe', 'asshat', 'asshats', 'smartass',
  'azz',
  'bitch', 'bitches', 'bitched', 'bitching', 'bitchy', 'biatch',
  'bastard', 'bastards', 'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'dickheads', 'dickwad',
  'prick', 'pricks',
  'piss', 'pissed', 'pisses', 'pissing',
  'damn', 'damned', 'dammit', 'damnit', 'goddamn', 'goddammit', 'goddamned',
  'crap', 'crappy', 'crapped', 'twat', 'twats', 'wanker', 'wankers', 'bollocks',
  'tosser', 'tossers', 'slut', 'sluts', 'whore', 'whores',
  'douche', 'douchebag', 'douchebags', 'scumbag', 'scumbags',
  'wtf', 'stfu', 'omfg', 'lmfao', 'ffs', 'mofo',
  ...Object.entries(cuss)
    .filter(([word, rating]) => rating === 2 && /^[a-z]+(?: [a-z]+)*$/.test(word))
    .map(([word]) => word),
]
