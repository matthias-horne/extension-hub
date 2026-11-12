import type { Extension } from '../data/extensions';
import { Link } from 'react-router-dom';
import { formatRelativeTime } from '../data/relativeTime';
import { Icon } from './Icon';
import { ExtensionIcon } from './ExtensionIcon';

interface ExtensionListItemProps {
  extension: Extension;
}

const starFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function ExtensionListItem({ extension }: ExtensionListItemProps) {
  const github = extension.github;
  const owner = github?.owner.login ?? extension.owner;
  const ownerUrl = github?.owner.htmlUrl ?? 'https://github.com/' + extension.owner;
  const avatarUrl = github?.owner.avatarUrl
    ? github.owner.avatarUrl + (github.owner.avatarUrl.includes('?') ? '&' : '?') + 's=32'
    : 'https://avatars.githubusercontent.com/' + extension.owner + '?s=32';
  const starsLabel = github
    ? github.stars.toLocaleString() + ' GitHub stars'
    : 'GitHub stars unavailable';
  const lastCommit = github?.lastCommit;
  const lastCommitActivity = formatRelativeTime(lastCommit);

  return (
    <article className="extension-row">
      <ExtensionIcon className="extension-icon" extension={extension} size={40} />
      <div className="extension-row-content">
        <div className="extension-row-heading">
          <h2><Link className="extension-row-link" to={'/extensions/' + encodeURIComponent(extension.id)}>{extension.title}</Link></h2>
        </div>
        <a className="extension-owner" href={ownerUrl} target="_blank" rel="noopener noreferrer" aria-label={'View ' + owner + ' on GitHub'}>
          <span className="owner-avatar" aria-hidden="true">
            <span>{owner.charAt(0).toUpperCase()}</span>
            <img src={avatarUrl} alt="" width="16" height="16" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
          </span>
          <span>{owner}</span>
        </a>
        <p className="extension-description">{extension.description}</p>
        <div className="extension-tags" aria-label="Extension categories">
          {extension.tags.map((tag) => <span className="extension-tag" key={tag}>{tag}</span>)}
        </div>
      </div>
      <div className="extension-row-actions">
        <div className="extension-row-buttons">
          {extension.manifestUrl && <a className="button button-small button-primary" href={extension.manifestUrl} download="extension.yaml" aria-label={'Download extension.yaml for ' + extension.title} title="Download extension.yaml">
            <Icon name="download" /><span>Download</span>
          </a>}
          <a className="button button-small" href={extension.repository} target="_blank" rel="noopener noreferrer" aria-label={'Open ' + extension.title + ' on GitHub'} title="Open on GitHub">
            <Icon name="github" /><span>Open on GitHub</span>
          </a>
        </div>
        {lastCommit && lastCommitActivity && (
          <time className="extension-row-activity" dateTime={lastCommit} title={'Last commit ' + lastCommitActivity}>
            Updated {lastCommitActivity}
          </time>
        )}
        <span className="extension-stars" title={starsLabel}>
          <Icon name="star" />
          <span aria-hidden="true">{github ? starFormatter.format(github.stars) : '—'}</span>
          <span className="sr-only">{starsLabel}</span>
        </span>
      </div>
    </article>
  );
}
