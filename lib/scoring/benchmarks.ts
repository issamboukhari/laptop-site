/**
 * CPU and GPU benchmark data for scoring purposes.
 *
 * CPU scores are Geekbench 6 (single-core, multi-core) and Cinebench R23.
 * GPU scores are 3DMark Time Spy graphics scores.
 *
 * Sources:
 *   - Geekbench Browser (https://browser.geekbench.com)
 *   - Notebookcheck.net
 *   - TechPowerUp GPU Database
 *   - Cinebench official results
 */

export interface CpuBenchmark {
  name: string;
  patterns: string[];
  /** Geekbench 6 single-core */
  gb6Single: number;
  /** Geekbench 6 multi-core */
  gb6Multi: number;
  /** Cinebench R23 multi-core */
  cb23Multi: number;
  /** TDP in watts (approximate) */
  tdp: number;
}

export interface GpuBenchmark {
  name: string;
  patterns: string[];
  /** 3DMark Time Spy graphics score */
  timeSpy: number;
  /** TDP in watts (approximate) */
  tdp: number;
}

// ---------------------------------------------------------------------------
// CPU Benchmarks
// ---------------------------------------------------------------------------

export const CPU_BENCHMARKS: CpuBenchmark[] = [
  // =========================================================================
  // Intel Core Ultra 200 Series (Arrow Lake / Lunar Lake)
  // =========================================================================
  // --- HX (Arrow Lake-HX, 2025) ---
  {
    name: "Intel Core Ultra 9 285HX",
    patterns: ["core\\s*ultra\\s*9\\s*285hx", "ultra\\s*9\\s*285hx", "285hx"],
    gb6Single: 3100,
    gb6Multi: 20500,
    cb23Multi: 36000,
    tdp: 55,
  },
  {
    name: "Intel Core Ultra 7 275HX",
    patterns: ["core\\s*ultra\\s*7\\s*275hx", "ultra\\s*7\\s*275hx", "275hx"],
    gb6Single: 2950,
    gb6Multi: 18500,
    cb23Multi: 33000,
    tdp: 45,
  },
  {
    name: "Intel Core Ultra 5 265HX",
    patterns: ["core\\s*ultra\\s*5\\s*265hx", "ultra\\s*5\\s*265hx", "265hx"],
    gb6Single: 2850,
    gb6Multi: 16500,
    cb23Multi: 29000,
    tdp: 45,
  },
  {
    name: "Intel Core Ultra 5 245HX",
    patterns: ["core\\s*ultra\\s*5\\s*245hx", "ultra\\s*5\\s*245hx", "245hx"],
    gb6Single: 2700,
    gb6Multi: 14000,
    cb23Multi: 25000,
    tdp: 45,
  },

  // --- H (Arrow Lake-H, 2025) ---
  {
    name: "Intel Core Ultra 7 265H",
    patterns: ["core\\s*ultra\\s*7\\s*265h", "ultra\\s*7\\s*265h", "265h"],
    gb6Single: 2900,
    gb6Multi: 17500,
    cb23Multi: 31000,
    tdp: 45,
  },
  {
    name: "Intel Core Ultra 5 255H",
    patterns: ["core\\s*ultra\\s*5\\s*255h", "ultra\\s*5\\s*255h", "255h"],
    gb6Single: 2800,
    gb6Multi: 15500,
    cb23Multi: 27000,
    tdp: 35,
  },
  {
    name: "Intel Core Ultra 5 235H",
    patterns: ["core\\s*ultra\\s*5\\s*235h", "ultra\\s*5\\s*235h", "235h"],
    gb6Single: 2700,
    gb6Multi: 14000,
    cb23Multi: 24500,
    tdp: 35,
  },
  {
    name: "Intel Core Ultra 5 225H",
    patterns: ["core\\s*ultra\\s*5\\s*225h", "ultra\\s*5\\s*225h", "225h"],
    gb6Single: 2600,
    gb6Multi: 12500,
    cb23Multi: 22000,
    tdp: 35,
  },

  // --- V (Lunar Lake-V, 2024) ---
  {
    name: "Intel Core Ultra 7 258V",
    patterns: ["core\\s*ultra\\s*7\\s*258v", "ultra\\s*7\\s*258v", "258v"],
    gb6Single: 2800,
    gb6Multi: 11500,
    cb23Multi: 16000,
    tdp: 28,
  },
  {
    name: "Intel Core Ultra 5 238V",
    patterns: ["core\\s*ultra\\s*5\\s*238v", "ultra\\s*5\\s*238v", "238v"],
    gb6Single: 2650,
    gb6Multi: 10000,
    cb23Multi: 14000,
    tdp: 17,
  },

  // --- H (Meteor Lake-H, 2024) ---
  {
    name: "Intel Core Ultra 7 155H",
    patterns: [
      "core\\s*ultra\\s*7\\s*155h",
      "ultra\\s*7\\s*155h",
      "155h",
      "ultra\\s*7\\s*155",
    ],
    gb6Single: 2500,
    gb6Multi: 13000,
    cb23Multi: 19000,
    tdp: 45,
  },
  {
    name: "Intel Core Ultra 5 125H",
    patterns: ["core\\s*ultra\\s*5\\s*125h", "ultra\\s*5\\s*125h", "125h"],
    gb6Single: 2400,
    gb6Multi: 11000,
    cb23Multi: 16000,
    tdp: 45,
  },

  // --- U (Meteor Lake-U, 2024) ---
  {
    name: "Intel Core Ultra 7 155U",
    patterns: ["core\\s*ultra\\s*7\\s*155u", "ultra\\s*7\\s*155u", "155u"],
    gb6Single: 2350,
    gb6Multi: 9500,
    cb23Multi: 13000,
    tdp: 15,
  },
  {
    name: "Intel Core Ultra 5 125U",
    patterns: ["core\\s*ultra\\s*5\\s*125u", "ultra\\s*5\\s*125u", "125u"],
    gb6Single: 2250,
    gb6Multi: 8500,
    cb23Multi: 11500,
    tdp: 15,
  },
  {
    name: "Intel Core Ultra 3 100U",
    patterns: ["core\\s*ultra\\s*3\\s*100u", "ultra\\s*3\\s*100u", "100u"],
    gb6Single: 2100,
    gb6Multi: 6500,
    cb23Multi: 9000,
    tdp: 15,
  },

  // =========================================================================
  // Intel 14th Gen (Raptor Lake Refresh)
  // =========================================================================
  {
    name: "Intel Core i9-14900HX",
    patterns: ["i9[-\\s]*14900hx", "14900hx"],
    gb6Single: 2800,
    gb6Multi: 18000,
    cb23Multi: 30000,
    tdp: 55,
  },
  {
    name: "Intel Core i7-14700HX",
    patterns: ["i7[-\\s]*14700hx", "14700hx"],
    gb6Single: 2700,
    gb6Multi: 16500,
    cb23Multi: 27000,
    tdp: 55,
  },
  {
    name: "Intel Core i5-14500HX",
    patterns: ["i5[-\\s]*14500hx", "14500hx"],
    gb6Single: 2550,
    gb6Multi: 14000,
    cb23Multi: 23000,
    tdp: 45,
  },

  // =========================================================================
  // Intel 13th Gen (Raptor Lake)
  // =========================================================================
  {
    name: "Intel Core i9-13980HX",
    patterns: ["i9[-\\s]*13980hx", "13980hx"],
    gb6Single: 2750,
    gb6Multi: 17500,
    cb23Multi: 29000,
    tdp: 55,
  },
  {
    name: "Intel Core i7-13700HX",
    patterns: ["i7[-\\s]*13700hx", "13700hx"],
    gb6Single: 2600,
    gb6Multi: 15500,
    cb23Multi: 25000,
    tdp: 55,
  },
  {
    name: "Intel Core i5-13500HX",
    patterns: ["i5[-\\s]*13500hx", "13500hx"],
    gb6Single: 2450,
    gb6Multi: 13000,
    cb23Multi: 21000,
    tdp: 45,
  },

  // --- 14th Gen H-series ---
  {
    name: "Intel Core i9-14900H",
    patterns: ["i9[-\\s]*14900h(?!x)", "14900h(?!x)"],
    gb6Single: 2700,
    gb6Multi: 16500,
    cb23Multi: 27000,
    tdp: 45,
  },
  {
    name: "Intel Core i7-14700H",
    patterns: ["i7[-\\s]*14700h(?!x)", "14700h(?!x)"],
    gb6Single: 2600,
    gb6Multi: 15000,
    cb23Multi: 24500,
    tdp: 45,
  },
  {
    name: "Intel Core i5-14500H",
    patterns: ["i5[-\\s]*14500h(?!x)", "14500h(?!x)"],
    gb6Single: 2500,
    gb6Multi: 13000,
    cb23Multi: 21000,
    tdp: 45,
  },

  // --- 13th Gen P / U series ---
  {
    name: "Intel Core i7-1360P",
    patterns: ["i7[-\\s]*1360p", "1360p"],
    gb6Single: 2500,
    gb6Multi: 10500,
    cb23Multi: 15000,
    tdp: 28,
  },
  {
    name: "Intel Core i5-1340P",
    patterns: ["i5[-\\s]*1340p", "1340p"],
    gb6Single: 2350,
    gb6Multi: 9000,
    cb23Multi: 13000,
    tdp: 28,
  },
  {
    name: "Intel Core i7-1355U",
    patterns: ["i7[-\\s]*1355u", "1355u"],
    gb6Single: 2400,
    gb6Multi: 8500,
    cb23Multi: 12000,
    tdp: 15,
  },
  {
    name: "Intel Core i5-1335U",
    patterns: ["i5[-\\s]*1335u", "1335u"],
    gb6Single: 2250,
    gb6Multi: 7500,
    cb23Multi: 10500,
    tdp: 15,
  },
  {
    name: "Intel Core i3-1315U",
    patterns: ["i3[-\\s]*1315u", "1315u"],
    gb6Single: 2100,
    gb6Multi: 6000,
    cb23Multi: 8500,
    tdp: 15,
  },

  // =========================================================================
  // AMD Ryzen 9000 Series (Zen 5, 2025)
  // =========================================================================
  {
    name: "AMD Ryzen 9 9955HX",
    patterns: ["r9[-\\s]*9955hx", "ryzen\\s*9[-\\s]*9955hx", "9955hx"],
    gb6Single: 2950,
    gb6Multi: 19000,
    cb23Multi: 34000,
    tdp: 55,
  },
  {
    name: "AMD Ryzen 7 9855HX",
    patterns: ["r7[-\\s]*9855hx", "ryzen\\s*7[-\\s]*9855hx", "9855hx"],
    gb6Single: 2850,
    gb6Multi: 17000,
    cb23Multi: 30000,
    tdp: 45,
  },

  // =========================================================================
  // AMD Ryzen 8000 Series (Zen 4 + Zen 5, 2024)
  // =========================================================================
  {
    name: "AMD Ryzen 9 8945H",
    patterns: ["r9[-\\s]*8945h(?!s)", "ryzen\\s*9[-\\s]*8945h(?!s)", "8945h"],
    gb6Single: 2650,
    gb6Multi: 15500,
    cb23Multi: 26000,
    tdp: 45,
  },
  {
    name: "AMD Ryzen 7 8845H",
    patterns: ["r7[-\\s]*8845h(?!s)", "ryzen\\s*7[-\\s]*8845h(?!s)", "8845h"],
    gb6Single: 2550,
    gb6Multi: 14000,
    cb23Multi: 23500,
    tdp: 45,
  },
  {
    name: "AMD Ryzen 5 8645H",
    patterns: ["r5[-\\s]*8645h(?!s)", "ryzen\\s*5[-\\s]*8645h(?!s)", "8645h"],
    gb6Single: 2500,
    gb6Multi: 12000,
    cb23Multi: 20000,
    tdp: 45,
  },

  // --- HS series ---
  {
    name: "AMD Ryzen 9 8945HS",
    patterns: ["r9[-\\s]*8945hs", "ryzen\\s*9[-\\s]*8945hs", "8945hs"],
    gb6Single: 2600,
    gb6Multi: 14500,
    cb23Multi: 24500,
    tdp: 35,
  },
  {
    name: "AMD Ryzen 7 8845HS",
    patterns: ["r7[-\\s]*8845hs", "ryzen\\s*7[-\\s]*8845hs", "8845hs"],
    gb6Single: 2500,
    gb6Multi: 13000,
    cb23Multi: 22000,
    tdp: 35,
  },

  // --- U series ---
  {
    name: "AMD Ryzen 7 8840U",
    patterns: ["r7[-\\s]*8840u", "ryzen\\s*7[-\\s]*8840u", "8840u"],
    gb6Single: 2450,
    gb6Multi: 11500,
    cb23Multi: 17000,
    tdp: 15,
  },
  {
    name: "AMD Ryzen 5 8640U",
    patterns: ["r5[-\\s]*8640u", "ryzen\\s*5[-\\s]*8640u", "8640u"],
    gb6Single: 2350,
    gb6Multi: 10000,
    cb23Multi: 14500,
    tdp: 15,
  },

  // =========================================================================
  // AMD Ryzen 7000 Series (Zen 4, 2023)
  // =========================================================================
  {
    name: "AMD Ryzen 9 7945HX",
    patterns: ["r9[-\\s]*7945hx", "ryzen\\s*9[-\\s]*7945hx", "7945hx"],
    gb6Single: 2700,
    gb6Multi: 17500,
    cb23Multi: 30000,
    tdp: 55,
  },
  {
    name: "AMD Ryzen 7 7845HX",
    patterns: ["r7[-\\s]*7845hx", "ryzen\\s*7[-\\s]*7845hx", "7845hx"],
    gb6Single: 2600,
    gb6Multi: 15500,
    cb23Multi: 26000,
    tdp: 45,
  },
  {
    name: "AMD Ryzen 9 7940H",
    patterns: ["r9[-\\s]*7940h(?!s)", "ryzen\\s*9[-\\s]*7940h(?!s)", "7940h"],
    gb6Single: 2550,
    gb6Multi: 14000,
    cb23Multi: 23500,
    tdp: 45,
  },
  {
    name: "AMD Ryzen 7 7840H",
    patterns: ["r7[-\\s]*7840h(?!s)", "ryzen\\s*7[-\\s]*7840h(?!s)", "7840h"],
    gb6Single: 2500,
    gb6Multi: 13000,
    cb23Multi: 22000,
    tdp: 45,
  },
  {
    name: "AMD Ryzen 5 7640H",
    patterns: ["r5[-\\s]*7640h(?!s)", "ryzen\\s*5[-\\s]*7640h(?!s)", "7640h"],
    gb6Single: 2450,
    gb6Multi: 11500,
    cb23Multi: 19000,
    tdp: 45,
  },

  // --- HS series ---
  {
    name: "AMD Ryzen 7 7840HS",
    patterns: ["r7[-\\s]*7840hs", "ryzen\\s*7[-\\s]*7840hs", "7840hs"],
    gb6Single: 2450,
    gb6Multi: 12500,
    cb23Multi: 21000,
    tdp: 35,
  },
  {
    name: "AMD Ryzen 5 7640HS",
    patterns: ["r5[-\\s]*7640hs", "ryzen\\s*5[-\\s]*7640hs", "7640hs"],
    gb6Single: 2400,
    gb6Multi: 11000,
    cb23Multi: 18000,
    tdp: 35,
  },

  // --- U series ---
  {
    name: "AMD Ryzen 7 7840U",
    patterns: ["r7[-\\s]*7840u", "ryzen\\s*7[-\\s]*7840u", "7840u"],
    gb6Single: 2400,
    gb6Multi: 11000,
    cb23Multi: 16000,
    tdp: 15,
  },
  {
    name: "AMD Ryzen 5 7640U",
    patterns: ["r5[-\\s]*7640u", "ryzen\\s*5[-\\s]*7640u", "7640u"],
    gb6Single: 2350,
    gb6Multi: 10000,
    cb23Multi: 14500,
    tdp: 15,
  },

  // =========================================================================
  // Apple Silicon
  // =========================================================================
  {
    name: "Apple M4 Max",
    patterns: ["m4\\s*max", "apple\\s*m4\\s*max"],
    gb6Single: 4000,
    gb6Multi: 26000,
    cb23Multi: 42000,
    tdp: 40,
  },
  {
    name: "Apple M4 Pro",
    patterns: ["m4\\s*pro", "apple\\s*m4\\s*pro"],
    gb6Single: 3900,
    gb6Multi: 22000,
    cb23Multi: 35000,
    tdp: 30,
  },
  {
    name: "Apple M4",
    patterns: ["m4(?!\\s*(max|pro|mini))", "apple\\s*m4(?!\\s*(max|pro|mini))"],
    gb6Single: 3800,
    gb6Multi: 15000,
    cb23Multi: 24000,
    tdp: 22,
  },
  {
    name: "Apple M3 Max",
    patterns: ["m3\\s*max", "apple\\s*m3\\s*max"],
    gb6Single: 3300,
    gb6Multi: 23000,
    cb23Multi: 37000,
    tdp: 40,
  },
  {
    name: "Apple M3 Pro",
    patterns: ["m3\\s*pro", "apple\\s*m3\\s*pro"],
    gb6Single: 3200,
    gb6Multi: 18500,
    cb23Multi: 30000,
    tdp: 27,
  },
  {
    name: "Apple M3",
    patterns: ["m3(?!\\s*(max|pro|mini))", "apple\\s*m3(?!\\s*(max|pro|mini))"],
    gb6Single: 3100,
    gb6Multi: 12500,
    cb23Multi: 20000,
    tdp: 22,
  },
  {
    name: "Apple M2 Max",
    patterns: ["m2\\s*max", "apple\\s*m2\\s*max"],
    gb6Single: 2900,
    gb6Multi: 21000,
    cb23Multi: 34000,
    tdp: 40,
  },
  {
    name: "Apple M2 Pro",
    patterns: ["m2\\s*pro", "apple\\s*m2\\s*pro"],
    gb6Single: 2850,
    gb6Multi: 17000,
    cb23Multi: 28000,
    tdp: 27,
  },
  {
    name: "Apple M2",
    patterns: ["m2(?!\\s*(max|pro|mini))", "apple\\s*m2(?!\\s*(max|pro|mini))"],
    gb6Single: 2750,
    gb6Multi: 10500,
    cb23Multi: 17500,
    tdp: 22,
  },
  {
    name: "Apple M1 Max",
    patterns: ["m1\\s*max", "apple\\s*m1\\s*max"],
    gb6Single: 2400,
    gb6Multi: 17500,
    cb23Multi: 28000,
    tdp: 40,
  },
  {
    name: "Apple M1 Pro",
    patterns: ["m1\\s*pro", "apple\\s*m1\\s*pro"],
    gb6Single: 2350,
    gb6Multi: 14500,
    cb23Multi: 24000,
    tdp: 27,
  },
  {
    name: "Apple M1",
    patterns: ["m1(?!\\s*(max|pro|mini))", "apple\\s*m1(?!\\s*(max|pro|mini))"],
    gb6Single: 2300,
    gb6Multi: 8500,
    cb23Multi: 15000,
    tdp: 20,
  },

  // =========================================================================
  // Intel N-series (Alder Lake-N, 2023)
  // =========================================================================
  {
    name: "Intel N200",
    patterns: ["n200"],
    gb6Single: 1400,
    gb6Multi: 4000,
    cb23Multi: 5500,
    tdp: 6,
  },
  {
    name: "Intel N100",
    patterns: ["n100"],
    gb6Single: 1300,
    gb6Multi: 3500,
    cb23Multi: 4800,
    tdp: 6,
  },
];

