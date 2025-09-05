## Use CopilotKit local clone in another project (no publish required)

This guide shows several ways to consume your local CopilotKit fork in another project without publishing to npm. It also includes cleanup steps to revert back to registry packages.

### Recommended approach: link packages for live development

Best for active development and fast iteration. Your app will use symlinks to your local CopilotKit packages.

1) Build CopilotKit once (and whenever code changes):

```bash
cd /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit
pnpm install
pnpm -r build
```

2) Register the packages you need as global links:

```bash
cd /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-core && pnpm link --global
cd /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-textarea && pnpm link --global
cd /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-ui && pnpm link --global
cd /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/runtime && pnpm link --global
```

3) In your consuming app, link them:

```bash
cd /path/to/your/app
pnpm link --global @copilotkit/react-core @copilotkit/react-textarea @copilotkit/react-ui @copilotkit/runtime
pnpm install
```

Optional (Next.js): add transpilation for linked packages if needed in `next.config.(mjs|js)`:

```js
export default {
  transpilePackages: [
    '@copilotkit/react-core',
    '@copilotkit/react-textarea',
    '@copilotkit/react-ui',
    '@copilotkit/runtime',
  ],
};
```

Notes
- Rebuild CopilotKit (`pnpm -r build`) after changes so `dist` is updated (or use a watch script if available).
- Ensure a single version of `react` and `react-dom` is installed in the app to satisfy peer deps.
- If you see a pnpm warning about peerDependencies not resolving with global links, see the troubleshooting section below.

### Alternative: link by absolute path (simple, local-only)

From your app:

```bash
pnpm link /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-core
pnpm link /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-textarea
pnpm link /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-ui
pnpm link /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/runtime
pnpm install
```

### Alternative: `file:` dependencies (no global links)

In your app's `package.json`:

```json
{
  "dependencies": {
    "@copilotkit/react-core": "file:/Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-core",
    "@copilotkit/react-textarea": "file:/Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-textarea",
    "@copilotkit/react-ui": "file:/Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-ui",
    "@copilotkit/runtime": "file:/Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/runtime"
  }
}
```

Then install:

```bash
pnpm install
```

Notes
- Still build CopilotKit before installing. Changes might require reinstalling to reflect.

### Optional: pack to a tarball (simulate publish)

Use only if you want to test an install as if from npm. Not live; you must repack after changes.

```bash
cd /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-core
pnpm pack --pack-destination /tmp
pnpm add /tmp/@copilotkit-react-core-*.tgz
```

Repeat for any other packages you need.

### Troubleshooting: pnpm peerDependencies warning when linking

When running `pnpm link --global` you may see a warning like:

> The linked in dependency will not resolve the peer dependencies from the target node_modules. This might cause issues in your project. To resolve this, you may use the "file:" protocol to reference the local dependency.

What it means
- `@copilotkit/*` packages declare `react` and `react-dom` as peerDependencies. With global links, peers may not resolve from your app’s `node_modules`, leading to multiple React copies or unmet peers (e.g., “Invalid hook call”).
- A separate “has no binaries” warning is harmless and can be ignored.

Recommended fixes
- Prefer `file:` protocol or direct path links, which resolve peers from your app:

```bash
pnpm add @copilotkit/react-core@file:/Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-core
```

- If you keep global links, ensure your app has the required peers installed and only a single React is present:

```bash
pnpm add react@^18 react-dom@^18
pnpm why react
pnpm list react
```

- For Next.js or similar bundlers, transpile linked packages if needed (see the config example above).

---

## Cleanup and unlink (switch back to npm registry)

When you're ready to deploy or just want to point your app back to published npm versions:

### If you used global links

In your app (remove symlinks):

```bash
cd /path/to/your/app
pnpm unlink @copilotkit/react-core @copilotkit/react-textarea @copilotkit/react-ui @copilotkit/runtime
```

Then install the desired versions from the registry (adjust versions as needed):

```bash
pnpm add @copilotkit/react-core @copilotkit/react-textarea @copilotkit/react-ui @copilotkit/runtime
```

Optionally, remove global link registrations:

```bash
pnpm unlink --global @copilotkit/react-core @copilotkit/react-textarea @copilotkit/react-ui @copilotkit/runtime
```

### If you linked by path

In your app, unlink and reinstall:

```bash
cd /path/to/your/app
pnpm unlink /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-core
pnpm unlink /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-textarea
pnpm unlink /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/react-ui
pnpm unlink /Users/luisfx/code/luisfx/copilotkit-fork/CopilotKit/packages/runtime
pnpm add @copilotkit/react-core @copilotkit/react-textarea @copilotkit/react-ui @copilotkit/runtime
```

### If you used `file:` dependencies

1) Edit your app's `package.json` to replace `file:` entries with published versions.
2) Reinstall:

```bash
pnpm install
```

### Optional hygiene

If things look out of sync, do a clean install:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

You can also dedupe to resolve multiple copies if peers changed:

```bash
pnpm dedupe
```

---

## Tips and gotchas

- Ensure your app has a single `react`/`react-dom` version compatible with CopilotKit peer deps.
- For frameworks like Next.js, you may need `transpilePackages` for linked packages.
- Always build CopilotKit packages so consumers use compiled output (e.g., `dist`).
- If you switch approaches (link ⇄ file ⇄ pack), reinstall to refresh the dependency graph.


