// HP EliteBook generator engine
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const q = s => `"${s}"`, QU = s => `'${s}'`;

const CPUs = {
  i5_8250U:["Intel Core i5-8250U","4C/8T",58,"Intel UHD Graphics 620",14],
  i7_8550U:["Intel Core i7-8550U","4C/8T",68,"Intel UHD Graphics 620",14],
  i5_8265U:["Intel Core i5-8265U","4C/8T",60,"Intel UHD Graphics 620",14],
  i7_8565U:["Intel Core i7-8565U","4C/8T",70,"Intel UHD Graphics 620",14],
  i5_10210U:["Intel Core i5-10210U","4C/8T",62,"Intel UHD Graphics",16],
  i7_10510U:["Intel Core i7-10510U","4C/8T",72,"Intel UHD Graphics",16],
  i5_1135G7:["Intel Core i5-1135G7","4C/8T",68,"Intel Iris Xe",28],
  i7_1165G7:["Intel Core i7-1165G7","4C/8T",76,"Intel Iris Xe",32],
  i5_1145G7:["Intel Core i5-1145G7","4C/8T",66,"Intel Iris Xe",28],
  i5_1235U:["Intel Core i5-1235U","10C/12T",72,"Intel Iris Xe",28],
  i5_1240P:["Intel Core i5-1240P","12C/16T",78,"Intel Iris Xe",30],
  i7_1255U:["Intel Core i7-1255U","10C/12T",80,"Intel Iris Xe",32],
  i7_1260P:["Intel Core i7-1260P","12C/16T",84,"Intel Iris Xe",34],
  i5_1335U:["Intel Core i5-1335U","10C/12T",74,"Intel Iris Xe",28],
  i5_1340P:["Intel Core i5-1340P","12C/16T",80,"Intel Iris Xe",30],
  i7_1355U:["Intel Core i7-1355U","10C/12T",82,"Intel Iris Xe",32],
  i7_1360P:["Intel Core i7-1360P","12C/16T",86,"Intel Iris Xe",34],
  u5_125U:["Intel Core Ultra 5 125U","12C/14T",78,"Intel Arc iGPU",35],
  u5_125H:["Intel Core Ultra 5 125H","14C/18T",82,"Intel Arc iGPU",38],
  u7_155U:["Intel Core Ultra 7 155U","12C/14T",84,"Intel Arc iGPU",36],
  u7_155H:["Intel Core Ultra 7 155H","14C/18T",88,"Intel Arc iGPU",40],
  u5_135U:["Intel Core Ultra 5 135U","12C/14T",80,"Intel Arc iGPU",36],
  u7_165U:["Intel Core Ultra 7 165U","12C/14T",86,"Intel Arc iGPU",38],
  r5_5650U:["AMD Ryzen 5 5650U","6C/12T",70,"AMD Radeon Graphics",22],
  r7_5850U:["AMD Ryzen 7 5850U","8C/16T",80,"AMD Radeon Graphics",25],
  r5_7530U:["AMD Ryzen 5 7530U","6C/12T",72,"AMD Radeon Graphics",22],
  r7_7730U:["AMD Ryzen 7 7730U","8C/16T",82,"AMD Radeon Graphics",25],
  r5_PRO_7530U:["AMD Ryzen 5 PRO 7530U","6C/12T",72,"AMD Radeon Graphics",22],
  r7_PRO_7730U:["AMD Ryzen 7 PRO 7730U","8C/16T",82,"AMD Radeon Graphics",25],
};

