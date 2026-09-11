import { cloneTree, makeNode, makeConnection, validateSection } from './talent-model.js';
import { loadDraft, saveDraft, clearDraft, downloadProject, readProjectFile } from './talent-designer-storage.js';

const TREES_URL = 'config/talent-trees.json';
const CONNECTIONS_URL = 'config/talent-connections.json';

let config;
let connections;
let selectedNodeId = null;
let connectMode = false;
let connectSource = null;
let baselineConfig;
let baselineConnections;
let saveTimer;

const $ = id => document.getElementById(id);
const classSelect = $('designer-class');
const specSelect = $('designer-spec');
const sectionSelect = $('designer-section');
const treeEl = $('designer-tree');
const statusEl = $('storage-status');

function currentKey() { return `${classSelect.value}/${specSelect.value}`; }
function currentTree() { return config.trees[currentKey()]; }
function currentSection() { return currentTree().sections.find(section => section.id === sectionSelect.value); }

function projectPayload() {
  return {
    format: 'wow-workbook-talent-project',
    version: 1,
    activeTreeKey: currentKey(),
    trees: cloneTree(config.trees),
    connections: cloneTree(connections)
  };
}

function setStatus(text, state = '') {
  statusEl.textContent = text;
  statusEl.dataset.state = state;
}

function scheduleSave() {
  setStatus('Unsaved changes…', 'dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveDraft(projectPayload());
      setStatus(`Saved locally · ${new Date().toLocaleTimeString()}`, 'saved');
    } catch (error) {
      setStatus(`Local save failed: ${error.message}`, 'error');
    }
  }, 250);
}

function sectionNodes(section) {
  if (Array.isArray(section.nodes)) return section.nodes;
  const nodes = [];
  (section.rows || []).forEach((row, rowIndex) => row.forEach((raw, columnIndex) => {
    const id = raw && typeof raw === 'object' ? raw.id : `${section.id}-${rowIndex}-${columnIndex}`;
    nodes.push(typeof raw === 'object' && raw ? { ...raw, row: raw.row ?? rowIndex, column: raw.column ?? columnIndex } : makeNode({ id, row: rowIndex, column: columnIndex }));
  }));
  section.nodes = nodes;
  return nodes;
}

function sectionConnections(section) {
  const raw = connections?.[currentKey()]?.[section.id] || [];
  return raw.map(pair => Array.isArray(pair) ? makeConnection(
    `${section.id}-${pair[0].split('-').slice(1).join('-')}`,
    `${section.id}-${pair[1].split('-').slice(1).join('-')}`
  ) : pair);
}

function populateSelectors() {
  const classes = Object.keys(config.content);
  classSelect.innerHTML = classes.map(value => `<option>${value}</option>`).join('');
  updateSpecs();
}

function updateSpecs() {
  const specs = config.content[classSelect.value] || [];
  specSelect.innerHTML = specs.map(value => `<option>${value}</option>`).join('');
  updateSections();
}

function updateSections() {
  const tree = currentTree();
  sectionSelect.innerHTML = tree.sections.map(section => `<option value="${section.id}">${section.title}</option>`).join('');
  render();
}

function nodePosition(node, section) {
  const rows = Math.max(1, ...sectionNodes(section).map(n => n.row + 1));
  const cols = Math.max(4, ...sectionNodes(section).map(n => n.column + 1));
  return { x: ((node.column + .5) / cols) * 100, y: ((node.row + .5) / rows) * 100 };
}

