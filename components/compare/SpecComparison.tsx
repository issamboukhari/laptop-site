"use client";

import { ComputerVariant } from "@/lib/data/types";
import { Card } from "@/components/ui/Card";
import { formatStorage } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Cpu, HardDrive, Monitor, Battery, Wifi, Shield, Camera, Keyboard, Box } from "lucide-react";

const NA = "Not available";

type Row = { label: string; a: unknown; b: unknown; winner?: "A" | "B" | "tie" | "diff"; numeric?: { a: number; b: number; max: number; higherBetter: boolean } };

function fmtValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return NA;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function numericCompare(a: unknown, b: unknown, higherBetter: boolean): "A" | "B" | "tie" {
  const na = typeof a === "number" ? a : null;
  const nb = typeof b === "number" ? b : null;
  if (na === null && nb === null) return "tie";
  if (na === null) return "B";
  if (nb === null) return "A";
  if (na === nb) return "tie";
  return higherBetter ? (na > nb ? "A" : "B") : na < nb ? "A" : "B";
}

function stringWinner(a: unknown, b: unknown): "A" | "B" | "tie" | "diff" {
  const sa = fmtValue(a);
  const sb = fmtValue(b);
  if (sa === NA && sb === NA) return "tie";
  if (sa === NA) return "B";
  if (sb === NA) return "A";
  return sa === sb ? "tie" : "diff";
}

function numRow(label: string, a: ComputerVariant["specs"], b: ComputerVariant["specs"], key: keyof ComputerVariant["specs"], max: number, higherBetter = true): Row {
  const va = typeof a[key] === "number" ? (a[key] as number) : null;
  const vb = typeof b[key] === "number" ? (b[key] as number) : null;
  return {
    label,
    a: va !== null ? `${va}` : NA,
    b: vb !== null ? `${vb}` : NA,
    winner: numericCompare(va, vb, higherBetter),
    numeric: va !== null && vb !== null ? { a: va, b: vb, max, higherBetter } : undefined,
  };
}

