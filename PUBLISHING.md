# Publishing to JSR

This package is published to [JSR (JavaScript Registry)](https://jsr.io) under `@smartbill/firestore-convex-style`.

## Prerequisites

1. Install the JSR CLI:
   ```bash
   # npm
   npm install -g @jsr/cli
   
   # pnpm
   pnpm add -g @jsr/cli
   
   # deno (built-in, no installation needed)
   ```

2. Authenticate with JSR:
   ```bash
   # If using JSR CLI
   jsr login
   
   # If using deno
   deno publish --dry-run
   ```

## Publishing Steps

1. **Update version** in both `package.json` and `jsr.json`

2. **Build the package** (optional, for local testing):
   ```bash
   pnpm run build
   ```

3. **Test locally** (recommended):
   ```bash
   pnpm test
   pnpm run test:e2e:run
   ```

4. **Dry run** to check what will be published:
   ```bash
   # Using JSR CLI
   jsr publish --dry-run
   
   # Or using deno
   deno publish --dry-run
   ```

5. **Publish to JSR**:
   ```bash
   # Using JSR CLI
   jsr publish
   
   # Or using deno
   deno publish
   ```

## Publishing Checklist

- [ ] Version updated in `package.json` and `jsr.json`
- [ ] All tests passing (`pnpm test`)
- [ ] E2E tests passing (`pnpm run test:e2e:run`)
- [ ] README updated with latest API changes
- [ ] CHANGELOG updated (if applicable)
- [ ] Dry run successful
- [ ] Published to JSR
- [ ] Verified installation works

## Version Management

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality additions
- **PATCH** version for backward-compatible bug fixes

## Automated Publishing (Optional)

You can set up GitHub Actions to automatically publish on tag push:

```yaml
name: Publish to JSR

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - run: deno publish
```

## Troubleshooting

### "Module not found" errors
- Ensure all imports use relative paths with file extensions in the source files
- Check that the `exports` field in `jsr.json` points to the correct entry file

### Authentication issues
- Make sure you're logged into JSR: `jsr login`
- For Deno, ensure you have the latest version: `deno upgrade`

### Publishing permission denied
- Verify you have access to the `@smartbill` scope on JSR
- Contact the scope owner to add you as a collaborator

