// Shared helpers + base-spec presets for the HP EliteBook dataset.
export const base = (o = {}) => ({
  wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.0",
  fingerprint: true, faceRecognition: false, irCamera: false, tpm: "TPM 2.0",
  privacyShutter: false, smartCardReader: false,
  backlitKeyboard: true, rgbKeyboard: false, keyboardLayout: "Full-size", numpad: false,
  buildMaterial: "Aluminum", militaryCertification: "MIL-STD-810H",
  coolingSystem: "Single fan + heat pipes", fans: "Single fan",
  warranty: "1 year",
  ...o,
});

export const P = {
  g5: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", buildMaterial: "Aluminum + plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2", fingerprint: false }),
  g6: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", buildMaterial: "Aluminum + plastic", militaryCertification: "MIL-STD-810G" }),
  g7: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.0", buildMaterial: "Aluminum", militaryCertification: "MIL-STD-810H" }),
  g8: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.0", buildMaterial: "Aluminum" }),
  g9: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "Aluminum", irCamera: true }),
  g10: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "Aluminum", irCamera: true, faceRecognition: true }),
  g11: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.3", buildMaterial: "Aluminum", irCamera: true, faceRecognition: true }),
  premium: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "CNC aluminum", irCamera: true, faceRecognition: true, smartCardReader: true }),
  ultra: base({ wifi: "Wi-Fi 7", bluetooth: "Bluetooth 5.4", buildMaterial: "CNC aluminum", irCamera: true, faceRecognition: true, smartCardReader: true }),
  convertG7: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.0", buildMaterial: "Aluminum", stylusSupport: true }),
  convertG8: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.0", buildMaterial: "Aluminum", stylusSupport: true, faceRecognition: true }),
  convertG9: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "Aluminum", stylusSupport: true, faceRecognition: true }),
  convertG10: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "Aluminum", stylusSupport: true, faceRecognition: true }),
};

export const V = (id, name, price, rating, reviews, desc, s) => ({
  id, name, price, rating, reviews, desc,
  o: {
    cpu: s.cpu, cs: s.cs, gpu: s.gpu, gs: s.gs, ram: s.ram, ramT: s.ramT,
    ramS: s.ramS, ru: s.ru, storage: s.storage, ss: s.ss,
    disp: s.disp, ds: s.ds, res: s.res, pt: s.pt, br: s.br,
    ref: s.ref, batt: s.batt, bc: s.bc, w: s.w, ports: s.ports, os: s.os, cores: s.cores,
  },
});
