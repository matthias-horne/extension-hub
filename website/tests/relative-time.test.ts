import { describe, expect, test } from 'bun:test';
import { formatRelativeTime } from '../src/data/relativeTime';

describe('relative commit times', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');

  test('formats elapsed time in the largest suitable unit', () => {
    expect(formatRelativeTime('2026-11-12T11:58:00Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-11-12T10:00:00Z', now)).toBe('2 hours ago');
    expect(formatRelativeTime('2026-11-09T12:00:00Z', now)).toBe('3 days ago');
    expect(formatRelativeTime('2026-11-05T12:00:00Z', now)).toBe('1 week ago');
    expect(formatRelativeTime('2026-09-12T12:00:00Z', now)).toBe('2 months ago');
    expect(formatRelativeTime('2025-11-12T12:00:00Z', now)).toBe('1 year ago');
  });

  test('handles recent, future, and invalid values', () => {
    expect(formatRelativeTime('2026-11-12T11:59:30Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-11-12T14:00:00Z', now)).toBe('in 2 hours');
    expect(formatRelativeTime(null, now)).toBeNull();
    expect(formatRelativeTime('not-a-date', now)).toBeNull();
  });
});
