# iOS CI Workflow

The repository now includes a build-only GitHub Actions workflow at `.github/workflows/ios-build.yml`.

## What it does

- runs on `macos-latest`
- installs Node dependencies with `npm ci`
- runs `npm test`
- runs `npm run check`
- builds the static web bundle
- syncs Capacitor iOS assets
- runs CocoaPods install in `ios/App`
- compiles the iOS app for the simulator with signing disabled
- uploads derived data as a workflow artifact

## What it does not do yet

- code sign for device or App Store
- archive an `.ipa`
- upload to TestFlight

## Future release automation

Once Apple credentials are available, extend this workflow or add a second one that:

- configures App Store Connect API key secrets
- sets signing / provisioning
- archives the app
- exports an `.ipa`
- uploads to TestFlight
