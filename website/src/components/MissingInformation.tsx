import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function MissingInformation({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="information-warning" role="note">
      <Icon name="warning" />
      <div><h2>{title}</h2><p>{children}</p></div>
    </div>
  );
}
