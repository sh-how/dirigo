import { describe, expect, it } from 'vitest';
import { age, ago } from '../src/shared/dates';

const today = '2026-11-12';
const now = '2026-11-12T12:35:00Z';

describe('relative times from exact GitHub timestamps', () => {
  it('counts minutes and hours under a day', () => {
    expect(ago('2026-11-12T12:34:30Z', today, now)).toBe('just now');
    expect(ago('2026-11-12T12:34:00Z', today, now)).toBe('1 minute ago');
    expect(ago('2026-11-12T11:40:05Z', today, now)).toBe('54 minutes ago');
    expect(ago('2026-11-12T05:02:50Z', today, now)).toBe('7 hours ago');
    expect(age('2026-11-12T11:40:05Z', today, now)).toBe('54 minutes');
  });

  it('counts from the exact moment across midnight', () => {
    expect(ago('2026-11-11T23:50:00Z', '2026-11-12', '2026-11-12T00:20:00Z')).toBe('30 minutes ago');
    expect(ago('2026-11-11T07:36:43Z', today, now)).toBe('yesterday');
  });

  it('keeps calendar wording for dates without a time', () => {
    expect(ago('2026-11-12', today, now)).toBe('today');
    expect(age('2026-11-12', today)).toBe('today');
    expect(ago('2026-11-09', today, now)).toBe('3 days ago');
  });
});
