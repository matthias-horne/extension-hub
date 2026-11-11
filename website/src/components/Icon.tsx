type IconName = 'search' | 'arrow' | 'moon' | 'sun' | 'menu' | 'close' | 'github' | 'x' | 'slack' | 'youtube';

export function Icon({ name }: { name: IconName }) {
  if (name === 'github') return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.71 2.63 1.21 3.27.93.1-.73.39-1.21.71-1.5-2.51-.28-5.15-1.26-5.15-5.56 0-1.23.44-2.23 1.16-3.01-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.78 10.78 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.98.72.78 1.16 1.78 1.16 3.01 0 4.31-2.64 5.28-5.16 5.56.41.35.77 1.04.77 2.1v3.08c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" /></svg>
  );
  if (name === 'x') return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.9-9L.8 2h6.5l5.5 7.1L18.9 2Zm-1.1 18h1.7L6.4 3.9H4.6L17.8 20Z" /></svg>
  );
  if (name === 'youtube') return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff3131" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12c0 1.6.1 3.2.5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8c0-1.6-.1-3.2-.5-4.8Z" /><path fill="white" d="m9.7 15.5 6-3.5-6-3.5Z" /></svg>
  );
  if (name === 'slack') return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path stroke="#36c5f0" strokeWidth="4" strokeLinecap="round" d="M3 9h5M8 3v1" />
      <path stroke="#2eb67d" strokeWidth="4" strokeLinecap="round" d="M15 3v5M21 8h-1" />
      <path stroke="#ecb22e" strokeWidth="4" strokeLinecap="round" d="M21 15h-5M16 21v-1" />
      <path stroke="#e01e5a" strokeWidth="4" strokeLinecap="round" d="M9 21v-5M3 16h1" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'search' && <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.5 4.5" /></>}
      {name === 'arrow' && <path d="M4 12h16m-6-6 6 6-6 6" />}
      {name === 'moon' && <path d="M20.5 13.2A8.6 8.6 0 0 1 10.8 3.5a8.6 8.6 0 1 0 9.7 9.7Z" />}
      {name === 'sun' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
      {name === 'menu' && <path d="M4 6h16M4 12h16M4 18h16" />}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    </svg>
  );
}
