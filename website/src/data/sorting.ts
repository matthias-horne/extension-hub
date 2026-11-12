import type { Extension } from './extensions';

export const SORT_OPTIONS = [
  { value: 'az', label: 'Name (A–Z)' },
  { value: 'za', label: 'Name (Z–A)' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
] as const;

export type SortOrder = typeof SORT_OPTIONS[number]['value'];

export function sortExtensions(extensions: readonly Extension[], order: SortOrder): Extension[] {
  const sorted = [...extensions];
  return sorted.sort((a, b) => {
    const nameOrder = a.title.localeCompare(b.title);
    switch (order) {
      case 'az': return nameOrder;
      case 'za': return -nameOrder;
      case 'popular': return (b.github?.stars ?? 0) - (a.github?.stars ?? 0) || nameOrder;
      case 'newest': return (b.addedAt ? Date.parse(b.addedAt) : 0) - (a.addedAt ? Date.parse(a.addedAt) : 0) || nameOrder;
    }
  });
}
