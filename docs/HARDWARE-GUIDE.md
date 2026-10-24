# Hardware validation status

## Locally observed

- Direct physical bootloader recovery and return to normal operation.
- Exact native application backup, page verification and full SHA-256 verification during native installation.
- Earlier short F24 tests for once/repeat/toggle/hold with human button input.
- Persistence of the previous macro firmware across direct USB use on a second computer without the browser.
- E350 named firmware: name-only save, actual RAM readback and name/sequence retention after a full OFF/USB power cycle. Normal pointer and clicks confirmed. Five native profile mirrors retained.

## Open issues and limits

A later browser-created macro was reported as uploaded successfully while RAM was incomplete. The previous persistent record remained intact. Apply now performs device readback at RAM, Flash and activation stages, with detailed failure phases. Automated regression tests and browser-byte replay against the compiled ARM code pass. The revised complete browser workflow still needs a successful physical check.

No general release-level reliability is established. Browser flashing, wireless macros, a new second-computer test of named firmware, healthy-versus-faulty custom debounce and long-term use remain unvalidated. Native LED, Single DPI and debounce UI paths have automated tests but are not all independently physically verified. One shared macro slot is supported; no profiles were removed.

Automated tests do not replace hardware checks. This repository uses synthetic data for browser flasher tests and includes no real firmware/configuration fixture. The private development project additionally ran ARM emulation against an owner-supplied stock application; those external artifacts are not public.
