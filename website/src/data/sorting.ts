import type { Extension } from './extensions';

export const SORT_OPTIONS = [
  { value: 'az', label: 'Name (A–Z)' },
  { value: 'za', label: 'Name (Z–A)' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'activity', label: 'Recent activity' },
] as const;

export type SortOrder = typeof SORT_OPTIONS[number]['value'];

function lastCommitTime(extension: Extension): number {
  const timestamp = extension.github?.lastCommit ? Date.parse(extension.github.lastCommit) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortExtensions(extensions: readonly Extension[], order: SortOrder): Extension[] {
  const sorted = [...extensions];
  return sorted.sort((a, b) => {
    const nameOrder = a.title.localeCompare(b.title);
    switch (order) {
      case 'az': return nameOrder;
      case 'za': return -nameOrder;
      case 'popular': return (b.github?.stars ?? 0) - (a.github?.stars ?? 0) || nameOrder;
      case 'newest': return (b.addedAt ? Date.parse(b.addedAt) : 0) - (a.addedAt ? Date.parse(a.addedAt) : 0) || nameOrder;
      case 'activity': return lastCommitTime(b) - lastCommitTime(a) || nameOrder;
    }
  });
}
