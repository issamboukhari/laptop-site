// A-series dataset (AMD-powered ThinkPads).
import { base, P, V } from "./thinkpad-data-common.mjs";

export const A_SERIES = [
  { id: "lenovo-thinkpad-a475", name: "ThinkPad A475", year: 2017, base: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.1", buildMaterial: "Glass-fiber plastic + magnesium", militaryCertification: "MIL-STD-810G", coolingSystem: "Single fan", fans: "Single fan" }), desc: "14-inch AMD PRO A12 business laptop — the first AMD ThinkPad in years.",
    variants: [
      V("thinkpad-a475-a12", "ThinkPad A475 (A12 · 8GB · 256GB)", 599, 3.9, 89, "AMD PRO A12-9800B with Radeon R7 graphics in a 14-inch chassis.", { cpu: "AMD PRO A12-9800B", cs: 45, gpu: "AMD Radeon R7", gs: 18, ram: 8, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 256, ss: "2× M.2", disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.75, ports: ["USB-C", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-a485", name: "ThinkPad A485", year: 2018, base: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", buildMaterial: "Glass-fiber plastic + magnesium", militaryCertification: "MIL-STD-810G", coolingSystem: "Single fan", fans: "Single fan" }), desc: "14-inch AMD Ryzen PRO business laptop with dual-drive support.",
    variants: [
      V("thinkpad-a485-r5", "ThinkPad A485 (Ryzen 5 · 8GB · 256GB)", 699, 4.1, 134, "Ryzen 5 PRO 2500U with Vega 8 graphics and dual-drive storage.", { cpu: "AMD Ryzen 5 PRO 2500U", cs: 62, gpu: "AMD Radeon Vega 8", gs: 22, ram: 8, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 256, ss: "2× M.2", disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.75, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
      V("thinkpad-a485-r7", "ThinkPad A485 (Ryzen 7 · 16GB · 512GB)", 899, 4.2, 87, "Ryzen 7 PRO 2700U with Vega 10 graphics for heavier workloads.", { cpu: "AMD Ryzen 7 PRO 2700U", cs: 68, gpu: "AMD Radeon Vega 10", gs: 25, ram: 16, ramT: "DDR4", ru: "Up to 32GB (2 slots)", storage: 512, ss: "2× M.2", disp: '14" FHD (1920×1080) IPS 250 nits', ds: 14, ref: 60, batt: 8, bc: "45Wh", w: 1.75, ports: ["USB-C x2", "USB-A x2", "HDMI 1.4", "Ethernet", "microSD", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
  { id: "lenovo-thinkpad-a285", name: "ThinkPad A285", year: 2018, base: base({ wifi: "Wi-Fi 5 (802.11ac)", bluetooth: "Bluetooth 4.2", buildMaterial: "Carbon fiber + magnesium", militaryCertification: "MIL-STD-810G", coolingSystem: "Single fan", fans: "Single fan" }), desc: "12.5-inch AMD Ryzen PRO ultraportable ThinkPad.",
    variants: [
      V("thinkpad-a285-r5", "ThinkPad A285 (Ryzen 5 · 8GB · 256GB)", 799, 4.1, 87, "Ryzen 5 PRO 2500U in a compact 12.5-inch 1.27kg chassis.", { cpu: "AMD Ryzen 5 PRO 2500U", cs: 62, gpu: "AMD Radeon Vega 8", gs: 22, ram: 8, ramT: "DDR4", storage: 256, disp: '12.5" FHD (1920×1080) IPS 300 nits', ds: 12.5, pt: "IPS", br: "300 nits", ref: 60, batt: 9, bc: "48Wh", w: 1.27, ports: ["USB-C x2", "USB-A", "HDMI 1.4", "3.5mm"], os: "Windows 10 Pro" }),
    ] },
];
