<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Savor deployment workflow

- Use pnpm 11.25.0 and the committed lockfile.
- Test changes locally, including the relevant user flow, TypeScript, and a production build.
- Push to the existing GitHub main branch only after the user approves the tested feature. Approval for one release does not authorize future pushes.
- Use the existing jrodbonnin/savor-cookbook repository and linked Vercel project; do not create replacements.
- Keep all .env files, credentials, and .vercel settings out of Git and chat.
- Do not delete existing database users.
