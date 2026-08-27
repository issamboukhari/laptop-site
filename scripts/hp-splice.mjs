// HP EliteBook splice - inserts generated HP data into computers.ts + index.html
import { readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const write = (p, s) => writeFileSync(p, s);

const baseTS = read("scripts/hp-out/hp-base.ts.txt");
const modelsTS = read("scripts/hp-out/hp-models.ts.txt");
const baseHTML = read("scripts/hp-out/hp-base.html.txt");
const modelsHTML = read("scripts/hp-out/hp-models.html.txt");

/* ---------- computers.ts ---------- */
let ts = read("lib/data/computers.ts");

// Remove old HP base entries (all lines from "hp-elitebook-860" block up to but not including "dell-latitude-9440")
const baseStart = ts.indexOf('  "hp-elitebook-860": {');
const baseEnd = ts.indexOf('\n  "dell-latitude-9440": {');
if (baseStart >= 0 && baseEnd >= 0 && baseStart < baseEnd) {
  ts = ts.slice(0, baseStart) + ts.slice(baseEnd + 1);
}

// Insert HP base before Dell
const baseIdx = ts.indexOf('"dell-latitude-9440": {');
if (baseIdx < 0) throw new Error("base marker not found in computers.ts");
const prevNL = ts.lastIndexOf("\n", baseIdx);
ts = ts.slice(0, prevNL + 1) + baseTS + "\n" + ts.slice(prevNL + 1);

// Remove old HP model entries (from {id: "hp-elitebook-860" block up to { id: "dell-latitude-9440")
const modelBlockStart = ts.indexOf('    id: "hp-elitebook-860",');
if (modelBlockStart >= 0) {
  // Find the opening { of this model block
  const openBrace = ts.lastIndexOf("{", modelBlockStart);
  // Find the closing },\n for this model
  let depth = 0;
  let closeIdx = -1;
  for (let i = openBrace; i < ts.length; i++) {
    if (ts[i] === "{") depth++;
    else if (ts[i] === "}") {
      depth--;
      if (depth === 0) { closeIdx = i; break; }
    }
  }
  if (closeIdx >= 0) {
    // Include the comma and newlines after the closing brace
    let endCut = closeIdx + 1;
    while (endCut < ts.length && (ts[endCut] === "," || ts[endCut] === "\n" || ts[endCut] === " ")) endCut++;
    ts = ts.slice(0, openBrace) + ts.slice(endCut);
  }
}

// Insert HP models before Dell model
const modelIdx = ts.indexOf('{\n    id: "dell-latitude-9440",');
if (modelIdx < 0) throw new Error("model marker not found in computers.ts");
ts = ts.slice(0, modelIdx) + modelsTS + "\n\n" + ts.slice(modelIdx);
write("lib/data/computers.ts", ts);
console.log("computers.ts: HP base + models synced");

/* ---------- index.html ---------- */
let html = read("index.html");

// Remove old HP models
html = removeHTMLBlock(html, '{id:"hp-elitebook-860"', '{id:"dell-latitude-9440"');
// Insert HP models
const hModelsIdx = html.indexOf('{id:"dell-latitude-9440"');
if (hModelsIdx < 0) throw new Error("models marker not found in index.html");
html = html.slice(0, hModelsIdx) + modelsHTML + "\n" + html.slice(hModelsIdx);

// Remove old HP base
html = removeHTMLBlock(html, '"hp-elitebook-860":{', '"dell-latitude-9440":{');
// Insert HP base
const hBaseIdx = html.indexOf('"dell-latitude-9440":{');
if (hBaseIdx < 0) throw new Error("base marker not found in index.html");
html = html.slice(0, hBaseIdx) + baseHTML + "\n" + html.slice(hBaseIdx);
write("index.html", html);
console.log("index.html: HP base + models synced");

/* ---------- public/index.html ---------- */
let pub = read("public/index.html");

pub = removeHTMLBlock(pub, '{id:"hp-elitebook-860"', '{id:"dell-latitude-9440"');
const pModelsIdx = pub.indexOf('{id:"dell-latitude-9440"');
if (pModelsIdx < 0) throw new Error("models marker not found in public/index.html");
pub = pub.slice(0, pModelsIdx) + modelsHTML + "\n" + pub.slice(pModelsIdx);

pub = removeHTMLBlock(pub, '"hp-elitebook-860":{', '"dell-latitude-9440":{');
const pBaseIdx = pub.indexOf('"dell-latitude-9440":{');
if (pBaseIdx < 0) throw new Error("base marker not found in public/index.html");
pub = pub.slice(0, pBaseIdx) + baseHTML + "\n" + pub.slice(pBaseIdx);
write("public/index.html", pub);
console.log("public/index.html: HP base + models synced");

function removeHTMLBlock(text, startAnchor, endAnchor) {
  const start = text.indexOf(startAnchor);
  const end = text.indexOf(endAnchor);
  if (start < 0 || end < 0 || start >= end) return text;
  return text.slice(0, start) + text.slice(end);
}
