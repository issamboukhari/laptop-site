// ThinkPad generator â€” emits TS + index.html fragments from the series datasets.
// Usage: node scripts/thinkpad-gen.mjs   (writes scripts/out/*.txt)
import { writeFileSync } from "node:fs";
import { E_SERIES } from "./thinkpad-data-e.mjs";
import { E_SERIES_EXPAND } from "./thinkpad-data-e-expand.mjs";
import { L_SERIES } from "./thinkpad-data-l.mjs";
import { L_SERIES_EXPAND } from "./thinkpad-data-l-expand.mjs";
import { T_SERIES } from "./thinkpad-data-t.mjs";
import { T_SERIES_EXPAND } from "./thinkpad-data-t-expand.mjs";
import { X_SERIES } from "./thinkpad-data-x.mjs";
import { X_SERIES_EXPAND } from "./thinkpad-data-x-expand.mjs";
import { P_SERIES } from "./thinkpad-data-p.mjs";
import { Z_SERIES } from "./thinkpad-data-z.mjs";
import { YOGA_SERIES } from "./thinkpad-data-yoga.mjs";
import { A_SERIES } from "./thinkpad-data-a.mjs";
import { R_SERIES } from "./thinkpad-data-r.mjs";
import { SL_SERIES } from "./thinkpad-data-sl.mjs";

const ALL = [
  ...E_SERIES, ...E_SERIES_EXPAND,
  ...L_SERIES, ...L_SERIES_EXPAND,
  ...T_SERIES, ...T_SERIES_EXPAND,
  ...X_SERIES, ...X_SERIES_EXPAND,
  ...P_SERIES, ...Z_SERIES, ...YOGA_SERIES,
  ...A_SERIES, ...R_SERIES, ...SL_SERIES,
];

/* ---------- spec emission (shared by TS + HTML) ---------- */
const q = (s) => `"${s}"`;
const sq = (s) => `'${s}'`;
const str = (s) => (s.includes('"') ? sq(s) : q(s));

function emitSpecs(o) {
  const parts = [];
  parts.push(`cpu:${q(o.cpu)}`);
  if (o.cores) parts.push(`cpuCores:${q(o.cores)}`);
  parts.push(`cpuScore:${o.cs}`);
  parts.push(`gpu:${q(o.gpu)}`);
  parts.push(`gpuScore:${o.gs}`);
  parts.push(`ram:${o.ram}`);
  if (o.ramT) parts.push(`ramType:${q(o.ramT)}`);
  if (o.ramS) parts.push(`ramSpeed:${q(o.ramS)}`);
  if (o.ru) parts.push(`ramUpgradeable:${q(o.ru)}`);
  parts.push(`storage:${o.storage}`);
  parts.push(`storageType:${q("NVMe")}`);
  if (o.ss) parts.push(`storageSlots:${q(o.ss)}`);
  parts.push(`display:${str(o.disp)}`);
  parts.push(`displaySize:${o.ds}`);
  if (o.res) parts.push(`resolution:${q(o.res)}`);
  parts.push(`displayRefreshRate:${o.ref ?? 60}`);
  if (o.pt) parts.push(`panelType:${q(o.pt)}`);
  if (o.br) parts.push(`brightness:${q(o.br)}`);
  parts.push(`batteryLife:${o.batt}`);
  if (o.bc) parts.push(`batteryCapacity:${q(o.bc)}`);
  parts.push(`weight:${o.w}`);
  parts.push(`ports:[${o.ports.map(q).join(",")}]`);
  parts.push(`os:${q(o.os)}`);
  return `{${parts.join(",")}}`;
}

function emitVariant(v, mYear) {
  return `{id:${q(v.id)},name:${q(v.name)},brand:${q("Lenovo")},category:${q("business-laptop")},price:${v.price},rating:${v.rating},reviewCount:${v.reviews},year:${v.year ?? mYear},description:${q(v.desc)},imageUrl:"",specs:${emitSpecs(v.o)}}`;
}

/* ---------- base-spec emission ---------- */
const BASE_ORDER = ["wifi", "bluetooth", "fingerprint", "faceRecognition", "irCamera", "tpm", "privacyShutter", "smartCardReader", "backlitKeyboard", "rgbKeyboard", "keyboardLayout", "numpad", "stylusSupport", "buildMaterial", "militaryCertification", "coolingSystem", "fans", "warranty"];

function emitBaseTS(id, b) {
  const lines = [];
  lines.push(`  ${q(id)}: {`);
  for (const k of BASE_ORDER) {
    if (b[k] === undefined) continue;
    lines.push(`    ${k}: ${typeof b[k] === "boolean" ? b[k] : q(String(b[k]))},`);
  }
  lines.push("  },");
  return lines.join("\n");
}

function emitBaseHTML(id, b) {
  const parts = [];
  for (const k of BASE_ORDER) {
    if (b[k] === undefined) continue;
    parts.push(`${k}:${typeof b[k] === "boolean" ? b[k] : q(String(b[k]))}`);
  }
  return `${q(id)}:{${parts.join(",")}},`;
}

/* ---------- model emission ---------- */
function emitModelTS(m) {
  const head = [
    "  {",
    `    id: ${q(m.id)},`,
    `    name: ${q(m.name)},`,
    `    brand: ${q("Lenovo")},`,
    `    category: ${q("business-laptop")},`,
    `    year: ${m.year},`,
    `    description: ${q(m.desc)},`,
    `    imageUrl: "",`,
    "    variants: [",
  ];
  const body = m.variants.map((v) => `      ${emitVariant(v, m.year)},`).join("\n");
  const tail = ["    ],", "  },"];
  return [...head, body, ...tail].join("\n");
}

function emitModelHTML(m) {
  const head = `{id:${q(m.id)},name:${q(m.name)},brand:${q("Lenovo")},category:${q("business-laptop")},year:${m.year},description:${q(m.desc)},imageUrl:"",variants:[`;
  const body = m.variants.map((v) => emitVariant(v, m.year) + ",").join("\n");
  return head + "\n" + body + "\n]},";
}

/* ---------- assembly ---------- */
const baseTS = ALL.map((m) => emitBaseTS(m.id, m.base)).join("\n");
const modelsTS = ALL.map(emitModelTS).join("\n\n");
const baseHTML = ALL.map((m) => emitBaseHTML(m.id, m.base)).join("\n");
const modelsHTML = ALL.map(emitModelHTML).join("\n");

writeFileSync("scripts/out/thinkpad-base.ts.txt", baseTS);
writeFileSync("scripts/out/thinkpad-models.ts.txt", modelsTS);
writeFileSync("scripts/out/thinkpad-base.html.txt", baseHTML);
writeFileSync("scripts/out/thinkpad-models.html.txt", modelsHTML);

const familyCount = new Set(ALL.map((m) => m.name.replace(/^(ThinkPad\s+)?/, "ThinkPad ").split(" ").slice(0, 3).join(" "))).size;
const totalVariants = ALL.reduce((n, m) => n + m.variants.length, 0);
console.log(`models: ${ALL.length}`);
console.log(`variants: ${totalVariants}`);
console.log(`series: E=${E_SERIES.length} L=${L_SERIES.length} T=${T_SERIES.length} X=${X_SERIES.length}`);
console.log(`families (approx by name): ${familyCount}`);
console.log(`base TS lines: ${baseTS.split("\n").length}`);
console.log(`base HTML lines: ${baseHTML.split("\n").length}`);
console.log("written: scripts/out/thinkpad-base.ts.txt, thinkpad-models.ts.txt, thinkpad-base.html.txt, thinkpad-models.html.txt");