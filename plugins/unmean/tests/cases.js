// Shared table for the pure filter tests. Both runners use it:
//   tests/filter.node.test.mjs  (node --test, no Claude Code needed)
//   tests/filter.test.ts        (claude plugin test)
//
// `config` is merged over the defaults; `expected` is what Claude would read.

const same = input => ({ input, expected: input })

export const CASES = [
  { name: 'a clean prompt passes through unchanged', ...same('Please refactor the login handler.') },
  { name: 'words that merely contain a bad word are not flagged', ...same('The classic Scunthorpe assessment passed with a bass guitar in the cockpit.') },
  { name: 'assess is not flagged', ...same('Please assess the risk.') },
  { name: 'a profane word mid-sentence is removed', input: 'Fix this fucking bug now.', expected: 'Fix this bug now.' },
  { name: 'a sentence-initial interjection goes with its comma', input: 'Fuck, it broke again.', expected: 'It broke again.' },
  { name: 'capitalization follows the word that was removed', input: 'fuck, it broke again.', expected: 'it broke again.' },
  { name: 'a sentence-final interjection goes with its comma', input: 'It broke again, damn.', expected: 'It broke again.' },
  { name: 'mixed case', input: 'this is SHIT', expected: 'this is' },
  { name: 'only exact words: stretched, leetspeak and starred spellings pass', ...same('this is shiiiit, sh1t and f***') },
  { name: 'numbers and model names are not words', ...same('455 tests fail on the Galaxy A55') },
  { name: 'markdown emphasis around a removed word goes too', input: 'this is **fucking** broken', expected: 'this is broken' },
  { name: 'hyphenated compounds', input: 'that dumb-ass approach', expected: 'that dumb approach' },
  { name: 'possessives', input: "the asshole's code", expected: 'the code' },
  { name: 'common endings', input: 'he bitched about the shitty tests', expected: 'he about the tests' },
  { name: 'wrappers left empty are removed too', input: '(fuck) that', expected: 'that' },
  { name: 'a question keeps its mark', input: 'What the fuck is this?', expected: 'What the is this?' },
  { name: 'several words in one prompt', input: 'fix this fucking bug, you useless shit', expected: 'fix this bug, you useless' },
  { name: 'paths are left alone', ...same('open src/ass/index.js and fix it') },
  { name: 'inline code is left alone', ...same('the variable `shit` is undefined') },
  { name: 'fenced code is left alone', ...same('see:\n```\nlet shit = 1\n```\nfix it') },
  { name: 'identifiers with underscores or dots are left alone', ...same('rename damn_var and obj.ass') },
  { name: 'URLs are left alone', ...same('see https://example.com/fuck/this') },
  { name: 'markdown emphasis is not read as self-censoring', ...same('this is **bold** and *italic*') },
  { name: 'the default allow list', ...same('the damning evidence') },
  { name: 'newlines survive', input: 'line one damn\nline two', expected: 'line one\nline two' },
  { name: 'a prompt that is nothing but profanity becomes the empty replacement', input: 'FUCK!!!', expected: '(frustrated sigh)' },
  { name: 'insults without profanity pass through (known limitation)', ...same('you are useless') },
  { name: 'an empty prompt stays empty', ...same('') },
  { name: 'non-string input passes through', input: 42, expected: 42 },
  { name: 'custom words can be added', config: { add: ['heck'] }, input: 'what the heck', expected: 'what the' },
  { name: 'default words can be removed', config: { remove: ['damn'] }, ...same('damn it') },
  { name: 'words can be allowed in one exact form', config: { allow: ['shitty'] }, ...same('the shitty tests') },
  { name: 'disabled in the config', config: { enabled: false }, ...same('fuck') },
  { name: 'mask mode keeps the shape of the sentence', config: { mode: 'mask' }, input: 'this is shit, SHIT', expected: 'this is ****, ****' },
  { name: 'the mask character is configurable', config: { mode: 'mask', maskChar: '#' }, input: 'oh crap', expected: 'oh ####' },
  { name: 'the empty replacement is configurable', config: { emptyReplacement: 'hello' }, input: 'damn', expected: 'hello' },
]

// Tokens the matcher must catch.
export const FLAGGED = [
  'FUCK', 'Fucked', 'fuckin', 'bitches', 'shitty', 'crappy', "asshole's", 'WTF',
]

// Spellings the matcher must leave alone.
export const NOT_FLAGGED = [
  'Scunthorpe', 'assess', 'assessed', 'assesses', 'assessment', 'classic', 'bass', 'passes',
  'shiitake', 'cocktail', 'assassin', 'as', 'dickens', 'asset', 'hello', 'damning',
  'snake_case_ass', 'fuuuck', 'sh1t', '@ss', '455', 'A55', 'Shiite', 'pricking',
]
