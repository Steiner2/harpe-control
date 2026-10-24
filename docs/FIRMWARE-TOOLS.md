# Firmware and recovery tools

The normal wired interface is ASUS 0B05:1A92. Bootloader mode is 0B05:1A93. **Bootloader detected** is displayed only after the supported bootloader replies and version 2.00.19 is verified. A stock version string of 8.00.10 alone is not proof of HCEX.

## Firmware availability

This public repository and site do not distribute manufacturer firmware, patched manufacturer images or device backups. Bring your own reviewed application image. The browser requires exact length, a known SHA-256 and the original application checksum. Unknown images are rejected. The source patch builder is developer tooling and never installs firmware by itself.

Macros require HCEX on the mouse. Installing the website or granting WebHID access does not install HCEX. Stock firmware can use the supported native settings; its macro upload path is not supported by this project.

## Physical recovery

The recovery route was tested on one P713: unplug USB, switch OFF, hold Left + Right + Wheel click + DPI, plug USB in, and release after about three seconds. This combination can reset settings. Back up readable settings, macro data and your original application before experimenting. Release all buttons after entry.

Connect the bootloader, select **Dump application**, wait for completion and export the application plus its hash metadata. The application window is 0x1C000–0x4DFFF (204800 bytes). This is not a full-device or configuration backup.

## Checked flashing

The browser flasher has simulated tests but has not been used for the physical flashes in this project. Those were performed with the native test tools. Select an owner-supplied exact reviewed application, confirm physical recovery and your exported backup, and type FLASH. The writer changes only differing 4-KiB application pages, verifies erase/programming and the complete final hash, and writes the vector page last.

Restart is a separate action after full verification and rechecks the image. No write is retried automatically. If communication or verification fails, preserve the evidence and remain in recovery. An unknown application is allowed only the exact allowlisted stock recovery target with explicit stock-recovery selection. Configuration and bootloader flash are outside the browser writer's range.

## Current extension

E3505A86 is the limited locally tested named-macro image. Native installation, name-only persistence, current-RAM identity and full power-off retention passed on one mouse. Wireless macro operation, browser flashing and long-term reliability are not validated. See [Hardware validation](HARDWARE-GUIDE.md).
