import { useCallback, useEffect, useRef, useState } from 'react';
import { ExtensionCard, type Extension } from './components/ExtensionCard';
import { Icon } from './components/Icon';
import './App.css';

const EXTENSIONS: Extension[] = [
  {
    title: 'Auto-Scaler Pro',
    description: 'Advanced automatic scaling for your Gardener workloads based on custom metrics and AI predictions.',
    category: 'Infrastructure',
    icon: '/highlights/extensible.svg',
  },
  {
    title: 'Security Guard',
    description: 'Real-time vulnerability scanning and policy enforcement for all your namespaces.',
    category: 'Security',
    icon: '/highlights/certified.svg',
  },
  {
    title: 'Cost Optimizer',
    description: 'Analyze your cluster spending and receive recommendations for right-sizing your nodes.',
    category: 'Management',
    icon: '/highlights/cloud-agnostic.svg',
  },
  {
    title: 'Log Aggregator',
    description: 'Centralized logging for your Gardener clusters, with dashboards and alerting.',
    category: 'Observability',
    icon: '/highlights/ubiqutious.svg',
  },
  {
    title: 'Backup Master',
    description: 'Automated snapshots and disaster recovery for your entire Gardener environment.',
    category: 'Infrastructure',
    icon: '/highlights/autonomous.svg',
  },
  {
    title: 'Identity Sync',
    description: 'Seamlessly synchronize your corporate identity provider with Gardener RBAC.',
    category: 'Security',
    icon: '/highlights/gardener.svg',
  },
];

const NAV_LINKS = [
  { label: 'Adopters', href: 'https://gardener.cloud/adopters/' },
  { label: 'Documentation', href: 'https://gardener.cloud/docs/' },
  { label: 'Blog', href: 'https://gardener.cloud/blog/' },
  { label: 'Community', href: 'https://gardener.cloud/community/' },
  { label: 'Contribute', href: 'https://github.com/matthias-horne/extension-hub' },
];

const SOCIAL_LINKS = [
  { label: 'GitHub', icon: 'github', href: 'https://github.com/gardener' },
  { label: 'X', icon: 'x', href: 'https://x.com/GardenerProject' },
  { label: 'Slack', icon: 'slack', href: 'https://gardener.cloud/community/' },
  { label: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com/@gardenerproject' },
] as const;

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('gardener-theme') !== 'light';
    } catch {
      return true;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const searchDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const openSearch = useCallback(() => {
    searchDialog.current?.showModal();
    searchInput.current?.focus();
  }, []);
  const searchResults = EXTENSIONS.filter((extension) =>
    `${extension.title} ${extension.description} ${extension.category}`
      .toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('gardener-theme', darkMode ? 'dark' : 'light');
    } catch {
      // The theme also works when browser storage is unavailable.
    }
  }, [darkMode]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        detailDialog.current?.close();
        openSearch();
      }
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [openSearch]);

  useEffect(() => {
    if (selectedExtension) detailDialog.current?.showModal();
  }, [selectedExtension]);

  function selectExtension(extension: Extension) {
    searchDialog.current?.close();
    setSelectedExtension(extension);
  }

  return (
    <div className="site">
      <a className="skip-link" href="#extensions">Skip to extensions</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Gardener Extensions home">
            <img src="/logo.svg" alt="" width="28" height="28" />
            <span>Gardener</span>
          </a>
          <button className="search-trigger" aria-label="Search extensions" onClick={openSearch}>
            <Icon name="search" />
            <span>Search</span>
            <kbd>⌘ K</kbd>
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, href }) => <a key={label} href={href}>{label}</a>)}
          </nav>
          <div className="header-tools">
            <button
              className="theme-switch"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-pressed={darkMode}
            >
              <span className="theme-switch-thumb"><Icon name={darkMode ? 'moon' : 'sun'} /></span>
            </button>
            <div className="social-links">
              {SOCIAL_LINKS.map(({ label, icon, href }) => (
                <a href={href} key={label} aria-label={label} target="_blank" rel="noopener noreferrer">
                  <Icon name={icon} />
                </a>
              ))}
            </div>
          </div>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          ><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        </div>
        {menuOpen && (
          <nav className="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ label, href }) => <a key={label} href={href}>{label}</a>)}
          </nav>
        )}
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="content-width hero-inner">
            <div className="hero-copy">
              <h1 id="hero-title">
                <span className="hero-name">Gardener</span>
                <span>Extensions for<br />Every Kubernetes<br />Cluster</span>
              </h1>
              <p className="hero-tagline">Discover community-built extensions to enhance your Gardener clusters.</p>
              <a className="hero-action" href="#extensions">
                Explore extensions <Icon name="arrow" />
              </a>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-glow" />
              <img className="hero-logo" src="/logo.svg" alt="" width="320" height="320" />
            </div>
          </div>
        </section>

        <section className="content-width extensions-section" id="extensions" aria-label="Explore Gardener extensions">
          <div className="extension-grid">
            {EXTENSIONS.map((extension) => (
              <ExtensionCard key={extension.title} extension={extension} onSelect={selectExtension} />
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer content-width">
        <a className="footer-brand" href="https://gardener.cloud/">
          <img src="/logo.svg" alt="" width="24" height="24" />
          <span>Gardener Extensions</span>
        </a>
        <p>A community effort. Built to grow together.</p>
        <a href="https://github.com/matthias-horne/extension-hub">Contribute an extension <Icon name="arrow" /></a>
      </footer>

      <dialog ref={searchDialog} className="search-dialog" aria-labelledby="search-title" onClose={() => setQuery('')}>
        <div className="dialog-heading">
          <h2 id="search-title">Search extensions</h2>
          <button className="icon-button" aria-label="Close search" onClick={() => searchDialog.current?.close()}><Icon name="close" /></button>
        </div>
        <div className="search-field">
          <Icon name="search" />
          <input ref={searchInput} aria-label="Search extensions" placeholder="Search by name, category, or capability…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <p className="result-count" aria-live="polite">{searchResults.length} {searchResults.length === 1 ? 'extension' : 'extensions'} found</p>
        <div className="search-results">
          {searchResults.map((extension) => (
            <button className="search-result" key={extension.title} onClick={() => selectExtension(extension)}>
              <img src={extension.icon} alt="" width="32" height="32" />
              <span><strong>{extension.title}</strong><small>{extension.category}</small></span>
              <Icon name="arrow" />
            </button>
          ))}
          {searchResults.length === 0 && <p className="empty-state">No extensions match “{query}”. Try a name or category such as Security.</p>}
        </div>
        <p className="dialog-hint"><kbd>esc</kbd> to close</p>
      </dialog>

      <dialog ref={detailDialog} className="detail-dialog" aria-labelledby="extension-title" onClose={() => setSelectedExtension(null)}>
        {selectedExtension && (
          <>
            <div className="dialog-heading">
              <img src={selectedExtension.icon} alt="" width="48" height="48" />
              <button className="icon-button" aria-label="Close extension details" onClick={() => detailDialog.current?.close()}><Icon name="close" /></button>
            </div>
            <span className="detail-category">{selectedExtension.category}</span>
            <h2 id="extension-title">{selectedExtension.title}</h2>
            <p className="detail-description">{selectedExtension.description}</p>
            <a className="hero-action" href="https://gardener.cloud/docs/gardener/extensions/" target="_blank" rel="noopener noreferrer">Gardener extension documentation <Icon name="arrow" /></a>
          </>
        )}
      </dialog>
    </div>
  );
}

export default App;