function buildRows(a: ComputerVariant, b: ComputerVariant): { icon: React.ElementType; title: string; rows: Row[] }[] {
  const sa = a.specs;
  const sb = b.specs;

  const sections: { icon: React.ElementType; title: string; rows: Row[] }[] = [
    {
      icon: Cpu,
      title: "Processor & Graphics",
      rows: [
        { label: "Processor", a: sa.cpu, b: sb.cpu, winner: stringWinner(sa.cpu, sb.cpu) },
        { label: "Cores", a: sa.cpuCores, b: sb.cpuCores, winner: stringWinner(sa.cpuCores, sb.cpuCores) },
        { label: "Graphics", a: sa.gpu, b: sb.gpu, winner: stringWinner(sa.gpu, sb.gpu) },
        numRow("CPU score", sa, sb, "cpuScore", 100),
        numRow("GPU score", sa, sb, "gpuScore", 100),
        numRow("RAM", sa, sb, "ram", 128),
        { label: "RAM speed", a: sa.ramSpeed, b: sb.ramSpeed, winner: stringWinner(sa.ramSpeed, sb.ramSpeed) },
        { label: "RAM upgradeable", a: sa.ramUpgradeable, b: sb.ramUpgradeable, winner: stringWinner(sa.ramUpgradeable, sb.ramUpgradeable) },
      ],
    },
    {
      icon: HardDrive,
      title: "Storage",
      rows: [
        {
          label: "Capacity",
          a: sa.storage ? `${formatStorage(sa.storage)} ${sa.storageType}` : NA,
          b: sb.storage ? `${formatStorage(sb.storage)} ${sb.storageType}` : NA,
          winner: numericCompare(sa.storage, sb.storage, true),
        },
        { label: "Drive slots", a: sa.storageSlots, b: sb.storageSlots, winner: stringWinner(sa.storageSlots, sb.storageSlots) },
        { label: "Upgradeability", a: sa.upgradeability, b: sb.upgradeability, winner: stringWinner(sa.upgradeability, sb.upgradeability) },
      ],
    },
    {
      icon: Monitor,
      title: "Display",
      rows: [
        { label: "Panel", a: sa.display, b: sb.display, winner: stringWinner(sa.display, sb.display) },
        {
          label: "Size",
          a: sa.displaySize ? `${sa.displaySize}"` : NA,
          b: sb.displaySize ? `${sb.displaySize}"` : NA,
          winner: numericCompare(sa.displaySize, sb.displaySize, true),
        },
        { label: "Resolution", a: sa.resolution, b: sb.resolution, winner: stringWinner(sa.resolution, sb.resolution) },
        numRow("Refresh rate", sa, sb, "displayRefreshRate", 360),
        { label: "Panel type", a: sa.panelType, b: sb.panelType, winner: stringWinner(sa.panelType, sb.panelType) },
        { label: "Brightness", a: sa.brightness, b: sb.brightness, winner: stringWinner(sa.brightness, sb.brightness) },
        { label: "Color coverage", a: sa.colorCoverage, b: sb.colorCoverage, winner: stringWinner(sa.colorCoverage, sb.colorCoverage) },
        { label: "Touchscreen", a: sa.touchscreen, b: sb.touchscreen, winner: stringWinner(sa.touchscreen, sb.touchscreen) },
      ],
    },
    {
      icon: Battery,
      title: "Battery & Power",
      rows: [
        numRow("Battery life", sa, sb, "batteryLife", 22),
        { label: "Battery capacity", a: sa.batteryCapacity, b: sb.batteryCapacity, winner: stringWinner(sa.batteryCapacity, sb.batteryCapacity) },
        numRow("Weight", sa, sb, "weight", 5, false),
        { label: "Dimensions", a: sa.dimensions, b: sb.dimensions, winner: stringWinner(sa.dimensions, sb.dimensions) },
      ],
    },
    {
      icon: Wifi,
      title: "Connectivity & Ports",
      rows: [
        { label: "Wi-Fi", a: sa.wifi, b: sb.wifi, winner: stringWinner(sa.wifi, sb.wifi) },
        { label: "Bluetooth", a: sa.bluetooth, b: sb.bluetooth, winner: stringWinner(sa.bluetooth, sb.bluetooth) },
        { label: "USB-A", a: sa.usbA, b: sb.usbA, winner: stringWinner(sa.usbA, sb.usbA) },
        { label: "USB-C", a: sa.usbC, b: sb.usbC, winner: stringWinner(sa.usbC, sb.usbC) },
        { label: "Thunderbolt", a: sa.thunderbolt, b: sb.thunderbolt, winner: stringWinner(sa.thunderbolt, sb.thunderbolt) },
        { label: "HDMI", a: sa.hdmi, b: sb.hdmi, winner: stringWinner(sa.hdmi, sb.hdmi) },
        { label: "SD card slot", a: sa.sdCard, b: sb.sdCard, winner: stringWinner(sa.sdCard, sb.sdCard) },
        { label: "Ethernet", a: sa.ethernet, b: sb.ethernet, winner: stringWinner(sa.ethernet, sb.ethernet) },
      ],
    },
    {
      icon: Shield,
      title: "Security & Biometrics",
      rows: [
        { label: "Fingerprint reader", a: sa.fingerprint, b: sb.fingerprint, winner: stringWinner(sa.fingerprint, sb.fingerprint) },
        { label: "Face recognition", a: sa.faceRecognition, b: sb.faceRecognition, winner: stringWinner(sa.faceRecognition, sb.faceRecognition) },
        { label: "TPM", a: sa.tpm, b: sb.tpm, winner: stringWinner(sa.tpm, sb.tpm) },
        { label: "Privacy shutter", a: sa.privacyShutter, b: sb.privacyShutter, winner: stringWinner(sa.privacyShutter, sb.privacyShutter) },
      ],
    },
    {
      icon: Camera,
      title: "Camera & Audio",
      rows: [
        { label: "Webcam", a: sa.webcam, b: sb.webcam, winner: stringWinner(sa.webcam, sb.webcam) },
        { label: "Speakers", a: sa.speakers, b: sb.speakers, winner: stringWinner(sa.speakers, sb.speakers) },
        { label: "Microphones", a: sa.microphones, b: sb.microphones, winner: stringWinner(sa.microphones, sb.microphones) },
      ],
    },
    {
      icon: Keyboard,
      title: "Keyboard & Input",
      rows: [
        { label: "Backlit keyboard", a: sa.backlitKeyboard, b: sb.backlitKeyboard, winner: stringWinner(sa.backlitKeyboard, sb.backlitKeyboard) },
        { label: "RGB keyboard", a: sa.rgbKeyboard, b: sb.rgbKeyboard, winner: stringWinner(sa.rgbKeyboard, sb.rgbKeyboard) },
        { label: "Numpad", a: sa.numpad, b: sb.numpad, winner: stringWinner(sa.numpad, sb.numpad) },
      ],
    },
    {
      icon: Box,
      title: "Build & Features",
      rows: [
        { label: "Build material", a: sa.buildMaterial, b: sb.buildMaterial, winner: stringWinner(sa.buildMaterial, sb.buildMaterial) },
        { label: "Military certification", a: sa.militaryCertification, b: sb.militaryCertification, winner: stringWinner(sa.militaryCertification, sb.militaryCertification) },
        { label: "Cooling system", a: sa.coolingSystem, b: sb.coolingSystem, winner: stringWinner(sa.coolingSystem, sb.coolingSystem) },
        { label: "Warranty", a: sa.warranty, b: sb.warranty, winner: stringWinner(sa.warranty, sb.warranty) },
      ],
    },
  ];

  return sections;
}

