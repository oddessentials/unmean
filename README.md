# unmean

A Claude Code plugin that removes profanity from your prompts before Claude
reads them. Nothing is blocked, nothing nags you to rephrase, and Claude never
knows anything was removed.

Made by Odd Essentials, LLC.

## What it does

`unmean` is a [mod](https://code.claude.com/docs/en/plugins/mods/overview) with
one hook. Before Claude reads your prompt, it removes every word on its list.
The cleaned text is what Claude reads, what the session stores, and what your
transcript shows. A dim line that Claude does not read tells you how many words
went:

```text
> fix this bug
  ● unmean: removed 1 word
```

Matching is exact, ignoring case: a word is removed only if it is on the list.
Words that merely contain a listed word (`Scunthorpe`, `assess`), numbers, and
unlisted spellings pass through. Code spans, fenced code, paths, URLs, and
dotted identifiers are never altered.

## Install

```text
/plugin install unmean --marketplace oddessentials/unmean
```

Or from a shell:

```bash
claude plugin marketplace add oddessentials/unmean
claude plugin install unmean@odd-essentials
```

To try it for one session from a clone:
`claude --plugin-dir ./unmean/plugins/unmean`.

## Configuration

No configuration is needed. To change the defaults, create
`~/.claude/unmean.json` (or point `UNMEAN_CONFIG` at another file). Every field
is optional; see [`unmean.example.json`](plugins/unmean/unmean.example.json).

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | `false` turns the filter off. |
| `mode` | `"remove"` | `"mask"` replaces each letter with `maskChar` instead of removing the word. Claude sees the mask. |
| `maskChar` | `"*"` | The character used in `"mask"` mode. |
| `add` | `[]` | Extra words to remove. List every form you want caught (`heck`, `hecking`). |
| `remove` | `[]` | Default words to stop removing. |
| `allow` | `[]` | Words to never remove, even if they are on the list or in `add`. |
| `notify` | `true` | Shows the `removed N words` line. It never names the words. `false` makes removal silent. |
| `emptyReplacement` | `"(frustrated sigh)"` | What Claude reads when a prompt was nothing but listed words. |

Changes apply on your next prompt. A malformed file falls back to the defaults
and logs the reason to the debug log (`claude --debug`).

## Disable

- For one session: `UNMEAN=off claude`.
- Everywhere: `"enabled": false` in `~/.claude/unmean.json`.
- Uninstall: `claude plugin uninstall unmean@odd-essentials`.

## Limitations

- It filters words, not sentiment. "You are useless" passes through.
- Only prompts you type are filtered, not tool output, Claude's replies, or
  messages from other sessions and scheduled tasks.
- It runs where mods run: the Claude Code terminal and the desktop app's Code
  tab.
- Claude Code may keep its own record of what you typed, such as your prompt
  history.

## Development

```bash
cd plugins/unmean
node --test "tests/**/*.node.test.mjs"   # filter and config tests
claude plugin test .                      # the same, plus the hooks
claude plugin validate .                  # manifest and hooks module
```

## License

MIT. See [LICENSE](LICENSE).
