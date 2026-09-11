const NAV_ITEMS = [
  { label: 'Talent Calculator', href: 'index.html', icon: '🎯' },
  { label: 'Talent Designer', href: 'designer.html', icon: '🛠️' }
];

function currentPage() {
  const path = window.location.pathname.split('/').pop();
  return path || 'index.html';
}

function renderNavigation() {
  const host = document.getElementById('app-header');
  if (!host) return;

  const activePage = currentPage();
  const links = NAV_ITEMS.map(item => `
    <a class="app-nav-link${item.href === activePage ? ' is-active' : ''}" href="${item.href}">
      <span class="app-nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('');

  host.innerHTML = `
    <header class="app-header">
      <a class="app-brand" href="index.html" aria-label="WoW Workbook home">
        <span class="app-brand-title">WoW Workbook</span>
        <span class="app-brand-subtitle">Homebrew toolkit</span>
      </a>

      <button class="app-menu-toggle" type="button" aria-expanded="false" aria-controls="app-navigation">
        <span class="app-menu-icon" aria-hidden="true">☰</span>
        <span class="app-menu-label">Menu</span>
      </button>

      <nav class="app-navigation" id="app-navigation" aria-label="Main navigation">
        <div class="app-navigation-inner">
          <p class="app-navigation-title">WoW Workbook</p>
          ${links}
        </div>
      </nav>
    </header>
  `;

  const toggle = host.querySelector('.app-menu-toggle');
  const navigation = host.querySelector('.app-navigation');

  toggle.addEventListener('click', () => {
    const open = navigation.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) {
      navigation.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

renderNavigation();
