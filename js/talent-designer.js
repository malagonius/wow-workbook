import {
  cloneProject, createEmptySection, createTree, makeChoice, makeConnection, makeNode,
  normalizeProject, sectionColumns, sectionRows, uniqueNodeId, validateSection,
  NODE_KINDS, SECTION_TYPES, TALENT_PROJECT_FORMAT, TALENT_PROJECT_VERSION
} from './talent-model.js';
import { renderSections, layoutConnections, renderEmptyState } from './talent-tree-renderer.js';
import { loadDraft, saveDraft, clearDraft, downloadProject, readProjectFile } from './talent-designer-storage.js';

const PROJECT_URL = 'config/talent-project.json';
const HISTORY_LIMIT = 60;
const IMAGE_ICON = /^(https?:|data:|\.{0,2}\/)|\.(png|jpe?g|gif|webp|svg)$/i;

let project;
let baselineProject;
let selectedNodeId = null;
let connectSourceId = null;
let saveTimer;
let contentCreationMode = null;
let pendingSnapshot = null;
const undoStack = [];
const redoStack = [];

const $ = id => document.getElementById(id);
const classSelect = $('designer-class');
const specSelect = $('designer-spec');
const sectionSelect = $('designer-section');
const treeEl = $('designer-tree');
const statusEl = $('storage-status');

function currentKey() { return `${classSelect.value}/${specSelect.value}`; }
function currentTree() { return project.trees[currentKey()]; }
function currentSection() { return currentTree()?.sections.find(section => section.id === sectionSelect.value); }
function selectedNode() { return currentSection()?.nodes.find(node => node.id === selectedNodeId) || null; }

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

function snapshot() { return JSON.stringify(projectPayload()); }

function pushHistory(entry) {
  undoStack.push(entry);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
}

// Every structural change goes through mutate() so undo/redo stays complete.
function mutate(mutation) {
  const before = snapshot();
  mutation();
  pushHistory(before);
  scheduleSave();
  render();
}

// Typing in a field should produce one history entry per edit, not one per keystroke.
function beginEdit() { if (pendingSnapshot === null) pendingSnapshot = snapshot(); }
function commitEdit() {
  if (pendingSnapshot === null) return;
  if (pendingSnapshot !== snapshot()) pushHistory(pendingSnapshot);
  pendingSnapshot = null;
}

function travelHistory(from, to) {
  if (!from.length) return;
  to.push(snapshot());
  project = normalizeProject(JSON.parse(from.pop()));
  scheduleSave();
  populateSelectors(classSelect.value, specSelect.value, sectionSelect.value);
}

function updateHistoryButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
}


function populateSelectors(preferredClass = classSelect.value, preferredSpec = specSelect.value, preferredSection = sectionSelect.value) {
  const classes = Object.keys(project.content || {});
  classSelect.innerHTML = classes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  classSelect.value = classes.includes(preferredClass) ? preferredClass : classes[0] || '';
  updateSpecs(preferredSpec, preferredSection);
}

function updateSpecs(preferredSpec = specSelect.value, preferredSection = sectionSelect.value) {
  const specs = project.content[classSelect.value] || [];
  specSelect.innerHTML = specs.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  specSelect.value = specs.includes(preferredSpec) ? preferredSpec : specs[0] || '';
  updateSections(preferredSection);
}

function updateSections(preferredSection = sectionSelect.value) {
  const sections = currentTree()?.sections || [];
  sectionSelect.innerHTML = sections.map(section => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.title)}</option>`).join('');
  sectionSelect.value = sections.some(section => section.id === preferredSection) ? preferredSection : sections[0]?.id || '';
  selectedNodeId = null;
  render();
}

function refreshSectionOptions() {
  const sections = currentTree()?.sections || [];
  const current = sectionSelect.value;
  sectionSelect.innerHTML = sections.map(section => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.title)}</option>`).join('');
  sectionSelect.value = sections.some(section => section.id === current) ? current : sections[0]?.id || '';
}

function nodeTooltip(node) {
  return [node.name || node.id, node.description].filter(Boolean).join('\n');
}

