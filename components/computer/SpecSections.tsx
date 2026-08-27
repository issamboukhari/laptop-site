"use client";

import { ComputerSpecs } from "@/lib/data/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Cpu,
  HardDrive,
  Monitor,
  Battery,
  Wifi,
  Shield,
  Camera,
  Keyboard,
  Box,
  Laptop,
} from "lucide-react";

const NA = "Not available";

function fmt(value: unknown): string {
  if (value === undefined || value === null || value === "") return NA;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function fmtNumber(value: number | undefined, unit = ""): string {
  if (value === undefined || value === null || value === 0) return NA;
  return `${value}${unit}`;
}

type Row = { label: string; value: unknown };

function SpecRow({ label, value }: Row) {
  const isNa = value === undefined || value === null || value === "";
  return (
    <div className="grid grid-cols-[150px_1fr] items-start gap-3 px-4 py-2.5">
      <span className="text-sm text-gen-muted">{label}</span>
      <span className={`text-sm font-medium ${isNa ? "text-gen-muted/60 italic" : "text-gen-fg"}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-gen-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-gen-accent" />
        <h3 className="text-sm font-semibold text-gen-fg">{title}</h3>
      </div>
      <div className="divide-y divide-gen-border/60">{children}</div>
    </Card>
  );
}

export function SpecSections({ specs }: { specs: ComputerSpecs }) {
  const s = specs;

  const sections: { icon: React.ElementType; title: string; rows: Row[] }[] = [
    {
      icon: Cpu,
      title: "Processor & Graphics",
      rows: [
        { label: "Processor", value: s.cpu },
        { label: "Cores", value: s.cpuCores },
        { label: "Graphics", value: s.gpu },
        { label: "RAM", value: s.ram ? `${fmtNumber(s.ram, "GB")} ${fmt(s.ramType)}`.trim() : fmt(s.ram) },
        { label: "RAM speed", value: s.ramSpeed },
        { label: "RAM upgradeable", value: s.ramUpgradeable },
      ],
    },
    {
      icon: HardDrive,
      title: "Storage",
      rows: [
        { label: "Capacity", value: s.storage ? `${fmtNumber(s.storage, "GB")} ${s.storageType}` : fmt(s.storage) },
        { label: "Drive slots", value: s.storageSlots },
        { label: "Upgradeability", value: s.upgradeability },
      ],
    },
    {
      icon: Monitor,
      title: "Display",
      rows: [
        { label: "Panel", value: s.display },
        { label: "Size", value: fmtNumber(s.displaySize, '"') },
        { label: "Resolution", value: s.resolution },
        { label: "Refresh rate", value: fmtNumber(s.displayRefreshRate, "Hz") },
        { label: "Panel type", value: s.panelType },
        { label: "Brightness", value: s.brightness },
        { label: "Color coverage", value: s.colorCoverage },
        { label: "Aspect ratio", value: s.aspectRatio },
        { label: "Touchscreen", value: s.touchscreen },
        { label: "HDR", value: s.hdr },
      ],
    },
    {
      icon: Battery,
      title: "Battery & Power",
      rows: [
        { label: "Battery life", value: s.batteryLife ? `${fmtNumber(s.batteryLife, "h")} rated` : fmt(s.batteryLife) },
        { label: "Battery capacity", value: s.batteryCapacity },
        { label: "Charger", value: s.charger },
        { label: "Weight", value: s.weight ? `${s.weight.toFixed(1)}kg` : NA },
        { label: "Dimensions", value: s.dimensions },
      ],
    },
    {
      icon: Wifi,
      title: "Connectivity & Ports",
      rows: [
        { label: "Wi-Fi", value: s.wifi },
        { label: "Bluetooth", value: s.bluetooth },
        { label: "Ethernet", value: s.ethernet },
        { label: "USB-A", value: s.usbA },
        { label: "USB-C", value: s.usbC },
        { label: "Thunderbolt", value: s.thunderbolt },
        { label: "HDMI", value: s.hdmi },
        { label: "DisplayPort", value: s.displayPort },
        { label: "SD card slot", value: s.sdCard },
        { label: "Audio jack", value: s.audioJack },
      ],
    },
    {
      icon: Shield,
      title: "Security & Biometrics",
      rows: [
        { label: "Fingerprint reader", value: s.fingerprint },
        { label: "Face recognition", value: s.faceRecognition },
        { label: "IR camera", value: s.irCamera },
        { label: "TPM", value: s.tpm },
        { label: "Privacy shutter", value: s.privacyShutter },
        { label: "Smart card reader", value: s.smartCardReader },
      ],
    },
    {
      icon: Camera,
      title: "Camera & Audio",
      rows: [
        { label: "Webcam", value: s.webcam },
        { label: "Microphones", value: s.microphones },
        { label: "Speakers", value: s.speakers },
        { label: "Audio features", value: s.audioFeatures },
      ],
    },
    {
      icon: Keyboard,
      title: "Keyboard & Input",
      rows: [
        { label: "Backlit keyboard", value: s.backlitKeyboard },
        { label: "RGB keyboard", value: s.rgbKeyboard },
        { label: "Layout", value: s.keyboardLayout },
        { label: "Numpad", value: s.numpad },
        { label: "Stylus support", value: s.stylusSupport },
      ],
    },
    {
      icon: Box,
      title: "Build & Features",
      rows: [
        { label: "Build material", value: s.buildMaterial },
        { label: "Military certification", value: s.militaryCertification },
        { label: "Cooling system", value: s.coolingSystem },
        { label: "Fans", value: s.fans },
        { label: "Warranty", value: s.warranty },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((sec) => (
          <Section key={sec.title} icon={sec.icon} title={sec.title}>
            {sec.rows.map((row) => (
              <SpecRow key={row.label} label={row.label} value={row.value} />
            ))}
          </Section>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Laptop className="w-4 h-4 text-gen-accent" />
          <h3 className="text-sm font-semibold text-gen-fg">Ports & Operating System</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {s.ports.map((port) => (
            <Badge key={port} variant="outline">{port}</Badge>
          ))}
          {s.ports.length === 0 && <span className="text-sm text-gen-muted italic">{NA}</span>}
        </div>
        <p className="text-sm text-gen-fg">{s.os}</p>
      </Card>
    </div>
  );
}