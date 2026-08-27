// HP EliteBook data generator - compact helpers
import { writeFileSync } from "node:fs";

const q = s => `"${s}"`;
const QU = s => `'${s}'`;

export function emitVariant(v, ds, ports, bc, batt) {
  const c = v.c;
  const parts = [
    `cpu:${q(c.cpu)}`, `cores:${q(c.cores)}`, `cs:${c.cs}`,
    `gpu:${q(c.gpu)}`, `gs:${c.gs}`, `ram:${v.ram}`,
    `ramType:${q(v.ramT || "DDR4")}`, `storage:${v.stor}`,
    `storageType:${q("NVMe")}`, `display:${QU(v.disp)}`, `displaySize:${ds}`,
    `displayRefreshRate:${v.ref || 60}`,
  ];
  if (v.res) parts.push(`resolution:${q(v.res)}`);
  if (v.pt) parts.push(`panelType:${q(v.pt)}`);
  if (v.br) parts.push(`brightness:${q(v.br)}`);
  parts.push(
    `batteryLife:${v.bt || batt}`, `batteryCapacity:${q(v.bc || bc)}`,
    `weight:${v.w}`, `ports:[${ports.map(q).join(",")}]`, `os:${q(v.os || "Windows 11 Pro")}`
  );
  return `V(${q(v.id)},${q(v.name)},${v.pr},${v.ra},${v.rv},${q(v.desc)},{${parts.join(",")}})`;
}

export function emitFile(exportName, models, outFile) {
  const lines = [`import { base, P, V } from "./hp-common.mjs";`, ``, `export const ${exportName} = [`];
  for (const m of models) {
    lines.push(`  {id:${q(m.id)},name:${q(m.name)},year:${m.year},base:${m.base},desc:${q(m.desc)},variants:[`);
    for (const v of m.vars) {
      lines.push(`    ${emitVariant(v, m.ds, m.ports, m.bc, m.bt)},`);
    }
    lines.push(`  ]},`);
  }
  lines.push(`];`);
  writeFileSync(outFile, lines.join("\n"));
}
