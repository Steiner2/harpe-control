# Sources and license

Harpe Control and its HCEX extension source use GPL-3.0-or-later. Retain LICENSE, NOTICE and SPDX notices. The optional compiled E350 download includes manufacturer code, which is not relicensed by the project GPL. See the firmware notice shipped beside that image.

## Protocol references

- [G-Helper AsusMouse.cs](https://github.com/seerge/g-helper/blob/main/app/Peripherals/Mouse/AsusMouse.cs)
- [G-Helper HarpeAceAimLab.cs](https://github.com/seerge/g-helper/blob/main/app/Peripherals/Mouse/Models/HarpeAceAimLab.cs)
- [G-Helper license](https://github.com/seerge/g-helper/blob/main/LICENSE)

The protocol adaptation used a local main-branch snapshot retrieved on 21 October 2026 without a pinned upstream commit. G-Helper attribution belongs to seerge and its contributors. The Harpe illustration is an original SVG for this interface. OpenMouse was visual inspiration; no OpenMouse code or image assets are included.

Stock Harpe firmware rejects the generic legacy ASUS sequence-upload path studied during development. The legacy encoder remains available only for local simulation/export; the hardware uploader is disabled. HCEX uses its own namespace and checked capabilities.

The native model exposes four DPI slots, without a confirmed stage-count change command. The native debounce enum is 2–7, corresponding to 12–32 ms. WebHID report IDs are separate from command payloads: wired report0, Omni report3. HCEX execution and flash tools are limited to the verified wired interfaces.

## Hosting references

- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [WebHID browser permission and HTTPS requirements](https://developer.mozilla.org/en-US/docs/Web/API/HID/requestDevice)
