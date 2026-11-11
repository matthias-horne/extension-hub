export type ImageDeployment = 'extension' | 'extension-runtime' | 'admission';

export interface ExtensionImage {
  reference: string;
  deployments: ImageDeployment[];
}

function referencePart(value: unknown, allowNumber = false): string | undefined {
  const part = typeof value === 'string' ? value.trim()
    : allowNumber && typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return part && !/\s|\{\{/.test(part) ? part : undefined;
}

function imageReference(image: unknown): string | undefined {
  if (typeof image === 'string') return referencePart(image);
  if (!image || typeof image !== 'object' || Array.isArray(image)) return undefined;
  const fields = image as Record<string, unknown>;
  if (typeof fields.ref === 'string' && fields.ref.trim()) return referencePart(fields.ref);
  const repository = referencePart(fields.repository);
  if (!repository) return undefined;
  if (typeof fields.digest === 'string' && fields.digest.trim()) {
    const digest = referencePart(fields.digest);
    return digest ? repository + '@' + digest : undefined;
  }
  const tag = referencePart(fields.tag, true);
  return tag ? repository + ':' + tag : undefined;
}

// Only inspect image fields in Helm values, so chart and manifest repositories
// cannot be mistaken for container images. Nested components and image lists
// use the same conventions as a chart's top-level image.
export function imagesFromValues(values: unknown): string[] {
  const references = new Set<string>();
  const ancestors = new Set<object>();

  function visit(value: unknown, isImage = false, isCollection = false) {
    if (isImage) {
      const reference = imageReference(value);
      if (reference) {
        references.add(reference);
        return;
      }
    }
    if (!value || typeof value !== 'object' || ancestors.has(value)) return;
    ancestors.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, isImage, isCollection);
    } else {
      for (const [key, item] of Object.entries(value)) {
        visit(item, key === 'image' || key === 'images' || isCollection || (isImage && typeof item === 'object'), key === 'images');
      }
    }
    ancestors.delete(value);
  }

  visit(values);
  return [...references];
}

export function extensionImages(values: { deployment: ImageDeployment; values: unknown }[]): ExtensionImage[] {
  const images = new Map<string, ExtensionImage>();
  for (const entry of values) {
    for (const reference of imagesFromValues(entry.values)) {
      const image = images.get(reference);
      if (image) {
        if (!image.deployments.includes(entry.deployment)) image.deployments.push(entry.deployment);
      } else {
        images.set(reference, { reference, deployments: [entry.deployment] });
      }
    }
  }
  return [...images.values()];
}
