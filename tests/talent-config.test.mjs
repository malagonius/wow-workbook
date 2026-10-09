import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTree, normalizeProject } from '../js/talent-model.js';
import { classFileName, compactProject, fileSlug, loadTalentProject, mergeLegacyAbilities, mergeProject, splitProject } from '../js/talent-config.js';

function fixture() {
  const blood = createTree({ className: 'Death Knight', specName: 'Blood' });
  const frost = structuredClone(blood);
  frost.spec = 'Frost';
  const mage = createTree({ className: 'Mage', specName: 'Frost' });
  return normalizeProject({
    format: 'wow-workbook-talent-project', version: 5,
    content: { 'Death Knight': ['Blood', 'Frost', 'Unholy'], Mage: ['Frost'] },
    abilities: {
      'Death Knight': [{ name: 'Death Coil', type: 'spell', description: 'Class ability' }],
      'Death Knight/Blood': [{ name: 'Blood Presence', type: 'passive', description: 'Spec ability' }],
      Mage: [{ name: 'Blink', type: 'spell', range: '20 yd' }]
    },
    trees: { 'Death Knight/Blood': blood, 'Death Knight/Frost': frost, 'Mage/Frost': mage }
  });
}

function memoryFetch(files) {
  return async path => {
    const data = files[path.replace(/^config\//, '')];
    return { ok: !!data, status: data ? 200 : 404, json: async () => structuredClone(data) };
  };
}

function legacyFiles(project) {
  const compact = compactProject(project);
  const files = { 'hero-talent.json': { heroes: compact.shared.heroes }, 'abilities.json': compact.abilities };
  const manifest = {
    format: 'wow-workbook-talent-manifest', version: 1, content: compact.content,
    classTalents: {}, heroTalents: 'hero-talent.json', specFiles: {}
  };
  for (const [className, specs] of Object.entries(compact.content)) {
    const path = `class/${fileSlug(className)}.json`;
    manifest.classTalents[className] = path;
    files[path] = { class: className, sections: Object.fromEntries(
      Object.entries(compact.shared.classes).filter(([key]) => key.startsWith(`${className}/`))
    ) };
    for (const spec of specs) {
      const key = `${className}/${spec}`;
      const specPath = `spec/${fileSlug(className)}/${fileSlug(spec)}.json`;
      manifest.specFiles[key] = specPath;
      files[specPath] = compact.trees[key] || { class: className, spec, available: false };
    }
  }
  files['talent-project.json'] = manifest;
  return files;
}

test('class talents share one object across specs but never across classes', () => {
  const project = fixture();
  const blood = project.trees['Death Knight/Blood'].sections[0];
  const frost = project.trees['Death Knight/Frost'].sections[0];
  assert.equal(blood, frost);
  assert.notEqual(blood, project.trees['Mage/Frost'].sections[0]);
  blood.nodes[0].description = 'Shared edit';
  assert.equal(frost.nodes[0].description, 'Shared edit');
});

test('compact serialization deduplicates class and identical hero sections', () => {
  const compact = compactProject(fixture());
  assert.equal(Object.keys(compact.shared.classes).length, 2);
  assert.equal(Object.keys(compact.shared.heroes).length, 2);
  assert.deepEqual(compact.trees['Death Knight/Blood'].sections[0], { classTalent: 'Death Knight/class' });
  assert.deepEqual(normalizeProject(compact), fixture());
});

test('class export includes all its specs and no other class data', () => {
  const compact = compactProject(fixture(), 'Death Knight');
  assert.deepEqual(Object.keys(compact.content), ['Death Knight']);
  assert.deepEqual(Object.keys(compact.trees), ['Death Knight/Blood', 'Death Knight/Frost']);
  assert.ok(Object.keys(compact.shared.classes).every(key => key.startsWith('Death Knight/')));
  assert.ok(Object.keys(compact.shared.heroes).every(key => key.startsWith('Death Knight/')));
  assert.deepEqual(compact.content['Death Knight'], ['Blood', 'Frost', 'Unholy']);
  assert.deepEqual(Object.keys(compact.abilities), ['Death Knight', 'Death Knight/Blood']);
  assert.throws(() => compactProject(fixture(), 'Missing'), /Unknown class/);
});

test('repository stores exactly one complete file per class plus an index', async () => {
  const project = fixture();
  const files = splitProject(project);
  assert.deepEqual(Object.keys(files), ['class/death-knight.json', 'class/mage.json', 'talent-project.json']);
  assert.deepEqual(files['class/death-knight.json'], compactProject(project, 'Death Knight'));
  assert.deepEqual(files['class/death-knight.json'].content['Death Knight'], ['Blood', 'Frost', 'Unholy']);
  assert.deepEqual(files['talent-project.json'], {
    format: 'wow-workbook-talent-manifest', version: 2,
    classFiles: { 'Death Knight': 'class/death-knight.json', Mage: 'class/mage.json' }
  });
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(files)), project);
});

