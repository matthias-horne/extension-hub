import type { SyntheticEvent } from 'react';
import type { Extension } from '../data/extensions';

export function ExtensionIcon({ extension, className, size }: {
  extension: Extension;
  className: string;
  size: number;
}) {
  const sources = [extension.icon, ...extension.iconFallbacks];

  function useNextIcon(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const index = sources.indexOf(image.getAttribute('src') ?? '');
    const next = sources[index + 1];
    if (index >= 0 && next) image.setAttribute('src', next);
  }

  return <img key={sources.join('\n')} className={className} src={extension.icon} alt="" width={size} height={size} onError={useNextIcon} />;
}