function render() {
  refreshSectionOptions();
  const section = currentSection();

  if (!section) {
    renderEmptyState(treeEl, '＋', 'No specialization tree yet', 'Create a class and a specialization to start designing its talent tree.');
  } else {
    renderSections(treeEl, [section], {
      mode: 'designer',
      selectedNodeId,
      connectSourceId,
      getSectionSummary: current => `${current.nodes.length} talents · ${current.maxPoints || 0} points`,
      getNodeState: (current, node) => ({ available: true, title: nodeTooltip(node) }),
      handlers: { onNodeClick, onSocketClick, onNodeMove, onNodeSwap, onConnect, onEdgeClick, onHandleClick }
    });
  }

  updateNodeForm();
  updateSectionForm();
  updateTreeForm();
  renderConnections();
  validate();
  updateHistoryButtons();
}

function onNodeClick(node, section) {
  if (connectSourceId && connectSourceId !== node.id) {
    const from = connectSourceId;
    connectSourceId = null;
    onConnect(from, node.id, section);
    return;
  }
  connectSourceId = null;
  selectedNodeId = node.id;
  render();
}

// Clicking the handle arms a connection; the next talent clicked becomes the target.
function onHandleClick(node) {
  connectSourceId = connectSourceId === node.id ? null : node.id;
  setStatus(connectSourceId ? `Connecting from "${node.name || node.id}" — click the target talent, or press Escape.` : 'Connection cancelled.', 'dirty');
  render();
}

function onSocketClick(section, row, column) {
  mutate(() => {
    const id = newNodeId(section, row, column);
    section.nodes.push(makeNode({ id, row, column }));
    selectedNodeId = id;
  });
}

function onNodeMove(id, row, column, section) {
  mutate(() => {
    const node = section.nodes.find(item => item.id === id);
    if (!node) return;
    node.row = row;
    node.column = column;
    selectedNodeId = id;
  });
}

function onNodeSwap(sourceId, targetId, section) {
  mutate(() => {
    const source = section.nodes.find(item => item.id === sourceId);
    const target = section.nodes.find(item => item.id === targetId);
    if (!source || !target) return;
    [source.row, target.row] = [target.row, source.row];
    [source.column, target.column] = [target.column, source.column];
    selectedNodeId = sourceId;
  });
}

function onConnect(from, to, section) {
  connectSourceId = null;
  if (from === to) return;
  if (section.connections.some(connection => connection.from === from && connection.to === to)) {
    setStatus('Those talents are already connected.', 'dirty');
    render();
    return;
  }
  mutate(() => section.connections.push(makeConnection(from, to)));
}

function onEdgeClick(index, section) {
  mutate(() => section.connections.splice(index, 1));
}

function updateIconPreview(value) {
  const preview = $('node-icon-preview');
  preview.innerHTML = '';
  if (!value) return;
  if (IMAGE_ICON.test(value)) {
    const image = document.createElement('img');
    image.src = value;
    image.alt = '';
    preview.appendChild(image);
  } else {
    preview.textContent = value;
  }
}

function updateNodeForm() {
  const node = selectedNode();
  $('node-form').hidden = !node;
  $('selection-hint').hidden = !!node;
  if (!node) return;

  $('node-id').value = node.id;
  $('node-name').value = node.name || '';
  $('node-description').value = node.description || '';
  $('node-icon').value = node.icon || '';
  $('node-kind').value = node.kind;
  $('node-max-rank').value = node.maxRank;
  $('node-row').value = node.row;
  $('node-column').value = node.column;

  const [first, second] = node.choices || [];
  $('choice-fields').hidden = node.kind !== 'choice';
  $('choice-a-name').value = first?.name || '';
  $('choice-a-description').value = first?.description || '';
  $('choice-b-name').value = second?.name || '';
  $('choice-b-description').value = second?.description || '';
  updateIconPreview(node.icon);
}

function applyNodeForm() {
  const section = currentSection();
  const node = selectedNode();
  if (!section || !node) return;

  const newId = $('node-id').value.trim() || node.id;
  if (newId !== node.id) {
    if (section.nodes.some(item => item !== node && item.id === newId)) {
      setStatus(`Node ID "${newId}" is already used in this section.`, 'error');
      $('node-id').value = node.id;
    } else {
      renameConnections(section, node.id, newId);
      node.id = newId;
      selectedNodeId = newId;
    }
  }

  node.name = $('node-name').value;
  node.description = $('node-description').value;
  node.icon = $('node-icon').value;
  node.kind = NODE_KINDS.includes($('node-kind').value) ? $('node-kind').value : 'active';
  node.maxRank = Math.max(1, Number($('node-max-rank').value) || 1);
  node.row = Math.max(0, Number($('node-row').value) || 0);
  node.column = Math.max(0, Number($('node-column').value) || 0);

  if (node.kind === 'choice') {
    node.choices = [
      makeChoice({ name: $('choice-a-name').value, description: $('choice-a-description').value }),
      makeChoice({ name: $('choice-b-name').value, description: $('choice-b-description').value })
    ];
  } else {
    delete node.choices;
  }
  scheduleSave();
}

