export interface Extension {
  title: string;
  description: string;
  category: string;
  icon: string;
}

interface ExtensionCardProps {
  extension: Extension;
  onSelect: (extension: Extension) => void;
}

export function ExtensionCard({ extension, onSelect }: ExtensionCardProps) {
  return (
    <article className="extension-card">
      <span className="card-top">
        <img className="extension-icon" src={extension.icon} alt="" width="48" height="48" />
        <span className="extension-category">{extension.category}</span>
      </span>
      <h2>
        <button className="card-title-button" onClick={() => onSelect(extension)} aria-label={`View ${extension.title} details`}>
          {extension.title}
        </button>
      </h2>
      <p>{extension.description}</p>
    </article>
  );
}
