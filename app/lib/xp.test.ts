import { describe, it, expect } from "vitest";
import { getLevelFromXp } from "./xp";

describe("getLevelFromXp", () => {
  it("returns level 1 at 0 XP", () => {
    const result = getLevelFromXp(0);
    expect(result.level).toBe(1);
    expect(result.xpIntoCurrentLevel).toBe(0);
    expect(result.nextLevelXp).toBe(80);
  });

  it("stays level 1 at 79 XP", () => {
    const result = getLevelFromXp(79);
    expect(result.level).toBe(1);
    expect(result.xpIntoCurrentLevel).toBe(79);
    expect(result.nextLevelXp).toBe(80);
  });

  it("reaches level 2 at exactly 80 XP", () => {
    const result = getLevelFromXp(80);
    expect(result.level).toBe(2);
    expect(result.xpIntoCurrentLevel).toBe(0);
  });

  it("level 2 requires round(80 * 2^1.3) XP to advance", () => {
    const result = getLevelFromXp(80);
    expect(result.nextLevelXp).toBe(Math.round(80 * Math.pow(2, 1.3)));
  });

  it("handles level 10 threshold correctly", () => {
    let cumulativeXp = 0;
    for (let n = 1; n < 10; n++) {
      cumulativeXp += Math.round(80 * Math.pow(n, 1.3));
    }
    const result = getLevelFromXp(cumulativeXp);
    expect(result.level).toBe(10);
    expect(result.xpIntoCurrentLevel).toBe(0);
    expect(result.nextLevelXp).toBe(Math.round(80 * Math.pow(10, 1.3)));
  });

  it("progress percentage is correct mid-level", () => {
    const result = getLevelFromXp(40);
    expect(result.level).toBe(1);
    expect(result.xpIntoCurrentLevel).toBe(40);
    expect(result.nextLevelXp).toBe(80);
  });
});