// ---------------------------------------------------------------------------
// GPU Benchmarks
// ---------------------------------------------------------------------------

export const GPU_BENCHMARKS: GpuBenchmark[] = [
  // =========================================================================
  // NVIDIA RTX 40 Series — Laptop
  // =========================================================================
  {
    name: "RTX 4090 Laptop",
    patterns: ["rtx\\s*4090.*lap", "4090.*lap", "4090\\s*m"],
    timeSpy: 21000,
    tdp: 150,
  },
  {
    name: "RTX 4080 Laptop",
    patterns: ["rtx\\s*4080.*lap", "4080.*lap", "4080\\s*m"],
    timeSpy: 18500,
    tdp: 150,
  },
  {
    name: "RTX 4070 Laptop",
    patterns: ["rtx\\s*4070.*lap", "4070.*lap", "4070\\s*m"],
    timeSpy: 14500,
    tdp: 115,
  },
  {
    name: "RTX 4060 Laptop",
    patterns: ["rtx\\s*4060.*lap", "4060.*lap", "4060\\s*m"],
    timeSpy: 12000,
    tdp: 115,
  },
  {
    name: "RTX 4050 Laptop",
    patterns: ["rtx\\s*4050.*lap", "4050.*lap", "4050\\s*m"],
    timeSpy: 9500,
    tdp: 100,
  },

  // =========================================================================
  // NVIDIA RTX 40 Series — Desktop
  // =========================================================================
  {
    name: "RTX 4090 Desktop",
    patterns: ["rtx\\s*4090(?!.*lap)", "4090(?!.*lap|m\\b)"],
    timeSpy: 36000,
    tdp: 450,
  },
  {
    name: "RTX 4080 Desktop",
    patterns: ["rtx\\s*4080(?!.*lap)", "4080(?!.*lap|m\\b)"],
    timeSpy: 28500,
    tdp: 320,
  },
  {
    name: "RTX 4070 Ti Desktop",
    patterns: ["rtx\\s*4070\\s*t[i]?(?!.*lap)", "4070\\s*t[i]?(?!.*lap|m\\b)"],
    timeSpy: 24500,
    tdp: 285,
  },
  {
    name: "RTX 4070 Desktop",
    patterns: ["rtx\\s*4070(?!.*lap|\\s*t)", "4070(?!.*lap|m\\b|\\s*t)"],
    timeSpy: 20000,
    tdp: 200,
  },
  {
    name: "RTX 4060 Desktop",
    patterns: ["rtx\\s*4060(?!.*lap)", "4060(?!.*lap|m\\b)"],
    timeSpy: 13000,
    tdp: 115,
  },

  // =========================================================================
  // NVIDIA RTX 30 Series — Laptop
  // =========================================================================
  {
    name: "RTX 3080 Ti Laptop",
    patterns: ["rtx\\s*3080\\s*t[i].*lap", "3080\\s*t[i].*lap", "3080ti.*lap"],
    timeSpy: 13500,
    tdp: 150,
  },
  {
    name: "RTX 3080 Laptop",
    patterns: ["rtx\\s*3080(?!.*t[i]).*lap", "3080(?!.*t[i]).*lap"],
    timeSpy: 12000,
    tdp: 150,
  },
  {
    name: "RTX 3070 Laptop",
    patterns: ["rtx\\s*3070.*lap", "3070.*lap"],
    timeSpy: 10500,
    tdp: 125,
  },
  {
    name: "RTX 3060 Laptop",
    patterns: ["rtx\\s*3060.*lap", "3060.*lap"],
    timeSpy: 8500,
    tdp: 115,
  },
  {
    name: "RTX 3050 Laptop",
    patterns: ["rtx\\s*3050.*lap", "3050.*lap"],
    timeSpy: 6000,
    tdp: 75,
  },

  // =========================================================================
  // NVIDIA GTX 16 Series
  // =========================================================================
  {
    name: "GTX 1660 Ti",
    patterns: ["gtx\\s*1660\\s*t[i]", "1660\\s*t[i]"],
    timeSpy: 6500,
    tdp: 80,
  },
  {
    name: "GTX 1650 Ti",
    patterns: ["gtx\\s*1650\\s*t[i]", "1650\\s*t[i]"],
    timeSpy: 4200,
    tdp: 50,
  },
  {
    name: "GTX 1650",
    patterns: ["gtx\\s*1650(?!\\s*t)", "1650(?!\\s*t)"],
    timeSpy: 3800,
    tdp: 50,
  },

  // =========================================================================
  // AMD Radeon RX 7000 Series — Desktop
  // =========================================================================
  {
    name: "RX 7950 XT",
    patterns: ["rx\\s*7950\\s*xt"],
    timeSpy: 27500,
    tdp: 350,
  },
  {
    name: "RX 7900 XTX",
    patterns: ["rx\\s*7900\\s*xtx"],
    timeSpy: 26000,
    tdp: 355,
  },
  {
    name: "RX 7900 XT",
    patterns: ["rx\\s*7900\\s*xt(?!x)"],
    timeSpy: 22000,
    tdp: 315,
  },
  {
    name: "RX 7800 XT",
    patterns: ["rx\\s*7800\\s*xt"],
    timeSpy: 18000,
    tdp: 263,
  },
  {
    name: "RX 7700 XT",
    patterns: ["rx\\s*7700\\s*xt"],
    timeSpy: 15500,
    tdp: 245,
  },
  {
    name: "RX 7600",
    patterns: ["rx\\s*7600(?!\\s*xt)"],
    timeSpy: 10500,
    tdp: 150,
  },
  {
    name: "RX 7500 XT",
    patterns: ["rx\\s*7500\\s*xt"],
    timeSpy: 8500,
    tdp: 120,
  },

  // =========================================================================
  // AMD Radeon RX 6000 Series — Desktop
  // =========================================================================
  {
    name: "RX 6800 XT",
    patterns: ["rx\\s*6800\\s*xt"],
    timeSpy: 17000,
    tdp: 300,
  },
  {
    name: "RX 6700 XT",
    patterns: ["rx\\s*6700\\s*xt"],
    timeSpy: 12000,
    tdp: 230,
  },
  {
    name: "RX 6600 XT",
    patterns: ["rx\\s*6600\\s*xt"],
    timeSpy: 8800,
    tdp: 160,
  },
  {
    name: "RX 6500 XT",
    patterns: ["rx\\s*6500\\s*xt"],
    timeSpy: 5000,
    tdp: 107,
  },

  // =========================================================================
  // Intel Arc / Iris
  // =========================================================================
  {
    name: "Intel Arc A770",
    patterns: ["arc\\s*a770"],
    timeSpy: 12500,
    tdp: 225,
  },
  {
    name: "Intel Arc A750",
    patterns: ["arc\\s*a750"],
    timeSpy: 11000,
    tdp: 225,
  },
  {
    name: "Intel Arc A380",
    patterns: ["arc\\s*a380"],
    timeSpy: 5800,
    tdp: 75,
  },
  {
    name: "Intel Iris Xe",
    patterns: ["iris\\s*xe", "intel\\s*xe"],
    timeSpy: 1800,
    tdp: 15,
  },

  // =========================================================================
  // AMD Radeon Integrated — 7000M / 8000M Series (iGPU)
  // =========================================================================
  {
    name: "AMD Radeon 780M",
    patterns: ["radeon\\s*780m", "780m"],
    timeSpy: 3500,
    tdp: 15,
  },
  {
    name: "AMD Radeon 760M",
    patterns: ["radeon\\s*760m", "760m"],
    timeSpy: 2800,
    tdp: 15,
  },
  {
    name: "AMD Radeon 680M",
    patterns: ["radeon\\s*680m", "680m"],
    timeSpy: 2900,
    tdp: 15,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Look up a CPU by name using case-insensitive pattern matching.
 * Returns the best matching `CpuBenchmark` or `null` if no match is found.
 * More specific patterns (longer regex) are tried first.
 */
export function lookupCpu(name: string): CpuBenchmark | null {
  const normalised = name.toLowerCase().trim();

  // Sort by pattern length descending so longer (more specific) patterns match first
  const sorted = [...CPU_BENCHMARKS].sort(
    (a, b) =>
      Math.max(...b.patterns.map((p) => p.length)) -
      Math.max(...a.patterns.map((p) => p.length)),
  );

  for (const cpu of sorted) {
    for (const pattern of cpu.patterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(normalised)) {
        return cpu;
      }
    }
  }

  return null;
}

/**
 * Look up a GPU by name using case-insensitive pattern matching.
 * Returns the best matching `GpuBenchmark` or `null` if no match is found.
 * More specific patterns (longer regex) are tried first.
 */
export function lookupGpu(name: string): GpuBenchmark | null {
  const normalised = name.toLowerCase().trim();

  const sorted = [...GPU_BENCHMARKS].sort(
    (a, b) =>
      Math.max(...b.patterns.map((p) => p.length)) -
      Math.max(...a.patterns.map((p) => p.length)),
  );

  for (const gpu of sorted) {
    for (const pattern of gpu.patterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(normalised)) {
        return gpu;
      }
    }
  }

  return null;
}