function render() {
  const section = currentSection();
  if (!section) return;
  const nodes = sectionNodes(section);
  const edges = sectionConnections(section);
  const cols = Math.max(4, ...nodes.map(n => n.column + 1));
  const rows = Math.max(1, ...nodes.map(n => n.row + 1));
  treeEl.innerHTML = `<div class="designer-canvas" style="aspect-ratio:${cols}/${Math.max(rows, 1)}"><svg class="designer-svg" aria-hidden="true"></svg>${nodes.map(node => {
    const p = nodePosition(node, section);
    const classes = ['designer-node'];
    if (!node.name && !node.description) classes.push('empty');
    if (node.id === selectedNodeId) classes.push('selected');
    if (node.id === connectSource) classes.push('connect-source');
    return `<div class="designer-node-wrap" style="left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%)"><button class="${classes.join(' ')}" data-node-id="${node.id}" title="${node.name || node.id}"><span class="designer-node-label">${node.name || ''}</span></button></div>`;
  }).join('')}</div>`;

  const canvas = treeEl.querySelector('.designer-canvas');
  const svg = canvas.querySelector('svg');
  const box = canvas.getBoundingClientRect();
  const nodeMap = new Map([...canvas.querySelectorAll('[data-node-id]')].map(el => [el.dataset.nodeId, el]));
  for (const edge of edges) {
    const from = nodeMap.get(edge.from), to = nodeMap.get(edge.to);
    if (!from || !to) continue;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.left + a.width / 2 - box.left); line.setAttribute('y1', a.top + a.height / 2 - box.top);
    line.setAttribute('x2', b.left + b.width / 2 - box.left); line.setAttribute('y2', b.top + b.height / 2 - box.top);
    svg.appendChild(line);
  }
  canvas.querySelectorAll('[data-node-id]').forEach(node => node.addEventListener('click', () => selectNode(node.dataset.nodeId)));
  updatePanel();
  validate();
}

function selectNode(id) {
  if (connectMode) {
    if (!connectSource) connectSource = id;
    else if (connectSource !== id) { addConnection(connectSource, id); connectSource = null; connectMode = false; }
    render();
    return;
  }
  selectedNodeId = id;
  render();
}

function updatePanel() {
  const section = currentSection();
  const node = section && sectionNodes(section).find(item => item.id === selectedNodeId);
  $('node-form').hidden = !node;
  $('selection-hint').hidden = !!node;
  $('connection-panel').hidden = !connectMode;
  if (!node) return;
  $('node-id').value = node.id; $('node-name').value = node.name || '';
  $('node-description').value = node.description || ''; $('node-icon').value = node.icon || '';
  $('node-row').value = node.row ?? 0; $('node-column').value = node.column ?? 0;
}

function addNode() {
  const section = currentSection();
  const nodes = sectionNodes(section);
  const id = `${section.id}-${Date.now()}`;
  nodes.push(makeNode({ id, row: 0, column: nodes.length % 4 }));
  selectedNodeId = id; scheduleSave(); render();
}

function saveNode(event) {
  event.preventDefault();
  const section = currentSection();
  const node = sectionNodes(section).find(item => item.id === selectedNodeId);
  if (!node) return;
  const newId = $('node-id').value.trim();
  if (!newId) return;
  if (newId !== node.id && sectionNodes(section).some(item => item !== node && item.id === newId)) return alert('Node ID must be unique.');
  const oldId = node.id;
  Object.assign(node, { id: newId, name: $('node-name').value, description: $('node-description').value, icon: $('node-icon').value, row: Number($('node-row').value) || 0, column: Number($('node-column').value) || 0 });
  if (oldId !== newId) renameConnections(section, oldId, newId);
  selectedNodeId = newId; scheduleSave(); render();
}

function renameConnections(section, oldId, newId) {
  const list = connections[currentKey()]?.[section.id];
  if (!Array.isArray(list)) return;
  for (const pair of list) {
    const from = `${section.id}-${pair[0].split('-').slice(1).join('-')}`;
    const to = `${section.id}-${pair[1].split('-').slice(1).join('-')}`;
    if (from === oldId) pair[0] = newId;
    if (to === oldId) pair[1] = newId;
  }
}

function deleteNode() {
  const section = currentSection();
  if (!selectedNodeId || !section) return;
  section.nodes = sectionNodes(section).filter(node => node.id !== selectedNodeId);
  const list = connections[currentKey()]?.[section.id];
  if (Array.isArray(list)) connections[currentKey()][section.id] = list.filter(pair => !pair.includes(selectedNodeId));
  selectedNodeId = null; scheduleSave(); render();
}