// Patch the tree in place while typing so the text field keeps focus.
function patchSelectedNode() {
  const node = selectedNode();
  if (!node) return;
  const label = treeEl.querySelector(`[data-id="${CSS.escape(node.id)}"] .node-name`);
  if (label) label.textContent = node.name;
  updateIconPreview(node.icon);
}

function renderConnections() {
  const section = currentSection();
  const list = $('connection-list');
  if (!section) { list.innerHTML = ''; return; }

  const nodes = new Map(section.nodes.map(node => [node.id, node]));
  const connections = section.connections || [];
  if (!connections.length) {
    list.innerHTML = '<p class="connection-empty">No connections yet. Drag the gold dot from one talent onto another.</p>';
    return;
  }

  list.innerHTML = connections.map((connection, index) => {
    const from = nodes.get(connection.from)?.name || connection.from;
    const to = nodes.get(connection.to)?.name || connection.to;
    return `<div class="connection-item"><span>${escapeHtml(from)} → ${escapeHtml(to)}</span><button type="button" data-delete-connection="${index}" aria-label="Delete connection">×</button></div>`;
  }).join('');

  list.querySelectorAll('[data-delete-connection]').forEach(button => button.addEventListener('click', () => {
    onEdgeClick(Number(button.dataset.deleteConnection), section);
  }));
}


function newNodeId(section, row, column) {
  const preferred = `${section.id}-${row}-${column}`;
  return section.nodes.some(node => node.id === preferred) ? uniqueNodeId(section, preferred) : preferred;
}

function firstFreeCell(section) {
  const columns = sectionColumns(section);
  const rows = sectionRows(section);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!section.nodes.some(node => node.row === row && node.column === column)) return { row, column };
    }
  }
  return { row: rows, column: 0 };
}

function addNode() {
  const section = currentSection();
  if (!section) return alert('Create a specialization before adding talents.');
  const { row, column } = firstFreeCell(section);
  onSocketClick(section, row, column);
}

function duplicateNode() {
  const section = currentSection();
  const node = selectedNode();
  if (!section || !node) return;
  const { row, column } = firstFreeCell(section);
  mutate(() => {
    const copy = makeNode({ ...node, id: newNodeId(section, row, column), row, column });
    section.nodes.push(copy);
    selectedNodeId = copy.id;
  });
}

function clearNode() {
  const node = selectedNode();
  if (!node) return;
  mutate(() => {
    node.name = '';
    node.description = '';
    node.icon = '';
    node.kind = 'active';
    node.maxRank = 1;
    delete node.choices;
  });
}

function renameConnections(section, oldId, newId) {
  for (const connection of section.connections || []) {
    if (connection.from === oldId) connection.from = newId;
    if (connection.to === oldId) connection.to = newId;
  }
}

function deleteNode() {
  const section = currentSection();
  if (!selectedNodeId || !section) return;
  mutate(() => {
    section.nodes = section.nodes.filter(node => node.id !== selectedNodeId);
    section.connections = (section.connections || []).filter(connection => connection.from !== selectedNodeId && connection.to !== selectedNodeId);
    selectedNodeId = null;
  });
}

const SECTION_FIELDS = ['section-title', 'section-type', 'section-max-points', 'section-columns', 'section-rows', 'section-selectable', 'delete-section'];

function updateSectionForm() {
  const section = currentSection();
  SECTION_FIELDS.forEach(id => { $(id).disabled = !section; });
  if (!section) return;
  $('section-title').value = section.title;
  $('section-type').value = section.type;
  $('section-max-points').value = section.maxPoints || 0;
  $('section-columns').value = sectionColumns(section);
  $('section-rows').value = sectionRows(section);
  $('section-selectable').checked = !!section.selectableEmpty;
}

