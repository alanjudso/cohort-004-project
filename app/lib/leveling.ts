export function xpRequiredForLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.3));
}

export function getLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpForNextLevel: number;
} {
  let level = 1;
  let xpConsumed = 0;

  while (true) {
    const needed = xpRequiredForLevel(level);
    if (xpConsumed + needed > totalXp) {
      return {
        level,
        currentLevelXp: totalXp - xpConsumed,
        xpForNextLevel: needed,
      };
    }
    xpConsumed += needed;
    level++;
  }
}
