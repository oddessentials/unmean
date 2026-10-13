# unmean

A Claude Code plugin that quietly keeps profanity out of what Claude reads.

Type however you like. When a prompt has harsh language in it, Claude reads a
cleaned version, while your transcript still shows exactly what you typed.
Nothing is blocked and nothing nags you to rephrase. From your side the message
went through as written; Claude just never sees the sharp edges.

Made by Odd Essentials, LLC.

## What it does

`unmean` is a [mod](https://code.claude.com/docs/en/plugins/mods/overview): a
small piece of JavaScript that runs inside Claude Code. It adds two hooks.

- **Before Claude reads your prompt**, it removes or masks any flagged words.
  The cleaned text is what Claude reads and what gets stored in the session, so
  the language never reaches the model.
- **When your message is drawn in the transcript**, it puts your original
  wording back on screen. You see what you typed.

So `fix this fucking bug` shows in your transcript as `fix this fucking bug`,
and Claude reads `fix this bug`. A prompt with no flagged words is untouched and
has no effect at all.

Matching is exact: a word is caught only when it is on the list, ignoring
case. Ordinary words that merely contain a bad word are safe (`Scunthorpe`,
`assess`, `classic`, `bass`), and so are numbers, names, and spellings that
aren't on the list, such as `fuuuck`, `sh1t`, or `f***`. Code spans, inline code, file
paths, URLs, and dotted identifiers are never altered, so a variable literally
named `shit` or a path like `src/ass/index.js` is left alone.

## Install

`unmean` is distributed through a Claude Code plugin marketplace hosted on
GitHub. In a terminal Claude Code session:

```text
/plugin install unmean --marketplace oddessentials/unmean
```

Press `y` to add the marketplace when asked, then choose a scope (installing for
your user account enables it in every project). That is the whole setup; the
plugin is active in that session right away and in every session afterward.

If you prefer two steps, or are scripting from your shell:

```text
/plugin marketplace add oddessentials/unmean
/plugin install unmean@odd-essentials
```

```bash
claude plugin marketplace add oddessentials/unmean
claude plugin install unmean@odd-essentials
```

`unmean` needs Claude Code v2.1.287 or later, the first release that runs mods.
Check with `claude --version`.

### Try it without installing

To run it from a clone for one session, without adding a marketplace:

```bash
git clone https://github.com/oddessentials/unmean
claude --plugin-dir ./unmean/plugins/unmean
```

## Configuration

`unmean` ships with a sensible default wordlist and works with no configuration.
To change what it catches or how, create a file at `~/.claude/unmean.json`
(on Windows, `%USERPROFILE%\.claude\unmean.json`). A copy you can start from is
in [`plugins/unmean/unmean.example.json`](plugins/unmean/unmean.example.json).
Every field is optional:

```json
{
  "enabled": true,
  "mode": "remove",
  "maskChar": "*",
  "add": ["heck"],
  "remove": ["damn"],
  "allow": ["cocky"],
  "notify": true,
  "emptyReplacement": "(frustrated sigh)"
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Turn the filter off without uninstalling. |
| `mode` | `"remove"` | `"remove"` drops the word and tidies the sentence; `"mask"` replaces each letter with `maskChar`, keeping the sentence's shape. |
| `maskChar` | `"*"` | The character used in `"mask"` mode. |
| `add` | `[]` | Extra words to catch. Each form is matched exactly, so list every form you want caught (`heck`, `hecking`). This is where you add anything beyond the default list, including slurs you want caught. |
| `remove` | `[]` | Default words to stop catching. |
| `allow` | `[]` | Exact words to never touch, even when a rule would otherwise catch them. |
| `notify` | `true` | Adds a dim line under your message naming the words that were removed, such as `removed before Claude read this prompt: wtf`. Claude does not read it. `false` makes it silent. |
| `emptyReplacement` | `"(frustrated sigh)"` | What Claude reads when a prompt was nothing but profanity. |

The file is read fresh whenever it changes, so edits take effect on your next
prompt. A malformed config never breaks anything: bad JSON or a bad field falls
back to the default, and the reason is written to the debug log
(`claude --debug`).

You can point the plugin at a different config file with the
`UNMEAN_CONFIG` environment variable.

## How to disable

Three ways, from most temporary to most permanent:

- **For one shell or session**, set the `UNMEAN` environment variable to
  `off` (or `0`, `false`, `no`). For example `UNMEAN=off claude`.
- **Everywhere, without uninstalling**, set `"enabled": false` in
  `~/.claude/unmean.json`.
- **Remove it** from the **Installed** tab of `/plugin`, or with
  `claude plugin uninstall unmean@odd-essentials`.

## Known limitations

- **Insults without listed words are not caught.** "You are useless" or "this is
  garbage" carry no flagged word, so they pass through unchanged. `unmean`
  filters language, not sentiment.
- **It is a wordlist, not a judge.** Only exact listed words are caught;
  variant spellings pass through by design. Add a form to `add` if you want it.
- **Only your own typed prompts are filtered.** Tool output, Claude's replies,
  and messages from other sessions or scheduled tasks are left as they are.
- **Code, paths, and URLs are deliberately skipped**, so a flagged word that is
  genuinely part of code or a path is not altered, in either direction.
- **It applies where mods run**: the Claude Code terminal and the desktop app's
  Code tab. It does not touch claude.ai or the Claude API, which are out of
  scope for this version.
- **The on-screen restore lasts for the running session.** The plugin keeps
  your original wording in memory only and never writes it anywhere. After a
  restart, a `/resume`, or a reload of the plugin, earlier messages that get
  redrawn show the cleaned text Claude read. New prompts are unaffected.
- **Typing it still means typing it.** The original text never reaches Claude
  or the saved session, but Claude Code may keep its own record of what you
  typed, such as your prompt history.

## Development

The filtering logic is plain, dependency-free JavaScript with no Claude Code
API in it, so it runs under both Node's test runner and Claude Code's.

```bash
cd plugins/unmean
node --test "tests/**/*.node.test.mjs"   # pure filter and config tests
claude plugin test .                      # the same table, plus the hooks
claude plugin validate .                  # manifest and hooks module
```

The repository is also a plugin marketplace: its
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) lists the
plugin under [`plugins/unmean`](plugins/unmean).

## License

MIT. See [LICENSE](LICENSE).
