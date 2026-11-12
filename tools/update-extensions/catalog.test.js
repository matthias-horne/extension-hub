import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';
import { validateRegistration } from './update-extensions.js';

test('registers every known Gardener implementation once with all section tags', async () => {
  const source = await readFile(new URL('./fixtures/gardener-extensions.md', import.meta.url), 'utf8');
  const expected = new Map();
  const headings = new Set();
  let heading;
  for (const line of source.split('\n')) {
    if (line.startsWith('### ')) {
      heading = line.slice(4);
      headings.add(heading);
    }
    if (!line.startsWith('- [')) continue;
    const repository = line.slice(line.lastIndexOf('](') + 2, -1);
    if (!expected.has(repository)) expected.set(repository, []);
    expected.get(repository).push(heading);
  }
  assert.equal(expected.size, 45);

  const directory = new URL('../../extensions/', import.meta.url);
  const filenames = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
  const entries = await Promise.all(filenames.map(async (name) => {
    const entry = parse(await readFile(new URL(name, directory), 'utf8'));
    validateRegistration(entry);
    assert.equal(new Set(entry.tags).size, entry.tags.length, name + ' repeats a tag');
    return entry;
  }));
  assert.equal(new Set(entries.map((entry) => entry.repository)).size, entries.length);
  const additional = new Map();
  for (const [repository, tags] of expected) {
    const entry = entries.find((entry) => entry.repository === repository);
    assert.ok(entry, 'Missing ' + repository);
    for (const tag of tags) assert.ok(entry.tags.includes(tag), repository + ' is missing ' + tag);
    for (const tag of entry.tags.filter((tag) => !headings.has(tag))) {
      additional.set(tag, (additional.get(tag) ?? 0) + 1);
    }
  }
  for (const [tag, count] of additional) {
    assert.ok(count >= 3, tag + ' must apply to at least three known extensions');
  }
});
