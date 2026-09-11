// Shared canonical talent project model.
// The Designer and Calculator both consume the same normalized structure.

export const TALENT_PROJECT_FORMAT = 'wow-workbook-talent-project';
export const TALENT_PROJECT_VERSION = 2;

export function makeNode({ id, name = '', description = '', icon = '', row = 0, column = 0, type = 'talent', ...extra }) {
  return { id, name, description, icon, row, column, type, ...extra };
}

export function makeConnection(from, to, ...extra) {
  return { from, to, ...extra };
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

  return makeNode({
    id: node?.id || `${sectionId}-${row}-${column}`,
    name: node?.name || '',
    description: node?.description || '',
    icon: node?.icon || '',
    row: Number.isInteger(node?.row) ? node.row : row,
    column: Number.isInteger(node?.column) ? node.column : column,
    type: node?.type || 'talent',
    ...node
  });
}

function normalizeConnection(connection, sectionId) {
  if (Array.isArray(connection)) {
    return makeConnection(
      `${sectionId}-${connection[0].split('-').slice(1).join('-')}`,
      `${sectionId}-${connection[1].split('-').slice(1).join('-')}`
    );
  }
  return makeConnection(connection.from, connection.to, ...Object.entries(connection).filter(([key]) => key !== 'from' && key !== 'to').reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}));
}

export function normalizeSection(section, legacyConnections = []) {
  const sectionId = section.id || 'section';
  let nodes = Array.isArray(section.nodes) ? section.nodes.map((node, index) => normalizeNode(node, node?.row ?? 0, node?.column ?? index % 4, sectionId)) : [];

  if (!nodes.length && Array.isArray(section.rows)) {
    section.rows.forEach((row, rowIndex) => row.forEach((raw, columnIndex) => {
      if (raw || section.selectableEmpty) nodes.push(normalizeNode(raw || '', rowIndex, columnIndex, sectionId));
    }));
  }

  const connections = Array.isArray(section.connections) ? section.connections.map(connection => normalizeConnection(connection, sectionId)) : legacyConnections.map(connection => normalizeConnection(connection, sectionId));

  return {
    id: sectionId,
    title: section.title || sectionId,
    type: section.type || 'spec',
    maxPoints: Number.isFinite(section.maxPoints) ? section.maxPoints : 0,
    selectableEmpty: !!section.selectableEmpty,
    nodes,
    connections,
    ...Object.fromEntries(Object.entries(section).filter(([key]) => !['rows', 'nodes', 'connections'].includes(key)))
  };
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

export function validateSection(section) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const nodes = section.nodes || [];
  const connections = section.connections || [];

  for (const node of nodes) {
    if (!node.id) errors.push('A node is missing an ID.');
    else if (ids.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
    else ids.add(node.id);
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

  for (const node of nodes) {
    if (node.row > 0 && !connections.some(connection => connection.to === node.id)) {
      warnings.push(`Node ${node.id} has no incoming connection.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
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
