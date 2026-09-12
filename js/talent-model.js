// Shared canonical talent project model.
// The Designer and Calculator both consume the same normalized structure.

export const TALENT_PROJECT_FORMAT = 'wow-workbook-talent-project';
export const TALENT_PROJECT_VERSION = 3;

export const DEFAULT_COLUMNS = 4;
export const NODE_KINDS = ['active', 'passive', 'choice'];
export const SECTION_TYPES = ['class', 'spec', 'apex', 'hero'];

// Reserved keys are rebuilt by the normalizer; anything else on a node is preserved as-is.
const RESERVED_NODE_KEYS = new Set(['id', 'name', 'description', 'icon', 'row', 'column', 'type', 'kind', 'maxRank', 'choices']);
const RESERVED_SECTION_KEYS = new Set(['id', 'title', 'type', 'maxPoints', 'columns', 'rowCount', 'selectableEmpty', 'nodes', 'connections', 'rows']);

export function makeChoice({ name = '', description = '', icon = '' } = {}) {
  return { name, description, icon };
}

export function makeNode({ id, name = '', description = '', icon = '', row = 0, column = 0, type = 'talent', kind = 'active', maxRank = 1, choices, ...extra }) {
  const node = {
    ...extra,
    id,
    name,
    description,
    icon,
    row,
    column,
    type,
    kind: NODE_KINDS.includes(kind) ? kind : 'active',
    maxRank: Number.isInteger(maxRank) && maxRank > 0 ? maxRank : 1
  };
  if (node.kind === 'choice' || (Array.isArray(choices) && choices.length)) {
    node.choices = (Array.isArray(choices) ? choices : []).map(choice => makeChoice(choice));
  }
  return node;
}

export function makeConnection(from, to, extra = {}) {
  return { ...extra, from, to };
}

export function makeSection({ id, title = id, type = 'spec', maxPoints = 0, columns = DEFAULT_COLUMNS, rowCount = 0, selectableEmpty = false, nodes = [], connections = [], ...extra }) {
  return {
    ...extra,
    id,
    title,
    type: SECTION_TYPES.includes(type) ? type : 'spec',
    maxPoints: Number.isFinite(maxPoints) ? maxPoints : 0,
    columns: Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_COLUMNS,
    rowCount: Number.isInteger(rowCount) && rowCount > 0 ? rowCount : 0,
    selectableEmpty: !!selectableEmpty,
    nodes,
    connections
  };
}

// Grid helpers shared by the renderer, the calculator and the designer.
export function sectionColumns(section) {
  const declared = Number.isInteger(section?.columns) && section.columns > 0 ? section.columns : 0;
  const used = Math.max(0, ...(section?.nodes || []).map(node => node.column + 1));
  return Math.max(declared || DEFAULT_COLUMNS, used);
}

export function sectionRows(section) {
  const declared = Number.isInteger(section?.rowCount) && section.rowCount > 0 ? section.rowCount : 0;
  const used = Math.max(0, ...(section?.nodes || []).map(node => node.row + 1));
  return Math.max(1, declared, used);
}

export function nodeAt(section, row, column) {
  return (section?.nodes || []).find(node => node.row === row && node.column === column) || null;
}

export function isEmptyNode(node) {
  return !node?.name && !node?.description && !(node?.choices || []).some(choice => choice.name);
}

export function nodeLabel(node) {
  if (node?.name) return node.name;
  const choiceNames = (node?.choices || []).map(choice => choice.name).filter(Boolean);
  return choiceNames.join(' / ');
}

export function createEmptySection({ id, title, type, rows = 10, columns = DEFAULT_COLUMNS, maxPoints = 0, selectableEmpty = true }) {
  const nodes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nodes.push(makeNode({ id: `${id}-${row}-${column}`, row, column }));
    }
  }
  return makeSection({ id, title, type, maxPoints, columns, rowCount: rows, selectableEmpty, nodes, connections: [] });
}

export function uniqueNodeId(section, prefix = section?.id || 'node') {
  const taken = new Set((section?.nodes || []).map(node => node.id));
  let index = taken.size;
  let candidate = `${prefix}-${index}`;
  while (taken.has(candidate)) candidate = `${prefix}-${++index}`;
  return candidate;
}

export function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree));
}

export function cloneProject(project) {
  return JSON.parse(JSON.stringify(project));
}

