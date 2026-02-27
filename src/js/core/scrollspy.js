/**
 * Scrollspy Navigation Module
 * Floating table of contents that highlights the current section as you scroll
 * and allows quick jumps to any section
 */

/**
 * Scrollspy configuration for different calculator types
 */
const SCROLLSPY_CONFIG = {
  onsite: {
    sections: [
      { id: 'onsiteOptionsSection', label: 'Options', icon: '⚙️' },
      { id: 'laborSection', label: 'Labor', icon: '👷' },
      { id: 'materialsSection', label: 'Materials', icon: '📦' },
      { id: 'travelSection', label: 'Travel', icon: '🚗' },
      { id: 'summarySection', label: 'Summary', icon: '📊' }
    ]
  },
  workshop: {
    sections: [
      { id: 'laborSection', label: 'Labor', icon: '👷' },
      { id: 'materialsSection', label: 'Materials', icon: '📦' },
      { id: 'travelSection', label: 'Shipping', icon: '🚗' },
      { id: 'summarySection', label: 'Summary', icon: '📊' }
    ]
  }
};

/**
 * Initialize scrollspy navigation
 * @param {string} type - Calculator type ('onsite' or 'workshop')
 */
export function initScrollspy(type = 'onsite') {
  const config = SCROLLSPY_CONFIG[type];
  if (!config) {
    console.warn(`Unknown scrollspy type: ${type}`);
    return;
  }

  // Verify all sections exist
  const missingSections = config.sections.filter(s => !document.getElementById(s.id));
  if (missingSections.length > 0) {
    console.warn('Missing sections for scrollspy:', missingSections.map(s => s.id));
    // Continue anyway - partial functionality is better than none
  }

  createScrollspyUI(config);
  initIntersectionObserver(config.sections);
}

/**
 * Create the scrollspy UI components
 * @param {Object} config - Scrollspy configuration
 */
function createScrollspyUI(config) {
  // Create main container
  const container = document.createElement('div');
  container.id = 'scrollspyNav';
  container.className = 'scrollspy-nav';
  container.setAttribute('role', 'navigation');
  container.setAttribute('aria-label', 'Section navigation');

  // Create toggle button (FAB)
  const fab = document.createElement('button');
  fab.id = 'scrollspyFab';
  fab.className = 'scrollspy-fab';
  fab.setAttribute('aria-label', 'Toggle section navigation');
  fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  // Create menu
  const menu = document.createElement('div');
  menu.className = 'scrollspy-menu';
  menu.setAttribute('role', 'menu');
  menu.id = 'scrollspyMenu';

  // Create section links
  config.sections.forEach((section, index) => {
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    link.className = 'scrollspy-link';
    link.setAttribute('role', 'menuitem');
    link.dataset.sectionId = section.id;
    link.innerHTML = `
      <span class="scrollspy-icon">${section.icon}</span>
      <span class="scrollspy-label">${section.label}</span>
    `;

    // Smooth scroll to section
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(section.id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close menu on mobile after selection
        if (window.innerWidth < 768) {
          closeMenu();
        }
      }
    });

    menu.appendChild(link);
  });

  // Toggle menu visibility
  let isMenuOpen = false;

  function openMenu() {
    isMenuOpen = true;
    container.classList.add('scrollspy-open');
    fab.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    isMenuOpen = false;
    container.classList.remove('scrollspy-open');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', () => {
    isMenuOpen ? closeMenu() : openMenu();
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (isMenuOpen && !container.contains(e.target)) {
      closeMenu();
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
      closeMenu();
      fab.focus();
    }
  });

  // Assemble components
  container.appendChild(fab);
  container.appendChild(menu);

  // Add to DOM
  document.body.appendChild(container);

  // Auto-open on scroll, close after inactivity
  let scrollTimeout;
  let hasInteracted = false;

  window.addEventListener('scroll', () => {
    if (!hasInteracted) {
      hasInteracted = true;
      return;
    }

    clearTimeout(scrollTimeout);
    openMenu();

    scrollTimeout = setTimeout(() => {
      // Don't auto-close on desktop
      if (window.innerWidth < 768) {
        closeMenu();
      }
    }, 3000);
  }, { passive: true });
}

/**
 * Initialize Intersection Observer for active section detection
 * @param {Array} sections - Array of section config objects
 */
function initIntersectionObserver(sections) {
  const observerOptions = {
    rootMargin: '-20% 0px -60% 0px',
    threshold: [0, 0.25, 0.5, 0.75, 1]
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const link = document.querySelector(`.scrollspy-link[data-section-id="${entry.target.id}"]`);
      if (!link) return;

      if (entry.isIntersecting && entry.intersectionRatio > 0.25) {
        link.classList.add('scrollspy-active');
        link.setAttribute('aria-current', 'true');
      } else {
        link.classList.remove('scrollspy-active');
        link.removeAttribute('aria-current');
      }
    });

    // Ensure exactly one section is active (the topmost one)
    const activeLinks = document.querySelectorAll('.scrollspy-link.scrollspy-active');
    if (activeLinks.length > 1) {
      const topSection = getTopmostVisibleSection(sections);
      activeLinks.forEach(link => {
        if (link.dataset.sectionId !== topSection?.id) {
          link.classList.remove('scrollspy-active');
          link.removeAttribute('aria-current');
        }
      });
    }
  }, observerOptions);

  // Observe all sections
  sections.forEach(section => {
    const el = document.getElementById(section.id);
    if (el) {
      observer.observe(el);
    }
  });
}

/**
 * Get the topmost visible section
 * @param {Array} sections - Array of section config objects
 * @returns {Object|null} Topmost visible section
 */
function getTopmostVisibleSection(sections) {
  let topmost = null;
  let minTop = Infinity;

  sections.forEach(section => {
    const el = document.getElementById(section.id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top >= 0 && rect.top < minTop) {
      minTop = rect.top;
      topmost = section;
    }
  });

  return topmost;
}

/**
 * Cleanup scrollspy (for testing or SPA navigation)
 */
export function destroyScrollspy() {
  const container = document.getElementById('scrollspyNav');
  if (container) {
    container.remove();
  }
}
