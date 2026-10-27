// Judging totals are computed, never stored (docs/data-model.md → ผลรวม)
// per sheet = Σ(score / maxScore × weight) / Σ weight · per project = mean of SUBMITTED sheets · shown as 0–100

export type CriterionLike = { id: string; maxScore: number; weight: number };
export type ScoreLike = { criterionId: string; score: number };

export function sheetPercent(criteria: CriterionLike[], scores: ScoreLike[]): number | null {
  const byId = new Map(scores.map((s) => [s.criterionId, s.score]));
  let total = 0;
  let weights = 0;
  for (const c of criteria) {
    const s = byId.get(c.id);
    if (s === undefined) return null;
    total += (s / c.maxScore) * c.weight;
    weights += c.weight;
  }
  return weights ? (total / weights) * 100 : null;
}

export function isSheetComplete(criteria: CriterionLike[], scores: ScoreLike[]) {
  const ids = new Set(scores.map((s) => s.criterionId));
  return criteria.every((c) => ids.has(c.id));
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
