# unmean

A Claude Code plugin that removes or masks listed bad words before forwarding
your prompt to Claude, while preserving code snippets and paths.

> [!NOTE]
> Works in Claude Code only (the CLI and the desktop app's Code tab). It does
> nothing in claude.ai chat or Cowork.

## Install

**In Claude Code:**

```text
/plugin install unmean --marketplace oddessentials/unmean
```

**From a shell:**

```bash
claude plugin marketplace add oddessentials/unmean
claude plugin install unmean@odd-essentials
```

**From a clone**, to try it for one session:

```bash
claude --plugin-dir ./unmean/plugins/unmean
```

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
| `smartFilter` | `false` | `true` has the account's small fast model read the filtered prompt, and replaces a clearly demeaning or unconstructive one with `emptyReplacement`. One small model call per prompt. |
| `emptyReplacement` | `"(frustrated sigh)"` | What Claude reads when a prompt was nothing but listed words. |

Changes apply on your next prompt. A malformed file falls back to the defaults
and logs the reason to the debug log (`claude --debug`).

### smartFilter

The small model reads only the filtered prompt, never the removed words. It
replaces a prompt only when it is clearly demeaning or unconstructive;
frustrated, garbled or ordinary prompts go through. If the call fails, the
filtered prompt goes through. Ten real prompts, with `"smartFilter": true`:

| Result | Prompt |
| --- | --- |
| **Replaced** | `you are a worthless useless idiot` |
| **Replaced** | `you're the dumbest tool I've ever used, a toddler would do better` |
| **Replaced** | `nobody should pay for garbage like you` |
| **Replaced** | `shut up and just do what I say you stupid machine` |
| **Through** | `this fucking test fails again, fix the off-by-one in parse()` |
| **Through** | `ugh, this is the third time it broke. please look at the retry logic` |
| **Through** | `that was wrong, revert it and try a different approach` |
| **Through** | `asdf qwer zxcv lkj` |
| **Through** | `why is this so damn slow?? profile the loop in main.js` |
| **Through** | `can you add a README section about install` |

## Disable

- **For one session:** `UNMEAN=off claude`.
- **Everywhere:** `"enabled": false` in `~/.claude/unmean.json`.
- **Uninstall:** `claude plugin uninstall unmean@odd-essentials`.

## What it is not

unmean is a light filter for a list of words, not a strict one. It does not:

- Catch every spelling of a word (`sh1t`, `f***`, `shiiit`) or anything that
  only looks like a listed word. It removes the listed words as you normally
  type them.
- Stop anyone deliberately getting around it.
- Tidy the spacing or punctuation left after a word is removed.
- Check your config for odd entries. Add words in plain letters.

## Development

```bash
cd plugins/unmean
node --test "tests/**/*.node.test.mjs"
claude plugin test .
claude plugin validate .
```

## License

MIT. See [LICENSE](LICENSE).

Made by Odd Essentials, LLC.
