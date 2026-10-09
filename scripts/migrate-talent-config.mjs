// Migrate legacy split data, or apply a Designer export to per-class storage.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTalentProject, mergeProject, splitProject } from '../js/talent-config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = resolve(root, 'config');
const fetchFile = async path => {
  try {
    const text = await readFile(resolve(root, path), 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { ok: false, status: 404 };
  }
};
const oldManifest = JSON.parse(await readFile(resolve(config, 'talent-project.json'), 'utf8'));
let project = await loadTalentProject('config/talent-project.json', fetchFile);
const importIndex = process.argv.indexOf('--import');
if (importIndex !== -1) {
  if (!process.argv[importIndex + 1]) throw new Error('--import requires a class-export filename.');
  const imported = JSON.parse(await readFile(resolve(process.argv[importIndex + 1]), 'utf8'));
  project = mergeProject(project, imported);
}
const files = splitProject(project);
if (!process.argv.includes('--check')) {
  // Write the manifest last: it must never point to files that do not exist yet.
  for (const [path, payload] of Object.entries(files)) {
    const destination = resolve(config, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(payload, null, 2) + '\n');
  }
  // Remove only files actually referenced by the previous index, after publishing
  // the new index. Legacy abilities are now included in their owning class file.
  const obsolete = oldManifest.version === 1
    ? [...Object.values(oldManifest.classTalents || {}), ...Object.values(oldManifest.specFiles || {}), oldManifest.heroTalents, 'abilities.json']
    : Object.values(oldManifest.classFiles || {});
  for (const path of obsolete) {
    if (!path || Object.hasOwn(files, path)) continue;
    const destination = resolve(config, path);
    if (!destination.startsWith(config + '/') && !destination.startsWith(config + '\\')) {
      throw new Error(`Refusing to remove a file outside config: ${path}`);
    }
    await rm(destination, { force: true });
  }
}
console.log(`${process.argv.includes('--check') ? 'Validated' : 'Wrote'} ${Object.keys(project.content).length} self-contained class files and one manifest; ${Object.keys(project.trees).length} configured specializations.`);