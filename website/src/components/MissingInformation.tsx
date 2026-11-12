import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function MissingInformation({ title, children, maintainerGuidance = false }: { title: string; children: ReactNode; maintainerGuidance?: boolean }) {
  return (
    <div className="information-warning" role="note">
      <Icon name="warning" />
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
        {maintainerGuidance && <p>
          Extension maintainers: follow the <a href="https://github.com/matthias-horne/extension-hub#how-to-contribute-my-extension-as-a-maintainer" target="_blank" rel="noopener noreferrer">contribution guide</a> to publish the required information.
        </p>}
      </div>
    </div>
  );
}
