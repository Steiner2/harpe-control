# HCEX named-macro extension source

The C source is the project's extension, not a full replacement vendor firmware. It is linked into an exact owner-supplied P713 8.00.10 application. The reviewed E350 compiled application is separately available under firmware/ with its own notice; configuration backups are never distributed.

The named-macro variant has one shared 128-event slot, once/repeat/toggle/hold execution, persistent V2/V3 records, a 64-byte NAM1 name trailer and bounded current-RAM readback. It preserves the five native profiles. USB only. Custom debounce-filter source is separate and is NOT linked into this build.

## Build locally

Python 3, pyelftools, capstone and Zig 0.14.1 are required. `ziglang==0.14.1` can provide Zig as a Python package. No tool is downloaded by the builder.

```sh
python -m pip install pyelftools==0.32 capstone==5.0.7 ziglang==0.14.1
python harpe-control/firmware-extension/build.py --original /path/to/your/owned/application.bin
```

The input must be exactly204800 bytes with stock SHA-256 ADA09D08C91FDEED6F4758E78955143884B0FCA1CEEADAC120847852A4075C41. It must be an application-only image; whole-device dumps are rejected. Output is written under the ignored build-named-macros directory. Code is constrained to0x40000–0x42FFF; fixed call patches and the bootstrap literal are verified against the original; the original checksum is recalculated. The builder never opens a device or flashes it.

The locally reviewed E350 image has SHA E3505A86C5ECD168C0EEA3C2FDF9DD25D8B8CE5CE95DDA7CFEDEBEC555E68930. A different compiler/toolchain can yield a different output; that does not authorize adding an unknown hash to the browser allowlist. Inspect changes and preserve a physical recovery route before a separately authorized hardware trial. Other generated images remain ignored by Git; only the exact reviewed E350 artifact is published separately.

Browser tests run without vendor binaries. The synthetic NAM1 fixture was generated from the extension's serialization logic and contains only a test macro. The private hardware/ARM test environment is not published as a supposed portable test suite because it requires owner-specific external firmware artifacts.