test('class-file reload preserves shared hero edit identity', async () => {
  const project = await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(fixture())));
  const blood = project.trees['Death Knight/Blood'].sections.find(s => s.type === 'hero');
  const frost = project.trees['Death Knight/Frost'].sections.find(s => s.type === 'hero');
  assert.equal(blood, frost);
  blood.nodes[0].name = 'Shared hero edit';
  assert.equal(frost.nodes[0].name, 'Shared hero edit');
});

test('different hero trees and spec-specific Apex sections stay inside their class file', () => {
  const project = fixture();
  const frost = project.trees['Death Knight/Frost'];
  frost.sections = frost.sections.map(section => section.type === 'hero' ? structuredClone(section) : section);
  frost.sections.find(s => s.type === 'hero').nodes[0].name = 'Frost hero';
  const files = splitProject(project);
  const data = files['class/death-knight.json'];
  assert.equal(Object.keys(data.shared.heroes).length, 2);
  assert.ok(data.trees['Death Knight/Frost'].sections.some(s => s.type === 'apex'));
  assert.ok(data.trees['Death Knight/Frost'].sections.some(s => s.classTalent));
  assert.ok(data.trees['Death Knight/Frost'].sections.some(s => s.heroTalent));
});

test('class imports preserve unrelated classes and remove replaced-class stale specs', () => {
  const current = fixture();
  const imported = compactProject(current, 'Death Knight');
  delete imported.trees['Death Knight/Frost'];
  imported.content['Death Knight'] = ['Blood'];
  delete imported.abilities['Death Knight/Blood'];
  imported.abilities['Death Knight'][0].description = 'Updated ability';
  imported.shared.classes['Death Knight/class'].nodes[0].name = 'Updated class';
  const merged = mergeProject(current, imported);
  assert.deepEqual(merged.trees['Mage/Frost'], current.trees['Mage/Frost']);
  assert.equal(merged.trees['Death Knight/Frost'], undefined);
  assert.equal(merged.trees['Death Knight/Blood'].sections[0].nodes[0].name, 'Updated class');
  assert.deepEqual(merged.abilities.Mage, current.abilities.Mage);
  assert.equal(merged.abilities['Death Knight/Blood'], undefined);
  assert.equal(merged.abilities['Death Knight'][0].description, 'Updated ability');
});

test('legacy local ability drafts migrate once without losing fields or duplicating entries', () => {
  const project = fixture();
  const legacy = {
    'Death Knight': [...project.abilities['Death Knight'], { name: 'Custom spell', school: 'Frost', cooldown: '12 sec', custom: true }],
    'Death Knight/Blood': [{ name: 'Local passive', type: 'passive' }],
    'Unrelated Class': [{ name: 'Ignore' }]
  };
  const migrated = mergeLegacyAbilities(project, legacy);
  assert.equal(migrated.abilities['Death Knight'].length, 2);
  assert.equal(migrated.abilities['Death Knight'][1].custom, true);
  assert.equal(migrated.abilities['Death Knight/Blood'].length, 2);
  assert.equal(migrated.abilities['Unrelated Class'], undefined);
  assert.deepEqual(mergeLegacyAbilities(migrated, legacy), migrated);
  assert.equal(project.abilities['Death Knight'].length, 1);
});

test('legacy whole-project imports and old draft JSON remain supported', async () => {
  const legacy = structuredClone(fixture());
  legacy.version = 5;
  assert.deepEqual(mergeProject(fixture(), legacy), fixture());
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch({ 'talent-project.json': legacy })), fixture());
  assert.deepEqual(normalizeProject(JSON.parse(JSON.stringify(compactProject(fixture())))), fixture());
});

test('legacy exports without abilities preserve existing abilities, explicit empty exports remove them', () => {
  const current = fixture();
  const legacy = compactProject(current, 'Death Knight');
  delete legacy.abilities;
  assert.deepEqual(mergeProject(current, legacy).abilities, current.abilities);
  const empty = { ...legacy, abilities: {} };
  assert.deepEqual(mergeProject(current, empty).abilities, { Mage: current.abilities.Mage });
});

test('missing shared references fail explicitly rather than silently dropping talents', () => {
  const compact = compactProject(fixture());
  delete compact.shared.classes['Death Knight/class'];
  assert.throws(() => normalizeProject(compact), /Missing shared talent section/);
});

test('conflicting old class copies are rejected without data loss', () => {
  // JSON copies emulate old disk files; structuredClone preserves shared aliases.
  const legacy = JSON.parse(JSON.stringify(fixture()));
  legacy.trees['Death Knight/Frost'].sections[0].nodes[0].name = 'Conflicting talent';
  assert.throws(() => normalizeProject(legacy), /Conflicting class talents/);
});

test('existing specs without a class section inherit the shared class tree', () => {
  const legacy = structuredClone(fixture());
  legacy.trees['Death Knight/Frost'].sections = legacy.trees['Death Knight/Frost'].sections.filter(s => s.type !== 'class');
  const project = normalizeProject(legacy);
  assert.equal(project.trees['Death Knight/Frost'].sections[0], project.trees['Death Knight/Blood'].sections[0]);
});

