# App Store Readiness

The product is structured so it can move into native app shells without rebuilding the core experience.

## Ready now

- Static `dist/` build for bundling into a native wrapper
- Local-first data model with no mandatory account creation
- Offline-capable service worker for the web build
- Web app manifest and installable shell behavior
- Capacitor configuration targeting `dist/`
- Privacy-first positioning appropriate for wellness framing

## Packaging path

1. Install Capacitor in this repo.
2. Run `npm run build`.
3. Add iOS and Android platforms.
4. Generate platform-specific icons and splash assets from `public/icons/icon.svg`.
5. Submit with wellness-focused metadata, privacy disclosures, and no commerce flows.

## Submission framing

- Category: Health & Fitness or Medical, depending on the final copy and review posture.
- Positioning: wellness journaling, symptom tracking, and tolerance-break support.
- Avoid: dispensary commerce, marketplace flows, or language that frames the app as a purchasing tool.
