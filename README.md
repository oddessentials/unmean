# unmean

A Claude Code plugin that removes or masks listed bad words before forwarding
your prompt to Claude, while preserving code snippets and paths.

Made by Odd Essentials, LLC.

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

Optional. Create `~/.claude/unmean.json`, or point `UNMEAN_CONFIG` at another
file. Every field is optional; see
[`unmean.example.json`](plugins/unmean/unmean.example.json).

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | `false` turns the filter off. |
| `mode` | `"remove"` | `"mask"` masks each word with `maskChar` instead of removing it. |
| `maskChar` | `"*"` | The character used in `"mask"` mode. |
| `add` | `[]` | Extra words to remove, in plain letters. List every form you want caught (`heck`, `hecking`). Other characters are dropped, so `a$$` would remove every `a`. |
| `remove` | `[]` | Default words to stop removing. |
| `allow` | `[]` | Words never removed, even if listed or in `add`. |
| `notify` | `true` | Shows a transcript line with the number of words removed. `false` removes silently. |
| `emptyReplacement` | `"(frustrated sigh)"` | What Claude reads when a prompt was nothing but listed words. |

Changes apply on your next prompt. A malformed file falls back to the defaults
and logs the reason to the debug log (`claude --debug`).

## Disable

- For one session: `UNMEAN=off claude`.
- Everywhere: `"enabled": false` in `~/.claude/unmean.json`.
- Uninstall: `claude plugin uninstall unmean@odd-essentials`.

## Development

```bash
cd plugins/unmean
node --test "tests/**/*.node.test.mjs"
claude plugin test .
claude plugin validate .
```

## License

MIT. See [LICENSE](LICENSE).
