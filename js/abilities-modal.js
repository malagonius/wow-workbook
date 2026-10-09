import { loadTalentProject } from './talent-config.js';

const get = id => document.getElementById(id);
const classSelect = get('classSelect');
const specSelect = get('specSelect');
const modal = get('spellModal');
const modalTitle = get('modalTitle');
const spellList = get('spellList');

let abilitiesPromise;

function loadAbilities() {
  if (!abilitiesPromise) {
    abilitiesPromise = loadTalentProject().then(project => project.abilities);
  }
  return abilitiesPromise;
}

function currentAbilities(data) {
  const classKey = classSelect.value;
  const specializationKey = `${classKey}/${specSelect.value}`;
  const baselineClass = data[classKey] || [];
  const baselineSpec = data[specializationKey] || [];
  return [...baselineClass, ...baselineSpec];
}

function renderAbilities(items) {
  if (!items.length) {
    spellList.innerHTML = '<p class="empty-state">No class or specialization abilities have been added yet.</p>';
    return;
  }

  spellList.innerHTML = items.map(ability => `
    <article class="spell-card">
      <h4>${escapeHtml(ability.name || 'Unnamed ability')}</h4>
      ${ability.type ? `<div class="spell-meta"><span>${escapeHtml(ability.type)}</span></div>` : ''}
      <p>${escapeHtml(ability.description || '')}</p>
    </article>
  `).join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function openAbilities() {
  modalTitle.textContent = `${classSelect.value} / ${specSelect.value} — Class & Spec Abilities`;
  spellList.innerHTML = '<p class="empty-state">Loading abilities…</p>';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  try {
    const data = await loadAbilities();
    renderAbilities(currentAbilities(data));
  } catch (error) {
    console.error(error);
    spellList.innerHTML = '<p class="empty-state">Unable to load class/spec abilities.</p>';
  }
}

get('abilitiesBtn')?.addEventListener('click', openAbilities);
