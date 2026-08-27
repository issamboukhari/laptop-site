// L-series expansion — older models and extra configs.
import { base, P, V } from "./thinkpad-data-common.mjs";

export const L_SERIES_EXPAND = [
  { id: "lenovo-thinkpad-l450", name: "ThinkPad L450", year: 2015, base: P.lOld, desc: "14-inch budget business laptop with Broadwell Intel.",
    variants: [
      V("thinkpad-l450-i5", "ThinkPad L450 (i5 · 4GB · 500GB HDD)", 599, 3.9, 123, "Broadwell i5 with dual batteries and a spill-resistant keyboard.", { cpu: "Intel Core i5-5200U", cs: 55, gpu: "Intel HD Graphics 5500", gs: 12, ram: 4, ramT: "DDR3L", ru: "Up to 16GB (2 slots)", storage: 500, storageType: "HDD", disp: '14" HD (1366×768) TN 200 nits', ds: 14, ref: 60, batt: 7, bc: "24Wh + 24Wh", w: 2.0, ports: ["USB-A x3", "VGA", "HDMI 1.4", "Ethernet", "SD Card", "3.5mm"], os: "Windows 7 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l560", name: "ThinkPad L560", year: 2016, base: P.lOld, desc: "15.6-inch budget business laptop with Skylake Intel.",
    variants: [
      V("thinkpad-l560-i5", "ThinkPad L560 (i5 · 4GB · 500GB HDD)", 649, 3.9, 98, "Skylake i5 with a 15.6-inch FHD display and dual batteries.", { cpu: "Intel Core i5-6200U", cs: 58, gpu: "Intel HD Graphics 520", gs: 12, ram: 4, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 500, storageType: "HDD", disp: '15.6" HD (1366×768) TN 200 nits', ds: 15.6, ref: 60, batt: 7, bc: "24Wh + 24Wh", w: 2.3, ports: ["USB-A x3", "VGA", "HDMI 1.4", "Ethernet", "SD Card", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l380", name: "ThinkPad L380", year: 2018, base: P.lModern, desc: "13.3-inch L-series with 8th-gen Intel — compact and affordable.",
    variants: [
      V("thinkpad-l380-i5", "ThinkPad L380 (i5 · 8GB · 256GB)", 699, 4.0, 87, "Kaby Lake i5 in a compact 13.3-inch business chassis.", { cpu: "Intel Core i5-8250U", cs: 65, gpu: "Intel UHD Graphics 620", gs: 18, ram: 8, ramT: "DDR4", storage: 256, disp: '13.3" FHD (1920×1080) IPS 250 nits', ds: 13.3, ref: 60, batt: 8, bc: "45Wh", w: 1.46, ports: ["USB-C", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l390", name: "ThinkPad L390", year: 2019, base: P.lModern, desc: "13.3-inch L-series with Whiskey Lake Intel.",
    variants: [
      V("thinkpad-l390-i5", "ThinkPad L390 (i5 · 8GB · 256GB)", 749, 4.1, 78, "Whiskey Lake i5 in a compact 13.3-inch business chassis.", { cpu: "Intel Core i5-8265U", cs: 66, gpu: "Intel UHD Graphics 620", gs: 18, ram: 8, ramT: "DDR4", storage: 256, disp: '13.3" FHD (1920×1080) IPS 250 nits', ds: 13.3, ref: 60, batt: 8, bc: "45Wh", w: 1.46, ports: ["USB-C", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l490", name: "ThinkPad L490", year: 2019, base: P.lModern, desc: "14-inch L-series with Whiskey Lake Intel and dual-drive support.",
    variants: [
      V("thinkpad-l490-i5", "ThinkPad L490 (i5 · 8GB · 256GB)", 849, 4.2, 112, "Whiskey Lake i5 with dual-drive bays and full business I/O.", { cpu: "Intel Core i5-8265U", cs: 66, gpu: "Intel UHD Graphics 620", gs: 18, ram: 8, ramT: "DDR4", ru: "Up to 64GB (2 slots)", storage: 256, ss: "M.2 + 2.5-inch", disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.65, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l590", name: "ThinkPad L590", year: 2019, base: P.lModern, desc: "15.6-inch L-series with Whiskey Lake Intel and dual-drive support.",
    variants: [
      V("thinkpad-l590-i5", "ThinkPad L590 (i5 · 8GB · 256GB)", 799, 4.1, 87, "Whiskey Lake i5 with a 15.6-inch FHD display and numpad.", { cpu: "Intel Core i5-8265U", cs: 66, gpu: "Intel UHD Graphics 620", gs: 18, ram: 8, ramT: "DDR4", ru: "Up to 64GB (2 slots)", storage: 256, ss: "M.2 + 2.5-inch", disp: '15.6" FHD (1920×1080) IPS 250 nits', ds: 15.6, ref: 60, batt: 8, bc: "45Wh", w: 1.93, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-gen1", name: "ThinkPad L13 Gen 1", year: 2019, base: P.lModern, desc: "First-gen 13.3-inch L-series with 10th-gen Intel Comet Lake.",
    variants: [
      V("thinkpad-l13-gen1-i5", "ThinkPad L13 Gen 1 (i5 · 8GB · 256GB)", 799, 4.1, 112, "Comet Lake i5 with a compact 13.3-inch body.", { cpu: "Intel Core i5-10210U", cs: 67, gpu: "Intel UHD Graphics", gs: 18, ram: 8, ramT: "DDR4", storage: 256, disp: '13.3" FHD (1920×1080) IPS 250 nits', ds: 13.3, ref: 60, batt: 8, bc: "46Wh", w: 1.4, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
];