function applySectionForm() {
  const section = currentSection();
  if (!section) return;

  const columns = Math.max(1, Number($('section-columns').value) || 1);
  const rows = Math.max(1, Number($('section-rows').value) || 1);
  const overflow = section.nodes.filter(node => node.column >= columns || node.row >= rows);
  if (overflow.length && !confirm(`${overflow.length} talent(s) fall outside a ${columns} × ${rows} grid and will be deleted. Continue?`)) {
    updateSectionForm();
    return;
  }

  mutate(() => {
    if (overflow.length) {
      const removed = new Set(overflow.map(node => node.id));
      section.nodes = section.nodes.filter(node => !removed.has(node.id));
      section.connections = (section.connections || []).filter(connection => !removed.has(connection.from) && !removed.has(connection.to));
      if (removed.has(selectedNodeId)) selectedNodeId = null;
    }
    section.title = $('section-title').value.trim() || section.id;
    section.type = SECTION_TYPES.includes($('section-type').value) ? $('section-type').value : section.type;
    section.maxPoints = Math.max(0, Number($('section-max-points').value) || 0);
    section.columns = columns;
    section.rowCount = rows;
    section.selectableEmpty = $('section-selectable').checked;
  });
}

function addSection() {
  const tree = currentTree();
  if (!tree) return alert('Create a specialization first.');
  const title = (prompt('Section title', 'New section') || '').trim();
  if (!title) return;
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  let id = base;
  let index = 1;
  while (tree.sections.some(section => section.id === id)) id = `${base}-${++index}`;
  mutate(() => tree.sections.push(createEmptySection({ id, title, type: 'spec', rows: 6, maxPoints: 10 })));
  updateSections(id);
}

function deleteSection() {
  const tree = currentTree();
  const section = currentSection();
  if (!tree || !section) return;
  if (!confirm(`Delete section "${section.title}" and all of its talents?`)) return;
  mutate(() => {
    tree.sections = tree.sections.filter(item => item !== section);
    selectedNodeId = null;
  });
  updateSections();
}

function updateTreeForm() {
  const tree = currentTree();
  ['tree-description', 'rename-spec', 'duplicate-spec', 'delete-spec', 'add-section', 'add-node'].forEach(id => { $(id).disabled = !tree; });
  ['rename-class', 'delete-class', 'add-spec'].forEach(id => { $(id).disabled = !classSelect.value; });
  $('tree-description').value = tree?.description || '';
}

function applyTreeForm() {
  const tree = currentTree();
  if (!tree) return;
  tree.description = $('tree-description').value;
  scheduleSave();
}

function renameSpec() {
  const tree = currentTree();
  if (!tree) return;
  const className = classSelect.value;
  const previous = tree.spec;
  const name = (prompt('New specialization name', previous) || '').trim();
  if (!name || name === previous) return;
  if (project.content[className].includes(name)) return alert(`"${name}" already exists for ${className}.`);

  mutate(() => {
    project.content[className] = project.content[className].map(spec => (spec === previous ? name : spec));
    project.trees[`${className}/${name}`] = project.trees[`${className}/${previous}`];
    delete project.trees[`${className}/${previous}`];
    project.trees[`${className}/${name}`].spec = name;
  });
  populateSelectors(className, name, sectionSelect.value);
}

function duplicateSpec() {
  const tree = currentTree();
  if (!tree) return;
  const className = classSelect.value;
  const name = (prompt('Name for the copy', `${tree.spec} copy`) || '').trim();
  if (!name) return;
  if (project.content[className].includes(name)) return alert(`"${name}" already exists for ${className}.`);

  mutate(() => {
    const copy = cloneProject(tree);
    copy.spec = name;
    project.content[className].push(name);
    project.trees[`${className}/${name}`] = copy;
  });
  populateSelectors(className, name, sectionSelect.value);
}

function deleteSpec() {
  const tree = currentTree();
  if (!tree) return;
  const className = classSelect.value;
  const specName = tree.spec;
  if (!confirm(`Delete ${className} / ${specName} and its whole talent tree?`)) return;

  mutate(() => {
    project.content[className] = (project.content[className] || []).filter(spec => spec !== specName);
    delete project.trees[`${className}/${specName}`];
    selectedNodeId = null;
  });
  populateSelectors(className, '');
}

function renameClass() {
  const previous = classSelect.value;
  if (!previous) return;
  const name = (prompt('New class name', previous) || '').trim();
  if (!name || name === previous) return;
  if (project.content[name]) return alert(`Class "${name}" already exists.`);

  mutate(() => {
    project.content[name] = project.content[previous];
    delete project.content[previous];
    for (const specName of project.content[name]) {
      const tree = project.trees[`${previous}/${specName}`];
      if (!tree) continue;
      tree.class = name;
      project.trees[`${name}/${specName}`] = tree;
      delete project.trees[`${previous}/${specName}`];
    }
  });
  populateSelectors(name, specSelect.value, sectionSelect.value);
}

