// Splice generated ThinkPad fragments into computers.ts, index.html, public/index.html.
// Idempotent: removes any previously inserted block before inserting fresh.
import { readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const write = (p, s) => writeFileSync(p, s);

const baseTS = read("scripts/out/thinkpad-base.ts.txt");
const modelsTS = read("scripts/out/thinkpad-models.ts.txt");
const baseHTML = read("scripts/out/thinkpad-base.html.txt");
const modelsHTML = read("scripts/out/thinkpad-models.html.txt");

const FIRST_ID = "lenovo-thinkpad-e460";

// Remove a previously inserted block: from the fragment's first entry (anchored on
// FIRST_ID) up to (not including) the given insert marker. Returns cleaned text.
function removeBlock(text, startAnchor, insertMarker) {
  const start = text.indexOf(startAnchor);
  const end = text.indexOf(insertMarker);
  if (start < 0 || end < 0 || start >= end) return text; // not present
  return text.slice(0, start) + text.slice(end);
}

/* ---------- computers.ts ---------- */
let ts = read("lib/data/computers.ts");

// 1. remove old base block if present (skip the trailing newline so `  },\n};` re-forms)
const firstBaseTS = `  "${FIRST_ID}": {`;
const fBaseIdx = ts.indexOf(firstBaseTS);
if (fBaseIdx >= 0) {
  const eBaseIdx = ts.indexOf("\n};", fBaseIdx) + 1;
  if (eBaseIdx > fBaseIdx) ts = ts.slice(0, fBaseIdx) + ts.slice(eBaseIdx);
}

// 2. insert base
const baseIdx = ts.lastIndexOf("  },\n};");
if (baseIdx < 0) throw new Error("base marker not found in computers.ts");
ts = ts.slice(0, baseIdx) + "  },\n" + baseTS + "\n};" + ts.slice(baseIdx + "  },\n};".length);

// 3. remove old models block if present (anchor includes the block's opening `{`)
const modelMarker = '  {\n    id: "dell-latitude-9440",';
ts = removeBlock(ts, `  {\n    id: "${FIRST_ID}",`, modelMarker);

// 4. insert models
const modelIdx = ts.indexOf(modelMarker);
if (modelIdx < 0) throw new Error("model marker not found in computers.ts");
ts = ts.slice(0, modelIdx) + modelsTS + "\n\n" + ts.slice(modelIdx);
write("lib/data/computers.ts", ts);
console.log("computers.ts: base + models synced");

/* ---------- index.html ---------- */
let html = read("index.html");
const hModelsMarker = '{id:"intel-nuc-14",name:"NUC 14 Pro"';
const hBaseMarker = '"dell-latitude-9440":{';

// models block: remove then insert
html = removeBlock(html, `{id:"${FIRST_ID}",`, hModelsMarker);
const hModelsIdx = html.indexOf(hModelsMarker);
if (hModelsIdx < 0) throw new Error("models marker not found in index.html");
html = html.slice(0, hModelsIdx) + modelsHTML + "\n" + html.slice(hModelsIdx);

// base block: remove then insert
html = removeBlock(html, `"${FIRST_ID}":{`, hBaseMarker);
const hBaseIdx = html.indexOf(hBaseMarker);
if (hBaseIdx < 0) throw new Error("base marker not found in index.html");
html = html.slice(0, hBaseIdx) + baseHTML + "\n" + html.slice(hBaseIdx);
write("index.html", html);
console.log("index.html: base + models synced");

/* ---------- public/index.html (identical mirror) ---------- */
let pub = read("public/index.html");

pub = removeBlock(pub, `{id:"${FIRST_ID}",`, hModelsMarker);
const pModelsIdx = pub.indexOf(hModelsMarker);
if (pModelsIdx < 0) throw new Error("models marker not found in public/index.html");
pub = pub.slice(0, pModelsIdx) + modelsHTML + "\n" + pub.slice(pModelsIdx);

pub = removeBlock(pub, `"${FIRST_ID}":{`, hBaseMarker);
const pBaseIdx = pub.indexOf(hBaseMarker);
if (pBaseIdx < 0) throw new Error("base marker not found in public/index.html");
pub = pub.slice(0, pBaseIdx) + baseHTML + "\n" + pub.slice(pBaseIdx);
write("public/index.html", pub);
console.log("public/index.html: base + models synced");