import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySection, createTree, makeNode, makeSection, validateSection } from '../js/talent-model.js';

test('unused sockets do not report missing incoming connections', () => {
  for (const section of createTree({ className: 'Test', specName: 'Test' }).sections) {
    const result = validateSection(section);
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues.map(issue => issue.field), ['maxPoints']);
  }
  const placeholders = createEmptySection({ id: 'legacy', type: 'spec', selectableEmpty: true, maxPoints: 34 });
  assert.deepEqual(validateSection(placeholders).issues, []);
});

test('validation identifies incomplete choices, disconnected talents and section settings', () => {
  const section = makeSection({
    id: 'spec', maxPoints: 4,
    nodes: [
      makeNode({ id: 'root', name: 'Root' }),
      makeNode({ id: 'choice', name: 'Choice', kind: 'choice', row: 1, choices: [{ name: 'Only option' }] })
    ]
  });
  const result = validateSection(section);
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 3);
  assert.deepEqual(result.issues.filter(issue => issue.nodeIds.includes('choice')).map(issue => issue.message), [
    'Choice node choice needs two named options.',
    'Node choice has no incoming connection.'
  ]);
  assert.equal(result.issues.find(issue => issue.field === 'maxPoints').severity, 'warning');
});

test('validation associates duplicate and dangling connections with their endpoints and line indexes', () => {
  const section = makeSection({
    id: 'spec',
    nodes: [makeNode({ id: 'a', name: 'A' }), makeNode({ id: 'b', name: 'B', row: 1 })],
    connections: [{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'b', to: 'missing' }]
  });
  const result = validateSection(section);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
  const duplicate = result.issues.find(issue => issue.message.startsWith('Duplicate connection'));
  assert.deepEqual(duplicate.connectionIndexes, [0, 1]);
  assert.deepEqual(duplicate.nodeIds, ['a', 'b']);
  const dangling = result.issues.find(issue => issue.message.includes('missing node'));
  assert.deepEqual(dangling.connectionIndexes, [2]);
  assert.deepEqual(dangling.nodeIds, ['b', 'missing']);
  section.connections = [{ from: 'a', to: 'b' }];
  assert.deepEqual(validateSection(section).issues, []);
});

test('loop highlighting includes every cycle but not incoming or outgoing branches', () => {
  const section = makeSection({
    id: 'spec',
    nodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, column) => makeNode({ id, name: id, column })),
    connections: [
      { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'b' },
      { from: 'c', to: 'd' }, { from: 'e', to: 'f' }, { from: 'f', to: 'e' },
      { from: 'g', to: 'g' }
    ]
  });
  const loop = validateSection(section).issues.find(issue => issue.message.includes('loop'));
  assert.deepEqual(loop.connectionIndexes, [1, 2, 4, 5, 6]);
  assert.deepEqual(loop.nodeIds.sort(), ['b', 'c', 'e', 'f', 'g']);
});

test('node errors identify both overlapping talents and invalid node properties', () => {
  const section = makeSection({
    id: 'spec',
    nodes: [
      makeNode({ id: 'a', name: 'A' }),
      makeNode({ id: 'b', name: 'B' }),
      { ...makeNode({ id: 'c', name: 'C', row: -1 }), maxRank: 0 },
      makeNode({ id: 'a', name: 'Duplicate', column: 1 })
    ]
  });
  const result = validateSection(section);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 4);
  assert.deepEqual(result.issues.find(issue => issue.message.includes('share row')).nodeIds, ['a', 'b']);
  assert.deepEqual(result.issues.find(issue => issue.message.includes('invalid max rank')).nodeIds, ['c']);
  assert.deepEqual(result.issues.find(issue => issue.message.includes('negative position')).nodeIds, ['c']);
  assert.deepEqual(result.issues.find(issue => issue.message.includes('Duplicate node ID')).nodeIds, ['a']);
});
