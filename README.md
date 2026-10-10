# Shine — gamified training (prototype)

A local-first PWA that turns training into a game: one **window** per area (Strength with body parts, Cycling…),
goals split into **milestones**, a **weekly program** toward the next milestone, logging, charts, XP, weekly
streaks and achievements. Reporting problems ("Something wrong?") adapts the program with fixed rules.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # unit tests
npm run lint       # oxlint + TypeScript
npm run build      # production build in dist/
```

Open the app → **Load demo data** to see 6 weeks of fake training. Clear it with one click; real data is untouched.

## Do I need an API or a backend?

No. Everything runs in the browser and is stored on the device (IndexedDB). There are no accounts and no server.
The only things you'd add a backend for later:

- **Sync between phone and laptop**: for now use Settings → Export / Import JSON.
- **AI coach chat**: the current "Something wrong?" check-in is rule-based. A real chat would need an
  Anthropic API key behind a small serverless function (to keep the key secret), and that costs money per use.

## Free hosting for your iPhone

Any static host works because the build is plain files in `dist/`. Recommended: **GitHub Pages**.

1. Create a GitHub repo and push this project.
2. Build with the repo name as base path: `BASE_PATH=/<repo-name>/ npm run build`
   (on Windows PowerShell: `$env:BASE_PATH='/<repo-name>/'; npm run build`).
3. Publish `dist/` (e.g. with a GitHub Actions "Deploy to Pages" workflow, or the `gh-pages` branch).
4. On the iPhone open the URL in **Safari → Share → Add to Home Screen**. It then opens full-screen and works offline.

Alternatives: Cloudflare Pages or Netlify (connect the repo, build command `npm run build`, output `dist`, no
`BASE_PATH` needed).

**Caveats**
- Data is per device and per browser. Export a backup regularly.
- iOS may delete storage of websites you haven't opened in a while; installing to the Home Screen avoids this.
- The repo (and so the site) can be public on free plans, but your training data never leaves your phone.
