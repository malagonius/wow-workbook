import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTree, normalizeProject } from '../js/talent-model.js';
import { compactProject, fileSlug, loadTalentProject, mergeProject, splitProject } from '../js/talent-config.js';

function fixture() {
  const blood = createTree({ className: 'Death Knight', specName: 'Blood' });
  const frost = structuredClone(blood);
  frost.spec = 'Frost';
  const mage = createTree({ className: 'Mage', specName: 'Frost' });
  return normalizeProject({
    format: 'wow-workbook-talent-project', version: 5,
    content: { 'Death Knight': ['Blood', 'Frost', 'Unholy'], Mage: ['Frost'] },
    trees: { 'Death Knight/Blood': blood, 'Death Knight/Frost': frost, 'Mage/Frost': mage }
  });
}

function memoryFetch(files) {
  return async path => {
    const data = files[path.replace(/^config\//, '')];
    return { ok: !!data, status: data ? 200 : 404, json: async () => structuredClone(data) };
  };
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
  assert.throws(() => compactProject(fixture(), 'Missing'), /Unknown class/);
});

test('split scaffold has collision-safe per-class spec paths and missing-spec placeholders', async () => {
  const project = fixture();
  const files = splitProject(project);
  assert.ok(files['spec/death-knight/frost.json']);
  assert.ok(files['spec/mage/frost.json']);
  assert.equal(files['spec/death-knight/unholy.json'].available, false);
  assert.equal(files['class/death-knight.json'].class, 'Death Knight');
  assert.ok(files['hero-talent.json']);
  assert.equal(files['talent-project.json'].trees, undefined);
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(files)), project);
});

test('split reload preserves shared hero edit identity', async () => {
  const project = await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(fixture())));
  const blood = project.trees['Death Knight/Blood'].sections.find(s => s.type === 'hero');
  const frost = project.trees['Death Knight/Frost'].sections.find(s => s.type === 'hero');
  assert.equal(blood, frost);
  blood.nodes[0].name = 'Shared hero edit';
  assert.equal(frost.nodes[0].name, 'Shared hero edit');
});

test('different hero trees remain separate, Apex stays in each spec file', () => {
  const project = fixture();
  project.trees['Death Knight/Frost'].sections.find(s => s.type === 'hero').nodes[0].name = 'Frost hero';
  const files = splitProject(project);
  assert.equal(Object.keys(files['hero-talent.json'].heroes).length, 3);
  assert.ok(files['spec/death-knight/frost.json'].sections.some(s => s.type === 'apex'));
  assert.ok(!files['spec/death-knight/frost.json'].sections.some(s => s.type === 'class' || s.type === 'hero'));
});

test('class imports preserve unrelated classes and remove replaced-class stale specs', () => {
  const current = fixture();
  const imported = compactProject(current, 'Death Knight');
  delete imported.trees['Death Knight/Frost'];
  imported.content['Death Knight'] = ['Blood'];
  imported.shared.classes['Death Knight/class'].nodes[0].name = 'Updated class';
  const merged = mergeProject(current, imported);
  assert.deepEqual(merged.trees['Mage/Frost'], current.trees['Mage/Frost']);
  assert.equal(merged.trees['Death Knight/Frost'], undefined);
  assert.equal(merged.trees['Death Knight/Blood'].sections[0].nodes[0].name, 'Updated class');
});

test('legacy whole-project imports and old draft JSON remain supported', async () => {
  const legacy = structuredClone(fixture());
  legacy.version = 5;
  assert.deepEqual(mergeProject(fixture(), legacy), fixture());
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch({ 'talent-project.json': legacy })), fixture());
  assert.deepEqual(normalizeProject(JSON.parse(JSON.stringify(compactProject(fixture())))), fixture());
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
  delete files['spec/mage/frost.json'];
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /spec\/mage\/frost.json.*404/);
  files['spec/mage/frost.json'] = { class: 'Mage', spec: 'Fire', available: false };
  await assert.rejects(loadTalentProject('config/talent-project.json', memoryFetch(files)), /Specialization mismatch/);
});

test('filename normalization detects collisions and escapes path separators', () => {
  assert.equal(fileSlug('Bio-Tech'), 'bio-tech');
  assert.equal(fileSlug('../Example'), '..%2Fexample');
  const project = fixture();
  project.content.Mage.push('frost');
  assert.throws(() => splitProject(project), /filename collision/);
});

test('empty projects can still round-trip', async () => {
  const project = normalizeProject({ format: 'wow-workbook-talent-project', version: 5, content: {}, trees: {} });
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(project))), project);
});

test('repository data round-trips losslessly through the scaffold', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fetcher = async path => ({ ok: true, json: async () => JSON.parse(await readFile(resolve(root, path), 'utf8')) });
  const project = await loadTalentProject('config/talent-project.json', fetcher);
  assert.deepEqual(await loadTalentProject('config/talent-project.json', memoryFetch(splitProject(project))), project);
  for (const className of Object.keys(project.content)) {
    const exported = compactProject(project, className);
    assert.ok(Object.values(exported.trees).every(tree => tree.class === className));
    assert.deepEqual(mergeProject(project, exported), project);
  }
});