test('missing config files and wrong spec identities produce actionable errors', async () => {
  const files = splitProject(fixture());
  delete files['class/mage.json'];
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /class\/mage.json.*404/);
  files['class/mage.json'] = compactProject(fixture(), 'Mage');
  files['class/mage.json'].trees['Mage/Frost'].spec = 'Fire';
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /Specialization mismatch/);
});

test('filename normalization detects collisions and escapes path separators', () => {
  assert.equal(fileSlug('Bio-Tech'), 'bio-tech');
  assert.equal(fileSlug('../Example'), '..%2Fexample');
  assert.equal(classFileName('Death Knight'), 'death-knight.json');
  assert.equal(classFileName('Thinker'), 'thinker.json');
  const project = fixture();
  project.content.mage = [];
  assert.throws(() => splitProject(project), /filename collision/);
});

test('replacing an exported class file updates specs without touching the manifest', async () => {
  const project = fixture();
  const files = splitProject(project);
  const manifest = structuredClone(files['talent-project.json']);
  const replacement = compactProject(project, 'Death Knight');
  delete replacement.trees['Death Knight/Frost'];
  replacement.content['Death Knight'] = ['Blood', 'New Spec'];
  replacement.trees['Death Knight/New Spec'] = createTree({ className: 'Death Knight', specName: 'New Spec' });
  replacement.shared.classes['Death Knight/class'].nodes[0].name = 'Published edit';
  // Use the same class section for the new spec as all existing specs.
  replacement.trees['Death Knight/New Spec'].sections[0] = { classTalent: 'Death Knight/class' };
  files['class/death-knight.json'] = replacement;
  const loaded = await loadTalentProject('config/talent-project.json', memoryFetch(files));
  assert.deepEqual(files['talent-project.json'], manifest);
  assert.deepEqual(loaded.content['Death Knight'], ['Blood', 'New Spec']);
  assert.equal(loaded.trees['Death Knight/Frost'], undefined);
  assert.equal(loaded.trees['Death Knight/New Spec'].sections[0].nodes[0].name, 'Published edit');
  assert.deepEqual(loaded.trees['Mage/Frost'], project.trees['Mage/Frost']);
});

test('every exported class loads independently without fetching companion files', async () => {
  const project = fixture();
  for (const className of Object.keys(project.content)) {
    const exported = compactProject(project, className);
    let requests = 0;
    const loaded = await loadTalentProject(classFileName(className), async () => {
      requests += 1;
      return { ok: true, json: async () => structuredClone(exported) };
    });
    assert.equal(requests, 1);
    assert.deepEqual(loaded, normalizeProject(exported));
  }
});

test('class files reject wrong classes, cross-class shared data and missing references', async () => {
  const files = splitProject(fixture());
  const path = 'class/death-knight.json';
  const original = structuredClone(files[path]);
  files[path] = compactProject(fixture(), 'Mage');
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /Class mismatch/);
  files[path] = structuredClone(original);
  files[path].shared.heroes['Mage/hero'] = {};
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /Shared talent class mismatch/);
  files[path] = structuredClone(original);
  delete files[path].shared.classes['Death Knight/class'];
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /Missing shared talent section/);
  files[path] = structuredClone(original);
  files[path].abilities.Mage = [];
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /Ability class mismatch/);
});

test('legacy split manifests migrate losslessly to one file per class', async () => {
  const project = fixture();
  const legacy = legacyFiles(project);
  const loaded = await loadTalentProject('config/talent-project.json', memoryFetch(legacy));
  assert.deepEqual(loaded, project);
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(loaded))), project);
});

test('invalid manifest versions and registries fail explicitly', async () => {
  const manifest = splitProject(fixture())['talent-project.json'];
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch({
    'talent-project.json': { ...manifest, version: 99 }
  })), /Unsupported talent manifest version/);
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch({
    'talent-project.json': { ...manifest, classFiles: null }
  })), /classFiles registry/);
});

test('empty projects can still round-trip', async () => {
  const project = normalizeProject({ format: 'wow-workbook-talent-project', version: 5, content: {}, trees: {} });
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(project))), project);
});

test('repository data round-trips losslessly through per-class files', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fetcher = async path => ({ ok: true, json: async () => JSON.parse(await readFile(resolve(root, path), 'utf8')) });
  const project = await loadTalentProject('config/talent-project.json', fetcher);
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(project))), project);
  for (const className of Object.keys(project.content)) {
    const exported = compactProject(project, className);
    const manifest = JSON.parse(await readFile(resolve(root, 'config/talent-project.json'), 'utf8'));
    assert.equal(manifest.classFiles[className], `class/${classFileName(className)}`);
    assert.ok(Object.values(exported.trees).every(tree => tree.class === className));
    assert.deepEqual(mergeProject(project, exported), project);
  }
});