# Toll Logger

Two-phone toll detour audit logger. Open the app: https://avinashpkf-arch.github.io/toll-logger/

- `index.html` – the phone app (live camera, plate reader, Google Sheet sync, Excel export)
- `Code.gs` – Google Apps Script to paste into the Google Sheet
- `SETUP.txt` – one-time setup steps

No vehicle data is stored here; it lives on the phones and in your private Google Sheet.

## Plate reader
- `models/plate_finder.onnx` – YOLOv9-t licence plate detector from [open-image-models](https://github.com/ankandrew/open-image-models) (MIT)
- `models/plate_reader.onnx` – `cct-xs-v2-global-model` from [fast-plate-ocr](https://github.com/ankandrew/fast-plate-ocr) (MIT)
- Both run on the phone with [onnxruntime-web](https://onnxruntime.ai/). Reading runs in a background worker; each tap reads 3 frames × 3 crops × (colour + black/white) and decodes with the Indian plate pattern.
