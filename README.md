# Savor — College SaaS project

A responsive, one-page landing website built with Next.js, TypeScript, and Tailwind CSS. Savor is a temporary product name. This Week 1 concept introduces planned recipe importing, cookbook organization, meal planning, and grocery lists. All app illustrations are static; there are no accounts, payments, databases, or AI services.

## Preview on your computer

1. Install the **LTS version of Node.js** from https://nodejs.org if you don't already have it. Close and reopen your terminal after installing.
2. Open this project folder in your terminal. In VS Code, open the folder and select **Terminal → New Terminal**.
3. Run `npm install` to download the packages the website needs (only required the first time, or when dependencies change).
4. Run `npm run dev` to start the local preview.
5. Open http://localhost:3000 in your browser. If the terminal shows a different port, use that address instead.

Leave the terminal running while previewing. Saving changes updates the page automatically. Press **Control + C** in the terminal to stop the server.

## Checks

- `npm run typecheck` checks TypeScript.
- `npm run build` creates the production build.
- `npm start` previews the production build after building it.

## Deploy to Vercel

Push this folder to a GitHub repository, import that repository in Vercel, and use the detected Next.js defaults. No environment variables or API keys are required.

## Files to edit

- `app/page.tsx`: page text, sections, and interface illustrations.
- `app/globals.css`: responsive styles, colors, and spacing; Tailwind CSS is also available in components.
- `app/layout.tsx`: browser title and description.

Food photography is loaded from Unsplash and requires an internet connection. The website uses system fonts and locally bundled icons. The navigation and calls to action link to sections on this page; no signup or functional app is implied.
