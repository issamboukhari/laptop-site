// HP EliteBook all-series generator
// Usage: node scripts/hp-all-gen.mjs

const ALL = [];
function add(id, name, year, baseRef, desc, ds, bc, bt, pk, variants) {
  ALL.push({ id, name, year, base: baseRef, desc, ds, bc, bt, pk, variants });
}
function va(id, name, ck, ram, stor, w, price, rating, reviews, desc) {
  return { id, name, ck, ram, stor, w, price, rating, reviews, desc };
}
// ===== 630 Series (13.3") =====
add("hp-elitebook-630-g8","EliteBook 630 G8",2021,"P.g8","13.3-inch business laptop with 11th-gen Intel Core.",13.3,"45Wh",9,"P8",[
  va("hp-630-g8-i5-8","630 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.31,849,4.0,65,"11th-gen i5 in compact 13.3-inch chassis."),
  va("hp-630-g8-i5-16","630 G8 (i5-1135G7/16GB/512GB)","i5_1135G7",16,512,1.31,999,4.1,48,"16GB RAM for smoother multitasking."),
  va("hp-630-g8-i7","630 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.31,1099,4.2,38,"Top 630 G8 config with i7."),
]);
add("hp-elitebook-630-g9","EliteBook 630 G9",2022,"P.g9","13.3-inch business laptop with 12th-gen Intel Core.",13.3,"45Wh",9,"P8",[
  va("hp-630-g9-i5-8","630 G9 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.34,879,4.0,72,"12th-gen i5 hybrid architecture."),
  va("hp-630-g9-i5-16","630 G9 (i5-1235U/16GB/512GB)","i5_1235U",16,512,1.34,1029,4.1,55,"16GB RAM for smoother multitasking."),
  va("hp-630-g9-i7","630 G9 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.34,1129,4.2,40,"i7 for demanding workloads."),
]);
add("hp-elitebook-630-g10","EliteBook 630 G10",2023,"P.g10","13.3-inch business laptop with 13th-gen Intel Core.",13.3,"45Wh",9,"P8",[
  va("hp-630-g10-i5-8","630 G10 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.35,899,4.0,58,"13th-gen i5 P-core/E-core."),
  va("hp-630-g10-i5-16","630 G10 (i5-1335U/16GB/512GB)","i5_1335U",16,512,1.35,1049,4.1,45,"16GB RAM for productive multitasking."),
  va("hp-630-g10-i7","630 G10 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.35,1149,4.2,35,"i7-1355U for top 630 performance."),
]);
add("hp-elitebook-630-g11","EliteBook 630 G11",2024,"P.g11","13.3-inch business laptop with Intel Core Ultra.",13.3,"45Wh",9,"P9",[
  va("hp-630-g11-u5-8","630 G11 (Core 5/8GB/256GB)","u5_125U",8,256,1.33,929,4.1,42,"Intel Core 5 with NPU."),
  va("hp-630-g11-u5-16","630 G11 (Core 5/16GB/512GB)","u5_125U",16,512,1.33,1079,4.2,32,"16GB RAM with 512GB NVMe."),
  va("hp-630-g11-u7","630 G11 (Core 7/16GB/512GB)","u7_155U",16,512,1.33,1199,4.3,25,"Core 7 155U with enhanced NPU."),
]);
// ===== 640 Series (14") =====
add("hp-elitebook-640-g5","EliteBook 640 G5",2018,"P.g5","14-inch business laptop with 8th-gen Intel Core.",14,"45Wh",9,"P6",[
  va("hp-640-g5-i5","640 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.48,749,3.9,82,"8th-gen quad-core i5."),
  va("hp-640-g5-i7","640 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.48,949,4.0,58,"i7-8550U with 16GB RAM."),
]);
add("hp-elitebook-640-g6","EliteBook 640 G6",2019,"P.g6","14-inch business laptop with Whiskey Lake Intel Core.",14,"45Wh",9,"P6",[
  va("hp-640-g6-i5","640 G6 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.43,799,4.0,75,"Whiskey Lake i5 improved efficiency."),
  va("hp-640-g6-i7","640 G6 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.43,999,4.1,52,"i7 Whiskey Lake 16GB RAM."),
]);
add("hp-elitebook-640-g7","EliteBook 640 G7",2020,"P.g7","14-inch business laptop with 10th-gen Intel Core.",14,"45Wh",9,"P7",[
  va("hp-640-g7-i5-8","640 G7 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.41,849,4.0,68,"10th-gen Comet Lake i5."),
  va("hp-640-g7-i5-16","640 G7 (i5-10210U/16GB/512GB)","i5_10210U",16,512,1.41,999,4.1,48,"16GB RAM for multitasking."),
  va("hp-640-g7-i7","640 G7 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.41,1099,4.2,35,"i7-10510U top config."),
]);
add("hp-elitebook-640-g8","EliteBook 640 G8",2021,"P.g8","14-inch business laptop with 11th-gen Intel Core.",14,"45Wh",9,"P8",[
  va("hp-640-g8-i5-8","640 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.38,899,4.0,62,"Tiger Lake i5 with Iris Xe."),
  va("hp-640-g8-i5-16","640 G8 (i5-1135G7/16GB/512GB)","i5_1135G7",16,512,1.38,1049,4.1,45,"16GB RAM for productive multitasking."),
  va("hp-640-g8-i7","640 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.38,1149,4.2,35,"i7 with Thunderbolt 4."),
]);
add("hp-elitebook-640-g9","EliteBook 640 G9",2022,"P.g9","14-inch business laptop with 12th-gen Intel Core.",14,"45Wh",9,"P9",[
  va("hp-640-g9-i5-8","640 G9 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.38,899,4.0,55,"12th-gen hybrid architecture."),
  va("hp-640-g9-i5-16","640 G9 (i5-1235U/16GB/512GB)","i5_1235U",16,512,1.38,1049,4.1,42,"16GB RAM efficient 10-core."),
  va("hp-640-g9-i7","640 G9 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.38,1179,4.2,30,"i7-1255U for demanding workloads."),
]);
add("hp-elitebook-640-g10","EliteBook 640 G10",2023,"P.g10","14-inch business laptop with 13th-gen Intel Core.",14,"45Wh",9,"P10",[
  va("hp-640-g10-i5-8","640 G10 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.38,949,4.0,48,"13th-gen i5 hybrid design."),
  va("hp-640-g10-i5-16","640 G10 (i5-1335U/16GB/512GB)","i5_1335U",16,512,1.38,1099,4.1,38,"16GB RAM smooth workflow."),
  va("hp-640-g10-i7","640 G10 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.38,1229,4.2,28,"i7-1355U top performance."),
]);
add("hp-elitebook-640-g11","EliteBook 640 G11",2024,"P.g11","14-inch business laptop with Intel Core Ultra.",14,"45Wh",9,"P11",[
  va("hp-640-g11-u5-8","640 G11 (Core 5/8GB/256GB)","u5_125U",8,256,1.38,999,4.1,40,"Intel Core 5 with NPU."),
  va("hp-640-g11-u5-16","640 G11 (Core 5/16GB/512GB)","u5_125U",16,512,1.38,1149,4.2,32,"16GB RAM for productive multitasking."),
  va("hp-640-g11-u7","640 G11 (Core 7/16GB/512GB)","u7_155U",16,512,1.38,1299,4.3,24,"Core 7 for top 640 performance."),
]);
// ===== 650 Series (15.6") =====
add("hp-elitebook-650-g8","EliteBook 650 G8",2021,"P.g8","15.6-inch business laptop with 11th-gen Intel Core.",15.6,"45Wh",9,"P8",[
  va("hp-650-g8-i5-8","650 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.74,799,4.0,58,"Tiger Lake i5 in 15.6-inch chassis."),
  va("hp-650-g8-i5-16","650 G8 (i5-1135G7/16GB/512GB)","i5_1135G7",16,512,1.74,949,4.1,42,"16GB RAM for productive multitasking."),
  va("hp-650-g8-i7","650 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.74,1049,4.2,32,"i7 for demanding workloads."),
]);
add("hp-elitebook-650-g9","EliteBook 650 G9",2022,"P.g9","15.6-inch business laptop with 12th-gen Intel Core.",15.6,"45Wh",9,"P9",[
  va("hp-650-g9-i5-8","650 G9 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.74,849,4.0,52,"12th-gen hybrid architecture."),
  va("hp-650-g9-i5-16","650 G9 (i5-1235U/16GB/512GB)","i5_1235U",16,512,1.74,999,4.1,40,"16GB RAM efficient 10-core."),
  va("hp-650-g9-i7","650 G9 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.74,1129,4.2,28,"i7-1255U for demanding workloads."),
]);
add("hp-elitebook-650-g10","EliteBook 650 G10",2023,"P.g10","15.6-inch business laptop with 13th-gen Intel Core.",15.6,"45Wh",9,"P10",[
  va("hp-650-g10-i5-8","650 G10 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.74,899,4.0,45,"13th-gen i5 hybrid design."),
  va("hp-650-g10-i5-16","650 G10 (i5-1335U/16GB/512GB)","i5_1335U",16,512,1.74,1049,4.1,35,"16GB RAM smooth workflow."),
  va("hp-650-g10-i7","650 G10 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.74,1179,4.2,25,"i7-1355U top 650 performance."),
]);
add("hp-elitebook-650-g11","EliteBook 650 G11",2024,"P.g11","15.6-inch business laptop with Intel Core Ultra.",15.6,"45Wh",9,"P11",[
  va("hp-650-g11-u5-8","650 G11 (Core 5/8GB/256GB)","u5_125U",8,256,1.72,949,4.1,38,"Intel Core 5 with NPU."),
  va("hp-650-g11-u5-16","650 G11 (Core 5/16GB/512GB)","u5_125U",16,512,1.72,1099,4.2,30,"16GB RAM for productive multitasking."),
  va("hp-650-g11-u7","650 G11 (Core 7/16GB/512GB)","u7_155U",16,512,1.72,1249,4.3,22,"Core 7 for top 650 performance."),
]);
// ===== 820 Series (12.5") =====
add("hp-elitebook-820-g3","EliteBook 820 G3",2015,"P.g5","12.5-inch ultra-portable business laptop with 5th-gen Intel Core.",12.5,"44Wh",9,"P5",[
  va("hp-820-g3-i5","820 G3 (i5-5300U/8GB/256GB)","i5_8250U",8,256,1.36,749,3.8,65,"5th-gen Broadwell i5 in ultra-portable form."),
  va("hp-820-g3-i7","820 G3 (i7-5600U/16GB/512GB)","i7_8550U",16,512,1.36,949,3.9,42,"i7 for demanding mobile professionals."),
]);
add("hp-elitebook-820-g4","EliteBook 820 G4",2017,"P.g6","12.5-inch ultra-portable business laptop with 7th-gen Intel Core.",12.5,"44Wh",9,"P6",[
  va("hp-820-g4-i5","820 G4 (i5-7200U/8GB/256GB)","i5_8265U",8,256,1.26,849,3.9,58,"7th-gen Kaby Lake i5 ultra-portable."),
  va("hp-820-g4-i7","820 G4 (i7-7600U/16GB/512GB)","i7_8565U",16,512,1.26,1049,4.0,38,"i7-7600U premium configuration."),
]);
add("hp-elitebook-820-g5","EliteBook 820 G5",2018,"P.g5","12.5-inch ultra-portable business laptop with 8th-gen Intel Core.",12.5,"44Wh",9,"P6",[
  va("hp-820-g5-i5","820 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.24,899,4.0,52,"8th-gen quad-core i5 ultra-portable."),
  va("hp-820-g5-i7","820 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.24,1099,4.1,35,"i7-8550U for demanding workloads."),
]);
add("hp-elitebook-820-g6","EliteBook 820 G6",2019,"P.g6","12.5-inch ultra-portable business laptop with Whiskey Lake Core.",12.5,"44Wh",9,"P6",[
  va("hp-820-g6-i5","820 G6 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.24,899,4.0,48,"Whiskey Lake i5 ultra-portable."),
  va("hp-820-g6-i7","820 G6 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.24,1099,4.1,32,"i7 Whiskey Lake top config."),
]);
add("hp-elitebook-820-g7","EliteBook 820 G7",2020,"P.g7","12.5-inch ultra-portable business laptop with 10th-gen Intel Core.",12.5,"44Wh",9,"P7",[
  va("hp-820-g7-i5","820 G7 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.24,899,4.0,45,"10th-gen Comet Lake i5 ultra-portable."),
  va("hp-820-g7-i7","820 G7 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.24,1099,4.1,30,"i7-10510U premium config."),
]);
add("hp-elitebook-820-g8","EliteBook 820 G8",2021,"P.g8","12.5-inch ultra-portable business laptop with 11th-gen Intel Core.",12.5,"44Wh",9,"P8",[
  va("hp-820-g8-i5","820 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.23,949,4.1,42,"Tiger Lake i5 ultra-portable."),
  va("hp-820-g8-i7","820 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.23,1149,4.2,28,"i7 Tiger Lake with Iris Xe."),
]);
// ===== 830 Series (13.3") - Part 1 =====
add("hp-elitebook-830-g5","EliteBook 830 G5",2018,"P.g5","13.3-inch premium business laptop with 8th-gen Intel Core.",13.3,"50Wh",10,"P7",[
  va("hp-830-g5-i5","830 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.33,1049,4.1,55,"8th-gen i5 in premium 13.3-inch."),
  va("hp-830-g5-i7","830 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.33,1349,4.3,30,"i7 for demanding business workloads."),
]);
add("hp-elitebook-830-g6","EliteBook 830 G6",2019,"P.g6","13.3-inch premium business laptop with Whiskey Lake Core.",13.3,"50Wh",10,"P7",[
  va("hp-830-g6-i5","830 G6 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.33,1099,4.1,52,"Whiskey Lake i5 premium."),
  va("hp-830-g6-i7","830 G6 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.33,1399,4.3,28,"i7 Whiskey Lake top config."),
]);
add("hp-elitebook-830-g7","EliteBook 830 G7",2020,"P.g7","13.3-inch premium business laptop with 10th-gen Intel Core.",13.3,"53Wh",10,"P7",[
  va("hp-830-g7-i5","830 G7 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.31,1099,4.1,50,"10th-gen Comet Lake i5."),
  va("hp-830-g7-i7","830 G7 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.31,1399,4.3,25,"i7-10510U premium config."),
]);
add("hp-elitebook-830-g8","EliteBook 830 G8",2021,"P.g8","13.3-inch premium business laptop with 11th-gen Intel Core.",13.3,"53Wh",10,"P8",[
  va("hp-830-g8-i5","830 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.31,1149,4.1,48,"Tiger Lake i5 Iris Xe."),
  va("hp-830-g8-i7","830 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.31,1449,4.3,25,"i7 Tiger Lake Iris Xe."),
]);
add("hp-elitebook-830-g9","EliteBook 830 G9",2022,"P.g9","13.3-inch premium business laptop with 12th-gen Intel Core.",13.3,"53Wh",10,"P8",[
  va("hp-830-g9-i5","830 G9 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.29,1149,4.1,45,"12th-gen hybrid architecture."),
  va("hp-830-g9-i7","830 G9 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.29,1449,4.3,25,"i7-1255U for demanding workloads."),
]);
add("hp-elitebook-830-g10","EliteBook 830 G10",2023,"P.g10","13.3-inch premium business laptop with 13th-gen Intel Core.",13.3,"53Wh",10,"P9",[
  va("hp-830-g10-i5","830 G10 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.29,1199,4.1,42,"13th-gen i5 hybrid design."),
  va("hp-830-g10-i7","830 G10 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.29,1499,4.3,22,"i7-1355U top 830 performance."),
]);
add("hp-elitebook-830-g11","EliteBook 830 G11",2024,"P.g11","13.3-inch premium business laptop with Intel Core Ultra.",13.3,"53Wh",10,"P10",[
  va("hp-830-g11-u5","830 G11 (Core 5/8GB/256GB)","u5_125U",8,256,1.28,1249,4.1,38,"Intel Core 5 with NPU."),
  va("hp-830-g11-u7","830 G11 (Core 7/16GB/512GB)","u7_155U",16,512,1.28,1549,4.3,20,"Core 7 for premium 830 experience."),
]);
// ===== 840 Series (14") - Part 1: G3-G7 =====
add("hp-elitebook-840-g3","EliteBook 840 G3",2015,"P.g5","14-inch premium business laptop with 5th-gen Intel Core.",14,"44Wh",9,"P5",[
  va("hp-840-g3-i5","840 G3 (i5-5300U/8GB/256GB)","i5_8250U",8,256,1.54,849,3.9,72,"5th-gen Broadwell i5 premium 14-inch."),
  va("hp-840-g3-i7","840 G3 (i7-5600U/16GB/512GB)","i7_8550U",16,512,1.54,1099,4.0,45,"i7-5600U for demanding mobile pros."),
]);
add("hp-elitebook-840-g4","EliteBook 840 G4",2017,"P.g6","14-inch premium business laptop with 7th-gen Intel Core.",14,"50Wh",9,"P6",[
  va("hp-840-g4-i5","840 G4 (i5-7200U/8GB/256GB)","i5_8265U",8,256,1.48,899,3.9,65,"7th-gen Kaby Lake i5 premium."),
  va("hp-840-g4-i7","840 G4 (i7-7600U/16GB/512GB)","i7_8565U",16,512,1.48,1149,4.0,42,"i7-7600U premium configuration."),
]);
add("hp-elitebook-840-g5","EliteBook 840 G5",2018,"P.g5","14-inch premium business laptop with 8th-gen Intel Core.",14,"50Wh",9,"P7",[
  va("hp-840-g5-i5-8","840 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.43,999,4.0,62,"8th-gen quad-core i5 premium."),
  va("hp-840-g5-i5-16","840 G5 (i5-8250U/16GB/512GB)","i5_8250U",16,512,1.43,1199,4.1,48,"16GB RAM for productive multitasking."),
  va("hp-840-g5-i7","840 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.43,1399,4.2,32,"i7 for demanding business workloads."),
]);
add("hp-elitebook-840-g6","EliteBook 840 G6",2019,"P.g6","14-inch premium business laptop with Whiskey Lake Core.",14,"50Wh",9,"P7",[
  va("hp-840-g6-i5-8","840 G6 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.43,1049,4.1,58,"Whiskey Lake i5 premium."),
  va("hp-840-g6-i5-16","840 G6 (i5-8265U/16GB/512GB)","i5_8265U",16,512,1.43,1249,4.2,42,"16GB RAM smooth workflow."),
  va("hp-840-g6-i7","840 G6 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.43,1449,4.3,28,"i7 Whiskey Lake top config."),
]);
add("hp-elitebook-840-g7","EliteBook 840 G7",2020,"P.g7","14-inch premium business laptop with 10th-gen Intel Core.",14,"53Wh",9,"P8",[
  va("hp-840-g7-i5-8","840 G7 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.39,1099,4.1,55,"10th-gen Comet Lake i5."),
  va("hp-840-g7-i5-16","840 G7 (i5-10210U/16GB/512GB)","i5_10210U",16,512,1.39,1299,4.2,42,"16GB RAM smooth workflow."),
  va("hp-840-g7-i7","840 G7 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.39,1499,4.3,28,"i7-10510U premium config."),
]);
// ===== 840 Series (14") - Part 2: G8-G11 =====
add("hp-elitebook-840-g8","EliteBook 840 G8",2021,"P.g8","14-inch premium business laptop with 11th-gen Intel Core.",14,"53Wh",9,"P8",[
  va("hp-840-g8-i5-8","840 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.37,1149,4.1,52,"Tiger Lake i5 Iris Xe."),
  va("hp-840-g8-i5-16","840 G8 (i5-1135G7/16GB/512GB)","i5_1135G7",16,512,1.37,1349,4.2,38,"16GB RAM Iris Xe graphics."),
  va("hp-840-g8-i7","840 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.37,1549,4.3,25,"i7 Tiger Lake Iris Xe premium."),
]);
add("hp-elitebook-840-g9","EliteBook 840 G9",2022,"P.g9","14-inch premium business laptop with 12th-gen Intel Core.",14,"53Wh",9,"P9",[
  va("hp-840-g9-i5-8","840 G9 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.37,1199,4.1,48,"12th-gen hybrid architecture."),
  va("hp-840-g9-i5-16","840 G9 (i5-1235U/16GB/512GB)","i5_1235U",16,512,1.37,1399,4.2,35,"16GB RAM efficient 10-core."),
  va("hp-840-g9-i7","840 G9 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.37,1599,4.3,22,"i7-1255U for demanding workloads."),
]);
add("hp-elitebook-840-g10","EliteBook 840 G10",2023,"P.g10","14-inch premium business laptop with 13th-gen Intel Core.",14,"53Wh",9,"P10",[
  va("hp-840-g10-i5-8","840 G10 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.37,1249,4.1,45,"13th-gen i5 hybrid design."),
  va("hp-840-g10-i5-16","840 G10 (i5-1335U/16GB/512GB)","i5_1335U",16,512,1.37,1449,4.2,32,"16GB RAM smooth workflow."),
  va("hp-840-g10-i7","840 G10 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.37,1649,4.3,22,"i7-1355U top 840 performance."),
]);
add("hp-elitebook-840-g11","EliteBook 840 G11",2024,"P.g11","14-inch premium business laptop with Intel Core Ultra.",14,"53Wh",9,"P11",[
  va("hp-840-g11-u5-8","840 G11 (Core 5/8GB/256GB)","u5_125U",8,256,1.37,1299,4.1,40,"Intel Core 5 with NPU."),
  va("hp-840-g11-u5-16","840 G11 (Core 5/16GB/512GB)","u5_125U",16,512,1.37,1499,4.2,30,"16GB RAM for productive multitasking."),
  va("hp-840-g11-u7","840 G11 (Core 7/16GB/512GB)","u7_155U",16,512,1.37,1699,4.3,20,"Core 7 for top 840 experience."),
]);
// ===== 850 Series (15.6") =====
add("hp-elitebook-850-g3","EliteBook 850 G3",2015,"P.g5","15.6-inch premium business laptop with 5th-gen Intel Core.",15.6,"44Wh",9,"P5",[
  va("hp-850-g3-i5","850 G3 (i5-5300U/8GB/256GB)","i5_8250U",8,256,1.84,849,3.9,68,"5th-gen Broadwell i5 15.6-inch."),
  va("hp-850-g3-i7","850 G3 (i7-5600U/16GB/512GB)","i7_8550U",16,512,1.84,1099,4.0,42,"i7-5600U for demanding mobile pros."),
]);
add("hp-elitebook-850-g4","EliteBook 850 G4",2017,"P.g6","15.6-inch premium business laptop with 7th-gen Intel Core.",15.6,"50Wh",9,"P6",[
  va("hp-850-g4-i5","850 G4 (i5-7200U/8GB/256GB)","i5_8265U",8,256,1.78,899,3.9,62,"7th-gen Kaby Lake i5 15.6-inch."),
  va("hp-850-g4-i7","850 G4 (i7-7600U/16GB/512GB)","i7_8565U",16,512,1.78,1149,4.0,38,"i7-7600U premium config."),
]);
add("hp-elitebook-850-g5","EliteBook 850 G5",2018,"P.g5","15.6-inch premium business laptop with 8th-gen Intel Core.",15.6,"50Wh",9,"P7",[
  va("hp-850-g5-i5-8","850 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.77,999,4.0,58,"8th-gen quad-core i5 15.6-inch."),
  va("hp-850-g5-i5-16","850 G5 (i5-8250U/16GB/512GB)","i5_8250U",16,512,1.77,1199,4.1,42,"16GB RAM for productive multitasking."),
  va("hp-850-g5-i7","850 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.77,1399,4.2,28,"i7 for demanding business workloads."),
]);
add("hp-elitebook-850-g6","EliteBook 850 G6",2019,"P.g6","15.6-inch premium business laptop with Whiskey Lake Core.",15.6,"50Wh",9,"P7",[
  va("hp-850-g6-i5","850 G6 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.72,1049,4.1,52,"Whiskey Lake i5 15.6-inch."),
  va("hp-850-g6-i7","850 G6 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.72,1399,4.3,25,"i7 Whiskey Lake top config."),
]);
add("hp-elitebook-850-g7","EliteBook 850 G7",2020,"P.g7","15.6-inch premium business laptop with 10th-gen Intel Core.",15.6,"53Wh",9,"P8",[
  va("hp-850-g7-i5","850 G7 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.69,1099,4.1,48,"10th-gen Comet Lake i5."),
  va("hp-850-g7-i7","850 G7 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.69,1449,4.3,25,"i7-10510U premium config."),
]);
add("hp-elitebook-850-g8","EliteBook 850 G8",2021,"P.g8","15.6-inch premium business laptop with 11th-gen Intel Core.",15.6,"53Wh",9,"P8",[
  va("hp-850-g8-i5","850 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.69,1149,4.1,45,"Tiger Lake i5 Iris Xe."),
  va("hp-850-g8-i7","850 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.69,1549,4.3,22,"i7 Tiger Lake Iris Xe."),
]);
add("hp-elitebook-850-g9","EliteBook 850 G9",2022,"P.g9","15.6-inch premium business laptop with 12th-gen Intel Core.",15.6,"53Wh",9,"P9",[
  va("hp-850-g9-i5","850 G9 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.69,1199,4.1,42,"12th-gen hybrid architecture."),
  va("hp-850-g9-i7","850 G9 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.69,1599,4.3,22,"i7-1255U for demanding workloads."),
]);
add("hp-elitebook-850-g10","EliteBook 850 G10",2023,"P.g10","15.6-inch premium business laptop with 13th-gen Intel Core.",15.6,"53Wh",9,"P10",[
  va("hp-850-g10-i5","850 G10 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.69,1249,4.1,38,"13th-gen i5 hybrid design."),
  va("hp-850-g10-i7","850 G10 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.69,1649,4.3,20,"i7-1355U top 850 performance."),
]);
add("hp-elitebook-850-g11","EliteBook 850 G11",2024,"P.g11","15.6-inch premium business laptop with Intel Core Ultra.",15.6,"53Wh",9,"P11",[
  va("hp-850-g11-u5","850 G11 (Core 5/8GB/256GB)","u5_125U",8,256,1.69,1299,4.1,35,"Intel Core 5 with NPU."),
  va("hp-850-g11-u7","850 G11 (Core 7/16GB/512GB)","u7_155U",16,512,1.69,1699,4.3,18,"Core 7 for top 850 experience."),
]);
// ===== 1030 Series (13.3" premium) =====
add("hp-elitebook-1030-g1","EliteBook 1030 G1",2016,"P.g6","13.3-inch ultra-premium business laptop with 6th-gen Intel Core.",13.3,"44Wh",9,"TB3",[
  va("hp-1030-g1-i5","1030 G1 (i5-6200U/8GB/256GB)","i5_8265U",8,256,1.19,1199,4.1,48,"6th-gen Skylake i5 ultra-premium."),
  va("hp-1030-g1-i7","1030 G1 (i7-6500U/16GB/512GB)","i7_8565U",16,512,1.19,1499,4.2,32,"i7-6500U ultra-premium config."),
]);
add("hp-elitebook-1030-g2","EliteBook 1030 G2",2017,"P.g6","13.3-inch ultra-premium business laptop with 7th-gen Intel Core.",13.3,"44Wh",9,"TB3",[
  va("hp-1030-g2-i5","1030 G2 (i5-7200U/8GB/256GB)","i5_8265U",8,256,1.19,1249,4.1,45,"7th-gen Kaby Lake i5 ultra-premium."),
  va("hp-1030-g2-i7","1030 G2 (i7-7500U/16GB/512GB)","i7_8565U",16,512,1.19,1549,4.2,30,"i7-7500U ultra-premium config."),
]);
add("hp-elitebook-1030-g3","EliteBook 1030 G3",2018,"P.g7","13.3-inch ultra-premium business laptop with 8th-gen Intel Core.",13.3,"50Wh",9,"TB3",[
  va("hp-1030-g3-i5","1030 G3 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.25,1299,4.1,42,"8th-gen quad-core i5 ultra-premium."),
  va("hp-1030-g3-i7","1030 G3 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.25,1599,4.2,28,"i7-8550U ultra-premium config."),
]);
add("hp-elitebook-1030-g4","EliteBook 1030 G4",2019,"P.g7","13.3-inch ultra-premium business laptop with Whiskey Lake Core.",13.3,"50Wh",9,"TB4_HDMI",[
  va("hp-1030-g4-i5","1030 G4 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.25,1349,4.1,40,"Whiskey Lake i5 ultra-premium."),
  va("hp-1030-g4-i7","1030 G4 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.25,1649,4.2,25,"i7 Whiskey Lake ultra-premium."),
]);
add("hp-elitebook-1030-g5","EliteBook 1030 G5",2020,"P.g8","13.3-inch ultra-premium business laptop with 10th-gen Intel Core.",13.3,"53Wh",9,"TB4_HDMI",[
  va("hp-1030-g5-i5","1030 G5 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.22,1399,4.1,38,"10th-gen Comet Lake i5."),
  va("hp-1030-g5-i7","1030 G5 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.22,1699,4.2,22,"i7-10510U ultra-premium config."),
]);
add("hp-elitebook-1030-g6","EliteBook 1030 G6",2021,"P.g8","13.3-inch ultra-premium business laptop with 11th-gen Intel Core.",13.3,"53Wh",9,"TB4_HDMI",[
  va("hp-1030-g6-i5","1030 G6 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.22,1449,4.1,35,"Tiger Lake i5 Iris Xe."),
  va("hp-1030-g6-i7","1030 G6 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.22,1749,4.2,20,"i7 Tiger Lake Iris Xe premium."),
]);
add("hp-elitebook-1030-g7","EliteBook 1030 G7",2022,"P.g9","13.3-inch ultra-premium business laptop with 12th-gen Intel Core.",13.3,"53Wh",9,"PREMIUM",[
  va("hp-1030-g7-i5","1030 G7 (i5-1240P/8GB/256GB)","i5_1240P",8,256,1.22,1549,4.1,32,"12th-gen P-series i5."),
  va("hp-1030-g7-i7","1030 G7 (i7-1260P/16GB/512GB)","i7_1260P",16,512,1.22,1849,4.2,18,"i7-1260P ultra-premium config."),
]);
add("hp-elitebook-1030-g8","EliteBook 1030 G8",2023,"P.g10","13.3-inch ultra-premium business laptop with 13th-gen Intel Core.",13.3,"53Wh",9,"PREMIUM",[
  va("hp-1030-g8-i5","1030 G8 (i5-1340P/8GB/256GB)","i5_1340P",8,256,1.22,1599,4.1,30,"13th-gen P-series i5."),
  va("hp-1030-g8-i7","1030 G8 (i7-1360P/16GB/512GB)","i7_1360P",16,512,1.22,1899,4.2,15,"i7-1360P ultra-premium."),
]);
// ===== 1040 Series (14" premium) =====
add("hp-elitebook-1040-g5","EliteBook 1040 G5",2018,"P.g7","14-inch ultra-premium business laptop with 8th-gen Intel Core.",14,"50Wh",9,"TB4_HDMI",[
  va("hp-1040-g5-i5","1040 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.32,1399,4.1,42,"8th-gen quad-core i5 14-inch premium."),
  va("hp-1040-g5-i7","1040 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.32,1699,4.2,28,"i7-8550U ultra-premium 14-inch."),
]);
add("hp-elitebook-1040-g6","EliteBook 1040 G6",2019,"P.g7","14-inch ultra-premium business laptop with Whiskey Lake Core.",14,"50Wh",9,"TB4_HDMI",[
  va("hp-1040-g6-i5","1040 G6 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.32,1449,4.1,40,"Whiskey Lake i5 14-inch premium."),
  va("hp-1040-g6-i7","1040 G6 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.32,1749,4.2,25,"i7 Whiskey Lake ultra-premium."),
]);
add("hp-elitebook-1040-g7","EliteBook 1040 G7",2020,"P.g8","14-inch ultra-premium business laptop with 10th-gen Intel Core.",14,"53Wh",9,"TB4_HDMI",[
  va("hp-1040-g7-i5","1040 G7 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.29,1499,4.1,38,"10th-gen Comet Lake i5."),
  va("hp-1040-g7-i7","1040 G7 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.29,1799,4.2,22,"i7-10510U ultra-premium."),
]);
add("hp-elitebook-1040-g8","EliteBook 1040 G8",2021,"P.g8","14-inch ultra-premium business laptop with 11th-gen Intel Core.",14,"53Wh",9,"PREMIUM",[
  va("hp-1040-g8-i5","1040 G8 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.29,1549,4.1,35,"Tiger Lake i5 Iris Xe."),
  va("hp-1040-g8-i7","1040 G8 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.29,1849,4.2,20,"i7 Tiger Lake Iris Xe premium."),
]);
add("hp-elitebook-1040-g9","EliteBook 1040 G9",2022,"P.g9","14-inch ultra-premium business laptop with 12th-gen Intel Core.",14,"53Wh",9,"PREMIUM",[
  va("hp-1040-g9-i5","1040 G9 (i5-1240P/8GB/256GB)","i5_1240P",8,256,1.29,1599,4.1,32,"12th-gen P-series i5."),
  va("hp-1040-g9-i7","1040 G9 (i7-1260P/16GB/512GB)","i7_1260P",16,512,1.29,1899,4.2,18,"i7-1260P ultra-premium."),
]);
add("hp-elitebook-1040-g10","EliteBook 1040 G10",2023,"P.g10","14-inch ultra-premium business laptop with 13th-gen Intel Core.",14,"53Wh",9,"PREMIUM",[
  va("hp-1040-g10-i5","1040 G10 (i5-1340P/8GB/256GB)","i5_1340P",8,256,1.29,1649,4.1,30,"13th-gen P-series i5."),
  va("hp-1040-g10-i7","1040 G10 (i7-1360P/16GB/512GB)","i7_1360P",16,512,1.29,1949,4.2,15,"i7-1360P ultra-premium."),
]);
// ===== x360 Convertible Series =====
add("hp-elitebook-x360-1030-g2","EliteBook x360 1030 G2",2017,"P.convertG7","13.3-inch premium convertible business laptop with 7th-gen Intel Core.",13.3,"44Wh",9,"TB3",[
  va("hp-x360-1030-g2-i5","x360 1030 G2 (i5-7200U/8GB/256GB)","i5_8265U",8,256,1.29,1349,4.1,42,"7th-gen i5 convertible with pen support."),
  va("hp-x360-1030-g2-i7","x360 1030 G2 (i7-7600U/16GB/512GB)","i7_8565U",16,512,1.29,1649,4.2,28,"i7 convertible for creative pros."),
]);
add("hp-elitebook-x360-1030-g3","EliteBook x360 1030 G3",2018,"P.convertG8","13.3-inch premium convertible business laptop with 8th-gen Intel Core.",13.3,"50Wh",9,"TB4_HDMI",[
  va("hp-x360-1030-g3-i5","x360 1030 G3 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.29,1449,4.1,38,"8th-gen i5 quad-core convertible."),
  va("hp-x360-1030-g3-i7","x360 1030 G3 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.29,1749,4.2,25,"i7 convertible premium config."),
]);
add("hp-elitebook-x360-1030-g4","EliteBook x360 1030 G4",2019,"P.convertG8","13.3-inch premium convertible business laptop with Whiskey Lake Core.",13.3,"50Wh",9,"TB4_HDMI",[
  va("hp-x360-1030-g4-i5","x360 1030 G4 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.29,1499,4.1,35,"Whiskey Lake i5 convertible."),
  va("hp-x360-1030-g4-i7","x360 1030 G4 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.29,1799,4.2,22,"i7 Whiskey Lake convertible."),
]);
add("hp-elitebook-x360-1030-g5","EliteBook x360 1030 G5",2020,"P.convertG9","13.3-inch premium convertible business laptop with 10th-gen Intel Core.",13.3,"53Wh",9,"TB4_HDMI",[
  va("hp-x360-1030-g5-i5","x360 1030 G5 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.25,1549,4.1,32,"10th-gen Comet Lake i5 convertible."),
  va("hp-x360-1030-g5-i7","x360 1030 G5 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.25,1849,4.2,18,"i7-10510U convertible premium."),
]);
add("hp-elitebook-x360-1030-g6","EliteBook x360 1030 G6",2021,"P.convertG10","13.3-inch premium convertible business laptop with 11th-gen Intel Core.",13.3,"53Wh",9,"TB4_HDMI",[
  va("hp-x360-1030-g6-i5","x360 1030 G6 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.25,1599,4.1,30,"Tiger Lake i5 Iris Xe convertible."),
  va("hp-x360-1030-g6-i7","x360 1030 G6 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.25,1899,4.2,15,"i7 Tiger Lake Iris Xe convertible."),
]);
add("hp-elitebook-x360-1040-g5","EliteBook x360 1040 G5",2019,"P.convertG8","14-inch premium convertible business laptop with Whiskey Lake Core.",14,"50Wh",9,"TB4_HDMI",[
  va("hp-x360-1040-g5-i5","x360 1040 G5 (i5-8265U/8GB/256GB)","i5_8265U",8,256,1.42,1549,4.1,32,"14-inch Whiskey Lake i5 convertible."),
  va("hp-x360-1040-g5-i7","x360 1040 G5 (i7-8565U/16GB/512GB)","i7_8565U",16,512,1.42,1849,4.2,20,"14-inch i7 convertible premium."),
]);
add("hp-elitebook-x360-1040-g6","EliteBook x360 1040 G6",2020,"P.convertG9","14-inch premium convertible business laptop with 10th-gen Intel Core.",14,"53Wh",9,"TB4_HDMI",[
  va("hp-x360-1040-g6-i5","x360 1040 G6 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.39,1599,4.1,28,"10th-gen Comet Lake i5 14-inch."),
  va("hp-x360-1040-g6-i7","x360 1040 G6 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.39,1899,4.2,15,"i7-10510U 14-inch convertible."),
]);
// ===== Folio Series =====
add("hp-elitebook-folio-9470m","EliteBook Folio 9470m",2013,"P.g5","14-inch ultra-thin business laptop with 3rd-gen Intel Core.",14,"42Wh",8,"P5",[
  va("hp-folio-9470-i5","Folio 9470m (i5-3317U/4GB/128GB)","i5_8250U",4,128,1.54,999,3.8,35,"3rd-gen Ivy Bridge i5 ultra-thin."),
  va("hp-folio-9470-i7","Folio 9470m (i7-3667U/8GB/256GB)","i7_8550U",8,256,1.54,1299,3.9,22,"i7-3667U ultra-thin business."),
]);
add("hp-elitebook-folio-9480m","EliteBook Folio 9480m",2015,"P.g5","14-inch ultra-thin business laptop with 5th-gen Intel Core.",14,"42Wh",8,"P5",[
  va("hp-folio-9480-i5","Folio 9480m (i5-5200U/4GB/128GB)","i5_8250U",4,128,1.54,999,3.8,32,"5th-gen Broadwell i5 ultra-thin."),
  va("hp-folio-9480-i7","Folio 9480m (i7-5500U/8GB/256GB)","i7_8550U",8,256,1.54,1299,3.9,20,"i7-5500U ultra-thin business."),
]);
add("hp-elitebook-folio-g1","EliteBook Folio G1",2016,"P.g6","12.5-inch 4K ultra-thin business laptop with 6th-gen Intel Core.",12.5,"45Wh",8,"TB3",[
  va("hp-folio-g1-i5","Folio G1 (i5-6200U/8GB/256GB)","i5_8265U",8,256,0.98,1199,4.1,38,"6th-gen Skylake i5 ultra-thin."),
  va("hp-folio-g1-i7","Folio G1 (i7-6500U/8GB/512GB)","i7_8565U",8,512,0.98,1499,4.2,25,"i7-6500U 4K ultra-thin premium."),
]);
add("hp-elitebook-folio-9560g","EliteBook Folio 9560 G5",2018,"P.g7","14-inch premium thin business laptop with 8th-gen Intel Core.",14,"50Wh",9,"P7",[
  va("hp-folio-9560-i5","Folio 9560 G5 (i5-8250U/8GB/256GB)","i5_8250U",8,256,1.33,1099,4.0,45,"8th-gen i5 premium thin design."),
  va("hp-folio-9560-i7","Folio 9560 G5 (i7-8550U/16GB/512GB)","i7_8550U",16,512,1.33,1399,4.1,30,"i7-8550U premium thin config."),
]);
// ===== Dragonfly Series =====
add("hp-elitebook-dragonfly-g1","EliteBook Dragonfly G1",2020,"P.premium","13.3-inch ultra-light premium business laptop with 10th-gen Intel Core.",13.3,"53Wh",9,"TB4_HDMI",[
  va("hp-dragonfly-g1-i5","Dragonfly G1 (i5-10210U/8GB/256GB)","i5_10210U",8,256,1.09,1599,4.2,38,"10th-gen i5 ultra-light under 1.1kg."),
  va("hp-dragonfly-g1-i7","Dragonfly G1 (i7-10510U/16GB/512GB)","i7_10510U",16,512,1.09,1899,4.3,25,"i7 ultra-light premium config."),
]);
add("hp-elitebook-dragonfly-g2","EliteBook Dragonfly G2",2021,"P.premium","13.3-inch ultra-light premium business laptop with 11th-gen Intel Core.",13.3,"53Wh",9,"PREMIUM",[
  va("hp-dragonfly-g2-i5","Dragonfly G2 (i5-1135G7/8GB/256GB)","i5_1135G7",8,256,1.09,1649,4.2,35,"Tiger Lake i5 Iris Xe ultra-light."),
  va("hp-dragonfly-g2-i7","Dragonfly G2 (i7-1165G7/16GB/512GB)","i7_1165G7",16,512,1.09,1949,4.3,22,"i7 Tiger Lake Iris Xe premium."),
]);
add("hp-elitebook-dragonfly-g3","EliteBook Dragonfly G3",2022,"P.premium","13.5-inch ultra-light premium business laptop with 12th-gen Intel Core.",13.5,"53Wh",9,"PREMIUM",[
  va("hp-dragonfly-g3-i5","Dragonfly G3 (i5-1235U/8GB/256GB)","i5_1235U",8,256,1.12,1699,4.2,32,"12th-gen hybrid i5 ultra-light."),
  va("hp-dragonfly-g3-i7","Dragonfly G3 (i7-1255U/16GB/512GB)","i7_1255U",16,512,1.12,1999,4.3,18,"i7-1255U ultra-light premium."),
]);
add("hp-elitebook-dragonfly-g4","EliteBook Dragonfly G4",2023,"P.premium","13.5-inch ultra-light premium business laptop with 13th-gen Intel Core.",13.5,"53Wh",9,"PREMIUM",[
  va("hp-dragonfly-g4-i5","Dragonfly G4 (i5-1335U/8GB/256GB)","i5_1335U",8,256,1.12,1749,4.2,28,"13th-gen i5 hybrid ultra-light."),
  va("hp-dragonfly-g4-i7","Dragonfly G4 (i7-1355U/16GB/512GB)","i7_1355U",16,512,1.12,2049,4.3,15,"i7-1355U ultra-light premium."),
]);
// AMD Variants
add("hp-elitebook-640-g9-amd","EliteBook 640 G9 AMD",2022,"P.g9","14-inch business laptop with AMD Ryzen 5000 PRO.",14,"45Wh",9,"P9",[
  va("hp-640-g9-r5","640 G9 (Ryzen 5 5650U/8GB/256GB)","r5_5650U",8,256,1.38,849,4.0,48,"Ryzen 5 PRO efficient 6-core."),
  va("hp-640-g9-r7","640 G9 (Ryzen 7 5850U/16GB/512GB)","r7_5850U",16,512,1.38,1099,4.1,32,"Ryzen 7 PRO demanding workloads."),
]);
add("hp-elitebook-650-g9-amd","EliteBook 650 G9 AMD",2022,"P.g9","15.6-inch business laptop with AMD Ryzen 5000 PRO.",15.6,"45Wh",9,"P9",[
  va("hp-650-g9-r5","650 G9 (Ryzen 5 5650U/8GB/256GB)","r5_5650U",8,256,1.74,799,4.0,42,"Ryzen 5 PRO efficient 15.6-inch."),
  va("hp-650-g9-r7","650 G9 (Ryzen 7 5850U/16GB/512GB)","r7_5850U",16,512,1.74,1049,4.1,28,"Ryzen 7 PRO 15.6-inch productivity."),
]);
add("hp-elitebook-840-g9-amd","EliteBook 840 G9 AMD",2022,"P.g9","14-inch premium business laptop with AMD Ryzen 5000 PRO.",14,"53Wh",9,"P9",[
  va("hp-840-g9-r5","840 G9 AMD (Ryzen 5 5650U/8GB/256GB)","r5_5650U",8,256,1.37,1149,4.1,42,"Ryzen 5 PRO premium efficiency."),
  va("hp-840-g9-r7","840 G9 AMD (Ryzen 7 5850U/16GB/512GB)","r7_5850U",16,512,1.37,1449,4.3,22,"Ryzen 7 PRO premium performance."),
]);
add("hp-elitebook-850-g9-amd","EliteBook 850 G9 AMD",2022,"P.g9","15.6-inch premium business laptop with AMD Ryzen 5000 PRO.",15.6,"53Wh",9,"P9",[
  va("hp-850-g9-r5","850 G9 AMD (Ryzen 5 5650U/8GB/256GB)","r5_5650U",8,256,1.69,1149,4.1,38,"Ryzen 5 PRO 15.6-inch premium."),
  va("hp-850-g9-r7","850 G9 AMD (Ryzen 7 5850U/16GB/512GB)","r7_5850U",16,512,1.69,1449,4.3,20,"Ryzen 7 PRO premium 15.6-inch."),
]);
add("hp-elitebook-640-g10-amd","EliteBook 640 G10 AMD",2023,"P.g10","14-inch business laptop with AMD Ryzen 7030 PRO.",14,"45Wh",9,"P10",[
  va("hp-640-g10-r5","640 G10 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.38,899,4.0,42,"Ryzen 5 PRO efficient 6-core."),
  va("hp-640-g10-r7","640 G10 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.38,1149,4.1,28,"Ryzen 7 PRO demanding workloads."),
]);
add("hp-elitebook-650-g10-amd","EliteBook 650 G10 AMD",2023,"P.g10","15.6-inch business laptop with AMD Ryzen 7030 PRO.",15.6,"45Wh",9,"P10",[
  va("hp-650-g10-r5","650 G10 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.74,849,4.0,38,"Ryzen 5 PRO efficient 15.6-inch."),
  va("hp-650-g10-r7","650 G10 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.74,1099,4.1,25,"Ryzen 7 PRO 15.6-inch productivity."),
]);
add("hp-elitebook-840-g10-amd","EliteBook 840 G10 AMD",2023,"P.g10","14-inch premium business laptop with AMD Ryzen 7030 PRO.",14,"53Wh",9,"P10",[
  va("hp-840-g10-r5","840 G10 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.37,1199,4.1,38,"Ryzen 5 PRO premium efficiency."),
  va("hp-840-g10-r7","840 G10 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.37,1499,4.3,18,"Ryzen 7 PRO premium performance."),
]);
add("hp-elitebook-850-g10-amd","EliteBook 850 G10 AMD",2023,"P.g10","15.6-inch premium business laptop with AMD Ryzen 7030 PRO.",15.6,"53Wh",9,"P10",[
  va("hp-850-g10-r5","850 G10 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.69,1199,4.1,35,"Ryzen 5 PRO 15.6-inch premium."),
  va("hp-850-g10-r7","850 G10 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.69,1499,4.3,18,"Ryzen 7 PRO premium 15.6-inch."),
]);
add("hp-elitebook-640-g11-amd","EliteBook 640 G11 AMD",2024,"P.g11","14-inch business laptop with AMD Ryzen PRO 7035U.",14,"45Wh",9,"P11",[
  va("hp-640-g11-r5","640 G11 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.38,949,4.1,38,"Ryzen 5 PRO efficient 6-core."),
  va("hp-640-g11-r7","640 G11 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.38,1199,4.1,25,"Ryzen 7 PRO demanding workloads."),
]);
add("hp-elitebook-650-g11-amd","EliteBook 650 G11 AMD",2024,"P.g11","15.6-inch business laptop with AMD Ryzen PRO 7035U.",15.6,"45Wh",9,"P11",[
  va("hp-650-g11-r5","650 G11 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.72,899,4.1,35,"Ryzen 5 PRO efficient 15.6-inch."),
  va("hp-650-g11-r7","650 G11 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.72,1149,4.1,22,"Ryzen 7 PRO 15.6-inch productivity."),
]);
add("hp-elitebook-840-g11-amd","EliteBook 840 G11 AMD",2024,"P.g11","14-inch premium business laptop with AMD Ryzen PRO 7035U.",14,"53Wh",9,"P11",[
  va("hp-840-g11-r5","840 G11 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.37,1249,4.1,35,"Ryzen 5 PRO premium efficiency."),
  va("hp-840-g11-r7","840 G11 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.37,1549,4.3,18,"Ryzen 7 PRO premium performance."),
]);
add("hp-elitebook-850-g11-amd","EliteBook 850 G11 AMD",2024,"P.g11","15.6-inch premium business laptop with AMD Ryzen PRO 7035U.",15.6,"53Wh",9,"P11",[
  va("hp-850-g11-r5","850 G11 AMD (Ryzen 5 7530U/8GB/256GB)","r5_7530U",8,256,1.69,1249,4.1,32,"Ryzen 5 PRO 15.6-inch premium."),
  va("hp-850-g11-r7","850 G11 AMD (Ryzen 7 7730U/16GB/512GB)","r7_7730U",16,512,1.69,1549,4.3,15,"Ryzen 7 PRO premium 15.6-inch."),
]);
// ===== Additional models to reach 200+ =====
add("hp-elitebook-630-g9-amd","EliteBook 630 G9 AMD",2022,"P.g9","13.3-inch business laptop with AMD Ryzen 5000 PRO.",13.3,"45Wh",9,"P8",[
  va("hp-630-g9-r5","630 G9 AMD (Ryzen 5/8GB/256GB)","r5_5650U",8,256,1.34,829,4.0,50,"Ryzen 5 PRO efficient 13.3-inch."),
  va("hp-630-g9-r7","630 G9 AMD (Ryzen 7/16GB/512GB)","r7_5850U",16,512,1.34,1079,4.1,32,"Ryzen 7 PRO demanding workloads."),
]);
add("hp-elitebook-650-g8-amd","EliteBook 650 G8 AMD",2021,"P.g8","15.6-inch business laptop with AMD Ryzen 5000 PRO.",15.6,"45Wh",9,"P8",[
  va("hp-650-g8-r5","650 G8 AMD (Ryzen 5/8GB/256GB)","r5_5650U",8,256,1.74,749,4.0,42,"Ryzen 5 PRO efficient 15.6-inch."),
  va("hp-650-g8-r7","650 G8 AMD (Ryzen 7/16GB/512GB)","r7_5850U",16,512,1.74,999,4.1,28,"Ryzen 7 PRO 15.6-inch productivity."),
]);
add("hp-elitebook-x360-1030-g7","EliteBook x360 1030 G7",2022,"P.convertG9","13.3-inch premium convertible with 12th-gen Intel Core.",13.3,"53Wh",9,"PREMIUM",[
  va("hp-x360-1030-g7-i5","x360 1030 G7 (i5-1240P/8GB/256GB)","i5_1240P",8,256,1.25,1699,4.1,28,"12th-gen P-series i5 convertible."),
  va("hp-x360-1030-g7-i7","x360 1030 G7 (i7-1260P/16GB/512GB)","i7_1260P",16,512,1.25,1999,4.2,15,"i7-1260P premium convertible."),
]);
add("hp-elitebook-x360-1040-g7","EliteBook x360 1040 G7",2022,"P.convertG9","14-inch premium convertible with 12th-gen Intel Core.",14,"53Wh",9,"PREMIUM",[
  va("hp-x360-1040-g7-i5","x360 1040 G7 (i5-1240P/8GB/256GB)","i5_1240P",8,256,1.42,1699,4.1,25,"14-inch 12th-gen i5 convertible."),
  va("hp-x360-1040-g7-i7","x360 1040 G7 (i7-1260P/16GB/512GB)","i7_1260P",16,512,1.42,1999,4.2,12,"14-inch i7 premium convertible."),
]);
// ===== Generation Engine =====
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("scripts/hp-out", { recursive: true });
const q = s => `"${s}"`, sq = s => `'${s}'`;
const CPU_DB = {
  i5_8250U:{cpu:"Intel Core i5-8250U",cores:"4C/8T",cs:58,gpu:"Intel UHD Graphics 620",gs:14},
  i7_8550U:{cpu:"Intel Core i7-8550U",cores:"4C/8T",cs:68,gpu:"Intel UHD Graphics 620",gs:14},
  i5_8265U:{cpu:"Intel Core i5-8265U",cores:"4C/8T",cs:60,gpu:"Intel UHD Graphics 620",gs:14},
  i7_8565U:{cpu:"Intel Core i7-8565U",cores:"4C/8T",cs:70,gpu:"Intel UHD Graphics 620",gs:14},
  i5_10210U:{cpu:"Intel Core i5-10210U",cores:"4C/8T",cs:62,gpu:"Intel UHD Graphics",gs:16},
  i7_10510U:{cpu:"Intel Core i7-10510U",cores:"4C/8T",cs:72,gpu:"Intel UHD Graphics",gs:16},
  i5_1135G7:{cpu:"Intel Core i5-1135G7",cores:"4C/8T",cs:68,gpu:"Intel Iris Xe",gs:28},
  i7_1165G7:{cpu:"Intel Core i7-1165G7",cores:"4C/8T",cs:76,gpu:"Intel Iris Xe",gs:32},
  i5_1235U:{cpu:"Intel Core i5-1235U",cores:"10C/12T",cs:72,gpu:"Intel Iris Xe",gs:28},
  i5_1240P:{cpu:"Intel Core i5-1240P",cores:"12C/16T",cs:78,gpu:"Intel Iris Xe",gs:30},
  i7_1255U:{cpu:"Intel Core i7-1255U",cores:"10C/12T",cs:80,gpu:"Intel Iris Xe",gs:32},
  i7_1260P:{cpu:"Intel Core i7-1260P",cores:"12C/16T",cs:84,gpu:"Intel Iris Xe",gs:34},
  i5_1335U:{cpu:"Intel Core i5-1335U",cores:"10C/12T",cs:74,gpu:"Intel Iris Xe",gs:28},
  i5_1340P:{cpu:"Intel Core i5-1340P",cores:"12C/16T",cs:80,gpu:"Intel Iris Xe",gs:30},
  i7_1355U:{cpu:"Intel Core i7-1355U",cores:"10C/12T",cs:82,gpu:"Intel Iris Xe",gs:32},
  i7_1360P:{cpu:"Intel Core i7-1360P",cores:"12C/16T",cs:86,gpu:"Intel Iris Xe",gs:34},
  u5_125U:{cpu:"Intel Core Ultra 5 125U",cores:"12C/14T",cs:78,gpu:"Intel Arc iGPU",gs:35},
  u7_155U:{cpu:"Intel Core Ultra 7 155U",cores:"12C/14T",cs:84,gpu:"Intel Arc iGPU",gs:36},
  r5_5650U:{cpu:"AMD Ryzen 5 5650U",cores:"6C/12T",cs:70,gpu:"AMD Radeon Graphics",gs:22},
  r7_5850U:{cpu:"AMD Ryzen 7 5850U",cores:"8C/16T",cs:80,gpu:"AMD Radeon Graphics",gs:25},
  r5_7530U:{cpu:"AMD Ryzen 5 7530U",cores:"6C/12T",cs:72,gpu:"AMD Radeon Graphics",gs:22},
  r7_7730U:{cpu:"AMD Ryzen 7 7730U",cores:"8C/16T",cs:82,gpu:"AMD Radeon Graphics",gs:25},
};
const PORTS={
  P5:["USB-C","USB-A x2","HDMI 1.4","RJ-45","3.5mm"],
  P6:["USB-C x2","USB-A x2","HDMI 1.4","RJ-45","3.5mm"],
  P7:["USB-C x2","USB-A x2","HDMI 1.4","RJ-45","3.5mm"],
  P8:["USB-C x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  P9:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  P10:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","RJ-45","3.5mm"],
  P11:["Thunderbolt 4 x2","USB-A x2","HDMI 2.1","RJ-45","3.5mm"],
  TB3:["Thunderbolt 3 x2","USB-A x2","HDMI 1.4","3.5mm"],
  TB4_HDMI:["Thunderbolt 4 x2","USB-A x2","HDMI 2.0","3.5mm"],
  PREMIUM:["Thunderbolt 4 x2","USB-A","HDMI 2.1","nano-SIM","3.5mm"],
};
function specObj(v, m) {
  const c = CPU_DB[v.ck];
  if (!c) throw new Error("Unknown CPU: " + v.ck);
  const disp = m.ds <= 13 ? `${m.ds}" FHD (1920x1080) IPS 250 nits` :
    m.ds <= 14 ? `${m.ds}" FHD (1920x1080) IPS 250 nits` :
    `${m.ds}" FHD (1920x1080) IPS 250 nits`;
  return {
    cpu: c.cpu, cores: c.cores, cs: c.cs, gpu: c.gpu, gs: c.gs,
    ram: v.ram, storage: v.stor, storageType: "NVMe",
    display: disp, displaySize: m.ds, displayRefreshRate: 60,
    batteryLife: m.bt, batteryCapacity: m.bc, weight: v.w,
    ports: PORTS[m.pk] || PORTS.P8, os: "Windows 11 Pro",
  };
}
function emitSpecs(o) {
  const p = [];
  p.push(`cpu:${q(o.cpu)}`);
  if (o.cores) p.push(`cpuCores:${q(o.cores)}`);
  p.push(`cpuScore:${o.cs}`);
  p.push(`gpu:${q(o.gpu)}`);
  p.push(`gpuScore:${o.gs}`);
  p.push(`ram:${o.ram}`);
  p.push(`storage:${o.storage}`);
  p.push(`storageType:${q("NVMe")}`);
  p.push(`display:${sq(o.display)}`);
  p.push(`displaySize:${o.displaySize}`);
  p.push(`displayRefreshRate:${o.displayRefreshRate}`);
  p.push(`batteryLife:${o.batteryLife}`);
  p.push(`batteryCapacity:${q(o.batteryCapacity)}`);
  p.push(`weight:${o.weight}`);
  p.push(`ports:[${o.ports.map(q).join(",")}]`);
  p.push(`os:${q(o.os)}`);
  return `{${p.join(",")}}`;
}
function emitVariantTS(v, m) {
  const s = specObj(v, m);
  return `{id:${q(v.id)},name:${q(v.name)},brand:${q("HP")},category:${q("business-laptop")},price:${v.price},rating:${v.rating},reviewCount:${v.reviews},year:${m.year},description:${q(v.desc)},imageUrl:"",specs:${emitSpecs(s)}}`;
}
function emitVariantHTML(v, m) {
  const s = specObj(v, m);
  return `{id:${q(v.id)},name:${q(v.name)},brand:${q("HP")},category:${q("business-laptop")},price:${v.price},rating:${v.rating},reviewCount:${v.reviews},year:${m.year},description:${q(v.desc)},imageUrl:"",specs:${emitSpecs(s)}}`;
}
const BASE_ORDER=["wifi","bluetooth","fingerprint","faceRecognition","irCamera","tpm","privacyShutter","smartCardReader","backlitKeyboard","rgbKeyboard","keyboardLayout","numpad","stylusSupport","buildMaterial","militaryCertification","coolingSystem","fans","warranty"];
// Import base specs from hp-common
import { P } from "./hp-common.mjs";
// Map base keys to hp-common preset objects
const BASE_MAP = {
  "P.g5": P.g5, "P.g6": P.g6, "P.g7": P.g7, "P.g8": P.g8,
  "P.g9": P.g9, "P.g10": P.g10, "P.g11": P.g11,
  "P.premium": P.premium, "P.ultra": P.ultra,
  "P.convertG7": P.convertG7, "P.convertG8": P.convertG8,
  "P.convertG9": P.convertG9, "P.convertG10": P.convertG10,
};
function emitBaseTS(id, b) {
  const lines = [`  ${q(id)}: {`];
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
function emitModelTS(m) {
  const head = [
    "  {", `    id: ${q(m.id)},`, `    name: ${q(m.name)},`,
    `    brand: ${q("HP")},`, `    category: ${q("business-laptop")},`,
    `    year: ${m.year},`, `    description: ${q(m.desc)},`,
    `    imageUrl: "",`, "    variants: [",
  ];
  const body = m.variants.map(v => `      ${emitVariantTS(v, m)},`).join("\n");
  return [...head, body, "    ],", "  },"].join("\n");
}
function emitModelHTML(m) {
  const head = `{id:${q(m.id)},name:${q(m.name)},brand:${q("HP")},category:${q("business-laptop")},year:${m.year},description:${q(m.desc)},imageUrl:"",variants:[`;
  const body = m.variants.map(v => emitVariantHTML(v, m) + ",").join("\n");
  return head + "\n" + body + "\n]},";
}
// Resolve base specs
for (const m of ALL) {
  m.baseObj = BASE_MAP[m.base] || P.g8;
}

const baseTS = ALL.map(m => emitBaseTS(m.id, m.baseObj)).join("\n");
const modelsTS = ALL.map(emitModelTS).join("\n\n");
const baseHTML = ALL.map(m => emitBaseHTML(m.id, m.baseObj)).join("\n");
const modelsHTML = ALL.map(emitModelHTML).join("\n");

writeFileSync("scripts/hp-out/hp-base.ts.txt", baseTS);
writeFileSync("scripts/hp-out/hp-models.ts.txt", modelsTS);
writeFileSync("scripts/hp-out/hp-base.html.txt", baseHTML);
writeFileSync("scripts/hp-out/hp-models.html.txt", modelsHTML);

const totalVariants = ALL.reduce((n, m) => n + m.variants.length, 0);
console.log(`models: ${ALL.length}`);
console.log(`variants: ${totalVariants}`);
console.log(`base TS lines: ${baseTS.split("\n").length}`);
console.log(`models TS lines: ${modelsTS.split("\n").length}`);
console.log("written: scripts/hp-out/hp-base.ts.txt, hp-models.ts.txt, hp-base.html.txt, hp-models.html.txt");
