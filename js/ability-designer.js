const STORAGE_KEY = 'wow-workbook-abilities-draft';
const $ = id => document.getElementById(id);

const TYPE_ALIASES = new Map([
  ['Class Ability', 'spell'],
  ['Specialization Ability', 'spell'],
  ['active', 'spell'],
  ['passive', 'passive']
]);

function loadAbilities() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveAbilities(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function classKey() { return $('designer-class').value; }
function specKey() { return classKey() + '/' + $('designer-spec').value; }

function normalizeType(type) {
  const value = String(type || '').trim();
  return TYPE_ALIASES.get(value) || (value === 'spell' || value === 'passive' ? value : 'spell');
}

function currentEntries() {
  const data = loadAbilities();
  return [
    ...(data[classKey()] || []).map((ability, index) => ({ ability: { ...ability, type: normalizeType(ability.type) }, key: classKey(), index })),
    ...(data[specKey()] || []).map((ability, index) => ({ ability: { ...ability, type: normalizeType(ability.type) }, key: specKey(), index }))
  ];
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]));
}

function updateTypeFields() {
  $('ability-spell-fields').hidden = $('ability-type').value !== 'spell';
}

function openEditor(entry = null) {
  const existing = entry?.ability || {};
  $('ability-name').value = existing.name || '';
  $('ability-scope').value = entry?.key === classKey() ? 'class' : 'spec';
  $('ability-type').value = normalizeType(existing.type);
  $('ability-school').value = existing.school || '';
  $('ability-cost').value = existing.cost || '';
  $('ability-range').value = existing.range || '';
  $('ability-charges').value = existing.charges || '';
  $('ability-cast-time').value = existing.castTime || '';
  $('ability-cooldown').value = existing.cooldown || '';
  $('ability-description').value = existing.description || existing.effect || '';
  $('ability-icon').value = existing.icon || '';
  $('ability-key').value = entry?.key || '';
  $('ability-index').value = entry ? entry.index : '';
  updateTypeFields();
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
  const type = normalizeType($('ability-type').value);
  const ability = {
    name,
    type,
    description: $('ability-description').value.trim(),
    icon: $('ability-icon').value.trim()
  };

  if (type === 'spell') {
    ability.school = $('ability-school').value.trim();
    ability.cost = $('ability-cost').value.trim();
    ability.range = $('ability-range').value.trim();
    ability.charges = $('ability-charges').value.trim();
    ability.castTime = $('ability-cast-time').value.trim();
    ability.cooldown = $('ability-cooldown').value.trim();
  }

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

function removeAbility(entry) {
  if (!entry) return;
  const data = loadAbilities();
  const list = [...(data[entry.key] || [])];
  if (!list[entry.index]) return;

  if (!window.confirm('Remove "' + entry.ability.name + '" from the Talent Designer?')) return;

  list.splice(entry.index, 1);
  if (list.length) data[entry.key] = list;
  else delete data[entry.key];

  saveAbilities(data);
  renderAbilities();
}

function renderAbilities() {
  const entries = currentEntries();
  const element = $('designer-abilities-list');
  if (!element) return;

  element.innerHTML = entries.length
    ? entries.map((entry, displayIndex) => '<div class="designer-ability-item">' +
        '<div><strong>' + escapeHtml(entry.ability.name) + '</strong>' +
        '<small>' + (entry.key === classKey() ? 'Class' : 'Spec') + ' · ' + escapeHtml(entry.ability.type || 'ability') + '</small>' +
        '<p>' + escapeHtml(entry.ability.description || '') + '</p></div>' +
        '<div class="designer-actions"><button type="button" data-edit="' + displayIndex + '">Edit</button><button type="button" data-delete="' + displayIndex + '">Remove</button></div>' +
      '</div>').join('')
    : '<p class="connection-empty">No class/spec abilities created yet.</p>';

  element.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => openEditor(entries[Number(button.dataset.edit)]));
  });
  element.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => removeAbility(entries[Number(button.dataset.delete)]));
  });
}

function inject() {
  const toolbar = document.querySelector('.designer-toolbar');
  const button = $('add-ability');
  if (!toolbar || !button) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'ability-dialog';
  dialog.className = 'designer-modal';
  dialog.innerHTML = `
    <form method="dialog" class="json-dialog-content">
      <header class="modal-header"><h2>Ability</h2><button type="button" class="modal-close" id="ability-dialog-close" aria-label="Close">×</button></header>
      <div class="modal-body">
        <label>Name<input id="ability-name" required autocomplete="off"></label>
        <label>Scope<select id="ability-scope"><option value="spec">Specialization</option><option value="class">Class</option></select></label>
        <label>Type
          <select id="ability-type">
            <option value="spell">Spell</option>
            <option value="passive">Passive</option>
          </select>
        </label>
        <div id="ability-spell-fields">
          <fieldset>
            <legend>Spell details</legend>
            <label>School<input id="ability-school" placeholder="Physical, Fire, Frost, Nature…"></label>
            <div class="designer-grid-fields">
              <label>Cost<input id="ability-cost" placeholder="30 Runic Power"></label>
              <label>Range<input id="ability-range" placeholder="40 yd"></label>
            </div>
            <div class="designer-grid-fields">
              <label>Charges<input id="ability-charges" placeholder="1 Charge"></label>
              <label>Cast time<input id="ability-cast-time" placeholder="Instant"></label>
            </div>
            <label>Cooldown<input id="ability-cooldown" placeholder="6 sec cooldown"></label>
          </fieldset>
        </div>
        <label>Icon<input id="ability-icon" placeholder="icons/ability.png or ✦"></label>
        <label>Description<textarea id="ability-description" rows="4"></textarea></label>
        <input type="hidden" id="ability-key">
        <input type="hidden" id="ability-index">
        <div class="modal-footer">
          <button type="button" id="save-ability" class="primary">Save Ability</button>
        </div>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);

  button.addEventListener('click', () => openEditor());
  $('create-ability').addEventListener('click', () => openEditor());
  $('save-ability').addEventListener('click', saveAbility);
  $('ability-type').addEventListener('change', updateTypeFields);
  $('ability-dialog-close').addEventListener('click', () => $('ability-dialog').close());
  $('designer-class').addEventListener('change', renderAbilities);
  $('designer-spec').addEventListener('change', renderAbilities);
  renderAbilities();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
else inject();
