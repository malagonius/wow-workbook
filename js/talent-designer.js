import { cloneProject, makeNode, makeConnection, normalizeProject, validateSection, TALENT_PROJECT_FORMAT, TALENT_PROJECT_VERSION } from './talent-model.js';
import { loadDraft, saveDraft, clearDraft, downloadProject, readProjectFile } from './talent-designer-storage.js';

const PROJECT_URL = 'config/talent-project.json';

let project;
let baselineProject;
let selectedNodeId = null;
let connectMode = false;
let connectSource = null;
let saveTimer;

const $ = id => document.getElementById(id);
const classSelect = $('designer-class');
const specSelect = $('designer-spec');
const sectionSelect = $('designer-section');
const treeEl = $('designer-tree');
const statusEl = $('storage-status');

function currentKey() { return `${classSelect.value}/${specSelect.value}`; }
function currentTree() { return project.trees[currentKey()]; }
function currentSection() { return currentTree()?.sections.find(section => section.id === sectionSelect.value); }

function projectPayload() {
  return cloneProject({
    format: TALENT_PROJECT_FORMAT,
    version: TALENT_PROJECT_VERSION,
    content: project.content,
    trees: project.trees
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
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

function sectionNodes(section) { return section.nodes || []; }
function sectionConnections(section) { return section.connections || []; }

function populateSelectors() {
  const classes = Object.keys(project.content);
  classSelect.innerHTML = classes.map(value => `<option>${escapeHtml(value)}</option>`).join('');
  updateSpecs();
}

function updateSpecs() {
  const specs = project.content[classSelect.value] || [];
  specSelect.innerHTML = specs.map(value => `<option>${escapeHtml(value)}</option>`).join('');
  updateSections();
}

function updateSections() {
  const tree = currentTree();
  sectionSelect.innerHTML = (tree?.sections || []).map(section => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.title)}</option>`).join('');
  selectedNodeId = null;
  render();
}

function nodePosition(node, section) {
  const nodes = sectionNodes(section);
  const rows = Math.max(1, ...nodes.map(n => n.row + 1));
  const cols = Math.max(4, ...nodes.map(n => n.column + 1));
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
    const label = escapeHtml(node.name || '');
    return `<div class="designer-node-wrap" style="left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%)"><button class="${classes.join(' ')}" data-node-id="${escapeHtml(node.id)}" title="${escapeHtml(node.name || node.id)}"><span class="designer-node-label">${label}</span></button></div>`;
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
  renderConnections();
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

function renderConnections() {
  const section = currentSection();
  const list = $('connection-list');
  if (!section) { list.innerHTML = ''; return; }
  const nodes = new Map(sectionNodes(section).map(node => [node.id, node]));
  const connections = sectionConnections(section);
  if (!connections.length) {
    list.innerHTML = '<p class="connection-empty">No connections in this section.</p>';
    return;
  }
  list.innerHTML = `<h3>Edges</h3>${connections.map((connection, index) => {
    const from = nodes.get(connection.from)?.name || connection.from;
    const to = nodes.get(connection.to)?.name || connection.to;
    return `<div class="connection-item"><span>${escapeHtml(from)} → ${escapeHtml(to)}</span><button type="button" data-delete-connection="${index}" aria-label="Delete connection">×</button></div>`;
  }).join('')}`;
  list.querySelectorAll('[data-delete-connection]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.deleteConnection);
    section.connections.splice(index, 1);
    scheduleSave();
    render();
  }));
}

function addNode() {
  const section = currentSection();
  const nodes = sectionNodes(section);
  let index = nodes.length;
  let id = `${section.id}-${Date.now()}`;
  while (nodes.some(node => node.id === id)) id = `${section.id}-${Date.now()}-${++index}`;
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
  for (const connection of sectionConnections(section)) {
    if (connection.from === oldId) connection.from = newId;
    if (connection.to === oldId) connection.to = newId;
  }
}

function deleteNode() {
  const section = currentSection();
  if (!selectedNodeId || !section) return;
  section.nodes = sectionNodes(section).filter(node => node.id !== selectedNodeId);
  section.connections = sectionConnections(section).filter(connection => connection.from !== selectedNodeId && connection.to !== selectedNodeId);
  selectedNodeId = null; scheduleSave(); render();
}

function addConnection(from, to) {
  const section = currentSection();
  section.connections ||= [];
  if (section.connections.some(connection => connection.from === from && connection.to === to)) return;
  section.connections.push(makeConnection(from, to));
  scheduleSave();
}

function showJson() {
  $('json-output').value = JSON.stringify(projectPayload(), null, 2);
  $('json-dialog').showModal();
}

function applyJson() {
  try {
    project = normalizeProject(JSON.parse($('json-output').value));
    scheduleSave();
    populateSelectors();
    $('json-dialog').close();
  } catch (error) { alert(`Invalid JSON: ${error.message}`); }
}

function validate() {
  const section = currentSection(); if (!section) return;
  const result = validateSection(section);
  const panel = $('validation-panel');
  panel.innerHTML = result.valid && !result.warnings.length ? '<span class="validation-ok">✓ Tree section is valid</span>' : `${result.errors.map(e => `<div class="validation-error">✕ ${escapeHtml(e)}</div>`).join('')}${result.warnings.map(w => `<div class="validation-warning">⚠ ${escapeHtml(w)}</div>`).join('')}`;
}

async function importProject() {
  const file = $('project-file').files[0];
  if (!file) return;
  try {
    project = normalizeProject(await readProjectFile(file));
    scheduleSave(); populateSelectors(); $('project-file').value = '';
    setStatus('Project imported and saved locally.', 'saved');
  } catch (error) { alert(`Import failed: ${error.message}`); }
}

async function resetDraft() {
  if (!confirm('Discard the local draft and restore the repository data?')) return;
  await clearDraft();
  project = cloneProject(baselineProject);
  selectedNodeId = null; populateSelectors(); setStatus('Local draft reset.', 'saved');
}

async function loadRepositoryProject() {
  const response = await fetch(PROJECT_URL);
  if (!response.ok) throw new Error(`Canonical project unavailable (${response.status})`);
  return normalizeProject(await response.json());
}

async function init() {
  baselineProject = await loadRepositoryProject();
  project = cloneProject(baselineProject);
  const draft = await loadDraft();
  if (draft) {
    try {
      project = normalizeProject(draft);
      setStatus(`Restored local draft · ${new Date(draft.savedAt).toLocaleString()}`, 'saved');
    } catch {
      setStatus('Saved draft was incompatible; using repository baseline.', 'error');
    }
  } else setStatus('Using repository baseline.', 'saved');

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

init().catch(error => { treeEl.innerHTML = `<p class="validation-error">Unable to load designer data: ${escapeHtml(error.message)}</p>`; setStatus(error.message, 'error'); });
