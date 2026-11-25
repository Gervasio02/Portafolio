import type { Mode } from "./engine";

export type CompletedGame = { mode: string; score: number };
export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
};
export type DailyChallenge = {
  date: string;
  mode: Mode;
  target: number;
  label: string;
};

export function achievements(games: CompletedGame[]): Achievement[] {
  const played = games.length;
  const best = games.reduce((value, game) => Math.max(value, game.score), 0);
  const modes = new Set(games.map((game) => game.mode)).size;
  return [
    {
      id: "first",
      title: "Primera partida",
      description: "Guarda tu primer resultado verificado.",
      unlocked: played >= 1,
      progress: Math.min(played, 1),
      target: 1,
    },
    {
      id: "explorer",
      title: "Explorador",
      description: "Completa una partida en los tres modos.",
      unlocked: modes >= 3,
      progress: Math.min(modes, 3),
      target: 3,
    },
    {
      id: "century",
      title: "Centurión",
      description: "Consigue al menos 100 puntos.",
      unlocked: best >= 100,
      progress: Math.min(best, 100),
      target: 100,
    },
    {
      id: "veteran",
      title: "Veterano",
      description: "Guarda diez partidas verificadas.",
      unlocked: played >= 10,
      progress: Math.min(played, 10),
      target: 10,
    },
  ];
}

export function dailyChallenge(date = new Date()): DailyChallenge {
  const key = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const seed = [...key].reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const modes: Mode[] = ["classic", "wrap", "timed"];
  const mode = modes[seed % modes.length];
  const target = 60 + (seed % 5) * 20;
  return {
    date: key,
    mode,
    target,
    label: `Consigue ${target} puntos en modo ${mode === "classic" ? "Clásico" : mode === "wrap" ? "Sin paredes" : "Contrarreloj"}.`,
  };
}
