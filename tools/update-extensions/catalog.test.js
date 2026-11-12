import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';
import { validateRegistration } from './update-extensions.js';

test('registers every known Gardener implementation once with the approved tags', async () => {
  const source = await readFile(new URL('./fixtures/gardener-extensions.md', import.meta.url), 'utf8');
  const expected = new Map();
  const sectionTags = new Map([
    ['Infrastructure Provider', 'Infrastructure'],
    ['Primary DNS Provider', 'DNS'],
    ['Operating System', 'OS'],
    ['Container Runtime', 'Runtime'],
    ['Network Plugin', 'Network'],
  ]);
  const approvedTags = new Set([
    'Infrastructure', 'DNS', 'OS', 'Runtime', 'Network', 'Security',
    'Observability', 'Images', 'Storage', 'GitOps', 'Example',
  ]);
  let heading;
  for (const line of source.split('\n')) {
    if (line.startsWith('### ')) {
      heading = line.slice(4);
    }
    if (!line.startsWith('- [')) continue;
    const repository = line.slice(line.lastIndexOf('](') + 2, -1);
    if (!expected.has(repository)) expected.set(repository, []);
    const tag = sectionTags.get(heading);
    if (tag) expected.get(repository).push(tag);
  }
  assert.equal(expected.size, 45);

  const directory = new URL('../../extensions/', import.meta.url);
  const filenames = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
  const entries = await Promise.all(filenames.map(async (name) => {
    const entry = parse(await readFile(new URL(name, directory), 'utf8'));
    validateRegistration(entry);
    assert.ok(Array.isArray(entry.tags) && entry.tags.length > 0, name + ' requires tags');
    assert.equal(new Set(entry.tags).size, entry.tags.length, name + ' repeats a tag');
    for (const tag of entry.tags) assert.ok(approvedTags.has(tag), name + ' has an unapproved tag: ' + tag);
    return entry;
  }));
  assert.equal(new Set(entries.map((entry) => entry.repository)).size, entries.length);
  for (const [repository, tags] of expected) {
    const entry = entries.find((entry) => entry.repository === repository);
    assert.ok(entry, 'Missing ' + repository);
    for (const tag of tags) assert.ok(entry.tags.includes(tag), repository + ' is missing ' + tag);
  }
  const counts = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  assert.deepEqual(new Set(counts.keys()), approvedTags);
  // Runtime and Example are existing categories; Storage and GitOps are approved exceptions.
  const smallCategories = new Set(['Runtime', 'Example', 'Storage', 'GitOps']);
  for (const [tag, count] of counts) {
    if (!smallCategories.has(tag)) assert.ok(count >= 3, tag + ' must apply to at least three extensions');
  }
});
