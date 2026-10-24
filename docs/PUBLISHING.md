# Publish with GitHub Pages

This is the curated public repository. Do not upload the private Tech directory, diagnostic archives, manufacturer applications or device configuration backups.

## Initial publication

1. Create a new public GitHub repository named harpe-control.
2. Push this repository to its main branch.
3. Open repository Settings → Pages. Select GitHub Actions as the source.
4. Run the Pages workflow, or push an update to main.
5. Wait for the deploy job and verify the returned HTTPS Pages address.

No custom domain, account, backend, service worker or repository secret is needed. The workflow deploys only generated dist files. It runs tests before publishing. HTTPS provides a secure context for WebHID, but users must still click Connect and grant access. A new domain has separate browser permissions and local draft storage; export/import JSON to migrate drafts.

## Local checks

```sh
npm test
npm run build
npm run check
```

The public firmware tests generate synthetic data with a test-only allowlist loaded in an isolated module. The production exact-image allowlist is unchanged. The only committed binary test fixture is a synthetic named macro record, not manufacturer firmware or a device backup.
