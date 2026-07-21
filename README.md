# Golf Journal

A hole-by-hole golf journal: club selector, tap-to-select tee shot zones,
strokes/putts/penalties, notes, and a full scorecard review.

Data is saved in your browser's `localStorage` — it stays on whichever
device/browser you use it in (not synced across devices unless you add a
backend later).

## Run it locally

Requires Node.js (18+) installed.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Deploy it as a real web app

### Option A: Vercel (easiest)
1. Create a free account at vercel.com
2. Install the CLI: `npm i -g vercel`
3. From this folder, run: `vercel`
4. Follow the prompts — it detects Vite automatically and gives you a live URL.

### Option B: Netlify
1. Run `npm run build` — this creates a `dist/` folder.
2. Go to netlify.com → "Add new site" → "Deploy manually" → drag in the `dist/` folder.
3. You get a live URL instantly.

### Option C: GitHub + auto-deploy
1. Push this folder to a GitHub repo.
2. Import the repo on vercel.com or netlify.com.
3. Every future `git push` auto-redeploys.

## Use it like an app on your phone

Once deployed, open the URL on your phone in Chrome/Safari, then:
- **iOS Safari**: Share button → "Add to Home Screen"
- **Android Chrome**: Menu (⋮) → "Add to Home Screen" / "Install app"

It'll launch full-screen without browser chrome, using the `manifest.json`
already included.

## If you want data synced across devices later

Swap the `localStorage` shim in `src/main.jsx` for a real backend — e.g.
Supabase (free tier, has a JS client and a Postgres database) is the
smallest lift. The rest of the app (`GolfJournal.jsx`) doesn't need to
change since it only talks to `window.storage.get/set/delete`.
