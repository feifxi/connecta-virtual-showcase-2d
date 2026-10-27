import { expect, it } from 'vitest';
import { isSheetComplete, sheetPercent } from './scoring.js';

const criteria = [
  { id: 'a', maxScore: 10, weight: 60 },
  { id: 'b', maxScore: 5, weight: 40 },
];

it('weights each criterion by its share', () => {
  expect(sheetPercent(criteria, [{ criterionId: 'a', score: 10 }, { criterionId: 'b', score: 0 }])).toBe(60);
  expect(sheetPercent(criteria, [{ criterionId: 'a', score: 5 }, { criterionId: 'b', score: 5 }])).toBe(70);
});

it('an incomplete sheet has no total', () => {
  expect(sheetPercent(criteria, [{ criterionId: 'a', score: 5 }])).toBeNull();
  expect(isSheetComplete(criteria, [{ criterionId: 'a', score: 5 }])).toBe(false);
});
