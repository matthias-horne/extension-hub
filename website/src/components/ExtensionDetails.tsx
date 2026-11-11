import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Extension } from '../data/extensions';
import { Icon } from './Icon';
import { ExtensionCompatibility } from './ExtensionCompatibility';

const dateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });
const detailTabs = [
  { id: 'overview', label: 'Overview', icon: 'book' },
  { id: 'manifest', label: 'extension.yaml', icon: 'file' },
  { id: 'compatibility', label: 'Compatibility', icon: 'check' },
] as const;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export default function ExtensionDetails({ extension, onCategory }: {
  extension: Extension;
  onCategory: (category: string) => void;
}) {
  const github = extension.github;
  const readme = github?.readme;
  const [activeTab, setActiveTab] = useState<(typeof detailTabs)[number]['id']>('overview');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const owner = github?.owner.login ?? extension.owner;
  const metadataPlaceholder = '—';
  const license = github?.license;
  const readmeUrl = readme?.htmlUrl ?? extension.repository + '#readme';

  async function copyManifest() {
    try {
      await navigator.clipboard.writeText(extension.manifest);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  function resolveReadmeUrl(value: string, key: string) {
    const safeUrl = defaultUrlTransform(value);
    if (!safeUrl || !readme) return safeUrl;
    const base = key === 'src' ? readme.rawUrl : readme.htmlUrl;
    // Root-relative paths in a README belong to the repository, not this site.
    const root = base.slice(0, base.length - readme.path.split('/').map(encodeURIComponent).join('/').length);
    return new URL(safeUrl.startsWith('/') && !safeUrl.startsWith('//') ? safeUrl.slice(1) : safeUrl,
      safeUrl.startsWith('/') ? root : base).href;
  }

  return (
    <main className="content-width extension-details" id="main-content" tabIndex={-1}>
      <Link className="back-link" to="/"><Icon name="back" />All extensions</Link>

      <div className="details-layout">
        <aside className="details-sidebar" aria-label="Extension information">
          <div className="details-identity">
            <img className="details-icon" src={extension.icon} alt="" width="64" height="64" />
            <div>
              <h1>{extension.title}</h1>
              <a className="extension-owner" href={github?.owner.htmlUrl ?? 'https://github.com/' + owner} target="_blank" rel="noopener noreferrer">
                <span className="owner-avatar" aria-hidden="true">
                  <span>{owner.charAt(0).toUpperCase()}</span>
                  <img src={github?.owner.avatarUrl ?? 'https://avatars.githubusercontent.com/' + owner + '?s=40'} alt="" width="20" height="20" onError={(event) => { event.currentTarget.hidden = true; }} />
                </span>
                <span>{owner}</span>
              </a>
            </div>
          </div>

          <p className="details-description">{extension.description}</p>

          <div className="details-actions">
            <a className="button-primary" href={extension.manifestUrl} download="extension.yaml"><Icon name="download" />Download extension.yaml</a>
            <a className="button-secondary" href={extension.repository} target="_blank" rel="noopener noreferrer"><Icon name="github" />View source<Icon name="external" /></a>
          </div>

          <dl className="repository-metadata">
            <div><dt>Latest version</dt><dd>{extension.version ? <a href={extension.repository + '/releases/tag/' + encodeURIComponent(extension.version)} target="_blank" rel="noopener noreferrer">{extension.version}</a> : metadataPlaceholder}</dd></div>
            <div><dt>Stars</dt><dd className="metadata-stars"><a href={extension.repository + '/stargazers'} target="_blank" rel="noopener noreferrer"><Icon name="star" />{github ? github.stars.toLocaleString('en') : metadataPlaceholder}</a></dd></div>
            <div><dt>Last commit</dt><dd>{formatDate(github?.lastCommit)}</dd></div>
            <div><dt>Language</dt><dd>{github?.language ?? metadataPlaceholder}</dd></div>
            <div><dt>License</dt><dd>{license ? <a href={extension.repository + '?tab=license-1-ov-file'} target="_blank" rel="noopener noreferrer">{license.spdxId === 'NOASSERTION' ? license.name : license.spdxId}</a> : metadataPlaceholder}</dd></div>
          </dl>
          {!github && <p className="metadata-note">Repository information is currently unavailable.</p>}

          <div className="details-categories">
            <h2>Categories</h2>
            <div className="extension-tags">
              {extension.tags.map((tag) => <Link className="extension-tag" to="/" onClick={() => onCategory(tag)} key={tag}>{tag}</Link>)}
            </div>
          </div>

          {extension.manifestRegistry && <div className="details-registry">
            <h2>Manifest registry</h2>
            <code>{extension.manifestRegistry}</code>
          </div>}

          <a className="details-support" href={extension.repository + '/issues'} target="_blank" rel="noopener noreferrer">Report an issue<Icon name="external" /></a>
        </aside>

        <div className="details-content">
          <div className="details-tabs" role="tablist" aria-label="Extension details" onKeyDown={(event) => {
            const current = detailTabs.findIndex((tab) => tab.id === activeTab);
            const next = event.key === 'ArrowRight' ? (current + 1) % detailTabs.length
              : event.key === 'ArrowLeft' ? (current - 1 + detailTabs.length) % detailTabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? detailTabs.length - 1 : null;
            if (next !== null) {
              event.preventDefault();
              setActiveTab(detailTabs[next].id);
              tabs.current[next]?.focus();
            }
          }}>
            {detailTabs.map((tab, index) => (
              <button key={tab.id} ref={(element) => { tabs.current[index] = element; }} id={tab.id + '-tab'} role="tab" aria-selected={activeTab === tab.id} aria-controls={tab.id + '-panel'} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)}><Icon name={tab.icon} />{tab.label}</button>
            ))}
          </div>

          <section className="details-panel" id="overview-panel" role="tabpanel" aria-labelledby="overview-tab" tabIndex={0} hidden={activeTab !== 'overview'}>
            <div className="details-panel-heading">
              <span><Icon name="book" />{readme?.path ?? 'README'}</span>
              <a href={readmeUrl} target="_blank" rel="noopener noreferrer" aria-label="Read documentation on GitHub" title="Read on GitHub"><Icon name="external" /></a>
            </div>
            {readme ? (
              <div className="readme-content">
                <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={resolveReadmeUrl} components={{
                  h1: ({ node: _node, ...props }) => <h2 {...props} className="readme-title" />,
                  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                  img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />,
                  table: ({ node: _node, ...props }) => <div className="readme-table"><table {...props} /></div>,
                }}>{readme.markdown}</Markdown>
              </div>
            ) : (
              <div className="readme-fallback">
                <h2>About this extension</h2>
                <p>{extension.description}</p>
                <p className="readme-fallback-note">{github ? 'No public README was found for this repository.' : 'Documentation is currently unavailable.'} Visit the repository for documentation and setup instructions.</p>
                <a className="button-secondary" href={readmeUrl} target="_blank" rel="noopener noreferrer">Read on GitHub<Icon name="external" /></a>
              </div>
            )}
          </section>

          <section className="details-panel" id="manifest-panel" role="tabpanel" aria-labelledby="manifest-tab" tabIndex={0} hidden={activeTab !== 'manifest'}>
            <div className="details-panel-heading">
              <span><Icon name="file" />Extension manifest</span>
              <button className="copy-manifest" onClick={copyManifest}><Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />{copyStatus === 'copied' ? 'Copied' : 'Copy YAML'}</button>
            </div>
            <div className="details-manifest">
              <p>The extension manifest for the latest published release.</p>
              {copyStatus === 'unavailable' && <p role="status">Copy is unavailable. Select the YAML below or download the file.</p>}
              <span className="sr-only" role="status">{copyStatus === 'copied' ? 'YAML copied to clipboard.' : ''}</span>
              <pre className="manifest-code" tabIndex={0} aria-label={extension.title + ' YAML definition'}><code>{extension.manifest}</code></pre>
            </div>
          </section>

          <section className="details-panel compatibility-panel" id="compatibility-panel" role="tabpanel" aria-labelledby="compatibility-tab" tabIndex={0} hidden={activeTab !== 'compatibility'}>
            <ExtensionCompatibility compatibility={extension.compatibility} version={extension.version} />
          </section>
        </div>
      </div>
    </main>
  );
}
