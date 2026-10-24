# Using Harpe Control

Open the hosted page in a desktop Chromium browser with WebHID, then select **Connect mouse** and choose the wired Harpe vendor interface. Firefox and Safari are not supported by this WebHID application. GitHub Pages provides HTTPS; mouse access still requires your explicit browser permission.

## On connection

DPI, slot colors, polling, native bindings, firmware, wheel lighting, debounce and HCEX capabilities are read automatically. When supported, the saved macro and actual RAM sequence are read too. Connection reads do not save settings, upload a macro or send a Run command. A demo is available without a mouse.

## Mouse settings

Select a button on the illustration or in the numbered button list. Primary clicks are selectable for orientation but cannot be remapped here. Native remapping is available for the side buttons and wheel click. Choose a value and explicitly Apply or Save; settings are read back.

Single DPI writes the same sensitivity to all four native slots and preserves their colors. It does not change the number of hardware slots. This replaces the four previous sensitivities.

Wheel lighting has explicit effect, brightness and supported color controls. Native debounce offers 12/16/20/24/28/32 ms. Free debounce values are drafts only.

## Create and apply a macro

HCEX firmware must be detected before the editor is enabled. Select Back or Forward, open the macro editor, give the macro a name and add paired key presses, text or pauses. The text composer uses a German keyboard layout; unsupported characters need manual key recording. Names on named firmware allow 1–48 UTF-8 bytes.

Choose Once, Repeat, Toggle or Hold. Enable **Keep after power-off** to save the sequence and name to the mouse. Select **Apply to mouse**. The browser disables previous activation, prepares and verifies the native side-button mapping, waits for storage to become idle, uploads the sequence/name, verifies actual RAM, optionally saves and rereads Flash, and only then enables and checks the side button. It sends no Run command. Normal Back/Forward is replaced by the macro while enabled.

An explicit success on named firmware means the device readbacks match the editor. A previous upload problem motivated this stronger verification; the revised full browser path still needs physical confirmation. If a phase fails, keep its exact message or export diagnostics. A failed upload can leave RAM unconfigured while the previous saved macro is still present. No automatic retry runs.

## Button assignment and saved macros

**Macro <name>** shows the current RAM identity and activation when it can be read. The **Select saved macro** dropdown lists real device storage, not local drafts. There is currently ONE shared slot. Select its entry and use **Assign selected macro** to activate that saved sequence. Applying another persistent macro replaces the slot.

**Use normal button** keeps the stored sequence, saves disabled-at-boot and restores the native side action. **Disable macro** only stops/disables the current session. **Read saved macro** explicitly opens the stored sequence in the editor and preserves a previous nonempty editor draft in the local library.

Names are on the device with named firmware and travel with the mouse. Older firmware cannot store names or verify actual RAM identity; that limitation is shown explicitly. The local draft library remains specific to this website origin and browser. To move drafts between the local HTML file and the hosted site, export/import JSON.

## Backups and privacy

Settings export is not a full device backup and does not include device macros. Export macro JSON separately. An application dump excludes configuration, calibration and pairing pages. Diagnostics remain local until you choose to share their exported file; inspect them before posting because they can contain macro traffic. The site has no application data upload endpoint.
