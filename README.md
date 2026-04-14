# Moss Journal

Privacy-first cannabis wellness journal and tolerance-break tracker.

Live temporary deployment: https://tacavar.com/moss/

The project includes a static `dist/` build, offline support, a web app manifest, and Capacitor configuration so it can move into App Store and Play Store packaging.

A build-only macOS GitHub Actions workflow now compiles the iOS Capacitor shell in CI.

## What ships in this MVP

- Local-first session logging with product, strain, dose, method, timestamp, and notes
- Effect scoring for sleep, pain, anxiety, mood, and focus
- Personal insights generated from local data
- T-break mode with streak progress, symptom logging, and re-entry guidance
- Encrypted backup export and import using AES-GCM through Web Crypto
- Doctor-friendly CSV export

## Run locally

```bash
npm test
npm run check
npm run build
npm start
```

Then open `http://localhost:4173`.

## Deployment shape

This is a static app. It can be deployed as:

- a standalone domain
- a subdomain like `moss.tacavar.com`
- a subpath mounted under `tacavar.com`

## Mobile packaging path

- Build web assets with `npm run build`
- Use `capacitor.config.json` with `dist/` as the web bundle
- Add iOS and Android platforms in Capacitor
- Generate store icons and splash assets from `public/icons/icon.svg`
- Submit as a privacy-first wellness tracker with no commerce flow
