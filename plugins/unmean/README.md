# unmean

A Claude Code chaperone to filter out unconstructive and demeaning prompts
without interrupting your workflow. It removes or masks listed bad words before
forwarding your prompt to Claude, while preserving code snippets and paths.

Works in Claude Code only. Everything runs locally in a hook. Nothing is sent
anywhere unless you turn on `smartFilter`, which has your account's small fast
model read the already filtered prompt.

Configure it in `~/.claude/unmean.json`; see `unmean.example.json` and the
[full README](https://github.com/oddessentials/unmean#readme).
