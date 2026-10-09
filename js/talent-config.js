// Each class file is self-contained; renderers receive ordinary, resolved trees.
import { normalizeProject, TALENT_PROJECT_FORMAT, TALENT_PROJECT_VERSION } from './talent-model.js';

export const TALENT_MANIFEST_FORMAT = 'wow-workbook-talent-manifest';
export const PROJECT_URL = 'config/talent-project.json';

export function fileSlug(name) {
  // Preserve punctuation as escapes rather than collapsing distinct names.
  return encodeURIComponent(name.toLowerCase().replaceAll(' ', '-'));
}

export function classFileName(className) {
  return `${fileSlug(className)}.json`;
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
  const abilities = Object.fromEntries(Object.entries(project.abilities || {}).filter(([key]) =>
    className === null || key === className || key.startsWith(`${className}/`)
  ));
  return JSON.parse(JSON.stringify({
    format: TALENT_PROJECT_FORMAT, version: TALENT_PROJECT_VERSION, content, abilities, shared, trees
  }));
}

export function mergeProject(current, imported) {
  // Importing one class must not delete the other classes or leave stale specs.
  const next = compactProject(current);
  const incoming = compactProject(normalizeProject(imported));
  const replaced = new Set(Object.keys(incoming.content));
  // Older exports did not carry abilities. Do not interpret that omission as
  // deleting already-published abilities; new exports use an explicit registry.
  if (Object.hasOwn(imported, 'abilities')) {
    for (const key of Object.keys(next.abilities)) {
      if (replaced.has(key.split('/')[0])) delete next.abilities[key];
    }
  }
  Object.assign(next.abilities, incoming.abilities);
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

export function mergeLegacyAbilities(project, legacy) {
  const next = compactProject(project);
  for (const [key, items] of Object.entries(legacy || {})) {
    if (!Object.hasOwn(next.content, key.split('/')[0]) || !Array.isArray(items)) continue;
    const list = next.abilities[key] || [];
    const seen = new Set(list.map(item => JSON.stringify(item)));
    for (const item of items) {
      const fingerprint = JSON.stringify(item);
      if (!seen.has(fingerprint)) {
        list.push(item);
        seen.add(fingerprint);
      }
    }
    next.abilities[key] = list;
  }
  return normalizeProject(next);
}

export function splitProject(project) {
  // Retain the public helper name for existing integrations. Only classes split now.
  const files = {};
  const manifest = {
    format: TALENT_MANIFEST_FORMAT, version: 2, classFiles: {}
  };
  const usedPaths = new Set();
  for (const className of Object.keys(project.content)) {
    const path = `class/${classFileName(className)}`;
    if (usedPaths.has(path)) throw new Error(`Configuration filename collision: ${path}`);
    usedPaths.add(path);
    manifest.classFiles[className] = path;
    files[path] = compactProject(project, className);
  }
  files['talent-project.json'] = manifest;
  return files;
}

function validateClassFile(data, className, path) {
  if (data.format !== TALENT_PROJECT_FORMAT || Object.keys(data.content || {}).length !== 1 ||
      !Object.hasOwn(data.content, className) || !Array.isArray(data.content[className])) {
    throw new Error(`Class mismatch in ${path}: expected only ${className}.`);
  }
  for (const [key, tree] of Object.entries(data.trees || {})) {
    if (tree.class !== className || key !== `${className}/${tree.spec}` ||
        !data.content[className].includes(tree.spec)) {
      throw new Error(`Specialization mismatch in ${path}: ${key}`);
    }
  }
  for (const registry of ['classes', 'heroes']) {
    for (const key of Object.keys(data.shared?.[registry] || {})) {
      if (!key.startsWith(`${className}/`)) throw new Error(`Shared talent class mismatch in ${path}: ${key}`);
    }
  }
  for (const [key, items] of Object.entries(data.abilities || {})) {
    if ((key !== className && !key.startsWith(`${className}/`)) || !Array.isArray(items)) {
      throw new Error(`Ability class mismatch in ${path}: ${key}`);
    }
  }
  // Resolve in isolation: a class cannot borrow missing talents from another file.
  return compactProject(normalizeProject(data), className);
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
  if (manifest.version === 2) {
    if (!manifest.classFiles || typeof manifest.classFiles !== 'object' || Array.isArray(manifest.classFiles)) {
      throw new Error('Talent manifest must contain a classFiles registry.');
    }
    const classes = await Promise.all(Object.entries(manifest.classFiles).map(async ([className, path]) => {
      if (typeof path !== 'string' || !path) throw new Error(`Missing class filename for ${className}.`);
      return validateClassFile(await read(base + path), className, path);
    }));
    const project = {
      format: TALENT_PROJECT_FORMAT, version: TALENT_PROJECT_VERSION,
      content: {}, abilities: {}, shared: { classes: {}, heroes: {} }, trees: {}
    };
    // The spec registry lives in each class file, so replacing it needs no index edits.
    for (const data of classes) {
      Object.assign(project.content, data.content);
      Object.assign(project.abilities, data.abilities);
      Object.assign(project.trees, data.trees);
      Object.assign(project.shared.classes, data.shared.classes);
      Object.assign(project.shared.heroes, data.shared.heroes);
    }
    return normalizeProject(project);
  }
  if (manifest.version !== 1) throw new Error(`Unsupported talent manifest version: ${manifest.version}`);
  // Legacy split manifests remain readable for migration and older installations.
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
  // The old repository kept baseline abilities outside talent exports.
  const abilitiesResponse = await fetcher(base + 'abilities.json');
  if (abilitiesResponse.ok) project.abilities = await abilitiesResponse.json();
  else if (abilitiesResponse.status !== 404) throw new Error('Legacy ability configuration could not be loaded.');
  return normalizeProject(project);
}