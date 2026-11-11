import type { PointerEvent } from 'react';
import type { Extension } from '../data/extensions';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

interface ExtensionCardProps {
  extension: Extension;
  onSelect: (extension: Extension) => void;
}

const starFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const cardGlowMedia = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

function moveCardGlow(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || !window.matchMedia(cardGlowMedia).matches) return;

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty('--card-glow-x', `${event.clientX - bounds.left - card.clientLeft}px`);
  card.style.setProperty('--card-glow-y', `${event.clientY - bounds.top - card.clientTop}px`);
  card.dataset.glowActive = '';
}

function hideCardGlow(event: PointerEvent<HTMLElement>) {
  delete event.currentTarget.dataset.glowActive;
}

export function ExtensionCard({ extension, onSelect }: ExtensionCardProps) {
  const github = extension.github;
  const owner = github?.owner.login ?? extension.owner;
  const ownerUrl = github?.owner.htmlUrl ?? 'https://github.com/' + extension.owner;
  const avatarUrl = github?.owner.avatarUrl
    ? github.owner.avatarUrl + (github.owner.avatarUrl.includes('?') ? '&' : '?') + 's=32'
    : 'https://avatars.githubusercontent.com/' + extension.owner + '?s=32';
  const starsLabel = github
    ? github.stars.toLocaleString() + ' GitHub stars'
    : 'GitHub stars unavailable';

  return (
    <article className="extension-card" onPointerEnter={moveCardGlow} onPointerMove={moveCardGlow} onPointerLeave={hideCardGlow} onPointerCancel={hideCardGlow}>
      <span className="card-glow" aria-hidden="true" />
      <div className="card-heading">
        <img className="extension-icon" src={extension.icon} alt="" width="40" height="40" />
        <div className="card-identity">
          <h2><Link className="card-details-link" to={'/extensions/' + encodeURIComponent(extension.id)}>{extension.title}</Link></h2>
          <a className="extension-owner" href={ownerUrl} target="_blank" rel="noopener noreferrer" aria-label={'View ' + owner + ' on GitHub'}>
            <span className="owner-avatar" aria-hidden="true">
              <span>{owner.charAt(0).toUpperCase()}</span>
              <img src={avatarUrl} alt="" width="16" height="16" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
            </span>
            <span>{owner}</span>
          </a>
        </div>
        <a className="extension-stars" href={extension.repository + '/stargazers'} target="_blank" rel="noopener noreferrer" aria-label={starsLabel} title={starsLabel}>
          <Icon name="star" />
          <span>{github ? starFormatter.format(github.stars) : '—'}</span>
        </a>
      </div>
      <p className="extension-description">{extension.description}</p>
      <div className="extension-tags" aria-label="Extension categories">
        {extension.tags.map((tag) => <span className="extension-tag" key={tag}>{tag}</span>)}
      </div>
      <div className="card-actions">
        <button className="manifest-button" onClick={() => onSelect(extension)} aria-label={'Show extension.yaml for ' + extension.title}>
          <Icon name="file" />extension.yaml
        </button>
        <a className="card-action-link" href={extension.manifestUrl} download="extension.yaml" aria-label={'Download extension.yaml for ' + extension.title} title="Download extension.yaml">
          <Icon name="download" />
        </a>
        <a className="card-action-link" href={extension.repository} target="_blank" rel="noopener noreferrer" aria-label={'View ' + extension.title + ' on GitHub'} title="View repository on GitHub">
          <Icon name="github" />
        </a>
      </div>
    </article>
  );
}
