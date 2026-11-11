import React, { useState, useEffect } from 'react';
import { ExtensionCard } from './components/ExtensionCard';
import './index.css';

const EXTENSIONS_DATA = [
  {
    title: 'Auto-Scaler Pro',
    description: 'Advanced automatic scaling for your Gardener workloads based on custom metrics and AI predictions.',
    category: 'Infrastructure',
    icon: '🚀',
    link: '#',
  },
  {
    title: 'Security Guard',
    description: 'Real-time vulnerability scanning and policy enforcement for all your namespaces.',
    category: 'Security',
    icon: '🛡️',
    link: '#',
  },
  {
    title: 'Cost Optimizer',
    description: 'Analyze your cluster spending and receive recommendations for right-sizing your nodes.',
    category: 'Management',
    icon: '💰',
    link: '#',
  },
  {
    title: 'Log Aggregator',
    description: 'Centralized logging solution with beautiful dashboards and alerting.',
    category: 'Observability',
    icon: '🪵',
    link: '#',
  },
  {
    title: 'Backup Master',
    description: 'Automated snapshots and disaster recovery for your entire Gardener environment.',
    category: 'Infrastructure',
    icon: '💾',
    link: '#',
  },
  {
    title: 'Identity Sync',
    description: 'Seamlessly synchronize your corporate identity provider with Gardener RBAC.',
    category: 'Security',
    icon: '🔑',
    link: '#',
  },
];

function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <img src="/logo.svg" alt="Gardener Logo" className="h-8 w-auto" />
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2 hidden sm:block"></div>
              <span className="text-xl font-bold text-gray-900 dark:text-white hidden sm:inline-block">
                Extensions
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <a 
                href="https://github.com/gardener/documentation" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-600 dark:text-gray-400 hover:text-gardener-brand dark:hover:text-gardener-brand-dark transition-colors font-medium text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.875 8.253 6.839 9.444.622.183 0.923-.491.923-1.116C7.57 15.524 10 .908 10 .908c0 0 2.683 0 4.681 0 2.683 0 4.681 0 4.681 0s2.683 0 4.681 0c0 0 2.683 0 4.681 0 0 0 .581.733.622 1.116C21.125 20.253 24 16.42 24 12c0-5.523-4.477-10-12-10z" />
                </svg>
                GitHub
              </a>
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle Dark Mode"
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 118.646 3.646 9 9 0 0120.354 15.354z" />
                  </svg>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gardener-soft dark:bg-gardener-soft-dark py-20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6">
            Extend your <span className="text-gradient">Gardener</span> experience
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-10">
            Discover a collection of community-driven extensions and official plugins to enhance the capabilities of your Gardener clusters.
          </p>
        </div>
      </section>

      {/* Grid Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXTENSIONS_DATA.map((ext, index) => (
            <ExtensionCard key={index} {...ext} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Gardener Logo" className="h-6 w-auto brightness-0 invert" />
            <span className="text-xl font-bold">Gardener Extensions</span>
          </div>
          <div className="flex gap-6 text-gray-400 text-sm">
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Gardener Project. Apache 2.0 License.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
