# unmean

A Claude Code chaperone to filter out unconstructive and demeaning prompts
without interrupting your workflow. It removes or masks listed bad words before
forwarding your prompt to Claude, while preserving code snippets and paths.

```text
/plugin install unmean --marketplace oddessentials/unmean
```

Works in Claude Code only. A `prompt.submit` hook reads each prompt you send,
removes or masks listed words, and passes the result to Claude. It reads the
environment variables `HOME`, `USERPROFILE` and `CLAUDE_CONFIG_DIR` to find its
config file, and `UNMEAN` and `UNMEAN_CONFIG` for its own settings, and sends
none of them anywhere. Nothing else is sent unless you turn on `smartFilter`,
which has the Haiku model read the already filtered prompt.

Configure it in `~/.claude/unmean.json`; see `unmean.example.json` and the
[full README](https://github.com/oddessentials/unmean#readme).
