# Savor — College SaaS project

Savor is built with Next.js, TypeScript, and Tailwind CSS. Savor includes real Neon Auth accounts, persistent sessions, and a protected cookbook dashboard. Text-to-recipe importing uses the OpenAI Responses API, with editable drafts and permanent private recipe storage in the existing Neon database. Video-link importing, meal planning, grocery lists, and payments are not implemented yet.

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


## Text-to-recipe importing (first AI feature)

### Try it locally

1. Run `pnpm dev` in this folder and keep the terminal open.
2. Open **http://localhost:3000/dashboard** and log in.
3. Paste a caption, transcript, or recipe description (40–6,000 characters). A video URL alone is not supported.
4. Select **Organize with AI**. This sends the source text to OpenAI and makes a real paid API request.
5. Review the title, ingredients, quantities, steps, cooking time, and notes. **AI inferred** labels identify estimates or added details; inferred flags can be corrected during review. Missing amounts remain **Quantity not stated**. Labels are not a guarantee of factual accuracy.
6. Edit anything that needs correction, then select **Save to my cookbook**.
7. Refresh the page and open the recipe's card. Saved recipes and their original text are stored in Neon for that account. **Edit recipe** lets you update it without another AI call.

The first end-to-end check retained a tomato-pasta test recipe in the demo cookbook and one separate **Savor recipe isolation check** auth identity. The browser check also saved an editable pasta example in the project owner's cookbook. No existing users were deleted or modified.

### Private setup and migrations

The `OPENAI_API_KEY` was downloaded from the existing Vercel Development connection and appended privately to `.env.local`; existing database, session-signing, and demo ID values were preserved. The key is used only by `lib/recipes/extract.ts` on the server. Do not use a `NEXT_PUBLIC_` variable or place API keys in source code.

If a future Vercel secret cannot be downloaded, open `.env.local` in your editor and add an `OPENAI_API_KEY` entry with the value copied directly from your OpenAI dashboard. Paste it only into that ignored file, save, and restart `pnpm dev`. Never paste it into chat or commit it. Do not replace the rest of the file.

Run `pnpm db:migrate` before deploying the feature to a database that has not been prepared. It runs `migrations/001_recipes.sql` against the existing `DATABASE_URL`, creating the `savor` schema and three tables with indexes. It is non-destructive and repeatable; it does not create a database or touch Neon Auth tables. The migration has already been applied to the currently connected database. Build does not run migrations automatically. Node 26 is used for local verification and by the existing Vercel project.

Keep `DATABASE_URL` and `OPENAI_API_KEY` configured in Vercel for each deployment environment. Existing Neon Auth settings and the immutable demo ID remain required. This feature has not been pushed or deployed by the assistant.

### Usage and cost protections

- A verified Neon session is required for every recipe endpoint. Save/import requests also require the same browser origin and bounded JSON bodies.
- The model is pinned to `gpt-4.1-mini-2025-04-14` using `POST /v1/responses`, strict JSON-schema output, no tools, `store: false`, a 45-second timeout, and at most 3,500 output tokens. Source text is limited to 6,000 characters. No automatic provider retries are performed.
- Each account has **5 attempts per UTC day**, with **30 seconds** between attempts. All accounts share **30 attempts per UTC day**. These are atomically reserved in Neon, so server restarts and concurrent Vercel instances do not reset the budget. Shared demo credentials share one per-account limit. Premium access does not disable cost controls.
- Failures and conservative budget reservations count toward attempts. User counters can be reserved even when the global limit prevents a call; no API call is then made. Credits and OpenAI project limits still apply independently.
- Import request IDs provide retry protection. Repeating the same ID/text returns its cached successful draft without another paid call. A pending request does not trigger another call. Generating again after changing the source or starting a new attempt can incur another charge.
- Draft outputs, input hashes, and request status are stored to support this protection. Original source text is stored with a recipe only when the user saves. A retention/cleanup policy for old import records can be added later; no automatic data deletion is enabled.
- API failures return safe, actionable errors without exposing provider payloads, cookies, source text, database connection strings, or API keys in logs. API responses are private and not cached.

### Ownership and Premium behavior

`lib/recipes/repository.ts` is server-only. All reads and writes are parameterized and include the owner ID from a freshly validated Neon session. An update with another user's recipe ID returns 404 and cannot change that row. The API's strict schemas reject client-supplied owner IDs. The application schema revokes PUBLIC privileges; database credentials are never sent to the browser. Ownership is enforced by the server's scoped queries, not by client-side filtering or a claim that the database-owner connection provides per-user row-level security.

For this first version, text imports are available to authenticated accounts under the same cost limits. Existing Premium entitlements are preserved. Stripe billing and feature-tier restrictions will be implemented separately with the existing server-side access checks.

### Checks

- `pnpm test:recipes`: input, recipe-schema, and conservative provenance tests using Node's TypeScript support (Node 22.6+; verified on Node 26).
- `pnpm test:access`: existing demo entitlement regression tests.
- `pnpm typecheck` and `pnpm build`: TypeScript and production checks.
- `scripts/check-recipes.mjs`: opt-in live integration check requiring `RUN_RECIPE_CHECKS=yes`, `SAVOR_TEST_EMAIL`, and `SAVOR_TEST_PASSWORD` in the process environment. It makes one real AI call, saves a real test recipe, and creates one separate isolation test identity. It tests origin/input rejection, cached retries, cooldown, saved/reopened edits, and denied cross-account reads/lists/updates. Run only with explicit approval; no passwords are embedded in the script and no users are deleted.

Do not push until the owner has tested and approved this feature. After deployment, test the public importer, database ownership, and limits again against that environment before sharing it with classmates.