function addConnection(from, to) {
  const key = currentKey(), section = currentSection();
  connections[key] ||= {}; connections[key][section.id] ||= [];
  const pair = [from, to];
  if (!connections[key][section.id].some(existing => existing[0] === pair[0] && existing[1] === pair[1])) connections[key][section.id].push(pair);
  scheduleSave();
}

function showJson() {
  $('json-output').value = JSON.stringify(projectPayload(), null, 2);
  $('json-dialog').showModal();
}

async function applyJson() {
  try {
    const replacement = JSON.parse($('json-output').value);
    if (replacement.format === 'wow-workbook-talent-project') {
      config.trees = replacement.trees; connections = replacement.connections || {};
    } else config.trees[currentKey()] = replacement;
    scheduleSave(); updateSections(); $('json-dialog').close();
  } catch (error) { alert(`Invalid JSON: ${error.message}`); }
}

function validate() {
  const section = currentSection(); if (!section) return;
  const result = validateSection(section, sectionConnections(section));
  const panel = $('validation-panel');
  panel.innerHTML = result.valid && !result.warnings.length ? '<span class="validation-ok">✓ Tree section is valid</span>' : `${result.errors.map(e => `<div class="validation-error">✕ ${e}</div>`).join('')}${result.warnings.map(w => `<div class="validation-warning">⚠ ${w}</div>`).join('')}`;
}

async function importProject() {
  const file = $('project-file').files[0];
  if (!file) return;
  try {
    const payload = await readProjectFile(file);
    if (payload.format !== 'wow-workbook-talent-project' || !payload.trees) throw new Error('This is not a valid WoW Workbook project file.');
    config.trees = payload.trees; connections = payload.connections || {};
    scheduleSave(); populateSelectors(); $('project-file').value = '';
    setStatus('Project imported and saved locally.', 'saved');
  } catch (error) { alert(`Import failed: ${error.message}`); }
}

async function resetDraft() {
  if (!confirm('Discard the local draft and restore the repository data?')) return;
  await clearDraft();
  config = cloneTree(baselineConfig); connections = cloneTree(baselineConnections);
  selectedNodeId = null; populateSelectors(); setStatus('Local draft reset.', 'saved');
}

async function init() {
  const [treeResponse, connectionResponse] = await Promise.all([fetch(TREES_URL), fetch(CONNECTIONS_URL)]);
  baselineConfig = await treeResponse.json(); baselineConnections = await connectionResponse.json();
  config = cloneTree(baselineConfig); connections = cloneTree(baselineConnections);
  const draft = await loadDraft();
  if (draft?.trees) { config.trees = draft.trees; connections = draft.connections || {}; setStatus(`Restored local draft · ${new Date(draft.savedAt).toLocaleString()}`, 'saved'); }
  else setStatus('Using repository baseline.', 'saved');
  populateSelectors();
  classSelect.addEventListener('change', updateSpecs); specSelect.addEventListener('change', updateSections);
  sectionSelect.addEventListener('change', () => { selectedNodeId = null; render(); });
  $('node-form').addEventListener('submit', saveNode); $('delete-node').addEventListener('click', deleteNode);
  $('add-node').addEventListener('click', addNode); $('show-json').addEventListener('click', showJson);
  $('apply-json').addEventListener('click', applyJson); $('copy-json').addEventListener('click', () => navigator.clipboard.writeText($('json-output').value));
  $('connect-mode').addEventListener('click', () => { connectMode = !connectMode; connectSource = null; render(); });
  $('cancel-connect').addEventListener('click', () => { connectMode = false; connectSource = null; render(); });
  $('export-project').addEventListener('click', () => downloadProject(projectPayload()));
  $('import-project').addEventListener('click', () => $('project-file').click()); $('project-file').addEventListener('change', importProject);
  $('reset-draft').addEventListener('click', resetDraft); window.addEventListener('resize', render);
  render();
}

init().catch(error => { treeEl.innerHTML = `<p class="validation-error">Unable to load designer data: ${error.message}</p>`; setStatus(error.message, 'error'); });
