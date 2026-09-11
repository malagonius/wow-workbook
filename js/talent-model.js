// Shared editor-friendly talent tree model helpers.
// The calculator and future designer should build on this model instead of
// maintaining separate representations of talent nodes and connections.

export function makeNode({ id, name = '', description = '', icon = '', row = 0, column = 0, type = 'talent', ...extra }) {
  return { id, name, description, icon, row, column, type, ...extra };
}

export function makeConnection(from, to) {
  return { from, to };
}

export function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree));
}

export function normalizeNode(node, row = 0, column = 0) {
  if (typeof node === 'string') {
    return makeNode({ id: node, row, column });
  }

  return makeNode({
    id: node.id,
    name: node.name || '',
    description: node.description || '',
    icon: node.icon || '',
    row: Number.isInteger(node.row) ? node.row : row,
    column: Number.isInteger(node.column) ? node.column : column,
    type: node.type || 'talent',
    ...node
  });
}

export function validateSection(section, connections = []) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const nodes = section.nodes || [];

  for (const node of nodes) {
    if (!node.id) errors.push('A node is missing an ID.');
    else if (ids.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
    else ids.add(node.id);
  }

  for (const connection of connections) {
    if (!ids.has(connection.from)) errors.push(`Connection references missing node: ${connection.from}`);
    if (!ids.has(connection.to)) errors.push(`Connection references missing node: ${connection.to}`);
    if (connection.from === connection.to) errors.push(`Node cannot connect to itself: ${connection.from}`);
  }

  for (const node of nodes) {
    if (node.row > 0 && !connections.some(connection => connection.to === node.id)) {
      warnings.push(`Node ${node.id} has no incoming connection.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
