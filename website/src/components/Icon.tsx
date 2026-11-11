type IconName = 'search' | 'arrow' | 'back' | 'moon' | 'sun' | 'close' | 'github' | 'chevron' | 'star' | 'download' | 'file' | 'book' | 'external' | 'copy' | 'check';

export function Icon({ name }: { name: IconName }) {
  if (name === 'github') return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.71 2.63 1.21 3.27.93.1-.73.39-1.21.71-1.5-2.51-.28-5.15-1.26-5.15-5.56 0-1.23.44-2.23 1.16-3.01-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.78 10.78 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.98.72.78 1.16 1.78 1.16 3.01 0 4.31-2.64 5.28-5.16 5.56.41.35.77 1.04.77 2.1v3.08c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" /></svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'search' && <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.5 4.5" /></>}
      {name === 'arrow' && <path d="M4 12h16m-6-6 6 6-6 6" />}
      {name === 'back' && <path d="M20 12H4m6-6-6 6 6 6" />}
      {name === 'book' && <><path d="M12 5v16M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" /></>}
      {name === 'external' && <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />}
      {name === 'copy' && <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>}
      {name === 'check' && <path d="m5 12 4 4L19 6" />}
      {name === 'moon' && <path d="M20.5 13.2A8.6 8.6 0 0 1 10.8 3.5a8.6 8.6 0 1 0 9.7 9.7Z" />}
      {name === 'sun' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
      {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
      {name === 'star' && <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 3Z" />}
      {name === 'download' && <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />}
      {name === 'file' && <><path d="M14 3H6v18h12V7l-4-4Z" /><path d="M14 3v5h4M9 12h6M9 16h6" /></>}
    </svg>
  );
}
