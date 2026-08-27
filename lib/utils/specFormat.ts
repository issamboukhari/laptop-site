import { ComputerSpecs } from "@/lib/data/types";

/** Format a complete structured spec list for Gemini context. Unknown fields show "Not available". */
export function formatFullSpecs(s: ComputerSpecs): string {
  const fmt = (v: unknown): string => {
    if (v === undefined || v === null || v === "") return "Not available";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  };

  const rows: string[] = [
    `- CPU: ${s.cpu} (Score: ${s.cpuScore}/100)${s.cpuCores ? ` | Cores: ${s.cpuCores}` : ""}`,
    `- GPU: ${s.gpu} (Score: ${s.gpuScore}/100)`,
    `- RAM: ${s.ram ? `${s.ram}GB` : fmt(s.ram)}${s.ramType ? ` ${s.ramType}` : ""}${s.ramSpeed ? ` ${s.ramSpeed}` : ""} | RAM upgradeable: ${fmt(s.ramUpgradeable)}`,
    `- Storage: ${s.storage ? `${s.storage}GB ${s.storageType}` : fmt(s.storage)} | Slots: ${fmt(s.storageSlots)}`,
    `- Display: ${s.display} | Size: ${s.displaySize ? `${s.displaySize}"` : "Not available"} | Resolution: ${fmt(s.resolution)} | Refresh: ${s.displayRefreshRate ? `${s.displayRefreshRate}Hz` : "Not available"} | Panel: ${fmt(s.panelType)} | Brightness: ${fmt(s.brightness)} | Color coverage: ${fmt(s.colorCoverage)} | Touch: ${fmt(s.touchscreen)} | HDR: ${fmt(s.hdr)} | Aspect ratio: ${fmt(s.aspectRatio)}`,
    `- Battery: ${s.batteryLife ? `${s.batteryLife}h rated` : "Desktop (no battery)"} | Capacity: ${fmt(s.batteryCapacity)} | Charger: ${fmt(s.charger)} | Weight: ${s.weight ? `${s.weight}kg` : "Not available"} | Dimensions: ${fmt(s.dimensions)}`,
    `- Wireless: ${fmt(s.wifi)} | Bluetooth: ${fmt(s.bluetooth)} | Ethernet: ${fmt(s.ethernet)}`,
    `- Ports: USB-A: ${fmt(s.usbA)} | USB-C: ${fmt(s.usbC)} | Thunderbolt: ${fmt(s.thunderbolt)} | HDMI: ${fmt(s.hdmi)} | DisplayPort: ${fmt(s.displayPort)} | SD slot: ${fmt(s.sdCard)} | Audio jack: ${fmt(s.audioJack)}`,
    `- Security: Fingerprint: ${fmt(s.fingerprint)} | Face recognition: ${fmt(s.faceRecognition)} | IR camera: ${fmt(s.irCamera)} | TPM: ${fmt(s.tpm)} | Privacy shutter: ${fmt(s.privacyShutter)} | Smart card: ${fmt(s.smartCardReader)}`,
    `- Camera/Audio: Webcam: ${fmt(s.webcam)} | Mics: ${fmt(s.microphones)} | Speakers: ${fmt(s.speakers)} | Audio features: ${fmt(s.audioFeatures)}`,
    `- Keyboard/Input: Backlit: ${fmt(s.backlitKeyboard)} | RGB: ${fmt(s.rgbKeyboard)} | Layout: ${fmt(s.keyboardLayout)} | Numpad: ${fmt(s.numpad)} | Stylus: ${fmt(s.stylusSupport)}`,
    `- Build: Material: ${fmt(s.buildMaterial)} | MIL-SPEC: ${fmt(s.militaryCertification)} | Cooling: ${fmt(s.coolingSystem)} | Fans: ${fmt(s.fans)} | Upgradeability: ${fmt(s.upgradeability)} | Warranty: ${fmt(s.warranty)}`,
    `- Ports list: ${s.ports.join(", ") || "Not available"} | OS: ${s.os}`,
  ];

  return rows.join("\n");
}