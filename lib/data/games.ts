import { ComputerVariant, Game, GameCompatibility, CompatibilityVerdict } from "../data/types";

export const GAMES: Game[] = [
  { id: "cyberpunk-2077", name: "Cyberpunk 2077", genre: "RPG / Open World", tier: "very-demanding", minCpu: 60, minGpu: 55, minRam: 12, recCpu: 80, recGpu: 80, recRam: 24, storage: 70 },
  { id: "gta-vi", name: "GTA VI", genre: "Open World", tier: "very-demanding", minCpu: 65, minGpu: 60, minRam: 16, recCpu: 85, recGpu: 85, recRam: 32, storage: 105 },
  { id: "elden-ring", name: "Elden Ring", genre: "Action RPG", tier: "demanding", minCpu: 55, minGpu: 50, minRam: 12, recCpu: 72, recGpu: 70, recRam: 16, storage: 60 },
  { id: "baldurs-gate-3", name: "Baldur's Gate 3", genre: "RPG", tier: "demanding", minCpu: 55, minGpu: 48, minRam: 8, recCpu: 75, recGpu: 72, recRam: 16, storage: 150 },
  { id: "call-of-duty-mw", name: "Call of Duty: Warzone", genre: "Battle Royale", tier: "demanding", minCpu: 60, minGpu: 55, minRam: 12, recCpu: 78, recGpu: 75, recRam: 16, storage: 125 },
  { id: "hogwarts-legacy", name: "Hogwarts Legacy", genre: "Action RPG", tier: "demanding", minCpu: 58, minGpu: 50, minRam: 16, recCpu: 78, recGpu: 75, recRam: 32, storage: 85 },
  { id: "starfield", name: "Starfield", genre: "RPG / Space", tier: "very-demanding", minCpu: 65, minGpu: 55, minRam: 16, recCpu: 85, recGpu: 80, recRam: 32, storage: 125 },
  { id: "red-dead-2", name: "Red Dead Redemption 2", genre: "Action / Open World", tier: "demanding", minCpu: 58, minGpu: 52, minRam: 12, recCpu: 72, recGpu: 70, recRam: 16, storage: 150 },
  { id: "witcher-3", name: "The Witcher 3", genre: "Action RPG", tier: "mainstream", minCpu: 52, minGpu: 45, minRam: 8, recCpu: 65, recGpu: 62, recRam: 16, storage: 50 },
  { id: "fortnite", name: "Fortnite", genre: "Battle Royale", tier: "esports", minCpu: 45, minGpu: 40, minRam: 8, recCpu: 60, recGpu: 55, recRam: 16, storage: 30 },
  { id: "valorant", name: "Valorant", genre: "Tactical Shooter", tier: "esports", minCpu: 40, minGpu: 30, minRam: 8, recCpu: 55, recGpu: 50, recRam: 16, storage: 30 },
  { id: "cs2", name: "Counter-Strike 2", genre: "Tactical Shooter", tier: "esports", minCpu: 45, minGpu: 35, minRam: 8, recCpu: 58, recGpu: 55, recRam: 16, storage: 35 },
  { id: "league-of-legends", name: "League of Legends", genre: "MOBA", tier: "esports", minCpu: 35, minGpu: 25, minRam: 8, recCpu: 50, recGpu: 45, recRam: 16, storage: 25 },
  { id: "dota-2", name: "Dota 2", genre: "MOBA", tier: "esports", minCpu: 38, minGpu: 28, minRam: 8, recCpu: 52, recGpu: 48, recRam: 16, storage: 30 },
  { id: "apex-legends", name: "Apex Legends", genre: "Battle Royale", tier: "esports", minCpu: 50, minGpu: 42, minRam: 8, recCpu: 62, recGpu: 58, recRam: 16, storage: 75 },
  { id: "overwatch-2", name: "Overwatch 2", genre: "Hero Shooter", tier: "esports", minCpu: 48, minGpu: 40, minRam: 8, recCpu: 60, recGpu: 55, recRam: 16, storage: 50 },
  { id: "minecraft", name: "Minecraft", genre: "Sandbox", tier: "mainstream", minCpu: 40, minGpu: 30, minRam: 8, recCpu: 55, recGpu: 50, recRam: 16, storage: 1 },
  { id: "forza-horizon-5", name: "Forza Horizon 5", genre: "Racing", tier: "mainstream", minCpu: 52, minGpu: 48, minRam: 8, recCpu: 65, recGpu: 62, recRam: 16, storage: 110 },
  { id: "hearts-of-iron", name: "Hearts of Iron IV", genre: "Strategy", tier: "mainstream", minCpu: 55, minGpu: 20, minRam: 8, recCpu: 70, recGpu: 40, recRam: 16, storage: 2 },
  { id: "doom-eternal", name: "DOOM Eternal", genre: "FPS", tier: "mainstream", minCpu: 55, minGpu: 48, minRam: 8, recCpu: 65, recGpu: 60, recRam: 16, storage: 80 },
  { id: "asset-to-corsa", name: "Assetto Corsa Competizione", genre: "Racing Sim", tier: "demanding", minCpu: 58, minGpu: 52, minRam: 8, recCpu: 72, recGpu: 70, recRam: 16, storage: 60 },
  { id: "flight-sim-2024", name: "MS Flight Simulator 2024", genre: "Simulation", tier: "very-demanding", minCpu: 62, minGpu: 55, minRam: 16, recCpu: 85, recGpu: 82, recRam: 32, storage: 100 },
  { id: "diablo-4", name: "Diablo IV", genre: "Action RPG", tier: "mainstream", minCpu: 50, minGpu: 45, minRam: 8, recCpu: 62, recGpu: 60, recRam: 16, storage: 90 },
  { id: "god-of-war", name: "God of War", genre: "Action Adventure", tier: "demanding", minCpu: 55, minGpu: 50, minRam: 8, recCpu: 72, recGpu: 68, recRam: 16, storage: 70 },
  { id: "monster-hunter-wilds", name: "Monster Hunter Wilds", genre: "Action RPG", tier: "very-demanding", minCpu: 62, minGpu: 55, minRam: 16, recCpu: 80, recGpu: 78, recRam: 32, storage: 140 },
];

