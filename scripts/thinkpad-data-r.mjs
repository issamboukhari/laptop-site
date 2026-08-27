// R-series dataset (legacy budget ThinkPads).
import { base, V } from "./thinkpad-data-common.mjs";

export const R_SERIES = [
  { id: "lenovo-thinkpad-r400", name: "ThinkPad R400", year: 2009, base: base({ wifi: "Wi-Fi 4 (802.11n)", bluetooth: "Bluetooth 2.1", fingerprint: false, faceRecognition: false, irCamera: false, privacyShutter: false, smartCardReader: false, buildMaterial: "Glass-fiber plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", coolingSystem: "Single fan", fans: "Single fan", warranty: "1 year" }), desc: "14-inch budget business laptop with Core 2 Duo and ThinkPad keyboard.",
    variants: [
      V("thinkpad-r400-c2d", "ThinkPad R400 (Core 2 Duo · 2GB · 160GB HDD)", 499, 3.5, 89, "Budget 14-inch ThinkPad with a Core 2 Duo P8400 and a 160GB HDD.", { cpu: "Intel Core 2 Duo P8400", cores: "2C/2T", cs: 25, gpu: "Intel GMA 4500MHD", gs: 5, ram: 2, ramT: "DDR3", storage: 160, storageType: "HDD", disp: '14.1" WXGA (1280×800) TN', ds: 14.1, ref: 60, batt: 5, bc: "6-cell", w: 2.4, ports: ["USB-A x3", "VGA", "Ethernet", "3.5mm"], os: "Windows 7 Professional" }),
    ] },
  { id: "lenovo-thinkpad-r500", name: "ThinkPad R500", year: 2009, base: base({ wifi: "Wi-Fi 4 (802.11n)", bluetooth: "Bluetooth 2.1", fingerprint: false, faceRecognition: false, irCamera: false, privacyShutter: false, smartCardReader: false, buildMaterial: "Glass-fiber plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", coolingSystem: "Single fan", fans: "Single fan", warranty: "1 year" }), desc: "15.4-inch budget ThinkPad with full keyboard and numpad.",
    variants: [
      V("thinkpad-r500-c2d", "ThinkPad R500 (Core 2 Duo · 2GB · 160GB HDD)", 499, 3.4, 67, "15.4-inch budget ThinkPad with Core 2 Duo and a spacious keyboard.", { cpu: "Intel Core 2 Duo T5870", cores: "2C/2T", cs: 24, gpu: "Intel GMA 4500MHD", gs: 5, ram: 2, ramT: "DDR2", storage: 160, storageType: "HDD", disp: '15.4" WXGA (1280×800) TN', ds: 15.4, ref: 60, batt: 4, bc: "6-cell", w: 2.9, ports: ["USB-A x3", "VGA", "Ethernet", "ExpressCard", "3.5mm"], os: "Windows 7 Professional" }),
    ] },
  { id: "lenovo-thinkpad-r410", name: "ThinkPad R410", year: 2010, base: base({ wifi: "Wi-Fi 4 (802.11n)", bluetooth: "Bluetooth 2.1", fingerprint: false, faceRecognition: false, irCamera: false, privacyShutter: false, smartCardReader: false, buildMaterial: "Glass-fiber plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", coolingSystem: "Single fan", fans: "Single fan", warranty: "1 year" }), desc: "14-inch budget ThinkPad with first-gen Intel Core i-series.",
    variants: [
      V("thinkpad-r410-i3", "ThinkPad R410 (Core i3 · 2GB · 250GB HDD)", 549, 3.6, 78, "Core i3-330M with a 250GB HDD and classic ThinkPad keyboard.", { cpu: "Intel Core i3-330M", cores: "2C/4T", cs: 28, gpu: "Intel GMA HD", gs: 6, ram: 2, ramT: "DDR3", storage: 250, storageType: "HDD", disp: '14.0" WXGA (1280×800) TN', ds: 14, ref: 60, batt: 5, bc: "6-cell", w: 2.3, ports: ["USB-A x3", "VGA", "Ethernet", "ExpressCard", "3.5mm"], os: "Windows 7 Professional" }),
    ] },
  { id: "lenovo-thinkpad-r510", name: "ThinkPad R510", year: 2010, base: base({ wifi: "Wi-Fi 4 (802.11n)", bluetooth: "Bluetooth 2.1", fingerprint: false, faceRecognition: false, irCamera: false, privacyShutter: false, smartCardReader: false, buildMaterial: "Glass-fiber plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", coolingSystem: "Single fan", fans: "Single fan", warranty: "1 year" }), desc: "15.4-inch budget ThinkPad with Core i5 and optional discrete graphics.",
    variants: [
      V("thinkpad-r510-i5", "ThinkPad R510 (Core i5 · 4GB · 320GB HDD)", 599, 3.7, 56, "Core i5-430M with NVIDIA NVS 3100M discrete graphics.", { cpu: "Intel Core i5-430M", cores: "2C/4T", cs: 32, gpu: "NVIDIA NVS 3100M 512MB", gs: 10, ram: 4, ramT: "DDR3", storage: 320, storageType: "HDD", disp: '15.4" WXGA (1280×800) TN', ds: 15.4, ref: 60, batt: 4, bc: "6-cell", w: 2.8, ports: ["USB-A x3", "VGA", "Ethernet", "ExpressCard", "3.5mm"], os: "Windows 7 Professional" }),
    ] },
];
