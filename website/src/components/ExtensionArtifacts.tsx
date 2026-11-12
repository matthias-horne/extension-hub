import { useState } from 'react';
import type { ExtensionArtifact } from '../data/extensions';
import type { ExtensionImage } from '../data/images';
import { Icon } from './Icon';
import { MissingInformation } from './MissingInformation';

const deploymentLabels = {
  extension: 'Extension',
  'admission-runtime': 'Admission (runtime cluster)',
  'admission-virtual': 'Admission (virtual cluster)',
};

const imageDeploymentLabels = {
  extension: 'Extension (seed clusters)',
  'extension-runtime': 'Extension (runtime cluster)',
  admission: 'Admission (runtime and virtual clusters)',
};

function ArtifactCard({ label, reference, type }: { label: string; reference: string; type: 'Helm chart' | 'Container image' }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const referenceLabel = type === 'Helm chart' ? 'OCI reference' : 'image reference';

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  return (
    <li className="artifact-card">
      <div className="artifact-heading">
        <h3>{label}</h3>
        <span className="artifact-type">{type}</span>
      </div>
      <div className="artifact-reference">
        <code>{reference}</code>
        <button className="copy-manifest" onClick={copyReference} aria-label={'Copy ' + referenceLabel + ' for ' + label}>
          <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />{copyStatus === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className={copyStatus === 'unavailable' ? 'artifact-copy-status' : 'sr-only'} role="status">
        {copyStatus === 'copied' ? label + ' ' + referenceLabel + ' copied to clipboard.' : copyStatus === 'unavailable' ? 'Copy is unavailable. Select the reference above.' : ''}
      </p>
    </li>
  );
}

export function ExtensionArtifacts({ artifacts, images = [], manifestRegistry }: { artifacts: ExtensionArtifact[]; images?: ExtensionImage[]; manifestRegistry?: string }) {
  return (
    <>
      <div className="details-panel-heading">
        <span><Icon name="package" />Extension artifacts</span>
      </div>
      <div className="details-artifacts">
        {!manifestRegistry && artifacts.length === 0 && images.length === 0 ? (
          <MissingInformation title="Artifact information unavailable">
            No manifest registry, Helm charts, or container images are available for this extension. Visit the repository for deployment artifacts.
          </MissingInformation>
        ) : (
          <>
            {manifestRegistry && <section className="artifact-registry">
              <h2>Manifest registry</h2>
              <code>{manifestRegistry}</code>
            </section>}
            <section className="artifact-section">
              <h2>Helm charts ({artifacts.length})</h2>
              {artifacts.length > 0 ? (
                <>
                  <p>Helm charts referenced in this extension.yaml.</p>
                  <ul className="artifact-list">
                    {artifacts.map((artifact) => <ArtifactCard key={artifact.deployment} label={deploymentLabels[artifact.deployment]} reference={artifact.reference} type="Helm chart" />)}
                  </ul>
                </>
              ) : <p>No Helm charts are referenced in this extension.yaml.</p>}
            </section>
            <section className="artifact-section">
              <h2>Container images ({images.length})</h2>
              {images.length > 0 ? (
                <>
                  <p>Container images configured in this extension’s Helm values.</p>
                  <ul className="artifact-list">
                    {images.map((image) => <ArtifactCard key={image.reference} label={image.deployments.map((deployment) => imageDeploymentLabels[deployment]).join(', ')} reference={image.reference} type="Container image" />)}
                  </ul>
                </>
              ) : <p>No container images are configured in this extension’s Helm values.</p>}
            </section>
          </>
        )}
      </div>
    </>
  );
}