export function normalizeNode(node, row = 0, column = 0, sectionId = 'section') {
  if (typeof node === 'string') {
    return makeNode({ id: `${sectionId}-${row}-${column}`, name: node, row, column });
  }

  const extra = Object.fromEntries(Object.entries(node || {}).filter(([key]) => !RESERVED_NODE_KEYS.has(key)));
  const choices = Array.isArray(node?.choices) ? node.choices : undefined;

  return makeNode({
    ...extra,
    id: node?.id || `${sectionId}-${row}-${column}`,
    name: node?.name || '',
    description: node?.description || '',
    icon: node?.icon || '',
    row: Number.isInteger(node?.row) ? node.row : row,
    column: Number.isInteger(node?.column) ? node.column : column,
    type: node?.type || 'talent',
    kind: node?.kind,
    maxRank: node?.maxRank,
    choices
  });
}

function normalizeConnection(connection, sectionId) {
  if (Array.isArray(connection)) {
    return makeConnection(
      `${sectionId}-${connection[0].split('-').slice(1).join('-')}`,
      `${sectionId}-${connection[1].split('-').slice(1).join('-')}`
    );
  }
  const { from, to, ...extra } = connection;
  return makeConnection(from, to, extra);
}

export function normalizeSection(section, legacyConnections = []) {
  const sectionId = section.id || 'section';
  let nodes = Array.isArray(section.nodes) ? section.nodes.map((node, index) => normalizeNode(node, node?.row ?? 0, node?.column ?? index % DEFAULT_COLUMNS, sectionId)) : [];

  if (!nodes.length && Array.isArray(section.rows)) {
    section.rows.forEach((row, rowIndex) => row.forEach((raw, columnIndex) => {
      if (raw || section.selectableEmpty) nodes.push(normalizeNode(raw || '', rowIndex, columnIndex, sectionId));
    }));
  }

  const connections = Array.isArray(section.connections) ? section.connections.map(connection => normalizeConnection(connection, sectionId)) : legacyConnections.map(connection => normalizeConnection(connection, sectionId));
  const extra = Object.fromEntries(Object.entries(section).filter(([key]) => !RESERVED_SECTION_KEYS.has(key)));

  return makeSection({
    ...extra,
    id: sectionId,
    title: section.title || sectionId,
    type: section.type || 'spec',
    maxPoints: Number.isFinite(section.maxPoints) ? section.maxPoints : 0,
    columns: Number.isInteger(section.columns) ? section.columns : Math.max(DEFAULT_COLUMNS, ...nodes.map(node => node.column + 1)),
    rowCount: Number.isInteger(section.rowCount) ? section.rowCount : Math.max(0, ...nodes.map(node => node.row + 1)),
    selectableEmpty: !!section.selectableEmpty,
    nodes,
    connections
  });
}

export function normalizeTree(tree, treeKey = '') {
  const [className = '', specName = ''] = treeKey.split('/');
  const legacySectionConnections = tree.__legacyConnections || {};
  const rawSections = Array.isArray(tree.sections)
    ? tree.sections
    : Object.values(tree.sections || {});

  return {
    class: tree.class || className,
    spec: tree.spec || specName,
    description: tree.description || '',
    sections: rawSections.map(section => normalizeSection(section, legacySectionConnections[section.id] || [])),
    ...Object.fromEntries(Object.entries(tree).filter(([key]) => !['sections', '__legacyConnections', 'class', 'spec', 'description'].includes(key)))
  };
}

export function projectFromLegacy(config, legacyConnections = {}) {
  const trees = {};
  for (const [treeKey, rawTree] of Object.entries(config?.trees || {})) {
    trees[treeKey] = normalizeTree({
      ...rawTree,
      __legacyConnections: legacyConnections[treeKey] || {}
    }, treeKey);
  }

  return {
    format: TALENT_PROJECT_FORMAT,
    version: TALENT_PROJECT_VERSION,
    content: cloneTree(config?.content || {}),
    trees
  };
}

export function normalizeProject(project) {
  if (!project || typeof project !== 'object') throw new Error('Talent project must be an object.');

  if (project.format === TALENT_PROJECT_FORMAT && project.version >= 2) {
    const trees = {};
    for (const [treeKey, tree] of Object.entries(project.trees || {})) trees[treeKey] = normalizeTree(tree, treeKey);
    return {
      format: TALENT_PROJECT_FORMAT,
      version: TALENT_PROJECT_VERSION,
      content: cloneTree(project.content || {}),
      trees
    };
  }

  if (project.format === TALENT_PROJECT_FORMAT && project.version === 1) {
    return projectFromLegacy(
      { content: project.content || {}, trees: project.trees || {} },
      project.connections || {}
    );
  }

  if (project.trees) return projectFromLegacy(project, project.connections || {});

  throw new Error('Unsupported talent project format.');
}

