# OpenWorkout

A mobile-first, private workout tracker that runs entirely in the browser. Workouts, routines, measurements, custom exercises, and progress photos stay on the current device and can be exported as JSON or CSV.

## Run locally

    npm install
    npm run dev

Create a production build with:

    npm run build

The deployable static site is written to the dist directory.

## Cloudflare Pages

- Framework preset: **Vite**
- Build command: npm run build
- Build output directory: dist
- Root directory: repository root

After the first deployment, add the chosen satyam.lol subdomain in **Workers & Pages → Custom domains**. The included public/_headers file adds privacy/security headers and correct cache behavior for the service worker and fingerprinted assets.

## GitHub Pages

The Vite build uses relative asset paths, so it works on both a custom subdomain and a repository subpath. Publish dist with the GitHub Pages workflow or deployment action of your choice. The app uses in-page state instead of URL routes, so no SPA rewrite rule is required.

## Local-first behavior

- No accounts, API server, analytics, or runtime third-party requests
- Automatic local persistence and active-workout recovery
- JSON backup/restore, including routines and private progress data
- Flat CSV workout export for Excel, Numbers, or Google Sheets
- Installable PWA shell with offline asset caching

Browser storage belongs to the current browser profile and domain. Export a backup before clearing site data, changing domains, or moving to a new phone.
