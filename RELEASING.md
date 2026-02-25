# Releasing

This package publishes to npm from git tags using `.github/workflows/release.yml`.

## Versioning policy

- `patch`: bug fixes, internal improvements, non-breaking changes
- `minor`: backward-compatible feature additions
- `major`: breaking behavior/API/config changes

## Dist-tag policy

- Stable tags (`vX.Y.Z`) publish to npm `latest`.
- Prerelease tags (`vX.Y.Z-beta.N`) publish to npm `beta`.

## One-time npm setup

- Configure npm Trusted Publishing for this package/repository pair.
- The release workflow uses GitHub OIDC (`id-token: write`) and publishes with provenance.
- If Trusted Publishing is not configured yet, the publish job will fail at `npm publish`.
- Add repository secret `NPM_TOKEN` (automation token with package write access) as CI publish auth fallback.

## Release commands

Run from a clean `main` branch.

1. Preflight:

```bash
bun run release:verify
```

2. Bump version:

```bash
# stable
bun run release:patch
bun run release:minor
bun run release:major

# beta
bun run release:beta:first
bun run release:beta:next
```

3. Push commit and tag:

```bash
git push origin main --follow-tags
```

The release workflow will publish automatically when it sees the tag.

## Workflow guarantees

- Runs `bun run check`
- Verifies tag matches `package.json` version
- Verifies tagged commit is contained in `origin/main`
- Verifies publish contents with `npm pack --dry-run`
- Skips npm publish on reruns when that exact version already exists
- Publishes with provenance (`npm publish --provenance`)
- Creates a GitHub Release automatically from the tag:
  - stable tags are marked as latest
  - prerelease tags are marked as prerelease

## Rollback and mitigation

If a bad version is published:

1. Publish a fix quickly as a new patch version.
2. Adjust dist-tags if needed:

```bash
npm dist-tag add opencode-ast-grep@<good-version> latest
```

3. Deprecate bad version with guidance:

```bash
npm deprecate opencode-ast-grep@<bad-version> "Broken release, use <good-version>"
```

Prefer deprecate + republish over unpublish.
