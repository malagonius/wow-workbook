// Shared talent tree renderer.
// The Calculator and the Designer both render through this module so a designed
// tree always looks exactly like the tree the calculator plays.

import { sectionColumns, sectionRows, nodeAt, nodeLabel, isEmptyNode } from './talent-model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const IMAGE_ICON = /^(https?:|data:|\.{0,2}\/)|\.(png|jpe?g|gif|webp|svg)$/i;

// dataTransfer contents cannot be read during dragover, so the active payload is kept here.
let dragPayload = null;

function buildIcon(node) {
  const icon = document.createElement('span');
  icon.className = 'node-icon';
  if (node.icon && IMAGE_ICON.test(node.icon)) {
    const image = document.createElement('img');
    image.className = 'node-img';
    image.src = node.icon;
    image.alt = '';
    image.loading = 'lazy';
    icon.appendChild(image);
  } else if (node.icon) {
    icon.textContent = node.icon;
  } else if (!isEmptyNode(node)) {
    icon.textContent = '✦';
  }
  return icon;
}

function buildNode(section, node, options) {
  const state = options.getNodeState?.(section, node) || {};
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.id = node.id;

  const label = state.choiceIndex >= 0 ? node.choices?.[state.choiceIndex]?.name || nodeLabel(node) : nodeLabel(node);
  const classes = ['node', section.type, `kind-${node.kind}`];
  if (isEmptyNode(node)) classes.push('placeholder');
  if (state.selected) classes.push('selected');
  if (state.available || state.selected) classes.push('available');
  else if (options.mode === 'calculator') classes.push('locked');
  if (state.partial) classes.push('partial');
  if (node.id === options.selectedNodeId) classes.push('editing');
  if (node.id === options.connectSourceId) classes.push('connect-source');
  button.className = classes.join(' ');
  button.title = state.title || label || node.id;
  if (options.mode === 'calculator' && !state.selected && !state.available) button.disabled = true;

  button.appendChild(buildIcon(node));

  const name = document.createElement('span');
  name.className = 'node-name';
  name.textContent = label;
  button.appendChild(name);

  if (options.showRanks !== false) {
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${state.rank || 0}/${node.maxRank || 1}`;
    button.appendChild(rank);
  }

  button.addEventListener('click', event => options.handlers?.onNodeClick?.(node, section, event));
  button.addEventListener('contextmenu', event => {
    if (!options.handlers?.onNodeAlt) return;
    event.preventDefault();
    options.handlers.onNodeAlt(node, section, event);
  });

  if (options.mode === 'designer') attachNodeDragging(button, section, node, options);
  return button;
}

function attachNodeDragging(button, section, node, options) {
  button.draggable = true;
  button.addEventListener('dragstart', event => {
    dragPayload = { op: 'move', id: node.id };
    button.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.id);
  });
  button.addEventListener('dragend', () => {
    dragPayload = null;
    button.classList.remove('dragging');
    button.closest('.tree-grid')?.querySelectorAll('.drop-target').forEach(cell => cell.classList.remove('drop-target'));
  });
  button.addEventListener('dragover', event => {
    if (!dragPayload || dragPayload.id === node.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = dragPayload.op === 'connect' ? 'link' : 'move';
    button.classList.add('drop-target');
  });
  button.addEventListener('dragleave', () => button.classList.remove('drop-target'));
  button.addEventListener('drop', event => {
    event.preventDefault();
    button.classList.remove('drop-target');
    if (!dragPayload || dragPayload.id === node.id) return;
    if (dragPayload.op === 'connect') options.handlers?.onConnect?.(dragPayload.id, node.id, section);
    else options.handlers?.onNodeSwap?.(dragPayload.id, node.id, section);
    dragPayload = null;
  });

  const handle = document.createElement('span');
  handle.className = 'connect-handle';
  handle.draggable = true;
  handle.title = 'Drag to another talent to connect them, or click then pick a target';
  handle.addEventListener('click', event => {
    event.stopPropagation();
    options.handlers?.onHandleClick?.(node, section);
  });
  handle.addEventListener('dragstart', event => {
    event.stopPropagation();
    dragPayload = { op: 'connect', id: node.id };
    event.dataTransfer.effectAllowed = 'link';
    event.dataTransfer.setData('text/plain', node.id);
  });
  handle.addEventListener('dragend', event => {
    event.stopPropagation();
    dragPayload = null;
  });
  button.appendChild(handle);
}

function buildSocket(section, row, column, options) {
  if (options.mode !== 'designer') {
    const filler = document.createElement('div');
    filler.className = 'socket empty-socket';
    filler.setAttribute('aria-hidden', 'true');
    return filler;
  }

  const socket = document.createElement('button');
  socket.type = 'button';
  socket.className = 'socket empty-socket droppable';
  socket.dataset.row = row;
  socket.dataset.column = column;
  socket.title = `Add a talent at row ${row}, column ${column}`;
  socket.textContent = '+';
  socket.addEventListener('click', () => options.handlers?.onSocketClick?.(section, row, column));
  socket.addEventListener('dragover', event => {
    if (dragPayload?.op !== 'move') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    socket.classList.add('drop-target');
  });
  socket.addEventListener('dragleave', () => socket.classList.remove('drop-target'));
  socket.addEventListener('drop', event => {
    event.preventDefault();
    socket.classList.remove('drop-target');
    if (dragPayload?.op !== 'move') return;
    options.handlers?.onNodeMove?.(dragPayload.id, row, column, section);
    dragPayload = null;
  });
  return socket;
}

function buildSectionHead(section, options) {
  const head = document.createElement('div');
  head.className = 'section-head';

  const left = document.createElement('div');
  const type = document.createElement('span');
  type.className = 'section-type';
  type.textContent = (section.type || '').toUpperCase();
  const title = document.createElement('h3');
  title.textContent = section.title || section.id;
  left.append(type, title);

  const points = document.createElement('strong');
  points.textContent = options.getSectionSummary?.(section) ?? `${section.maxPoints || 0} points`;

  head.append(left, points);
  return head;
}

function buildConnections(section, options) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'connections');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');

  (section.connections || []).forEach((connection, index) => {
    const line = document.createElementNS(SVG_NS, 'line');
    line.dataset.from = connection.from;
    line.dataset.to = connection.to;
    if (options.handlers?.onEdgeClick) {
      line.classList.add('clickable');
      line.addEventListener('click', () => options.handlers.onEdgeClick(index, section));
    }
    svg.appendChild(line);
  });
  return svg;
}

function buildSection(section, options) {
  const element = document.createElement('section');
  element.className = `talent-section ${section.type}`;
  element.dataset.sectionId = section.id;
  if (options.showSectionHead !== false) element.appendChild(buildSectionHead(section, options));

  const graph = document.createElement('div');
  graph.className = 'tree-graph';
  const columns = sectionColumns(section);
  graph.style.setProperty('--cols', columns);
  graph.appendChild(buildConnections(section, options));

  const grid = document.createElement('div');
  grid.className = 'tree-grid';
  const rows = sectionRows(section);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const node = nodeAt(section, row, column);
      grid.appendChild(node ? buildNode(section, node, options) : buildSocket(section, row, column, options));
    }
  }

  graph.appendChild(grid);
  element.appendChild(graph);
  return element;
}

export function layoutConnections(container) {
  container.querySelectorAll('.talent-section').forEach(section => {
    const graph = section.querySelector('.tree-graph');
    const svg = section.querySelector('.connections');
    if (!graph || !svg) return;

    const box = graph.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.setAttribute('width', box.width);
    svg.setAttribute('height', box.height);

    svg.querySelectorAll('line').forEach(line => {
      const from = section.querySelector(`[data-id="${CSS.escape(line.dataset.from)}"]`);
      const to = section.querySelector(`[data-id="${CSS.escape(line.dataset.to)}"]`);
      if (!from || !to) {
        line.classList.add('broken');
        line.removeAttribute('x1');
        return;
      }
      line.classList.remove('broken');
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      line.setAttribute('x1', a.left + a.width / 2 - box.left);
      line.setAttribute('y1', a.top + a.height / 2 - box.top);
      line.setAttribute('x2', b.left + b.width / 2 - box.left);
      line.setAttribute('y2', b.top + b.height / 2 - box.top);
      const active = from.classList.contains('selected') && to.classList.contains('selected');
      line.classList.toggle('active', active);
      line.classList.toggle('available', !active && (from.classList.contains('selected') || to.classList.contains('selected')));
    });
  });
}

export function renderSections(container, sections, options = {}) {
  container.innerHTML = '';
  container.classList.toggle('designer-mode', options.mode === 'designer');
  sections.forEach(section => container.appendChild(buildSection(section, options)));
  requestAnimationFrame(() => layoutConnections(container));
}

export function renderEmptyState(container, icon, title, message) {
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty';
  const iconElement = document.createElement('div');
  iconElement.className = 'icon';
  iconElement.textContent = icon;
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = message;
  empty.append(iconElement, strong, span);
  container.appendChild(empty);
}