function CellValue({ value }: { value: unknown }) {
  const isNa = value === undefined || value === null || value === "";
  return <span className={cn("text-sm", isNa ? "text-gen-muted/50 italic" : "text-gen-fg")}>{fmtValue(value)}</span>;
}

function NumericBar({ value, max, isWinner }: { value: number; max: number; isWinner: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mt-1">
      <div className="h-1.5 rounded-full bg-gen-card-hover overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isWinner ? "bg-emerald-500" : "bg-gen-muted/40"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SpecComparison({ computerA, computerB }: { computerA: ComputerVariant; computerB: ComputerVariant }) {
  const sections = buildRows(computerA, computerB);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {sections.map((sec) => (
        <Card key={sec.title} className="overflow-hidden">
          <div className="p-4 border-b border-gen-border flex items-center gap-2">
            <sec.icon className="w-4 h-4 text-gen-accent" />
            <h3 className="text-sm font-semibold text-gen-fg">{sec.title}</h3>
          </div>
          <div className="divide-y divide-gen-border/60">
            {sec.rows.map((row) => (
              <div key={row.label} className="px-4 py-2.5 hover:bg-gen-card-hover/30 transition-colors">
                <p className="text-[10px] text-gen-muted uppercase tracking-wider mb-1.5">
                  {row.label}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {row.winner === "A" && (
                        <span className="text-[10px] font-bold text-emerald-500 shrink-0">▲</span>
                      )}
                      <CellValue value={row.a} />
                    </div>
                    {row.numeric && (
                      <NumericBar
                        value={row.numeric.a}
                        max={row.numeric.max}
                        isWinner={row.winner === "A"}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-gen-muted shrink-0 pt-0.5">
                    {row.winner === "A" ? "▲" : row.winner === "B" ? "▼" : row.winner === "tie" ? "=" : "vs"}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <CellValue value={row.b} />
                      {row.winner === "B" && (
                        <span className="text-[10px] font-bold text-emerald-500 shrink-0">▲</span>
                      )}
                    </div>
                    {row.numeric && (
                      <NumericBar
                        value={row.numeric.b}
                        max={row.numeric.max}
                        isWinner={row.winner === "B"}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
