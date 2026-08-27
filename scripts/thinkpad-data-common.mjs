// Shared helpers + base-spec presets for the ThinkPad dataset.
export const base = (o = {}) => ({
  wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1",
  fingerprint: true, faceRecognition: false, irCamera: false, tpm: "TPM 2.0",
  privacyShutter: true, smartCardReader: false,
  backlitKeyboard: true, rgbKeyboard: false, keyboardLayout: "Full-size", numpad: false,
  buildMaterial: "Carbon fiber + magnesium", militaryCertification: "MIL-STD-810H",
  coolingSystem: "Single fan + heat pipes", fans: "Single fan",
  warranty: "1 year",
  ...o,
});

export const P = {
  eModern: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1", buildMaterial: "Plastic", militaryCertification: "MIL-STD-810H" }),
  eOld: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.1", fingerprint: false, privacyShutter: false, buildMaterial: "Plastic", militaryCertification: "MIL-STD-810G", tpm: "TPM 1.2" }),
  lModern: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1", buildMaterial: "Plastic (PC-ABS)", militaryCertification: "MIL-STD-810H" }),
  lOld: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.1", fingerprint: false, privacyShutter: false, buildMaterial: "Plastic (PC-ABS)", militaryCertification: "MIL-STD-810G" }),
  tModern: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1", buildMaterial: "Carbon fiber + magnesium", militaryCertification: "MIL-STD-810H" }),
  tOld: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", buildMaterial: "Glass-fiber plastic + magnesium", militaryCertification: "MIL-STD-810G" }),
  tOldNoShut: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", privacyShutter: false, buildMaterial: "Glass-fiber plastic + magnesium", militaryCertification: "MIL-STD-810G" }),
  x1: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "Carbon fiber + magnesium", militaryCertification: "MIL-STD-810H" }),
  xOld: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", buildMaterial: "Carbon fiber + magnesium", militaryCertification: "MIL-STD-810G" }),
  xOldNoShut: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", privacyShutter: false, buildMaterial: "Carbon fiber + magnesium", militaryCertification: "MIL-STD-810G" }),
};

/* Variant helper. Short keys:
   cs=cpuScore gs=gpuScore ramT=ramType ramS=ramSpeed ru=ramUpgradeable
   ss=storageSlots disp=display ds=displaySize res=resolution pt=panelType
   br=brightness ref=displayRefreshRate batt=batteryLife bc=batteryCapacity
   w=weight ports=[...] os= cores=cpuCores */
export const V = (id, name, price, rating, reviews, desc, s) => ({
  id, name, price, rating, reviews, desc,
  o: {
    cpu: s.cpu, cs: s.cs, gpu: s.gpu, gs: s.gs, ram: s.ram, ramT: s.ramT,
    ramS: s.ramS, ru: s.ru, storage: s.storage, ss: s.ss,
    disp: s.disp, ds: s.ds, res: s.res, pt: s.pt, br: s.br,
    ref: s.ref, batt: s.batt, bc: s.bc, w: s.w, ports: s.ports, os: s.os, cores: s.cores,
  },
});