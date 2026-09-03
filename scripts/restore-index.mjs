import { readFileSync, writeFileSync } from "fs";

const src = readFileSync("lib/data/computers.ts", "utf8");
let html = readFileSync("index.html", "utf8");

// 1. Extract computerModels array
const mExp = src.indexOf("export const computerModels: ComputerModel[] = [");
if (mExp < 0) throw new Error("computerModels not found");
let mStart = src.indexOf("[", mExp);
let depth = 0, mEnd = -1;
for (let i = mStart; i < src.length; i++) {
  if (src[i] === "[") depth++;
  else if (src[i] === "]") { depth--; if (depth === 0) { mEnd = i + 1; break; } }
}
const modelsArray = src.slice(mStart, mEnd);
console.log("models array:", modelsArray.length, "chars");

// 2. Extract MODEL_BASE_SPECS
const bExp = src.indexOf("export const MODEL_BASE_SPECS: Record<string, Partial<ComputerSpecs>> = {");
if (bExp < 0) throw new Error("MODEL_BASE_SPECS not found");
let bStart = src.indexOf("{", bExp);
depth = 0;
let bEnd = -1;
for (let i = bStart; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { bEnd = i + 1; break; } }
}
const specsObject = src.slice(bStart, bEnd);
console.log("specs object:", specsObject.length, "chars");

// 3. Extract helper functions used by enrichSpecs
function extractFn(name) {
  const re = new RegExp("(?:function|const)\\s+" + name + "\\s*[=(]");
  const m = src.match(re);
  if (!m) return "";
  const s = m.index;
  let d = 0, started = false;
  for (let i = s; i < src.length; i++) {
    if (src[i] === "{") { d++; started = true; }
    else if (src[i] === "}") { d--; if (started && d === 0) return src.slice(s, i + 1); }
  }
  return "";
}

const helpers = ["deriveResolution", "derivePanelType", "deriveAspectRatio", "countPort"]
  .map(n => extractFn(n)).filter(Boolean);

// 4. Extract enrichSpecs
const eSpecs = src.indexOf("export function enrichSpecs(specs: ComputerSpecs): ComputerSpecs {");
let eEnd = -1;
{
  let d = 0, started = false;
  for (let i = eSpecs; i < src.length; i++) {
    if (src[i] === "{") { d++; started = true; }
    else if (src[i] === "}") { d--; if (started && d === 0) { eEnd = i + 1; break; } }
  }
}
const enrichSpecsFn = src.slice(eSpecs, eEnd)
  .replace("export function enrichSpecs(specs: ComputerSpecs): ComputerSpecs", "function enrichSpecs(specs)");

// Build inline data block
const dataBlock = `
const models=${modelsArray};
const MODEL_BASE_SPECS=${specsObject};

${helpers.join("\n\n")}
${enrichSpecsFn}

function enrichVariant(modelId,variant){const base=MODEL_BASE_SPECS[modelId]??{};const merged={...base,...variant.specs};return{...variant,specs:enrichSpecs(merged)}}
models.forEach(m=>{m.variants=m.variants.map(v=>enrichVariant(m.id,v))});
`;

console.log("data block:", dataBlock.length, "chars");

// Now rebuild index.html
// Find the boundaries: from after ACCENTS line to before "function resolveImageUrl"
const resolveUrl = html.indexOf("function resolveImageUrl");

// The JS rest (from resolveImageUrl to end of script) - keep as-is
const jsRest = html.slice(resolveUrl);

// Build the full script section
const scriptStart = html.indexOf("<script>");
const beforeScript = html.slice(0, scriptStart);
const afterScript = html.slice(html.lastIndexOf("</script>"));

// Revert HTML structure
let htmlBody = html.slice(scriptStart, html.lastIndexOf("</script>"));

// Revert search input
htmlBody = htmlBody.replace(
  '<input type="text" id="searchInput" placeholder="Search computers... (e.g. HP EliteBook, ThinkPad, MacBook)" autocomplete="off" oninput="onSearchInput()">\n      <div class="autocomplete-dropdown" id="acDropdown" style="display:none"></div>\n      <button class="ai-search-btn" id="aiSearchBtn" onclick="doAiSearch()">\u2728 Search with AI</button>',
  '<input type="text" id="searchInput" placeholder="Search computers... (e.g. MacBook, RTX, gaming)" oninput="visibleCount=20;render()">'
);

// Revert filter section
htmlBody = htmlBody.replace(
  '<section class="filters"><div class="container"><div class="filter-row" id="filterRow"></div><div style="margin-top:8px"><button class="filter-toggle-btn" onclick="toggleFilterPanel()">\u2699\uFE0F Advanced Filters</button></div><div class="filter-panel" id="filterPanel"><div class="filter-grid" id="filterGrid"></div></div></div></section>',
  '<section class="filters"><div class="container"><div class="filter-row" id="filterRow"></div></div></section>'
);

// Remove AI banner
htmlBody = htmlBody.replace(
  '<div class="ai-banner" id="aiBanner"><span class="ai-badge">\u2728 AI</span><span id="aiBannerText">Discovered via AI Search</span><span class="ai-dismiss" onclick="dismissAiBanner()">\u2715</span></div>\n    <div class="grid" id="grid"></div>',
  '<div class="grid" id="grid"></div>'
);

// Now replace the script content: everything from <script> to </script>
const newScript = beforeScript + "<script>\n" + htmlBody.slice(htmlBody.indexOf("\nconst CATS=")) + dataBlock + jsRest + afterScript;

writeFileSync("index.html", newScript);
console.log("Written:", newScript.length, "chars");
console.log("Original:", html.length, "chars");
