const CLASS_ICONS = {
  'Death Knight': 'deathknight', 'Demon Hunter': 'demonhunter', Druid: 'druid',
  Evoker: 'evoker', Hunter: 'hunter', Mage: 'mage', Monk: 'monk', Paladin: 'paladin',
  Priest: 'priest', Rogue: 'rogue', Shaman: 'shaman', Warlock: 'warlock', Warrior: 'warrior'
};

export function initializeClassPicker(classSelect, specSelect, getContent, { onCreateSpec, canCreateSpec = () => false } = {}) {
  const picker = document.createElement('nav');
  picker.className = 'class-picker';
  picker.setAttribute('aria-label', 'Class and specialization');
  classSelect.closest('label').before(picker);
  classSelect.closest('label').hidden = true;
  specSelect.closest('label').hidden = !onCreateSpec;
  let signature = '';

  function closeMenus() {
    picker.querySelectorAll('.class-spec-menu').forEach(menu => { menu.hidden = true; });
    picker.querySelectorAll('.class-icon-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }

  function openMenu(group) {
    closeMenus();
    const menu = group.querySelector('.class-spec-menu');
    menu.hidden = false;
    group.querySelector('.class-icon-button').setAttribute('aria-expanded', 'true');
    menu.style.transform = '';
    const bounds = menu.getBoundingClientRect();
    const shift = Math.min(0, innerWidth - 12 - bounds.right);
    menu.style.transform = `translateX(${Math.max(12 - bounds.left, shift)}px)`;
  }

  document.addEventListener('click', event => { if (!picker.contains(event.target)) closeMenus(); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const trigger = picker.querySelector('[aria-expanded="true"]');
      closeMenus();
      trigger?.focus();
    }
  });

  return function refresh() {
    const content = getContent();
    const nextSignature = JSON.stringify(content);
    if (signature !== nextSignature) {
      signature = nextSignature;
      picker.replaceChildren();
      for (const [className, specs] of Object.entries(content)) {
        const group = document.createElement('div');
        group.className = 'class-picker-item';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'class-icon-button';
        trigger.dataset.className = className;
        trigger.setAttribute('aria-label', `${className} specializations`);
        trigger.setAttribute('aria-expanded', 'false');
        const icon = CLASS_ICONS[className];
        const image = document.createElement('img');
        image.src = `https://wow.zamimg.com/images/wow/icons/medium/${icon ? `classicon_${icon}` : 'inv_misc_gear_01'}.jpg`;
        image.alt = '';
        const fallback = document.createElement('span');
        fallback.textContent = className.split(' ').map(word => word[0]).join('').slice(0, 2);
        fallback.hidden = true;
        image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; });
        trigger.append(image, fallback);
        const menu = document.createElement('div');
        menu.className = 'class-spec-menu';
        menu.id = `${classSelect.id}-specs-${picker.childElementCount}`;
        menu.hidden = true;
        trigger.setAttribute('aria-controls', menu.id);
        const title = document.createElement('strong');
        title.textContent = className;
        menu.append(title);
        if (onCreateSpec) {
          const create = document.createElement('button');
          create.type = 'button';
          create.textContent = '-- NEW SPEC --';
          create.dataset.createSpec = className;
          create.addEventListener('click', () => {
            if (classSelect.value !== className) {
              classSelect.value = className;
              classSelect.dispatchEvent(new Event('change'));
            }
            closeMenus();
            onCreateSpec();
          });
          menu.append(create);
        }
        for (const specName of specs) {
          const option = document.createElement('button');
          option.type = 'button';
          option.textContent = specName;
          option.dataset.specName = specName;
          option.setAttribute('aria-label', `${className} / ${specName}`);
          option.addEventListener('click', () => {
            if (classSelect.value !== className) {
              classSelect.value = className;
              classSelect.dispatchEvent(new Event('change'));
            }
            specSelect.value = specName;
            specSelect.dispatchEvent(new Event('change'));
            closeMenus();
            trigger.focus({ preventScroll: true });
          });
          menu.append(option);
        }
        if (!specs.length) {
          const empty = document.createElement('span');
          empty.textContent = 'No specializations';
          menu.append(empty);
        }
        let hovered = false;
        trigger.addEventListener('click', () => {
          if (classSelect.value !== className) {
            classSelect.value = className;
            classSelect.dispatchEvent(new Event('change'));
          }
          if (menu.hidden || hovered) openMenu(group);
          else closeMenus();
          hovered = false;
        });
        trigger.addEventListener('keydown', event => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          openMenu(group);
          menu.querySelector('button')?.focus();
        });
        group.addEventListener('pointerenter', event => {
          if (event.pointerType === 'mouse') { openMenu(group); hovered = true; }
        });
        group.addEventListener('pointerleave', event => {
          if (event.pointerType === 'mouse' && !group.contains(document.activeElement)) closeMenus();
        });
        group.append(trigger, menu);
        picker.append(group);
      }
    }
    picker.querySelectorAll('.class-picker-item').forEach(group => {
      const trigger = group.querySelector('.class-icon-button');
      const selected = trigger.dataset.className === classSelect.value;
      trigger.setAttribute('aria-pressed', String(selected));
      const create = group.querySelector('[data-create-spec]');
      if (create) create.disabled = !canCreateSpec(trigger.dataset.className);
      group.querySelectorAll('[data-spec-name]').forEach(option => {
        option.setAttribute('aria-pressed', String(selected && option.dataset.specName === specSelect.value));
      });
    });
  };
}