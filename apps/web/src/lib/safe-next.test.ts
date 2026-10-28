import { expect, it } from 'vitest';
import { safeNext } from './safe-next';

it('keeps same-site paths', () => {
  expect(safeNext('/e/abc/hall')).toBe('/e/abc/hall');
  expect(safeNext(['/home', '/x'])).toBe('/home');
});

it('refuses anything that could leave the site (open redirect)', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined]) expect(safeNext(bad)).toBe('/home');
});
