import { describe, it, expect } from "vitest";
import { xpRequiredForLevel, getLevelFromXp } from "./leveling";

describe("leveling", () => {
  describe("xpRequiredForLevel", () => {
    it("returns 80 for level 1", () => {
      expect(xpRequiredForLevel(1)).toBe(80);
    });

    it("scales with exponent 1.3", () => {
      expect(xpRequiredForLevel(2)).toBe(Math.round(80 * Math.pow(2, 1.3)));
      expect(xpRequiredForLevel(5)).toBe(Math.round(80 * Math.pow(5, 1.3)));
      expect(xpRequiredForLevel(10)).toBe(Math.round(80 * Math.pow(10, 1.3)));
    });
  });

  describe("getLevelFromXp", () => {
    it("returns level 1 with 0 XP", () => {
      const result = getLevelFromXp(0);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(0);
      expect(result.xpForNextLevel).toBe(80);
    });

    it("returns level 1 with 79 XP", () => {
      const result = getLevelFromXp(79);
      expect(result.level).toBe(1);
      expect(result.currentLevelXp).toBe(79);
      expect(result.xpForNextLevel).toBe(80);
    });

    it("returns level 2 at exactly 80 XP", () => {
      const result = getLevelFromXp(80);
      expect(result.level).toBe(2);
      expect(result.currentLevelXp).toBe(0);
    });

    it("returns level 3 after accumulating enough XP", () => {
      const xpForLevel2 = xpRequiredForLevel(1);
      const xpForLevel3 = xpRequiredForLevel(2);
      const result = getLevelFromXp(xpForLevel2 + xpForLevel3);
      expect(result.level).toBe(3);
      expect(result.currentLevelXp).toBe(0);
    });

    it("handles large XP values", () => {
      const result = getLevelFromXp(100000);
      expect(result.level).toBeGreaterThan(10);
      expect(result.currentLevelXp).toBeGreaterThanOrEqual(0);
      expect(result.currentLevelXp).toBeLessThan(result.xpForNextLevel);
    });
  });
});
