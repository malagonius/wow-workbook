import {
  cloneProject, createEmptySection, createTree, makeChoice, makeConnection, makeNode,
  isEmptyNode, normalizeProject, sectionColumns, sectionRows, uniqueNodeId, validateSection,
  NODE_KINDS, SECTION_TYPES
} from './talent-model.js';
import { renderSections, layoutConnections, renderEmptyState } from './talent-tree-renderer.js';
import { loadDraft, downloadProject, readProjectFile } from './talent-designer-storage.js';
import { classFileName, compactProject, loadTalentProject, mergeLegacyAbilities, mergeProject } from './talent-config.js';
import { connectSupabase, copyClass } from './supabase-storage.js';
import { initializeAbilityDesigner, renderAbilities } from './ability-designer.js';
import { initializeClassPicker } from './class-picker.js';
import { initializeRichTextEditors } from './rich-text.js';

const HISTORY_LIMIT = 60;
const IMAGE_ICON = /^(https?:|data:|\.{0,2}\/)|\.(png|jpe?g|gif|webp|svg)$/i;

let project;
let storage;
let dirty = false;
let saving = Promise.resolve();
let changeVersion = 0;
let selectedNodeId = null;
let connectSourceId = null;
let connectMode = false;
let connectionReceipt = '';
let saveTimer;
let contentCreationMode = null;
let selectedSpec = '';
let pendingSnapshot = null;
const undoStack = [];
const redoStack = [];

const $ = id => document.getElementById(id);
const classSelect = $('designer-class');
const specSelect = $('designer-spec');
const sectionSelect = $('designer-section');
const treeEl = $('designer-tree');
const statusEl = $('storage-status');
const refreshClassPicker = initializeClassPicker(classSelect, specSelect, () => project?.content || {}, {
  onCreateSpec: () => openContentDialog('spec'),
  canCreateSpec: className => storage?.canEdit(className) || false
});

function currentKey() { return `${classSelect.value}/${specSelect.value}`; }
function currentTree() { return project.trees[currentKey()]; }
function currentSection() { return currentTree()?.sections.find(section => section.id === sectionSelect.value); }
function selectedNode() { return currentSection()?.nodes.find(node => node.id === selectedNodeId) || null; }

function projectPayload() {
  return compactProject(project);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
}

function setStatus(text, state = '') {
  statusEl.textContent = text;
  statusEl.dataset.state = state;
}

