import { useEffect, useState } from 'react';
import type { ExtensionArtifact } from '../data/extensions';
import type { ExtensionImage } from '../data/images';
import { Icon } from './Icon';

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

function ArtifactRow({ label, reference, type }: { label: string; reference: string; type: 'Helm chart' | 'Container image' }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const referenceLabel = type === 'Helm chart' ? 'OCI reference' : 'image reference';

  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timer = setTimeout(() => setCopyStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('unavailable');
    }
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <div className="artifact-reference">
          <code className="artifact-value">{reference}</code>
          <button className="button button-small button-icon" onClick={copyReference} aria-label={'Copy ' + referenceLabel + ' for ' + label} title="Copy to clipboard">
            <Icon name={copyStatus === 'copied' ? 'check' : 'copy'} />
          </button>
        </div>
        <p className={copyStatus === 'unavailable' ? 'artifact-copy-status' : 'sr-only'} role="status">
          {copyStatus === 'copied' ? label + ' ' + referenceLabel + ' copied to clipboard.' : copyStatus === 'unavailable' ? 'Copy is unavailable. Select the reference above.' : ''}
        </p>
      </dd>
    </div>
  );
}

export function ExtensionArtifacts({ artifacts, images = [], manifestRegistry }: { artifacts: ExtensionArtifact[]; images?: ExtensionImage[]; manifestRegistry?: string }) {
  const registryUrl = manifestRegistry && (/^https?:\/\//i.test(manifestRegistry)
    ? manifestRegistry
    : 'https://' + manifestRegistry.replace(/^oci:\/\//i, ''));

  return (
    <>
      <div className="details-panel-heading">
        <span><Icon name="package" />Extension artifacts</span>
      </div>
      <div className="panel-body">
        {manifestRegistry && <section className="content-section">
          <h2 className="section-title">Manifest registry</h2>
          <dl className="metadata-table artifact-metadata">
            <div>
              <dt>Registry</dt>
              <dd><div className="artifact-reference">
                <span className="artifact-value">{manifestRegistry}</span>
                <a className="button button-small button-icon" href={registryUrl} target="_blank" rel="noopener noreferrer" aria-label="Open manifest registry" title="Open registry">
                  <Icon name="external" />
                </a>
              </div></dd>
            </div>
          </dl>
        </section>}
        <section className="content-section">
          <h2 className="section-title">Helm charts</h2>
          {artifacts.length > 0 ? (
            <dl className="metadata-table artifact-metadata">
              {artifacts.map((artifact) => <ArtifactRow key={artifact.deployment} label={deploymentLabels[artifact.deployment]} reference={artifact.reference} type="Helm chart" />)}
            </dl>
          ) : <p className="panel-description">No Helm charts are referenced in this extension.yaml.</p>}
        </section>
        <section className="content-section">
          <h2 className="section-title">Container images</h2>
          {images.length > 0 ? (
            <dl className="metadata-table artifact-metadata">
              {images.map((image) => <ArtifactRow key={image.reference} label={image.deployments.map((deployment) => imageDeploymentLabels[deployment]).join(', ')} reference={image.reference} type="Container image" />)}
            </dl>
          ) : <p className="panel-description">No container images are configured in this extension's Helm values.</p>}
        </section>
      </div>
    </>
  );
}