function deleteClass() {
  const className = classSelect.value;
  if (!className) return;
  if (!confirm(`Delete class "${className}" and every specialization tree it contains?`)) return;

  mutate(() => {
    for (const specName of project.content[className] || []) delete project.trees[`${className}/${specName}`];
    delete project.content[className];
    selectedNodeId = null;
  });
  populateSelectors();
}

function createClass(name) {
  const cleanName = name.trim();
  if (!cleanName) return;
  if (project.content[cleanName]) return alert(`Class "${cleanName}" already exists.`);
  mutate(() => { project.content[cleanName] = []; });
  populateSelectors(cleanName, '');
  setStatus(`Created class "${cleanName}". Add a specialization to start its tree.`, 'saved');
}

function createSpec(className, specName, description = '') {
  const cleanClass = className.trim();
  const cleanSpec = specName.trim();
  if (!cleanClass || !cleanSpec) return;
  if (project.content[cleanClass]?.includes(cleanSpec) || project.trees[`${cleanClass}/${cleanSpec}`]) {
    return alert(`Specialization "${cleanSpec}" already exists for ${cleanClass}.`);
  }

  mutate(() => {
    project.content[cleanClass] ||= [];
    project.content[cleanClass].push(cleanSpec);
    project.trees[`${cleanClass}/${cleanSpec}`] = createTree({ className: cleanClass, specName: cleanSpec, description: description.trim() });
  });
  populateSelectors(cleanClass, cleanSpec, 'spec');
  setStatus(`Created ${cleanClass} / ${cleanSpec}.`, 'saved');
}

function openContentDialog(mode) {
  contentCreationMode = mode;
  const isClass = mode === 'class';
  $('content-dialog-title').textContent = isClass ? 'Create class' : 'Create specialization';
  $('content-dialog-help').textContent = isClass
    ? 'Create a new class. You can add its first specialization immediately afterwards.'
    : `Create a new specialization for ${classSelect.value || 'the selected class'}. An empty class, spec, Apex and Hero tree will be created for you.`;
  $('content-description-label').hidden = isClass;
  $('content-name').value = '';
  $('content-description').value = '';
  $('content-dialog').showModal();
  $('content-name').focus();
}

function createContentFromDialog() {
  const name = $('content-name').value.trim();
  if (!name) return;
  if (contentCreationMode === 'class') createClass(name);
  else createSpec(classSelect.value, name, $('content-description').value);
  $('content-dialog').close();
}

function showJson() {
  $('json-output').value = JSON.stringify(projectPayload(), null, 2);
  $('json-dialog').showModal();
}

function applyJson() {
  try {
    const parsed = normalizeProject(JSON.parse($('json-output').value));
    mutate(() => { project = parsed; });
    populateSelectors();
    $('json-dialog').close();
  } catch (error) { alert(`Invalid JSON: ${error.message}`); }
}

function validate() {
  const panel = $('validation-panel');
  const section = currentSection();
  if (!section) { panel.innerHTML = ''; return; }
  const result = validateSection(section);
  panel.innerHTML = result.valid && !result.warnings.length
    ? '<span class="validation-ok">✓ Section is valid</span>'
    : `${result.errors.map(error => `<div class="validation-error">✕ ${escapeHtml(error)}</div>`).join('')}${result.warnings.map(warning => `<div class="validation-warning">⚠ ${escapeHtml(warning)}</div>`).join('')}`;
}

async function importProject() {
  const file = $('project-file').files[0];
  if (!file) return;
  try {
    const imported = normalizeProject(await readProjectFile(file));
    mutate(() => { project = imported; });
    populateSelectors();
    $('project-file').value = '';
    setStatus('Project imported and saved locally.', 'saved');
  } catch (error) { alert(`Import failed: ${error.message}`); }
}

async function resetDraft() {
  if (!confirm('Discard the local draft and restore the repository data?')) return;
  await clearDraft();
  project = cloneProject(baselineProject);
  selectedNodeId = null;
  undoStack.length = 0;
  redoStack.length = 0;
  populateSelectors();
  setStatus('Local draft reset.', 'saved');
}