const PORTS = {
  P5:["USB-C","USB-A x2","HDMI 1.4","RJ-45","3.5mm"],
  P6:["USB-C x2","USB-A x2","HDMI 1.4","RJ-45","3.5mm"],
  P7:["USB-C x2","USB-A x2","HDMI 1.4","RJ-45","3.5mm"],
  P8:["USB-C x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  P9:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  P10:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  P11:["Thunderbolt 4 x2","USB-A x2","HDMI 2.1","RJ-45","3.5mm"],
  TB4:["Thunderbolt 4 x2","USB-A","3.5mm"],
  TB4_HDMI:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","3.5mm"],
  TB4_HDMI_RJ:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  TB3:["Thunderbolt 3 x2","USB-A x2","HDMI 1.4","3.5mm"],
  USB_C:["USB-C x2","USB-A x2","3.5mm"],
  PREMIUM:["Thunderbolt 4 x2","USB-A","HDMI 2.1","nano-SIM","3.5mm"],
  ULTRA:["Thunderbolt 4 x2","USB-A","3.5mm"],
};

// JSON format per model: [id,name,year,base,desc,ds,bc,bt,portsKey,[variants]]
// JSON format per variant: [id,name,cpuKey,ram,storage,weight,price,rating,reviews,desc,extras?]
// extras: {res:"...",pt:"...",br:"...",ramT:"...",os:"..."}

function emitVariant(v) {
  const [id,name,cpuKey,ram,stor,w,price,rating,rev,desc,ex] = v;
  const c = CPUs[cpuKey];
  if (!c) throw new Error("Unknown CPU: " + cpuKey);
  const p = ex || {};
  const parts = [
    `cpu:${q(c[0])}`,`cores:${q(c[1])}`,`cs:${c[2]}`,
    `gpu:${q(c[3])}`,`gs:${c[4]}`,`ram:${ram}`,
    `ramType:${q(p.ramT||"DDR4")}`,`storage:${stor}`,
    `storageType:${q("NVMe")}`,`display:${QU(name.includes("4K")? '14.0" 4K (3840×2160) IPS 400 nits' : name.includes("WQHD")? '14.0" WQHD (2560×1440) IPS 400 nits' : name.includes("OLED")? '14.0" 2.8K OLED (2880×1800) 400 nits' : name.includes("13")? '13.3" FHD (1920×1080) IPS 250 nits' : name.includes("15")? '15.6" FHD (1920×1080) IPS 250 nits' : '14.0" FHD (1920×1080) IPS 250 nits')}`,
    `displaySize:${v.ds || 14}`,
    `displayRefreshRate:${p.ref||60}`,
  ];
  if(p.res) parts.push(`resolution:${q(p.res)}`);
  if(p.pt) parts.push(`panelType:${q(p.pt)}`);
  if(p.br) parts.push(`brightness:${q(p.br)}`);
  parts.push(
    `batteryLife:${p.bt||v.bt||9}`,`batteryCapacity:${q(p.bc||v.bc||"45Wh")}`,
    `weight:${w}`,`ports:[${(PORTS[v.pk]||PORTS.P8).map(q).join(",")}]`,
    `os:${q(p.os||"Windows 11 Pro")}`
  );
  return `V(${q(id)},${q(name)},${price},${rating},${rev},${q(desc)},{${parts.join(",")}})`;
}

function emitModels(exportName, data, outFile) {
  const lines = [`import { base, P, V } from "./hp-common.mjs";`,``, `export const ${exportName} = [`];
  for (const m of data) {
    const [id,name,year,base,desc,ds,bc,bt,pk,vars] = m;
    lines.push(`  {id:${q(id)},name:${q(name)},year:${year},base:${base},desc:${q(desc)},variants:[`);
    for (const v of vars) {
      v.ds = v.ds || ds; v.bc = v.bc || bc; v.bt = v.bt || bt; v.pk = v.pk || pk;
      lines.push(`    ${emitVariant(v)},`);
    }
    lines.push(`  ]},`);
  }
  lines.push(`];`);
  writeFileSync(outFile, lines.join("\n"));
}

// Read all JSON data files from scripts/hp-data/ and emit .mjs modules
const dataDir = "scripts/hp-data";
const files = readdirSync(dataDir).filter(f => f.endsWith(".json")).sort();
for (const f of files) {
  const raw = JSON.parse(readFileSync(join(dataDir, f), "utf8"));
  const exportName = raw.export;
  const outMjs = "scripts/" + raw.file;
  emitModels(exportName, raw.models, outMjs);
  console.log(`${f} -> ${outMjs} (${raw.models.length} models)`);
}
