// Disk configuration is split; renderers still receive ordinary, resolved trees.
import { normalizeProject, TALENT_PROJECT_FORMAT, TALENT_PROJECT_VERSION } from './talent-model.js';

export const TALENT_MANIFEST_FORMAT = 'wow-workbook-talent-manifest';
export const PROJECT_URL = 'config/talent-project.json';

export function fileSlug(name) {
  // Preserve punctuation as escapes rather than collapsing distinct names.
  return encodeURIComponent(name.toLowerCase().replaceAll(' ', '-'));
}

export function compactProject(project, className = null) {
  if (className !== null && !Object.hasOwn(project.content, className)) {
    throw new Error(`Unknown class: ${className}`);
  }
  const content = className === null ? project.content : { [className]: project.content[className] };
  const shared = { classes: {}, heroes: {} };
  const heroKeys = new Map();
  const trees = {};
  for (const [key, tree] of Object.entries(project.trees)) {
    if (className !== null && tree.class !== className) continue;
    trees[key] = {
      ...tree,
      sections: tree.sections.map(section => {
        if (section.type === 'class') {
          const ref = `${tree.class}/${section.id}`;
          if (shared.classes[ref] && JSON.stringify(shared.classes[ref]) !== JSON.stringify(section)) {
            throw new Error(`Conflicting class talents for ${ref}.`);
          }
          shared.classes[ref] = section;
          return { classTalent: ref };
        }
        if (section.type === 'hero') {
          const fingerprint = `${tree.class}:${JSON.stringify(section)}`;
          let ref = heroKeys.get(fingerprint);
          if (!ref) {
            const base = `${tree.class}/${section.id}`;
            ref = base;
            let suffix = 1;
            while (Object.hasOwn(shared.heroes, ref)) ref = `${base}-${++suffix}`;
            shared.heroes[ref] = section;
            heroKeys.set(fingerprint, ref);
          }
          return { heroTalent: ref };
        }
        return section; // Spec and Apex sections stay with their specialization.
      })
    };
  }
  return JSON.parse(JSON.stringify({
    format: TALENT_PROJECT_FORMAT, version: TALENT_PROJECT_VERSION, content, shared, trees
  }));
}

export function mergeProject(current, imported) {
  // Importing one class must not delete the other classes or leave stale specs.
  const next = compactProject(current);
  const incoming = compactProject(normalizeProject(imported));
  const replaced = new Set(Object.keys(incoming.content));
  for (const [key, tree] of Object.entries(next.trees)) {
    if (replaced.has(tree.class)) delete next.trees[key];
  }
  for (const registry of ['classes', 'heroes']) {
    for (const key of Object.keys(next.shared[registry])) {
      if (replaced.has(key.split('/')[0])) delete next.shared[registry][key];
    }
    Object.assign(next.shared[registry], incoming.shared[registry]);
  }
  Object.assign(next.content, incoming.content);
  Object.assign(next.trees, incoming.trees);
  return normalizeProject(next);
}

export function splitProject(project) {
  const compact = compactProject(project);
  const files = {};
  const manifest = {
    format: TALENT_MANIFEST_FORMAT, version: 1, content: compact.content,
    classTalents: {}, heroTalents: 'hero-talent.json', specFiles: {}
  };
  const usedPaths = new Set();
  function reserve(path) {
    if (usedPaths.has(path)) throw new Error(`Configuration filename collision: ${path}`);
    usedPaths.add(path);
    return path;
  }
  files['hero-talent.json'] = { heroes: compact.shared.heroes };
  for (const [className, specs] of Object.entries(compact.content)) {
    const classPath = reserve(`class/${fileSlug(className)}.json`);
    const sections = Object.fromEntries(Object.entries(compact.shared.classes).filter(([key]) => key.startsWith(`${className}/`)));
    manifest.classTalents[className] = classPath;
    files[classPath] = { class: className, sections };
    for (const specName of specs) {
      const key = `${className}/${specName}`;
      const path = reserve(`spec/${fileSlug(className)}/${fileSlug(specName)}.json`);
      // Explicit placeholders make unfinished specs visible in the scaffold.
      files[path] = compact.trees[key] || { class: className, spec: specName, available: false };
      manifest.specFiles[key] = path;
    }
  }
  files['talent-project.json'] = manifest;
  return files;
}

export async function loadTalentProject(url = PROJECT_URL, fetcher = fetch) {
  async function read(path) {
    const response = await fetcher(path);
    if (!response.ok) throw new Error(`Talent configuration unavailable: ${path} (${response.status})`);
    return response.json();
  }
  const manifest = await read(url);
  if (manifest.format !== TALENT_MANIFEST_FORMAT) return normalizeProject(manifest);
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  const project = {
    format: TALENT_PROJECT_FORMAT, version: TALENT_PROJECT_VERSION,
    content: manifest.content, shared: { classes: {}, heroes: {} }, trees: {}
  };
  const [heroes, classes, specs] = await Promise.all([
    read(base + manifest.heroTalents),
    Promise.all(Object.entries(manifest.classTalents).map(async ([className, path]) => {
      const data = await read(base + path);
      if (data.class !== className) throw new Error(`Class mismatch in ${path}`);
      return data;
    })),
    Promise.all(Object.entries(manifest.specFiles).map(async ([key, path]) => {
      const tree = await read(base + path);
      if (`${tree.class}/${tree.spec}` !== key) throw new Error(`Specialization mismatch in ${path}`);
      return [key, tree];
    }))
  ]);
  // Preserve manifest order regardless of the order network requests finish.
  project.shared.heroes = heroes.heroes;
  for (const data of classes) Object.assign(project.shared.classes, data.sections);
  for (const [key, tree] of specs) {
    if (tree.available !== false) project.trees[key] = tree;
  }
  return normalizeProject(project);
}