# Harpe Control

Browser-based control for the **ROG Harpe Ace Aim Lab Edition (P713)**. English interface with a German language toggle. No companion service, account or backend is required. Mouse access starts only after you select Connect and grant browser permission.

## Features

- DPI stages and Single DPI, polling, button assignments and wheel lighting.
- Native debounce presets and a click calibrator. Custom debounce remains a local draft, not an installed filter.
- HCEX firmware detection, one persistent named macro slot, once/repeat/toggle/hold modes.
- Actual RAM and saved-slot readback, plus explicit Normal / Macro assignment.
- Bootloader detection, application-only dump and exact-image-gated recovery tools.

Use a desktop Chromium browser with WebHID support over HTTPS or localhost. Device settings and macros are processed in your browser; this application has no telemetry or upload endpoint. Local drafts use browser storage. Browser HID permissions are specific to the website origin.

## Current experimental status

The E350 named-macro firmware was installed on one test mouse through the native tools. Name persistence, current-RAM identity, cold-start retention and normal pointer/clicks passed local checks. There is one shared macro slot, not a multi-slot macro library on the device.

A browser upload was reported as successful while device RAM was incomplete. Apply has since been revised to verify native queue completion, RAM, Flash and activation before success. Automated checks pass; the revised end-to-end browser path still awaits confirmation on the physical mouse. Browser flashing, wireless macro operation, custom debounce and long-term reliability are not validated. Stock firmware cannot run HCEX macros; the macro editor stays locked unless HCEX is detected.

## Run and build

Node.js 22 or newer is sufficient; there are no npm dependencies.

```sh
npm test
npm run build
npm run check
```

The self-contained site is generated in `dist/`. Serve that directory on localhost or publish it over HTTPS. Do not serve the parent private development directory.

## GitHub Pages

Push this repository to GitHub, then select **Settings → Pages → Source: GitHub Actions**. The included Pages workflow tests the source, builds the static site and publishes only `dist/` on pushes to main. Pull requests run checks without publishing. See [the publishing guide](docs/PUBLISHING.md).

## Firmware source and redistribution

The original HCEX source is included under `harpe-control/firmware-extension/`. A portable patch builder accepts an owner-supplied exact stock application dump; it does not obtain or flash firmware. No manufacturer firmware binaries or private device backups are shipped. See [firmware source instructions](harpe-control/firmware-extension/README.md).

## Guides

- [Usage](docs/USAGE.md)
- [Firmware and recovery](docs/FIRMWARE-TOOLS.md)
- [Debounce](docs/DEBOUNCE.md)
- [Hardware validation](docs/HARDWARE-GUIDE.md)
- [Sources and license](docs/SOURCES.md)

GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE). This independent project is not affiliated with ASUS.
