const STORAGE_KEY = 'wow-workbook-abilities-draft';
const $ = id => document.getElementById(id);

function loadAbilities() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveAbilities(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function classKey() { return $('designer-class').value; }
function specKey() { return `${classKey()}/${$('designer-spec').value}`; }

function currentEntries() {
  const data = loadAbilities();
  return [
    ...(data[classKey()] || []).map((ability, index) => ({ ability, key: classKey(), index })),
    ...(data[specKey()] || []).map((ability, index) => ({ ability, key: specKey(), index }))
  ];
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
}

function openEditor(entry = null) {
  const existing = entry?.ability || {};
  $('ability-name').value = existing.name || '';
  $('ability-scope').value = entry?.key === classKey() ? 'class' : 'spec';
  $('ability-type').value = existing.type || 'Class Ability';
  $('ability-description').value = existing.description || '';
  $('ability-icon').value = existing.icon || '';
  $('ability-key').value = entry?.key || '';
  $('ability-index').value = entry ? entry.index : '';
  $('ability-dialog').showModal();
  $('ability-name').focus();
}

function saveAbility() {
  const name = $('ability-name').value.trim();
  if (!name) return;

  const data = loadAbilities();
  const targetKey = $('ability-scope').value === 'class' ? classKey() : specKey();
  const previousKey = $('ability-key').value;
  const previousIndex = $('ability-index').value === '' ? -1 : Number($('ability-index').value);
  const ability = {
    name,
    type: $('ability-type').value.trim(),
    description: $('ability-description').value.trim(),
    icon: $('ability-icon').value.trim()
  };

  if (previousIndex >= 0 && previousKey) {
    const previousList = [...(data[previousKey] || [])];
    if (previousList[previousIndex]) {
      previousList.splice(previousIndex, 1);
      data[previousKey] = previousList;
    }
  }

  const targetList = [...(data[targetKey] || [])];
  if (previousIndex >= 0 && previousKey === targetKey) targetList.splice(previousIndex, 0, ability);
  else targetList.push(ability);
  data[targetKey] = targetList;

  saveAbilities(data);
  $('ability-dialog').close();
  renderAbilities();
}

function deleteAbility(key, index) {
  const data = loadAbilities();
  const list = [...(data[key] || [])];
  if (!list[index]) return;
  if (!confirm(`Delete ability "${list[index].name}"?`)) return;

  list.splice(index, 1);
  data[key] = list;
  saveAbilities(data);
  renderAbilities();
}

function renderAbilities() {
  const entries = currentEntries();
  const element = $('designer-abilities-list');
  if (!element) return;

  element.innerHTML = entries.length
    ? entries.map((entry, displayIndex) => `
        <div class="designer-ability-item">
          <div>
            <strong>${escapeHtml(entry.ability.name)}</strong>
            <small>${entry.key === classKey() ? 'Class' : 'Spec'} · ${escapeHtml(entry.ability.type || 'Ability')}</small>
            <p>${escapeHtml(entry.ability.description || '')}</p>
          </div>
          <div class="designer-actions">
            <button type="button" data-edit="${displayIndex}">Edit</button>
            <button type="button" data-delete="${displayIndex}">Delete</button>
          </div>
        </div>
      `).join('')
    : '<p class="connection-empty">No class/spec abilities created yet.</p>';

  element.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => openEditor(entries[Number(button.dataset.edit)]));
  });
  element.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      const entry = entries[Number(button.dataset.delete)];
      deleteAbility(entry.key, entry.index);
    });
  });
}

function inject() {
  const toolbar = document.querySelector('.designer-toolbar');
  if (!toolbar || $('add-ability')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'add-ability';
  button.textContent = '＋ Ability';
  toolbar.insertBefore(button, $('clear-section'));

  const group = document.createElement('details');
  group.className = 'panel-group';
  group.innerHTML = `
    <summary>Class / Spec Abilities</summary>
    <div class="panel-form">
      <div id="designer-abilities-list"></div>
      <div class="designer-actions">
        <button type="button" id="create-ability">＋ Create Ability</button>
      </div>
    </div>
  `;
  $('validation-panel').before(group);

  const dialog = document.createElement('dialog');
  dialog.id = 'ability-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="json-dialog-content">
      <header><h2>Ability</h2><button aria-label="Close">×</button></header>
      <label>Name<input id="ability-name" required autocomplete="off"></label>
      <label>Scope<select id="ability-scope"><option value="spec">Specialization</option><option value="class">Class</option></select></label>
      <label>Type<input id="ability-type" value="Class Ability"></label>
      <label>Icon<input id="ability-icon" placeholder="icons/ability.png or ✦"></label>
      <label>Description<textarea id="ability-description" rows="4"></textarea></label>
      <input type="hidden" id="ability-key">
      <input type="hidden" id="ability-index">
      <div class="designer-actions">
        <button type="button" id="save-ability">Save Ability</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);

  button.addEventListener('click', () => openEditor());
  $('create-ability').addEventListener('click', () => openEditor());
  $('save-ability').addEventListener('click', saveAbility);
  $('designer-class').addEventListener('change', renderAbilities);
  $('designer-spec').addEventListener('change', renderAbilities);
  renderAbilities();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
else inject();