// Depth-first search over the section graph; a back edge means the tree can never be fully unlocked.
function findCycle(nodes, connections) {
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  for (const connection of connections) outgoing.get(connection.from)?.push(connection.to);

  const visiting = new Set();
  const done = new Set();

  function walk(id) {
    if (visiting.has(id)) return id;
    if (done.has(id)) return null;
    visiting.add(id);
    for (const next of outgoing.get(id) || []) {
      const found = walk(next);
      if (found) return found;
    }
    visiting.delete(id);
    done.add(id);
    return null;
  }

  for (const node of nodes) {
    const found = walk(node.id);
    if (found) return found;
  }
  return null;
}

export function validateSection(section) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const nodes = section.nodes || [];
  const connections = section.connections || [];
  const columns = sectionColumns(section);

  for (const node of nodes) {
    if (!node.id) errors.push('A node is missing an ID.');
    else if (ids.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
    else ids.add(node.id);
  }

  const occupied = new Map();
  for (const node of nodes) {
    const cell = `${node.row}/${node.column}`;
    if (occupied.has(cell)) errors.push(`Nodes ${occupied.get(cell)} and ${node.id} share row ${node.row}, column ${node.column}.`);
    else occupied.set(cell, node.id);

    if (node.row < 0 || node.column < 0) errors.push(`Node ${node.id} has a negative position.`);
    if (node.column >= columns) errors.push(`Node ${node.id} sits outside the ${columns}-column grid.`);
    if (!Number.isInteger(node.maxRank) || node.maxRank < 1) errors.push(`Node ${node.id} has an invalid max rank.`);
    if (node.kind === 'choice' && (node.choices || []).filter(choice => choice.name).length < 2) {
      warnings.push(`Choice node ${node.id} needs two named options.`);
    }
  }

  const seenConnections = new Set();
  for (const connection of connections) {
    if (!ids.has(connection.from)) errors.push(`Connection references missing node: ${connection.from}`);
    if (!ids.has(connection.to)) errors.push(`Connection references missing node: ${connection.to}`);
    if (connection.from === connection.to) errors.push(`Node cannot connect to itself: ${connection.from}`);
    const key = `${connection.from}->${connection.to}`;
    if (seenConnections.has(key)) errors.push(`Duplicate connection: ${key}`);
    seenConnections.add(key);
  }

  const cycle = findCycle(nodes, connections.filter(connection => ids.has(connection.from) && ids.has(connection.to)));
  if (cycle) errors.push(`Connections form a loop through ${cycle}.`);

  const totalRanks = nodes.reduce((total, node) => total + (node.maxRank || 1), 0);
  if (section.maxPoints > totalRanks) warnings.push(`Max points (${section.maxPoints}) exceeds the ${totalRanks} ranks available in this section.`);

  for (const node of nodes) {
    if (node.row > 0 && !connections.some(connection => connection.to === node.id)) {
      warnings.push(`Node ${node.id} has no incoming connection.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function createTree({ className, specName, description = '' }) {
  return {
    class: className,
    spec: specName,
    description,
    sections: [
      createEmptySection({ id: 'class', title: className, type: 'class', rows: 10, maxPoints: 34 }),
      createEmptySection({ id: 'spec', title: specName, type: 'spec', rows: 10, maxPoints: 34 }),
      createEmptySection({ id: 'apex', title: 'Apex', type: 'apex', rows: 3, columns: 1, maxPoints: 4 }),
      createEmptySection({ id: 'hero', title: 'Hero Talents', type: 'hero', rows: 5, maxPoints: 13 })
    ]
  };
}

export function validateProject(project) {
  const errors = [];
  const warnings = [];
  for (const [treeKey, tree] of Object.entries(project.trees || {})) {
    for (const section of tree.sections || []) {
      const result = validateSection(section);
      result.errors.forEach(error => errors.push(`${treeKey}/${section.id}: ${error}`));
      result.warnings.forEach(warning => warnings.push(`${treeKey}/${section.id}: ${warning}`));
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