function scheduleSave() {
  dirty = true;
  changeVersion++;
  setStatus('Unsaved changes…', 'dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveToDatabase(); }, 500);
}

async function saveToDatabase() {
  clearTimeout(saveTimer);
  const version = changeVersion;
  const payload = projectPayload();
  const attempt = saving.then(async () => {
    setStatus('Saving to Supabase…', 'dirty');
    await storage.save(payload);
    if (version === changeVersion) {
      dirty = false;
      setStatus(`Saved to Supabase · ${new Date().toLocaleTimeString()}`, 'saved');
    }
    updateOwnership();
  });
  saving = attempt.catch(error => {
    dirty = true;
    setStatus(`Database save failed: ${error.message} Your changes remain in this tab; retry Save to database or export a backup.`, 'error');
  });
  await saving;
  return !dirty;
}

function editable() { return storage?.canEdit(classSelect.value) || false; }

function updateOwnership() {
  const allowed = editable();
  $('ownership-status').textContent = !classSelect.value ? 'Create a class to get started.'
    : allowed ? 'Your class - edits autosave to Supabase.'
      : 'Read-only class - sign in and duplicate it to create your own editable copy.';
  for (const id of ['add-class', 'import-project', 'migrate-draft', 'import-bundled']) $(id).disabled = !storage.user;
  $('duplicate-class').disabled = !storage.user || !classSelect.value;
  $('save-project').disabled = !storage.user;
  for (const id of ['add-spec', 'rename-class', 'delete-class', 'add-ability', 'mode-connect', 'apply-json']) {
    if (!allowed) $(id).disabled = true;
    else $(id).disabled = !classSelect.value;
  }
  $('rename-spec').disabled = !allowed || !currentTree();
  specSelect.querySelector('[data-new-spec]').disabled = !allowed;
  document.querySelectorAll('.designer-workspace input, .designer-workspace textarea, .designer-workspace select, .designer-workspace button, #ability-dialog input, #ability-dialog textarea, #ability-dialog select, #save-ability')
    .forEach(control => {
      if (!allowed && !control.disabled && control.id !== 'node-dialog-close') {
        control.dataset.ownershipDisabled = 'true';
        control.disabled = true;
      }
    });
  $('undo').disabled ||= !storage.user;
  $('redo').disabled ||= !storage.user;
}

function snapshot() { return JSON.stringify(projectPayload()); }

function pushHistory(entry) {
  undoStack.push(entry);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
}

function mutate(mutation, { creating = false } = {}) {
  if (!storage.user || (!creating && !editable())) {
    setStatus('This class is read-only. Sign in and duplicate it to edit your own copy.', 'error');
    return false;
  }
  const before = snapshot();
  try { mutation(); storage.changes(project); }
  catch (error) {
    project = normalizeProject(JSON.parse(before));
    setStatus(error.message, 'error');
    render();
    return false;
  }
  pushHistory(before);
  scheduleSave();
  render();
  return true;
}

function beginEdit() { if (pendingSnapshot === null) pendingSnapshot = snapshot(); }
function commitEdit() {
  if (pendingSnapshot === null) return;
  if (pendingSnapshot !== snapshot()) pushHistory(pendingSnapshot);
  pendingSnapshot = null;
}

function travelHistory(from, to) {
  if (!storage.user || !from.length) return;
  const candidate = normalizeProject(JSON.parse(from.at(-1)));
  try { storage.changes(candidate); }
  catch (error) { setStatus(error.message, 'error'); return; }
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
  specSelect.innerHTML = '<option value="" data-new-spec>-- NEW SPEC --</option>'
    + specs.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  specSelect.value = specs.includes(preferredSpec) ? preferredSpec : specs[0] || '';
  if (!specs.length) specSelect.selectedIndex = -1;
  updateSections(preferredSection);
}

function updateSections(preferredSection = sectionSelect.value) {
  selectedSpec = specSelect.value;
  const sections = currentTree()?.sections || [];
  sectionSelect.innerHTML = sections.map(section => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.title)}</option>`).join('');
  sectionSelect.value = sections.some(section => section.id === preferredSection) ? preferredSection : sections[0]?.id || '';
  selectedNodeId = null;
  connectSourceId = null;
  connectionReceipt = '';
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
  document.querySelectorAll('[data-ownership-disabled]').forEach(control => {
    control.disabled = false;
    delete control.dataset.ownershipDisabled;
  });
  refreshClassPicker();
  refreshSectionOptions();
  const section = currentSection();
  const validation = section ? validateSection(section) : null;

  if (!section) {
    renderEmptyState(treeEl, '＋', 'No specialization tree yet', 'Sign in to create a class, or use Tools > Import bundled classes to migrate the existing workbook.');
  } else {
    renderSections(treeEl, [section], {
      mode: 'designer',
      validation,
      selectedNodeId,
      connectSourceId,
      getSectionSummary: current => `${current.nodes.length} talents · ${current.maxPoints || 0} points`,
      getNodeState: (current, node) => ({ available: true, selected: node.id === selectedNodeId, title: nodeTooltip(node) }),
      handlers: editable() ? { onNodeClick, onSocketClick, onNodeMove, onNodeSwap, onConnect, onConnectToSocket, onEdgeClick, onHandleClick } : {}
    });
  }

  $('mode-select').setAttribute('aria-pressed', String(!connectMode));
  $('mode-connect').setAttribute('aria-pressed', String(connectMode));
  const source = section?.nodes.find(node => node.id === connectSourceId);
  $('canvas-status').textContent = connectMode
    ? (source ? `Target for: ${source.name || source.id}` : connectionReceipt || 'Source talent')
    : selectedNode()?.name || selectedNode()?.id || 'No talent selected';
  $('edit-selected').disabled = !selectedNode() || connectMode;
  updateNodeForm();
  updateSectionForm();
  updateTreeForm();
  const pointsIssues = validation?.issues.filter(issue => issue.field === 'maxPoints') || [];
  const pointsField = $('section-max-points');
  pointsField.classList.toggle('validation-invalid', pointsIssues.length > 0);
  pointsField.setAttribute('aria-invalid', String(pointsIssues.length > 0));
  pointsField.title = pointsIssues.map(issue => issue.message).join('\n');
  updateHistoryButtons();
  renderAbilities();
  updateOwnership();
}

function onNodeClick(node, section, event) {
  if (connectSourceId && connectSourceId !== node.id) {
    const from = connectSourceId;
    connectSourceId = null;
    onConnect(from, node.id, section);
    return;
  }
  if (connectMode) {
    connectionReceipt = '';
    selectedNodeId = node.id;
    connectSourceId = connectSourceId === node.id ? null : node.id;
    render();
    return;
  }
  connectSourceId = null;
  selectedNodeId = node.id;
  render();
  openNodeEditor();
}

function onHandleClick(node) {
  connectMode = true;
  connectionReceipt = '';
  connectSourceId = connectSourceId === node.id ? null : node.id;
  setStatus(connectSourceId ? `Connecting from "${node.name || node.id}" — click the target talent, or press Escape.` : 'Connection cancelled.', 'dirty');
  render();
}

function onSocketClick(section, row, column) {
  const from = connectSourceId;
  connectSourceId = null;
  createNodeAtSocket(section, row, column, from);
  if (!connectMode) openNodeEditor();
}

function createNodeAtSocket(section, row, column, from = null) {
  mutate(() => {
    const id = newNodeId(section, row, column);
    section.nodes.push(makeNode({ id, row, column }));
    if (from && from !== id) section.connections.push(makeConnection(from, id));
    selectedNodeId = id;
  });
}

function onConnectToSocket(from, section, row, column) {
  connectSourceId = null;
  createNodeAtSocket(section, row, column, from);
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
    connectionReceipt = 'Connection already exists';
    setStatus('Those talents are already connected.', 'dirty');
    render();
    return;
  }
  const source = section.nodes.find(node => node.id === from);
  const target = section.nodes.find(node => node.id === to);
  connectionReceipt = `${source?.name || from} → ${target?.name || to}`;
  mutate(() => {
    section.connections.push(makeConnection(from, to));
    if (isEmptyNode(section.nodes.find(node => node.id === to))) selectedNodeId = to;
  });
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
  if (!node && $('node-dialog').open) $('node-dialog').close();
  if (!node) return;

  $('node-id').value = node.id;
  $('node-name').value = node.name || '';
  $('node-description').value = node.description || '';
  $('node-icon').value = node.icon || '';
  $('node-kind').value = node.kind;
  $('node-max-rank').value = node.maxRank;
  $('node-cost').value = node.cost || '';
  $('node-range').value = node.range || '';
  $('node-charges').value = node.charges || '';
  $('node-cast-time').value = node.castTime || '';
  $('node-cooldown').value = node.cooldown || '';
  $('active-spell-fields').hidden = node.kind !== 'active';
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

for (const mode of ['select', 'connect']) $('mode-' + mode).addEventListener('click', () => {
  connectMode = mode === 'connect';
  connectSourceId = null;
  connectionReceipt = '';
  render();
});
function openNodeEditor() {
  if (!selectedNode() || connectMode) return;
  if (!$('node-dialog').open) $('node-dialog').showModal();
  $('node-name').focus({ preventScroll: true });
}
$('edit-selected').addEventListener('click', openNodeEditor);
$('node-dialog-close').addEventListener('click', () => $('node-dialog').close());
$('node-dialog').addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  $('node-dialog').close();
});
$('node-dialog').addEventListener('close', () => {
  commitEdit();
  treeEl.querySelector(`[data-id="${CSS.escape(selectedNodeId || '')}"]`)?.focus({ preventScroll: true });
});
$('node-dialog').addEventListener('click', event => {
  if (event.target !== $('node-dialog')) return;
  const bounds = event.target.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close();
});

function applyNodeForm() {
  if (!editable()) return;
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
  node.cost = node.kind === 'active' ? $('node-cost').value : '';
  node.range = node.kind === 'active' ? $('node-range').value : '';
  node.charges = node.kind === 'active' ? $('node-charges').value : '';
  node.castTime = node.kind === 'active' ? $('node-cast-time').value : '';
  node.cooldown = node.kind === 'active' ? $('node-cooldown').value : '';
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

function patchSelectedNode() {
  const node = selectedNode();
  if (!node) return;
  const label = treeEl.querySelector(`[data-id="${CSS.escape(node.id)}"] .node-name`);
  if (label) label.textContent = node.name;
  updateIconPreview(node.icon);
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
    node.cost = '';
    node.range = '';
    node.charges = '';
    node.castTime = '';
    node.cooldown = '';
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
    // Shared sections are deleted everywhere they are used.
    for (const candidate of Object.values(project.trees)) {
      candidate.sections = candidate.sections.filter(item => item !== section);
    }
    selectedNodeId = null;
  });
  updateSections();
}

function clearSection() {
  const section = currentSection();
  if (!section || (!section.nodes.length && !section.connections.length)) return;
  if (!confirm(`Clear every talent and connection from "${section.title}"?`)) return;

  mutate(() => {
    section.nodes = [];
    section.connections = [];
    selectedNodeId = null;
    connectSourceId = null;
  });
}

function updateTreeForm() {
  const tree = currentTree();
  ['tree-description', 'rename-spec', 'duplicate-spec', 'delete-spec', 'add-section', 'clear-section'].forEach(id => { $(id).disabled = !tree; });
  ['rename-class', 'delete-class', 'add-spec'].forEach(id => { $(id).disabled = !classSelect.value; });
  $('tree-description').value = tree?.description || '';
}

function applyTreeForm() {
  if (!editable()) return;
  const tree = currentTree();
  if (!tree) return;
  tree.description = $('tree-description').value;
  scheduleSave();
}

function renameSpec(name) {
  const tree = currentTree();
  if (!tree) return false;
  const className = classSelect.value;
  const previous = tree.spec;
  const sectionTitles = Array.from($('content-section-fields').querySelectorAll('input'), input => input.value.trim());
  if (name === previous && tree.sections.every((section, index) => section.title === sectionTitles[index])) return true;
  if (name !== previous && project.content[className].includes(name)) {
    $('content-name').setCustomValidity(`"${name}" already exists for ${className}.`);
    $('content-name').reportValidity();
    return false;
  }

  const renamed = mutate(() => {
    tree.sections.forEach((section, index) => { section.title = sectionTitles[index]; });
    if (name !== previous) {
      project.content[className] = project.content[className].map(spec => (spec === previous ? name : spec));
      project.trees[`${className}/${name}`] = tree;
      delete project.trees[`${className}/${previous}`];
      tree.spec = name;
      const previousKey = `${className}/${previous}`;
      if (Object.hasOwn(project.abilities, previousKey)) {
        project.abilities[`${className}/${name}`] = project.abilities[previousKey];
        delete project.abilities[previousKey];
      }
    }
  });
  if (renamed) populateSelectors(className, name, sectionSelect.value);
  return renamed;
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
    copy.sections = tree.sections.map(section => ['class', 'hero'].includes(section.type) ? section : cloneProject(section));
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
    const renamed = copyClass(project, previous, name);
    removeClassData(previous);
    project = mergeProject(project, renamed);
  });
  populateSelectors(name, specSelect.value, sectionSelect.value);
}

function deleteClass() {
  const className = classSelect.value;
  if (!className) return;
  if (!confirm(`Delete class "${className}" and every specialization tree it contains?`)) return;

  mutate(() => {
    removeClassData(className);
    selectedNodeId = null;
  });
  populateSelectors();
}

function removeClassData(className) {
  for (const [key, tree] of Object.entries(project.trees)) {
    if (tree.class === className) delete project.trees[key];
  }
  for (const key of Object.keys(project.abilities)) {
    if (key === className || key.startsWith(`${className}/`)) delete project.abilities[key];
  }
  delete project.content[className];
}

function duplicateClass(name) {
  if (!storage.user || !classSelect.value) return;
  name = name.trim();
  if (!name) return;
  if (Object.hasOwn(project.content, name)) return alert(`Class "${name}" already exists. Choose a unique name.`);
  const previous = classSelect.value;
  try {
    const copy = copyClass(project, previous, name);
    if (mutate(() => { project = mergeProject(project, copy); }, { creating: true })) populateSelectors(name);
  } catch (error) { setStatus(error.message, 'error'); }
}

function createClass(name) {
  const cleanName = name.trim();
  if (!cleanName) return;
  if (project.content[cleanName]) return alert(`Class "${cleanName}" already exists.`);
  if (!mutate(() => { project.content[cleanName] = []; }, { creating: true })) return;
  populateSelectors(cleanName, '');
}

function createSpec(className, specName, description = '') {
  const cleanClass = className.trim();
  const cleanSpec = specName.trim();
  if (!cleanClass || !cleanSpec) return;
  if (project.trees[`${cleanClass}/${cleanSpec}`]) {
    return alert(`Specialization "${cleanSpec}" already exists for ${cleanClass}.`);
  }

  mutate(() => {
    project.content[cleanClass] ||= [];
    if (!project.content[cleanClass].includes(cleanSpec)) project.content[cleanClass].push(cleanSpec);
    const sibling = Object.values(project.trees).find(tree => tree.class === cleanClass);
    const tree = createTree({ className: cleanClass, specName: cleanSpec, description: description.trim() });
    if (sibling) {
      const shared = sibling.sections.filter(section => section.type === 'class');
      tree.sections = [...shared, ...tree.sections.filter(section => section.type !== 'class')];
    }
    project.trees[`${cleanClass}/${cleanSpec}`] = tree;
  });
  populateSelectors(cleanClass, cleanSpec, 'spec');
}

function openContentDialog(mode) {
  contentCreationMode = mode;
  const isClass = mode !== 'spec';
  const duplicate = mode === 'duplicate';
  const renaming = mode === 'rename-spec';
  $('content-dialog-title').textContent = renaming ? 'Edit specialization and sections' : duplicate ? 'Duplicate class' : isClass ? 'Create class' : 'Create specialization';
  $('content-dialog-help').textContent = renaming
    ? `Edit the spec name and section titles for ${classSelect.value}. Talents, connections and abilities will be preserved.`
    : duplicate
    ? 'Copy every specialization, talent and ability into your own uniquely named class.'
    : isClass
    ? 'Create a new class. You can add its first specialization immediately afterwards.'
    : `Create a new specialization for ${classSelect.value || 'the selected class'}. An empty class, spec, Apex and Hero tree will be created for you.`;
  $('content-description-label').hidden = isClass;
  $('content-name').setCustomValidity('');
  $('content-name-label').textContent = renaming ? 'Spec name' : 'Name';
  $('content-name').value = renaming ? specSelect.value : duplicate ? `${classSelect.value} copy` : '';
  $('content-description').value = '';
  $('content-sections').hidden = !renaming;
  $('content-sections').disabled = !renaming;
  $('content-section-fields').replaceChildren();
  if (renaming) {
    currentTree().sections.forEach(section => {
      const label = document.createElement('label');
      label.textContent = `${section.type} section (${section.id})`;
      const input = document.createElement('input');
      input.value = section.title;
      input.required = true;
      input.autocomplete = 'off';
      input.addEventListener('input', () => input.setCustomValidity(''));
      label.append(input);
      $('content-section-fields').append(label);
    });
  }
  $('create-content').textContent = renaming ? 'Save changes' : 'Create';
  $('content-dialog').showModal();
  $('content-name').focus();
}

function createContentFromDialog() {
  const name = $('content-name').value.trim();
  $('content-name').setCustomValidity(name ? '' : 'Enter a name.');
  if (contentCreationMode === 'rename-spec') {
    $('content-section-fields').querySelectorAll('input').forEach(input => {
      input.setCustomValidity(input.value.trim() ? '' : 'Enter a section title.');
    });
  }
  if (!$('content-form').reportValidity()) return;
  if (contentCreationMode === 'rename-spec') {
    if (!renameSpec(name)) return;
  } else if (contentCreationMode === 'duplicate') duplicateClass(name);
  else if (contentCreationMode === 'class') createClass(name);
  else createSpec(classSelect.value, name, $('content-description').value);
  $('content-dialog').close();
}

function showJson() {
  if (!classSelect.value) return;
  $('json-output').value = JSON.stringify(compactProject(project, classSelect.value), null, 2);
  $('json-dialog').showModal();
}

function applyJson() {
  try {
    const parsed = mergeProject(project, JSON.parse($('json-output').value));
    if (!mutate(() => { project = parsed; })) return;
    populateSelectors();
    $('json-dialog').close();
  } catch (error) { alert(`Invalid JSON: ${error.message}`); }
}

async function importProject() {
  const file = $('project-file').files[0];
  if (!file) return;
  try {
    const imported = mergeProject(project, await readProjectFile(file));
    if (!mutate(() => { project = imported; }, { creating: true })) return;
    populateSelectors();
    $('project-file').value = '';
  } catch (error) { alert(`Import failed: ${error.message}`); }
}

async function resetDraft() {
  if (dirty && !confirm('Discard unsaved changes and reload the database? Export a backup first if needed.')) return;
  clearTimeout(saveTimer);
  await saving;
  try {
    project = await storage.load();
    dirty = false;
    selectedNodeId = null;
    pendingSnapshot = null;
    undoStack.length = 0;
    redoStack.length = 0;
    populateSelectors();
    setStatus('Loaded latest Supabase data.', 'saved');
  } catch (error) { setStatus(`Reload failed: ${error.message}`, 'error'); }
}

async function migrateDraft() {
  if (!storage.user) return;
  try {
    let draft = await loadDraft();
    const legacy = localStorage.getItem('wow-workbook-abilities-draft');
    if (!draft && !legacy) throw new Error('No old browser draft exists on this browser and origin.');
    if (!draft) throw new Error('Only a legacy ability draft exists. Export it with the old app before migrating.');
    draft = normalizeProject(draft);
    if (legacy) draft = mergeLegacyAbilities(draft, JSON.parse(legacy));
    let next = project;
    let first;
    for (const className of Object.keys(draft.content)) {
      let name = className;
      let index = 1;
      while (Object.hasOwn(next.content, name)) name = `${className} migrated ${index++}`;
      next = mergeProject(next, copyClass(draft, className, name));
      first ||= name;
    }
    if (!confirm('Import the old browser draft as your own classes? Existing names get new names. The browser backup will be kept.')) return;
    if (mutate(() => { project = next; }, { creating: true })) {
      populateSelectors(first);
      await saveToDatabase();
    }
  } catch (error) { setStatus(`Draft migration failed: ${error.message}`, 'error'); }
}

async function importBundled() {
  if (!storage.user) return;
  try {
    const bundled = await loadTalentProject();
    let next = project;
    let count = 0;
    for (const name of Object.keys(bundled.content)) {
      if (Object.hasOwn(next.content, name)) continue;
      next = mergeProject(next, compactProject(bundled, name));
      count++;
    }
    if (!count) return setStatus('All bundled class names already exist. Duplicate a class to make your own copy.');
    if (!confirm(`Import ${count} bundled classes into Supabase under your ownership? Existing classes will not be changed.`)) return;
    if (mutate(() => { project = next; }, { creating: true })) {
      populateSelectors();
      await saveToDatabase();
    }
  } catch (error) { setStatus(`Bundled import failed: ${error.message}`, 'error'); }
}

function renderAccount() {
  $('account-form').hidden = Boolean(storage.user);
  $('sign-out').hidden = !storage.user;
  $('account-status').textContent = storage.user
    ? `Signed in as ${storage.user.email}. Everyone can view your saved classes.`
    : 'Public viewing. Sign in to create and edit your own classes.';
  if (project) render();
}

function wireAccount() {
  async function authenticate(signUp) {
    const form = $('account-form');
    if (!form.reportValidity()) return;
    $('sign-in').disabled = true;
    $('sign-up').disabled = true;
    try {
      const email = $('account-email').value.trim();
      const password = $('account-password').value;
      if (signUp) {
        const signedIn = await storage.signUp(email, password);
        renderAccount();
        if (!signedIn) $('account-status').textContent = 'Check your email to confirm your account, then return here and sign in.';
      } else {
        await storage.signIn(email, password);
        renderAccount();
      }
      $('account-password').value = '';
    } catch (error) { $('account-status').textContent = `Authentication failed: ${error.message}`; }
    finally { $('sign-in').disabled = false; $('sign-up').disabled = false; }
  }
  $('account-form').addEventListener('submit', event => { event.preventDefault(); void authenticate(false); });
  $('sign-up').addEventListener('click', () => { void authenticate(true); });
  $('sign-out').addEventListener('click', async () => {
    if (dirty && !(await saveToDatabase())) return;
    try {
      await saving;
      await storage.signOut();
      undoStack.length = 0;
      redoStack.length = 0;
      pendingSnapshot = null;
      renderAccount();
    } catch (error) { $('account-status').textContent = `Sign out failed: ${error.message}`; }
  });
}

const TEXT_FIELDS = ['node-name', 'node-description', 'node-icon', 'node-cost', 'node-range', 'node-charges', 'node-cast-time', 'node-cooldown', 'choice-a-name', 'choice-a-description', 'choice-b-name', 'choice-b-description'];
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
  $('rename-spec').addEventListener('click', () => openContentDialog('rename-spec'));
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
    } else if (event.key === 'Escape' && (connectSourceId || connectMode)) {
      connectSourceId = null;
      connectMode = false;
      connectionReceipt = '';
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

  storage = await connectSupabase();
  project = await storage.load();
  setStatus('Loaded from Supabase. Changes save directly to the database.', 'saved');

  initializeAbilityDesigner({
    getAbilities: () => project.abilities,
    onChange: abilities => mutate(() => { project.abilities = abilities; }),
    canEdit: editable
  });
  initializeRichTextEditors(document);
  populateSelectors();

  classSelect.addEventListener('change', () => updateSpecs());
  specSelect.addEventListener('change', () => {
    if (specSelect.value) return updateSections();
    specSelect.value = selectedSpec;
    if (!selectedSpec) specSelect.selectedIndex = -1;
    if (editable()) openContentDialog('spec');
  });
  sectionSelect.addEventListener('change', () => { selectedNodeId = null; connectSourceId = null; connectionReceipt = ''; render(); });

  wireNodeForm();
  wirePanels();
  wireShortcuts();
  wireAccount();
  renderAccount();

  $('add-class').addEventListener('click', () => openContentDialog('class'));
  $('duplicate-class').addEventListener('click', () => openContentDialog('duplicate'));
  $('migrate-draft').addEventListener('click', migrateDraft);
  $('import-bundled').addEventListener('click', importBundled);
  $('add-spec').addEventListener('click', () => openContentDialog('spec'));
  $('create-content').addEventListener('click', createContentFromDialog);
  $('content-name').addEventListener('input', () => $('content-name').setCustomValidity(''));
  $('content-form').addEventListener('submit', event => { event.preventDefault(); createContentFromDialog(); });
  $('content-dialog-close').addEventListener('click', () => $('content-dialog').close());
  $('json-dialog-close').addEventListener('click', () => $('json-dialog').close());
  $('undo').addEventListener('click', () => travelHistory(undoStack, redoStack));
  $('redo').addEventListener('click', () => travelHistory(redoStack, undoStack));
  $('show-json').addEventListener('click', showJson);
  $('apply-json').addEventListener('click', applyJson);
  $('copy-json').addEventListener('click', () => navigator.clipboard.writeText($('json-output').value));
  $('save-project').addEventListener('click', () => { void saveToDatabase(); });
  $('export-project').addEventListener('click', () => {
    if (!classSelect.value) return;
    downloadProject(compactProject(project, classSelect.value), classFileName(classSelect.value));
  });
  $('import-project').addEventListener('click', () => $('project-file').click());
  $('project-file').addEventListener('change', importProject);
  $('reset-draft').addEventListener('click', resetDraft);
  $('clear-section').addEventListener('click', clearSection);
  window.addEventListener('resize', () => layoutConnections(treeEl));
  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  render();
}

init().catch(error => {
  $('account-status').textContent = `Unable to restore the designer: ${error.message} Reload to retry.`;
  renderEmptyState(treeEl, '⚠', 'Unable to load designer data', error.message);
  setStatus(error.message, 'error');
});
