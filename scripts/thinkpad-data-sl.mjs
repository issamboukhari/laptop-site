// SL-series dataset (mainstream budget ThinkPads).
import { base, V } from "./thinkpad-data-common.mjs";

export const SL_SERIES = [
  { id: "lenovo-thinkpad-sl410", name: "ThinkPad SL410", year: 2009, base: base({ wifi: "Wi-Fi 4 (802.11n)", bluetooth: "Bluetooth 2.1", fingerprint: false, faceRecognition: false, irCamera: false, privacyShutter: false, smartCardReader: false, buildMaterial: "Glass-fiber plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", coolingSystem: "Single fan", fans: "Single fan", warranty: "1 year" }), desc: "14-inch mainstream ThinkPad with a glossy display option.",
    variants: [
      V("thinkpad-sl410-c2d", "ThinkPad SL410 (Core 2 Duo · 2GB · 250GB HDD)", 499, 3.5, 123, "Core 2 Duo T6570 with a 14-inch glossy LED display.", { cpu: "Intel Core 2 Duo T6570", cores: "2C/2T", cs: 26, gpu: "Intel GMA 4500MHD", gs: 5, ram: 2, ramT: "DDR3", storage: 250, storageType: "HDD", disp: '14.0" WXGA (1280×800) TN', ds: 14, ref: 60, batt: 4, bc: "6-cell", w: 2.3, ports: ["USB-A x3", "VGA", "HDMI 1.3", "Ethernet", "3.5mm"], os: "Windows 7 Professional" }),
    ] },
  { id: "lenovo-thinkpad-sl510", name: "ThinkPad SL510", year: 2009, base: base({ wifi: "Wi-Fi 4 (802.11n)", bluetooth: "Bluetooth 2.1", fingerprint: false, faceRecognition: false, irCamera: false, privacyShutter: false, smartCardReader: false, buildMaterial: "Glass-fiber plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", coolingSystem: "Single fan", fans: "Single fan", warranty: "1 year" }), desc: "15.6-inch mainstream ThinkPad with HDMI output.",
    variants: [
      V("thinkpad-sl510-c2d", "ThinkPad SL510 (Core 2 Duo · 2GB · 250GB HDD)", 499, 3.4, 98, "15.6-inch budget ThinkPad with Core 2 Duo and HDMI output.", { cpu: "Intel Core 2 Duo T6670", cores: "2C/2T", cs: 26, gpu: "Intel GMA 4500MHD", gs: 5, ram: 2, ramT: "DDR3", storage: 250, storageType: "HDD", disp: '15.6" HD (1366×768) TN', ds: 15.6, ref: 60, batt: 3, bc: "6-cell", w: 2.7, ports: ["USB-A x3", "VGA", "HDMI 1.3", "Ethernet", "3.5mm"], os: "Windows 7 Professional" }),
    ] },
];