export function findGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

function fpsEstimate(variant: ComputerVariant, game: Game): string {
  const gpuRatio = variant.specs.gpuScore / Math.max(game.recGpu, 1);
  const cpuRatio = variant.specs.cpuScore / Math.max(game.recCpu, 1);
  const base = Math.min(gpuRatio, cpuRatio);
  const tiers: Record<Game["tier"], { hi: number; lo: number }> = {
    esports: { hi: 240, lo: 60 },
    mainstream: { hi: 120, lo: 45 },
    demanding: { hi: 90, lo: 30 },
    "very-demanding": { hi: 70, lo: 25 },
  };
  const { hi, lo } = tiers[game.tier];
  const headroom = Math.max(0, base - 1);
  const est = lo + (hi - lo) * Math.min(headroom, 1);
  const low = Math.max(20, Math.round(est * 0.75));
  const high = Math.round(est * 1.25);
  return `${low}–${high} FPS (estimated) @ 1080p`;
}

export function estimateGameCompatibility(variant: ComputerVariant, game: Game): GameCompatibility {
  const gpu = variant.specs.gpuScore;
  const cpu = variant.specs.cpuScore;
  const ram = variant.specs.ram;
  const storageGb = variant.specs.storage;

  const meetsMinGpu = gpu >= game.minGpu;
  const meetsMinCpu = cpu >= game.minCpu;
  const meetsMinRam = ram >= game.minRam;
  const meetsMinStorage = storageGb >= game.storage;
  const meetsMinimum = meetsMinGpu && meetsMinCpu && meetsMinRam && meetsMinStorage;

  const meetsRecGpu = gpu >= game.recGpu;
  const meetsRecCpu = cpu >= game.recCpu;
  const meetsRecRam = ram >= game.recRam;
  const meetsRecommended = meetsRecGpu && meetsRecCpu && meetsRecRam;

  const gpuHeadroom = gpu - game.recGpu;
  const reasoning: string[] = [];

  if (variant.specs.gpu.includes("iGPU") || variant.specs.gpuScore < 35) {
    reasoning.push(`${variant.specs.gpu} is an integrated GPU — expect low settings and reduced performance in ${game.name}.`);
  } else {
    reasoning.push(`${variant.specs.gpu} (score ${gpu}/100) vs game ${game.name} requirement ${meetsRecGpu ? "recommended" : "minimum"}: GPU ${gpu >= game.recGpu ? "meets recommended tier" : gpu >= game.minGpu ? "meets minimum tier" : "below minimum"}.`);
  }
  reasoning.push(`CPU ${variant.specs.cpu.split("(")[0].trim()} (${cpu}/100): ${cpu >= game.recCpu ? "meets recommended" : cpu >= game.minCpu ? "meets minimum" : "below minimum"}.`);
  reasoning.push(`${ram}GB RAM vs ${game.minRam}GB minimum / ${game.recRam}GB recommended.`);
  reasoning.push(`${storageGb >= game.storage ? "Storage OK" : `Only ${storageGb}GB storage — game needs ${game.storage}GB.`}`);

  let verdict: CompatibilityVerdict;
  if (meetsRecommended && gpuHeadroom >= 5) verdict = "Excellent";
  else if (meetsRecommended) verdict = "Good";
  else if (meetsMinimum) verdict = "Playable";
  else verdict = "Not Recommended";

  if (verdict === "Excellent") reasoning.push("This machine exceeds the recommended spec — expect high/ultra settings comfortably.");
  else if (verdict === "Good") reasoning.push("Meets recommended specs — expect high settings with occasional dips.");
  else if (verdict === "Playable") reasoning.push("Meets minimum specs — expect medium/low settings to maintain playable frame rates.");
  else reasoning.push("Below minimum specs — the game may struggle to run smoothly on this machine.");

  return {
    verdict,
    estimatedFps: meetsMinimum ? fpsEstimate(variant, game) : "Unlikely to sustain playable frame rates",
    reasoning,
    meetsRecommended,
    meetsMinimum,
  };
}