import { describe, expect, it } from "vitest";
import { achievements, dailyChallenge } from "./progress";

describe("progreso", () => {
  it("calcula logros a partir de partidas verificadas", () => {
    const games = [
      { mode: "classic", score: 120 },
      { mode: "wrap", score: 20 },
      { mode: "timed", score: 30 },
    ];
    const result = achievements(games);
    expect(result.find((item) => item.id === "explorer")?.unlocked).toBe(true);
    expect(result.find((item) => item.id === "century")?.unlocked).toBe(true);
    expect(result.find((item) => item.id === "veteran")?.progress).toBe(3);
  });
  it("genera un desafío diario estable", () => {
    const date = new Date("2026-11-23T12:00:00Z");
    expect(dailyChallenge(date)).toEqual(dailyChallenge(date));
    expect(dailyChallenge(date).target).toBeGreaterThanOrEqual(60);
  });
});
