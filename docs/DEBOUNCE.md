# Debounce and click health

The native presets are 12, 16, 20, 24, 28 and 32 ms. Readback happens automatically after connection; changing a preset requires an explicit Apply and exact readback. The newly added UI path still needs device-specific confirmation.

The free 0–50 ms input is a local draft only. The standalone C stable-state filter source is not integrated into installed firmware. A custom value is never sent as an invented native command.

## Click calibrator

Record confirmed single clicks, holds and intentional double-click trials. The calibrator sees already processed browser events, not raw electrical switch signals. Confirm the intended action, then keep or discard each trial.

A recommendation needs at least 20 confirmed single/hold trials, five intentional double-click trials and three unwanted transitions. Without observed faults it does not increase debounce. The tentative custom suggestion is the largest false gap rounded up plus 2 ms; it is rejected if above 50 ms or too close to intentional double-click timings. A native preset at or above that draft may also be shown.

Nothing is applied automatically. This is a heuristic, not a hardware-defect diagnosis. The current healthy test mouse cannot establish that a proposed setting fixes a faulty switch.
