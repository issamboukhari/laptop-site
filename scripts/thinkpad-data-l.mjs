// L-series dataset.
import { base, P, V } from "./thinkpad-data-common.mjs";

export const L_SERIES = [
  { id: "lenovo-thinkpad-l460", name: "ThinkPad L460", year: 2016, base: P.lOld, desc: "Affordable 14-inch business laptop with dual-battery design.",
    variants: [
      V("thinkpad-l460-i5", "ThinkPad L460 (i5 · 8GB · 256GB)", 649, 4.0, 178, "Hot-swappable external battery and full business I/O in a budget chassis.", { cpu: "Intel Core i5-6200U", cs: 58, gpu: "Intel HD Graphics 520", gs: 12, ram: 8, ramT: "DDR3L", storage: 256, disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 7, w: 1.88, ports: ["USB-C", "USB-A x3", "HDMI 1.4", "Ethernet", "SD Card", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l470", name: "ThinkPad L470", year: 2017, base: P.lOld, desc: "Seventh-gen Intel update to the affordable L-series.",
    variants: [
      V("thinkpad-l470-i5", "ThinkPad L470 (i5 · 8GB · 256GB)", 649, 4.1, 156, "Kaby Lake i5 with DDR4, dual batteries, and a spill-resistant keyboard.", { cpu: "Intel Core i5-7200U", cs: 60, gpu: "Intel HD Graphics 620", gs: 14, ram: 8, ramT: "DDR4", storage: 256, disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 7, bc: "24Wh + 24Wh", w: 1.84, ports: ["USB-C", "USB-A x3", "HDMI 1.4", "Ethernet", "SD Card", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l480", name: "ThinkPad L480", year: 2018, base: P.lModern, desc: "8th-gen Intel 14-inch L-series with dual-drive storage options.",
    variants: [
      V("thinkpad-l480-i5", "ThinkPad L480 (i5 · 8GB · 256GB)", 799, 4.1, 189, "Quiet, serviceable business laptop with 2.5-inch + M.2 drive bays.", { cpu: "Intel Core i5-8250U", cs: 65, gpu: "Intel UHD Graphics 620", gs: 18, ram: 8, ramT: "DDR4", storage: 256, disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "48Wh", w: 1.88, ports: ["USB-C", "USB-A x2", "HDMI 1.4", "Ethernet", "SD Card", "3.5mm"], os: "Windows 10 Pro" }),
      V("thinkpad-l480-i7", "ThinkPad L480 (i7 · 16GB · 512GB)", 949, 4.2, 87, "Higher-spec L480 for heavier business workloads.", { cpu: "Intel Core i7-8550U", cs: 70, gpu: "Intel UHD Graphics 620", gs: 18, ram: 16, ramT: "DDR4", storage: 512, disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "48Wh", w: 1.88, ports: ["USB-C", "USB-A x2", "HDMI 1.4", "Ethernet", "SD Card", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-gen2", name: "ThinkPad L13 Gen 2", year: 2020, base: P.lModern, desc: "Compact 13.3-inch L-series with 11th-gen Intel.",
    variants: [
      V("thinkpad-l13-gen2-i5", "ThinkPad L13 Gen 2 (i5 · 8GB · 256GB)", 899, 4.2, 134, "Light 1.4kg 13-inch business laptop that keeps the classic keyboard.", { cpu: "Intel Core i5-1135G7", cs: 72, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 8, ramT: "DDR4", storage: 256, disp: '13.3" FHD (1920×1080) IPS 300 nits', ds: 13.3, ref: 60, batt: 8, bc: "46Wh", w: 1.4, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-gen3", name: "ThinkPad L13 Gen 3", year: 2021, base: P.lModern, desc: "Third-gen 13.3-inch L-series, now with Tiger Lake i5/i7.",
    variants: [
      V("thinkpad-l13-gen3-i5", "ThinkPad L13 Gen 3 (i5 · 16GB · 512GB)", 849, 4.2, 123, "16GB RAM and 512GB storage make this a full day-to-day business machine.", { cpu: "Intel Core i5-1135G7", cs: 72, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", storage: 512, disp: '13.3" FHD (1920×1080) IPS 300 nits', ds: 13.3, ref: 60, batt: 8, bc: "46Wh", w: 1.4, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-gen4", name: "ThinkPad L13 Gen 4", year: 2022, base: P.lModern, desc: "12th-gen Intel 13.3-inch business ultraportable.",
    variants: [
      V("thinkpad-l13-gen4-i5", "ThinkPad L13 Gen 4 (i5 · 16GB · 512GB)", 899, 4.3, 112, "Alder Lake i5-1235U brings hybrid-core efficiency to the compact L13.", { cpu: "Intel Core i5-1235U", cs: 74, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", storage: 512, disp: '13.3" FHD+ (1920×1200) IPS 300 nits', ds: 13.3, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 8, bc: "46Wh", w: 1.4, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-gen5", name: "ThinkPad L13 Gen 5", year: 2023, base: P.lModern, desc: "Latest 13.3-inch L13 with 13th-gen Intel processors.",
    variants: [
      V("thinkpad-l13-gen5-i5", "ThinkPad L13 Gen 5 (i5 · 16GB · 512GB)", 879, 4.3, 98, "Raptor Lake i5-1335U in the lightest member of the L-series.", { cpu: "Intel Core i5-1335U", cs: 75, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", storage: 512, disp: '13.3" FHD+ (1920×1200) IPS 300 nits', ds: 13.3, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 8, bc: "46Wh", w: 1.4, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-yoga-gen3", name: "ThinkPad L13 Yoga Gen 3", year: 2021, base: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1", buildMaterial: "Plastic (PC-ABS)", militaryCertification: "MIL-STD-810H", stylusSupport: true }), desc: "Convertible 13.3-inch L-series with garaged pen and touch display.",
    variants: [
      V("thinkpad-l13-yoga-gen3-i5", "ThinkPad L13 Yoga Gen 3 (i5 · 16GB · 512GB)", 999, 4.2, 87, "360-degree hinge, bundled pen, and a 300-nit touch panel.", { cpu: "Intel Core i5-1135G7", cs: 72, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", storage: 512, disp: '13.3" FHD (1920×1080) IPS Touch 300 nits', ds: 13.3, pt: "IPS", br: "300 nits", ref: 60, batt: 8, bc: "46Wh", w: 1.43, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l13-yoga-gen4", name: "ThinkPad L13 Yoga Gen 4", year: 2022, base: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1", buildMaterial: "Plastic (PC-ABS)", militaryCertification: "MIL-STD-810H", stylusSupport: true }), desc: "12th-gen Intel convertible with pen input and 16:10 panel.",
    variants: [
      V("thinkpad-l13-yoga-gen4-i5", "ThinkPad L13 Yoga Gen 4 (i5 · 16GB · 512GB)", 949, 4.3, 76, "Alder Lake i5 with the taller 16:10 FHD+ touch display.", { cpu: "Intel Core i5-1235U", cs: 74, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", storage: 512, disp: '13.3" FHD+ (1920×1200) IPS Touch 300 nits', ds: 13.3, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 8, bc: "46Wh", w: 1.43, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l14-gen1", name: "ThinkPad L14 Gen 1", year: 2020, base: P.lModern, desc: "14-inch L-series with Ryzen 4000 or 10th-gen Intel options.",
    variants: [
      V("thinkpad-l14-gen1-i5", "ThinkPad L14 Gen 1 (i5 · 8GB · 256GB)", 949, 4.2, 167, "Comet Lake i5 with 2.5-inch + M.2 storage flexibility.", { cpu: "Intel Core i5-10210U", cs: 67, gpu: "Intel UHD Graphics", gs: 18, ram: 8, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 256, disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
      V("thinkpad-l14-gen1-r5", "ThinkPad L14 Gen 1 (Ryzen 5 · 8GB · 256GB)", 899, 4.3, 134, "Ryzen 5 PRO 4650U with six cores — strong value for multitaskers.", { cpu: "AMD Ryzen 5 PRO 4650U", cs: 70, gpu: "AMD Radeon Graphics", gs: 25, ram: 8, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 256, disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l14-gen2", name: "ThinkPad L14 Gen 2", year: 2021, base: P.lModern, desc: "Tiger Lake or Ryzen 5000 in the reliable L14 business chassis.",
    variants: [
      V("thinkpad-l14-gen2-i5", "ThinkPad L14 Gen 2 (i5 · 16GB · 512GB)", 899, 4.3, 178, "Tiger Lake i5-1135G7 with Iris Xe graphics and full business ports.", { cpu: "Intel Core i5-1135G7", cs: 72, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD (1920×1080) IPS 300 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
      V("thinkpad-l14-gen2-r5", "ThinkPad L14 Gen 2 (Ryzen 5 · 16GB · 512GB)", 949, 4.4, 112, "Ryzen 5 PRO 5650U with six cores and strong integrated graphics.", { cpu: "AMD Ryzen 5 PRO 5650U", cs: 72, gpu: "AMD Radeon Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD (1920×1080) IPS 300 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l14-gen3", name: "ThinkPad L14 Gen 3", year: 2022, base: P.lModern, desc: "12th-gen Intel or Ryzen 6000 PRO with a larger 57Wh battery.",
    variants: [
      V("thinkpad-l14-gen3-i5", "ThinkPad L14 Gen 3 (i5 · 16GB · 512GB)", 949, 4.3, 134, "Alder Lake i5-1235U with upgraded 57Wh battery capacity.", { cpu: "Intel Core i5-1235U", cs: 74, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD+ (1920×1200) IPS 300 nits', ds: 14, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
      V("thinkpad-l14-gen3-r7", "ThinkPad L14 Gen 3 (Ryzen 7 · 16GB · 512GB)", 1049, 4.5, 98, "Ryzen 7 PRO 6850U with Radeon 680M — near-discrete GPU performance.", { cpu: "AMD Ryzen 7 PRO 6850U", cs: 80, gpu: "AMD Radeon 680M", gs: 40, ram: 16, ramT: "DDR5", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD+ (1920×1200) IPS 300 nits', ds: 14, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l14-gen4", name: "ThinkPad L14 Gen 4", year: 2023, base: P.lModern, desc: "13th-gen Intel or Ryzen 7030 in the L14 with 16:10 panel.",
    variants: [
      V("thinkpad-l14-gen4-i5", "ThinkPad L14 Gen 4 (i5 · 16GB · 512GB)", 929, 4.4, 145, "Raptor Lake i5-1335U with the taller 16:10 FHD+ display.", { cpu: "Intel Core i5-1335U", cs: 75, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD+ (1920×1200) IPS 300 nits', ds: 14, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
      V("thinkpad-l14-gen4-r7", "ThinkPad L14 Gen 4 (Ryzen 7 · 16GB · 512GB)", 1099, 4.5, 87, "Ryzen 7 PRO 7840U with Radeon 780M integrated graphics.", { cpu: "AMD Ryzen 7 PRO 7840U", cs: 84, gpu: "AMD Radeon 780M", gs: 42, ram: 16, ramT: "DDR5", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD+ (1920×1200) IPS 300 nits', ds: 14, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l14-gen5", name: "ThinkPad L14 Gen 5", year: 2024, base: P.lModern, desc: "Latest L14 with Core Ultra and Ryzen 8040 options.",
    variants: [
      V("thinkpad-l14-gen5-u5", "ThinkPad L14 Gen 5 (Ultra 5 · 16GB · 512GB)", 999, 4.4, 87, "Meteor Lake Core Ultra 5 with Arc graphics and Wi-Fi 6E.", { cpu: "Intel Core Ultra 5 125U", cs: 76, gpu: "Intel Arc iGPU", gs: 35, ram: 16, ramT: "DDR5", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD+ (1920×1200) IPS 300 nits', ds: 14, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 2.1", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
      V("thinkpad-l14-gen5-r7", "ThinkPad L14 Gen 5 (Ryzen 7 · 16GB · 512GB)", 1099, 4.5, 65, "Ryzen 7 PRO 8840U with Radeon 780M — best-in-class iGPU.", { cpu: "AMD Ryzen 7 PRO 8840U", cs: 85, gpu: "AMD Radeon 780M", gs: 42, ram: 16, ramT: "DDR5", ru: "Up to 32GB (2 slots)", storage: 512, disp: '14" FHD+ (1920×1200) IPS 300 nits', ds: 14, res: "FHD+ (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.63, ports: ["USB-C x2", "USB-A x2", "HDMI 2.1", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l15-gen1", name: "ThinkPad L15 Gen 1", year: 2020, base: P.lModern, desc: "15.6-inch L-series with AMD or Intel choices.",
    variants: [
      V("thinkpad-l15-gen1-i5", "ThinkPad L15 Gen 1 (i5 · 8GB · 256GB)", 899, 4.1, 123, "Bigger 15.6-inch panel and dual storage bays for everyday office use.", { cpu: "Intel Core i5-10210U", cs: 67, gpu: "Intel UHD Graphics", gs: 18, ram: 8, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 256, disp: '15.6" FHD (1920×1080) IPS 250 nits', ds: 15.6, ref: 60, batt: 8, bc: "45Wh", w: 1.93, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l15-gen2", name: "ThinkPad L15 Gen 2", year: 2021, base: P.lModern, desc: "Tiger Lake / Ryzen 5000 15.6-inch business laptop.",
    variants: [
      V("thinkpad-l15-gen2-i5", "ThinkPad L15 Gen 2 (i5 · 16GB · 512GB)", 849, 4.3, 98, "Tiger Lake i5 with a 300-nit FHD display and full-size keyboard.", { cpu: "Intel Core i5-1135G7", cs: 72, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '15.6" FHD (1920×1080) IPS 300 nits', ds: 15.6, ref: 60, batt: 8, bc: "45Wh", w: 1.93, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l15-gen3", name: "ThinkPad L15 Gen 3", year: 2022, base: P.lModern, desc: "12th-gen Intel 15.6-inch L-series with 57Wh battery.",
    variants: [
      V("thinkpad-l15-gen3-i5", "ThinkPad L15 Gen 3 (i5 · 16GB · 512GB)", 899, 4.3, 76, "Alder Lake i5-1235U with a roomy 15.6-inch screen and numpad.", { cpu: "Intel Core i5-1235U", cs: 74, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '15.6" FHD (1920×1080) IPS 300 nits', ds: 15.6, ref: 60, batt: 9, bc: "57Wh", w: 1.93, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l15-gen4", name: "ThinkPad L15 Gen 4", year: 2023, base: P.lModern, desc: "13th-gen Intel 15.6-inch L-series in a modern chassis.",
    variants: [
      V("thinkpad-l15-gen4-i5", "ThinkPad L15 Gen 4 (i5 · 16GB · 512GB)", 929, 4.4, 65, "Raptor Lake i5-1335U with full keyboard including numeric keypad.", { cpu: "Intel Core i5-1335U", cs: 75, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '15.6" FHD (1920×1080) IPS 300 nits', ds: 15.6, ref: 60, batt: 9, bc: "57Wh", w: 1.93, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l16-gen1", name: "ThinkPad L16 Gen 1", year: 2023, base: base({ wifi: "Wi-Fi 6", bluetooth: "Bluetooth 5.1", buildMaterial: "Plastic (PC-ABS)", militaryCertification: "MIL-STD-810H", numpad: true }), desc: "16-inch 16:10 L-series with full numpad.",
    variants: [
      V("thinkpad-l16-gen1-i5", "ThinkPad L16 Gen 1 (i5 · 16GB · 512GB)", 949, 4.3, 54, "Tall 16-inch WUXGA panel plus a dedicated numeric keypad.", { cpu: "Intel Core i5-1335U", cs: 75, gpu: "Intel Iris Xe Graphics", gs: 30, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, disp: '16" WUXGA (1920×1200) IPS 300 nits', ds: 16, res: "WUXGA (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.95, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
  { id: "lenovo-thinkpad-l16-gen2", name: "ThinkPad L16 Gen 2", year: 2024, base: base({ wifi: "Wi-Fi 6E", bluetooth: "Bluetooth 5.2", buildMaterial: "Plastic (PC-ABS)", militaryCertification: "MIL-STD-810H", numpad: true }), desc: "Latest 16-inch L-series with Core Ultra processors.",
    variants: [
      V("thinkpad-l16-gen2-u5", "ThinkPad L16 Gen 2 (Ultra 5 · 16GB · 512GB)", 999, 4.4, 43, "Core Ultra 5 with Arc graphics on a big WUXGA screen.", { cpu: "Intel Core Ultra 5 125U", cs: 76, gpu: "Intel Arc iGPU", gs: 35, ram: 16, ramT: "DDR5", ru: "Up to 32GB (2 slots)", storage: 512, disp: '16" WUXGA (1920×1200) IPS 300 nits', ds: 16, res: "WUXGA (1920×1200)", pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "57Wh", w: 1.95, ports: ["USB-C x2", "USB-A x2", "HDMI 2.1", "Ethernet", "microSD", "3.5mm"], os: "Windows 11 Pro" }),
    ] },
];