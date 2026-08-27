import { readFileSync } from "node:fs";
const c = readFileSync("lib/data/computers.ts", "utf8");
const ids = [...c.matchAll(/id:\s*"(thinkpad[^"]+)"/g)].map(x => x[1]);
const fam = new Set(ids.map(i => i.split("-").slice(0, 3).join("-")));
console.log("Total models:", ids.length);
console.log("Families:", fam.size);
console.log([...fam].sort().join(", "));
