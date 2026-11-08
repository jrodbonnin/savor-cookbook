# Savor — College SaaS project

Savor is built with Next.js, TypeScript, and Tailwind CSS. Week 2 adds real email/password accounts through the existing Neon Auth instance, persistent sessions, and a protected cookbook dashboard. Recipe imports, meal planning, grocery lists, and payments are not implemented yet.

## Preview on your computer

1. Install the **LTS version of Node.js** from https://nodejs.org if you don't already have it. Close and reopen your terminal after installing.
2. Open this project folder in your terminal. In VS Code, open the folder and select **Terminal → New Terminal**.
3. Run `npm install --global pnpm@11.22.0` once to install our package manager. This only installs the pnpm tool; it does not install the website dependencies.
4. Run `pnpm install --frozen-lockfile` to download the packages the website needs (only required the first time, or when dependencies change).
5. Run `pnpm dev` to start the local preview.
6. Open http://localhost:3000 in your browser. If the terminal shows a different port, use that address instead.

Leave the terminal running while previewing. Saving changes updates the page automatically. Press **Control + C** in the terminal to stop the server.

## Why pnpm?

Use **pnpm 11.22.0** for this project. The committed `pnpm-lock.yaml` records the tested dependency versions. Do not run `npm install` inside this project or create a second lockfile. Mixing npm with the pnpm-created `node_modules` caused npm to crash while processing linked dependencies. `package.json` now declares the package manager, and modern npm will stop early if used accidentally.

The Vite warnings from that failed npm attempt came from dependency development tools. Savor uses Next.js, and Vite is not required. Keep `pnpm-lock.yaml` in Git so another computer and Vercel can install the same versions.

## Checks

- `pnpm typecheck` checks TypeScript.
- `pnpm build` creates the production build.
- `pnpm start` previews the production build after building it.

## Deploy to Vercel

Push this folder to a GitHub repository, import that repository in Vercel, and use the detected Next.js defaults. No environment variables or API keys are required.

## Files to edit

- `app/page.tsx`: page text, sections, and interface illustrations.
- `app/globals.css`: responsive styles, colors, and spacing; Tailwind CSS is also available in components.
- `app/layout.tsx`: browser title and description.

Food photography is loaded from Unsplash and requires an internet connection. The website uses system fonts and locally bundled icons. The navigation and calls to action link to sections on this page; no signup or functional app is implied.


## Week 2: test your account

Open **http://localhost:3000/signup**. Use your name, an email address you own, and a new password of at least 8 characters. Confirm the password and select **Create my account**. The dashboard will greet you by name. If Neon requests email verification, follow the email instructions or enter the emailed code.

Refresh the dashboard and revisit it in the same browser to check that your session persists. Use **Log out**, confirm, then log back in at **/login**. Visiting **/dashboard** while signed out redirects to login. Sessions eventually expire; your account remains in Neon so you can log back in.

Use `localhost`, rather than `127.0.0.1`: Neon automatically trusts localhost for local authentication. Keep the terminal running; if localhost refuses to connect, run `pnpm dev` from this folder again.

### Private configuration

The existing Vercel project is linked locally. `.env.local` contains the pulled Development settings and a locally generated `NEON_AUTH_COOKIE_SECRET`. This file and `.vercel/` are ignored by Git. Never paste their contents into chat, screenshots, or GitHub. Database credentials stay on the server; the browser talks to `/api/auth`.

The required auth settings are `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` (a cryptographically random value of at least 32 characters). The local cookie secret must stay stable between restarts to preserve sessions. Pulling Vercel variables again may overwrite it. Production uses a separate signing secret configured privately in Vercel. Never copy it into source files.

Neon manages accounts and password hashing. No new database, custom password table, or schema migration was created. The SDK is pinned to a compatible beta release. `pnpm-workspace.yaml` aligns its bundled Better Auth dependencies; it does not change the homepage styling.

### Verification

Live API checks exercised signup, persistent HttpOnly cookies, protected dashboard access, logout, and incorrect-password rejection. The standalone `scripts/check-auth.mjs` also checks login-again and session revocation when run. It requires `AUTH_TEST_CREATE_USER=yes` and creates a real randomly named test user in the connected Neon instance; run it only with explicit approval. It does not delete any users. They are named **Savor integration check**, with addresses matching `savor-check-...@example.com`. No shared demo credentials are included.


## Deployment workflow

1. Make and test changes locally with `pnpm dev`.
2. Run `pnpm typecheck` and `pnpm build`, and manually test the affected features.
3. Review `git diff` and confirm `.env.local`, `.vercel/`, and credentials are excluded.
4. Wait for José’s approval to push that release.
5. Commit the tested files and push to `main` in `jrodbonnin/savor-cookbook`.
6. Check Vercel’s deployment status and confirm its source commit matches the pushed commit.
7. Test the public login and dashboard. Existing account credentials work when Development and Production point to the same Neon Auth branch; browser sessions are separate for localhost and the public domain.

`vercel.json` explicitly uses pnpm for installs and builds. Add the public Vercel domain to Neon Auth’s trusted domains if sign-up or login returns `INVALID_ORIGIN` (Neon Console → Auth → Configuration → Domains). Localhost is automatically allowed. An environment change applies to the next deployment.

Stop and resolve failures before pushing. No automatic approval for future releases is implied.

## Class demo account and future Premium access

The class demo account exists in the existing Neon Auth database. It signs in at `/login` using the credentials supplied privately by the project owner. The account was created through normal Neon Auth signup, and its row in `neon_auth.user` was checked using a read-only query. Its password is not stored in this repository. Sign-in was tested through the production login form without email verification; no global verification settings or existing users were changed. The email ownership flag was not falsified.

`SAVOR_DEMO_USER_ID` identifies this account by its immutable Neon user ID. It is configured in ignored `.env.local` and in the existing Vercel Development and Production environments. It must never have a `NEXT_PUBLIC_` prefix. The Vercel setting applies to the next deployment; the newly added access code remains local until an approved push.

`lib/access/server.ts` is the server-only entry point for entitlements. It revalidates the current session, then grants the configured demo user `plan: premium`, `source: demo`, and `hasPremiumAccess: true`. Anonymous visitors, other user IDs, and missing configuration default to free. Email addresses, names, profile fields, request parameters, and client-submitted roles are not used for authorization. A client can see its entitlement at `/api/account/access`; that response is private and not cached. It cannot change the entitlement.

Future Premium server actions and API routes must call `requirePremiumAccess()` before accessing Premium data or services. Client-side badges or hidden buttons are never sufficient enforcement. The server function accepts no caller-supplied identity. Run `pnpm test:access` to check the identity policy.

When Stripe is implemented, add server-side subscription records linked to the same immutable Neon user ID. Populate them through signature-verified, idempotent Stripe webhooks and handle renewals, cancellations, and payment failures according to the product's policy. Extend `getCurrentEntitlements()` to grant subscription access to regular paying users while retaining the explicit demo grant. Never let Stripe webhook processing overwrite the demo grant, and never create a fake checkout, payment, customer, or subscription for this account. The current code makes no Stripe calls and does not pretend a payment occurred.

The demo grant means full application Premium access, not administrator rights or access to other users' private data. Existing data ownership and authorization checks must still apply. No Premium product features exist yet; the entitlement is the foundation for protecting them when added.
