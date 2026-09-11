import fs from 'node:fs/promises';

const TREE_PATH = new URL('../config/talent-trees.json', import.meta.url);
const CONNECTION_PATH = new URL('../config/talent-connections.json', import.meta.url);
const OUTPUT_PATH = new URL('../config/talent-project.json', import.meta.url);

const treesConfig = JSON.parse(await fs.readFile(TREE_PATH, 'utf8'));
const legacyConnections = JSON.parse(await fs.readFile(CONNECTION_PATH, 'utf8'));

function nodeFromRaw(raw, sectionId, row, column) {
  if (raw && typeof raw === 'object') {
    return {
      id: raw.id || `${sectionId}-${row}-${column}`,
      name: raw.name || '',
      description: raw.description || '',
      icon: raw.icon || '',
      row: Number.isInteger(raw.row) ? raw.row : row,
      column: Number.isInteger(raw.column) ? raw.column : column,
      type: raw.type || 'talent',
      ...raw
    };
  }
  return {
    id: `${sectionId}-${row}-${column}`,
    name: raw || '',
    description: '',
    icon: '',
    row,
    column,
    type: 'talent'
  };
}

function migrateSection(section, treeKey) {
  const nodes = [];
  (section.nodes || []).forEach((node, index) => nodes.push(nodeFromRaw(node, section.id, node.row ?? 0, node.column ?? index % 4)));
  if (!nodes.length) {
    (section.rows || []).forEach((row, rowIndex) => row.forEach((raw, columnIndex) => {
      if (raw || section.selectableEmpty) nodes.push(nodeFromRaw(raw, section.id, rowIndex, columnIndex));
    }));
  }

  const pairs = legacyConnections[treeKey]?.[section.id] || section.connections || [];
  const connections = pairs.map(pair => Array.isArray(pair)
    ? { from: pair[0], to: pair[1] }
    : { from: pair.from, to: pair.to, ...Object.fromEntries(Object.entries(pair).filter(([key]) => key !== 'from' && key !== 'to')) });

  return {
    id: section.id,
    title: section.title || section.id,
    type: section.type || 'spec',
    maxPoints: section.maxPoints || 0,
    selectableEmpty: !!section.selectableEmpty,
    nodes,
    connections
  };
}

const project = {
  format: 'wow-workbook-talent-project',
  version: 2,
  content: treesConfig.content || {},
  trees: Object.fromEntries(Object.entries(treesConfig.trees || {}).map(([treeKey, tree]) => {
    const [className, specName] = treeKey.split('/');
    return [treeKey, {
      class: className,
      spec: specName,
      description: tree.description || '',
      sections: (tree.sections || []).map(section => migrateSection(section, treeKey))
    }];
  }))
};

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
console.log(`Wrote canonical talent project to ${OUTPUT_PATH.pathname}`);
