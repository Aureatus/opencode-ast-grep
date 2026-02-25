# opencode-ast-grep

OpenCode plugin that provides AST-aware search and replace tools backed by ast-grep.

This project extracts and packages the ast-grep plugin logic from `hive/.opencode/plugin/ast-grep` into a standalone, reusable OpenCode plugin.

Implementation note: this package was largely bootstrapped from the Oh My OpenCode ast-grep tool implementation, then adapted into a standalone npm plugin with release automation and local/npm test modes.

## What it does

- Exposes two custom tools:
  - `ast_grep_search`
  - `ast_grep_replace`
- Supports 25 languages through ast-grep CLI
- Auto-discovers an installed `sg` binary, and can auto-download one if missing
- Returns concise, agent-friendly output with truncation handling and error details

## Installation

Add the plugin package to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-ast-grep"]
}
```

## Tool: `ast_grep_search`

Arguments:

- `pattern` (required): ast-grep pattern (`$VAR`, `$$$` supported)
- `lang` (required): one of the supported languages
- `paths` (optional): paths to search (defaults to `.`)
- `globs` (optional): include/exclude globs (`!` prefix excludes)
- `context` (optional): context lines around each match

Example:

```text
pattern: "console.log($MSG)"
lang: "typescript"
globs: ["src/**/*.ts", "!**/*.test.ts"]
```

## Tool: `ast_grep_replace`

Arguments:

- `pattern` (required): ast-grep match pattern
- `rewrite` (required): replacement pattern (can use matched meta-variables)
- `lang` (required): target language
- `paths` (optional): paths to search
- `globs` (optional): include/exclude globs
- `dryRun` (optional): defaults to `true`; set `false` to apply edits

Example:

```text
pattern: "console.log($MSG)"
rewrite: "logger.info($MSG)"
lang: "typescript"
dryRun: false
```

## Binary behavior

- Preferred order:
  1. Cached binary under `~/.cache/opencode/plugins/ast-grep/bin/`
  2. `@ast-grep/cli` package binary
  3. Platform-specific `@ast-grep/cli-*` package binary
  4. Homebrew `sg` on macOS
  5. Auto-download from ast-grep GitHub releases

## Releasing

- Run `bun run release:verify`.
- Bump version with `bun run release:patch|minor|major` or beta helpers.
- Push tags with `git push origin main --follow-tags`.
- Full release runbook: `RELEASING.md`.

## Local development

```bash
bun install
bun run check
bun run build
```

For local OpenCode testing in this repo:

- `.opencode/plugins/ast-grep-plugin.ts` imports `src/index.ts` directly for fast iteration (no build required)
- `.opencode/package.json` installs plugin runtime dependencies for OpenCode

Local source mode (uses checked-out `src/` code):

```bash
bun run opencode:local
bun run opencode:local:config
```

To run OpenCode with the npm-installed package (without the local shim), use:

```bash
bun run opencode:npm
```

Quick verification:

```bash
bun run opencode:npm:config
```

Expected plugin list includes `opencode-ast-grep` and does not include `.opencode/plugins/ast-grep-plugin.ts`.

If your global OpenCode config already includes a local ast-grep shim path, remove it first when validating npm-only mode.
