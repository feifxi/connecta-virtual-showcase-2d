import { expect, it } from 'vitest';
import { fromLocalInput, toLocalInput } from './format';

it('datetime-local inputs are Bangkok time and round-trip to UTC', () => {
  expect(toLocalInput('2026-11-30T06:30:00.000Z')).toBe('2026-11-30T13:30');
  expect(fromLocalInput('2026-11-30T13:30')).toBe('2026-11-30T06:30:00.000Z');
});