async function loadRepositoryProject() {
  const response = await fetch(PROJECT_URL);
  if (!response.ok) throw new Error(`Canonical project unavailable (${response.status})`);
  return normalizeProject(await response.json());
}

const TEXT_FIELDS = ['node-name', 'node-description', 'node-icon', 'choice-a-name', 'choice-a-description', 'choice-b-name', 'choice-b-description'];
const COMMIT_FIELDS = ['node-id', 'node-kind', 'node-max-rank', 'node-row', 'node-column'];

function wireNodeForm() {
  $('node-form').addEventListener('submit', event => event.preventDefault());

  TEXT_FIELDS.forEach(id => {
    const field = $(id);
    field.addEventListener('focus', beginEdit);
    field.addEventListener('input', () => { applyNodeForm(); patchSelectedNode(); });
    field.addEventListener('change', () => { commitEdit(); render(); });
  });

  COMMIT_FIELDS.forEach(id => {
    const field = $(id);
    field.addEventListener('focus', beginEdit);
    field.addEventListener('change', () => { applyNodeForm(); commitEdit(); render(); });
  });

  $('duplicate-node').addEventListener('click', duplicateNode);
  $('clear-node').addEventListener('click', clearNode);
  $('delete-node').addEventListener('click', deleteNode);
}

function wirePanels() {
  SECTION_FIELDS.filter(id => id !== 'delete-section').forEach(id => $(id).addEventListener('change', applySectionForm));
  $('add-section').addEventListener('click', addSection);
  $('delete-section').addEventListener('click', deleteSection);

  $('tree-description').addEventListener('focus', beginEdit);
  $('tree-description').addEventListener('input', applyTreeForm);
  $('tree-description').addEventListener('change', commitEdit);
  $('rename-spec').addEventListener('click', renameSpec);
  $('duplicate-spec').addEventListener('click', duplicateSpec);
  $('delete-spec').addEventListener('click', deleteSpec);
  $('rename-class').addEventListener('click', renameClass);
  $('delete-class').addEventListener('click', deleteClass);
}

function wireShortcuts() {
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);

    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      travelHistory(event.shiftKey ? redoStack : undoStack, event.shiftKey ? undoStack : redoStack);
    } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      travelHistory(redoStack, undoStack);
    } else if (event.key === 'Escape' && connectSourceId) {
      connectSourceId = null;
      setStatus('Connection cancelled.', 'dirty');
      render();
    } else if (!typing && event.key === 'Delete' && selectedNodeId) {
      event.preventDefault();
      deleteNode();
    }
  });
}

async function init() {
  $('node-kind').innerHTML = NODE_KINDS.map(kind => `<option value="${kind}">${kind[0].toUpperCase()}${kind.slice(1)}</option>`).join('');
  $('section-type').innerHTML = SECTION_TYPES.map(type => `<option value="${type}">${type[0].toUpperCase()}${type.slice(1)}</option>`).join('');

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

  classSelect.addEventListener('change', () => updateSpecs());
  specSelect.addEventListener('change', () => updateSections());
  sectionSelect.addEventListener('change', () => { selectedNodeId = null; render(); });

  wireNodeForm();
  wirePanels();
  wireShortcuts();

  $('add-node').addEventListener('click', addNode);
  $('add-class').addEventListener('click', () => openContentDialog('class'));
  $('add-spec').addEventListener('click', () => openContentDialog('spec'));
  $('create-content').addEventListener('click', createContentFromDialog);
  $('content-form').addEventListener('submit', event => { event.preventDefault(); createContentFromDialog(); });
  $('undo').addEventListener('click', () => travelHistory(undoStack, redoStack));
  $('redo').addEventListener('click', () => travelHistory(redoStack, undoStack));
  $('show-json').addEventListener('click', showJson);
  $('apply-json').addEventListener('click', applyJson);
  $('copy-json').addEventListener('click', () => navigator.clipboard.writeText($('json-output').value));
  $('export-project').addEventListener('click', () => downloadProject(projectPayload()));
  $('import-project').addEventListener('click', () => $('project-file').click());
  $('project-file').addEventListener('change', importProject);
  $('reset-draft').addEventListener('click', resetDraft);
  window.addEventListener('resize', () => layoutConnections(treeEl));

  render();
}

init().catch(error => {
  renderEmptyState(treeEl, '⚠', 'Unable to load designer data', error.message);
  setStatus(error.message, 'error');
});

