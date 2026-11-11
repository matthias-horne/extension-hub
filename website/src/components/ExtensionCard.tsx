import type { Extension } from '../data/extensions';
import { Link } from 'react-router-dom';
import { useGitHubRepository } from '../hooks/useGitHubRepository';
import { Icon } from './Icon';

interface ExtensionCardProps {
  extension: Extension;
  onSelect: (extension: Extension) => void;
}

const starFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function ExtensionCard({ extension, onSelect }: ExtensionCardProps) {
  const { data: github, status } = useGitHubRepository(extension.repositoryPath);
  const owner = github?.owner.login ?? extension.owner;
  const ownerUrl = github?.owner.html_url ?? 'https://github.com/' + extension.owner;
  const avatarUrl = github?.owner.avatar_url
    ? github.owner.avatar_url + (github.owner.avatar_url.includes('?') ? '&' : '?') + 's=32'
    : 'https://avatars.githubusercontent.com/' + extension.owner + '?s=32';
  const starsLabel = github
    ? github.stargazers_count.toLocaleString() + ' GitHub stars'
    : status === 'loading' ? 'Loading GitHub stars' : 'GitHub stars unavailable';

  return (
    <article className="extension-card">
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
          <span>{github ? starFormatter.format(github.stargazers_count) : status === 'loading' ? '…' : '—'}</span>
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
