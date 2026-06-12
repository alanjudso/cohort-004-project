export function getLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoCurrentLevel: number;
} {
  let level = 1;
  let cumulativeXp = 0;

  while (true) {
    const xpForNextLevel = Math.round(80 * Math.pow(level, 1.3));
    if (cumulativeXp + xpForNextLevel > totalXp) {
      return {
        level,
        currentLevelXp: cumulativeXp,
        nextLevelXp: xpForNextLevel,
        xpIntoCurrentLevel: totalXp - cumulativeXp,
      };
    }
    cumulativeXp += xpForNextLevel;
    level++;
  }
}
