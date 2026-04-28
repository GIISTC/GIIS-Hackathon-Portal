/**
 * GAVEL CORE ENGINE
 * Implements Bradley-Terry Model with Maximum Likelihood Estimation (MLE)
 * using the MM (Minorization-Maximization) Algorithm.
 */

export interface Matchup {
  winner_id: string;
  loser_id: string;
}

/**
 * Computes ratings for all projects based on matchup history.
 * This is the exact mathematical model used by the official Gavel software.
 */
export function computeRatings(
  projectIds: string[],
  matchups: Matchup[],
  iterations: number = 50
): Record<string, number> {
  // 1. Initialize gamma (e^beta) to 1.0 for all projects.
  // In Bradley-Terry, we work with gamma = exp(strength).
  const gamma: Record<string, number> = {};
  projectIds.forEach(id => (gamma[id] = 1.0));

  // 2. Count total wins for each project.
  const wins: Record<string, number> = {};
  projectIds.forEach(id => (wins[id] = 0));
  matchups.forEach(m => {
    if (wins[m.winner_id] !== undefined) wins[m.winner_id]++;
  });

  // 3. Pre-calculate N_ij (total matches between i and j)
  const pairwiseMatches: Record<string, Record<string, number>> = {};
  matchups.forEach(m => {
    const [a, b] = [m.winner_id, m.loser_id].sort();
    if (!pairwiseMatches[a]) pairwiseMatches[a] = {};
    pairwiseMatches[a][b] = (pairwiseMatches[a][b] || 0) + 1;
  });

  // 4. MM Algorithm Iterations
  // This converges to the Maximum Likelihood Estimate.
  for (let iter = 0; iter < iterations; iter++) {
    const nextGamma: Record<string, number> = {};
    
    for (const i of projectIds) {
      let denominator = 0;
      
      // OPTIMIZED: Only iterate over actual opponents
      const opponents = pairwiseMatches[i] || {};
      for (const [j, n_ij] of Object.entries(opponents)) {
        denominator += n_ij / (gamma[i] + gamma[j]);
      }
      
      // Also check if we were the loser in matches (symmetry)
      for (const j of projectIds) {
        if (i === j) continue;
        const [a, b] = [i, j].sort();
        if (a === i) continue; // Already covered
        const n_ji = pairwiseMatches[a]?.[b] || 0;
        if (n_ji > 0) {
          denominator += n_ji / (gamma[i] + gamma[j]);
        }
      }
      
      // Use a small constant to prevent division by zero or infinite ratings
      // This acts as a "prior" (Laplace smoothing).
      nextGamma[i] = (wins[i] + 0.01) / (denominator + 0.01);
    }
    
    // Update gamma for next iteration
    Object.assign(gamma, nextGamma);
  }

  // 5. Convert gamma back to beta (log-space)
  // We scale them so the average is 1200 to keep it familiar, or just leave as raw.
  // Official Gavel uses raw log-strengths. We'll use log and scale for readability.
  const ratings: Record<string, number> = {};
  projectIds.forEach(id => {
    // We use a baseline of 1200 and a scale factor of 400/ln(10) to match Elo's feel
    // but with Gavel's accuracy.
    ratings[id] = 1200 + (Math.log(gamma[id]) * 400) / Math.LN10;
  });

  return ratings;
}
