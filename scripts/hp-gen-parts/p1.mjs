// HP EliteBook generator - part 1: CPU presets + helpers
import { writeFileSync, appendFileSync } from "node:fs";

const q = s => `"${s}"`;

export const C = {
  i5_8250U:{cpu:"Intel Core i5-8250U",cores:"4C/8T",cs:58,gpu:"Intel UHD Graphics 620",gs:14},
  i7_8550U:{cpu:"Intel Core i7-8550U",cores:"4C/8T",cs:68,gpu:"Intel UHD Graphics 620",gs:14},
  i5_8265U:{cpu:"Intel Core i5-8265U",cores:"4C/8T",cs:60,gpu:"Intel UHD Graphics 620",gs:14},
  i7_8565U:{cpu:"Intel Core i7-8565U",cores:"4C/8T",cs:70,gpu:"Intel UHD Graphics 620",gs:14},
  i5_10210U:{cpu:"Intel Core i5-10210U",cores:"4C/8T",cs:62,gpu:"Intel UHD Graphics",gs:16},
  i7_10510U:{cpu:"Intel Core i7-10510U",cores:"4C/8T",cs:72,gpu:"Intel UHD Graphics",gs:16},
  i5_1135G7:{cpu:"Intel Core i5-1135G7",cores:"4C/8T",cs:68,gpu:"Intel Iris Xe",gs:28},
  i7_1165G7:{cpu:"Intel Core i7-1165G7",cores:"4C/8T",cs:76,gpu:"Intel Iris Xe",gs:32},
  i5_1145G7:{cpu:"Intel Core i5-1145G7",cores:"4C/8T",cs:66,gpu:"Intel Iris Xe",gs:28},
  i5_1235U:{cpu:"Intel Core i5-1235U",cores:"10C/12T",cs:72,gpu:"Intel Iris Xe",gs:28},
  i5_1240P:{cpu:"Intel Core i5-1240P",cores:"12C/16T",cs:78,gpu:"Intel Iris Xe",gs:30},
  i7_1255U:{cpu:"Intel Core i7-1255U",cores:"10C/12T",cs:80,gpu:"Intel Iris Xe",gs:32},
  i7_1260P:{cpu:"Intel Core i7-1260P",cores:"12C/16T",cs:84,gpu:"Intel Iris Xe",gs:34},
  i5_1335U:{cpu:"Intel Core i5-1335U",cores:"10C/12T",cs:74,gpu:"Intel Iris Xe",gs:28},
  i5_1340P:{cpu:"Intel Core i5-1340P",cores:"12C/16T",cs:80,gpu:"Intel Iris Xe",gs:30},
  i7_1355U:{cpu:"Intel Core i7-1355U",cores:"10C/12T",cs:82,gpu:"Intel Iris Xe",gs:32},
  i7_1360P:{cpu:"Intel Core i7-1360P",cores:"12C/16T",cs:86,gpu:"Intel Iris Xe",gs:34},
  ultra5_125U:{cpu:"Intel Core Ultra 5 125U",cores:"12C/14T",cs:78,gpu:"Intel Arc iGPU",gs:35},
  ultra5_125H:{cpu:"Intel Core Ultra 5 125H",cores:"14C/18T",cs:82,gpu:"Intel Arc iGPU",gs:38},
  ultra7_155U:{cpu:"Intel Core Ultra 7 155U",cores:"12C/14T",cs:84,gpu:"Intel Arc iGPU",gs:36},
  ultra7_155H:{cpu:"Intel Core Ultra 7 155H",cores:"14C/18T",cs:88,gpu:"Intel Arc iGPU",gs:40},
  ultra5_135U:{cpu:"Intel Core Ultra 5 135U",cores:"12C/14T",cs:80,gpu:"Intel Arc iGPU",gs:36},
  ultra7_165U:{cpu:"Intel Core Ultra 7 165U",cores:"12C/14T",cs:86,gpu:"Intel Arc iGPU",gs:38},
  r5_5650U:{cpu:"AMD Ryzen 5 5650U",cores:"6C/12T",cs:70,gpu:"AMD Radeon Graphics",gs:22},
  r7_5850U:{cpu:"AMD Ryzen 7 5850U",cores:"8C/16T",cs:80,gpu:"AMD Radeon Graphics",gs:25},
  r5_7530U:{cpu:"AMD Ryzen 5 7530U",cores:"6C/12T",cs:72,gpu:"AMD Radeon Graphics",gs:22},
  r7_7730U:{cpu:"AMD Ryzen 7 7730U",cores:"8C/16T",cs:82,gpu:"AMD Radeon Graphics",gs:25},
};
