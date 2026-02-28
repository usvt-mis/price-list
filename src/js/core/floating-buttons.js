/**
 * Floating Buttons Module
 * Handles sticky header and floating action buttons for save/records
 */

export function initFloatingButtons() {
  const mainHeader = document.getElementById('mainHeader');
  const floatingActionBar = document.getElementById('floatingActionBar');
  const saveBtn = document.getElementById('saveBtn');
  const myRecordsBtn = document.getElementById('myRecordsBtn');
  const floatingSaveBtn = document.getElementById('floatingSaveBtn');
  const floatingMyRecordsBtn = document.getElementById('floatingMyRecordsBtn');

  if (!mainHeader || !floatingActionBar) {
    console.warn('[FLOATING-BTN] Required elements not found, skipping initialization');
    return;
  }

  // Sticky header observer
  const headerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          mainHeader.classList.add('is-sticky');
        } else {
          mainHeader.classList.remove('is-sticky');
        }
      });
    },
    { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
  );

  // Create sentinel for scroll detection
  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  mainHeader.parentNode.insertBefore(sentinel, mainHeader.nextSibling);

  const sentinelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        // Show floating buttons when sentinel leaves viewport (header scrolled away)
        const isMobile = window.innerWidth < 768;
        if (isMobile && !entry.isIntersecting) {
          floatingActionBar.classList.add('visible');
        } else {
          floatingActionBar.classList.remove('visible');
        }
      });
    },
    { threshold: 0 }
  );

  // Initialize observers
  headerObserver.observe(mainHeader);
  sentinelObserver.observe(sentinel);

  // Sync button visibility with auth state
  const originalUpdateVisibility = window.updateSaveButtonsVisibility;
  if (originalUpdateVisibility) {
    window.updateSaveButtonsVisibility = function() {
      originalUpdateVisibility();
      syncFloatingButtons();
    };
  }

  function syncFloatingButtons() {
    const saveHidden = saveBtn?.classList.contains('hidden');
    const recordsHidden = myRecordsBtn?.classList.contains('hidden');

    if (saveHidden) {
      floatingSaveBtn?.classList.add('hidden');
    } else {
      floatingSaveBtn?.classList.remove('hidden');
    }

    if (recordsHidden) {
      floatingMyRecordsBtn?.classList.add('hidden');
    } else {
      floatingMyRecordsBtn?.classList.remove('hidden');
    }
  }

  // Initial sync
  syncFloatingButtons();

  // Hide floating buttons when modals open
  const modalObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.classList?.contains('fixed') && node.classList?.contains('z-50')) {
          floatingActionBar.style.display = 'none';
        }
      });
      mutation.removedNodes.forEach((node) => {
        if (node.classList?.contains('fixed') && node.classList?.contains('z-50')) {
          floatingActionBar.style.display = '';
        }
      });
    });
  });

  modalObserver.observe(document.body, { childList: true, subtree: true });

  // Sync click handlers
  floatingSaveBtn?.addEventListener('click', () => saveBtn?.click());
  floatingMyRecordsBtn?.addEventListener('click', () => myRecordsBtn?.click());

  // Log floating button usage (for analytics)
  floatingSaveBtn?.addEventListener('click', () => {
    console.log('[FLOATING-BTN] Save button clicked via floating action', {
      scrollPosition: window.scrollY,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    });
  });

  floatingMyRecordsBtn?.addEventListener('click', () => {
    console.log('[FLOATING-BTN] My Records clicked via floating action', {
      scrollPosition: window.scrollY,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    });
  });

  // Handle resize events
  window.addEventListener('resize', () => {
    syncFloatingButtons();
  });

  // Hide floating buttons in Records view
  const recordsViewObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.id === 'listView' || mutation.target.id === 'detailView') {
        const isRecordsView = !document.getElementById('listView').classList.contains('hidden') ||
                              !document.getElementById('detailView').classList.contains('hidden');
        if (isRecordsView) {
          floatingActionBar.classList.remove('visible');
        }
      }
    });
  });

  const listView = document.getElementById('listView');
  const detailView = document.getElementById('detailView');
  if (listView) recordsViewObserver.observe(listView, { attributes: true, attributeFilter: ['class'] });
  if (detailView) recordsViewObserver.observe(detailView, { attributes: true, attributeFilter: ['class'] });

  console.log('[FLOATING-BTN] Floating buttons initialized');
}
