// Minimal content script placeholder for the extension.
// You can expand this to inject UI, read page data, or message the background/service worker.
(function () {
  try {
    console.log('[EcoStyle] content script loaded');
    // Example: insert a small badge into the page (non-invasive)
    const badge = document.createElement('div');
    badge.textContent = 'EcoStyle';
    badge.style.position = 'fixed';
    badge.style.right = '12px';
    badge.style.bottom = '12px';
    badge.style.background = 'rgba(14,165,164,0.9)';
    badge.style.color = 'white';
    badge.style.padding = '6px 8px';
    badge.style.borderRadius = '6px';
    badge.style.zIndex = 2147483647;
    badge.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    badge.style.fontSize = '12px';
    badge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', () => {
      window.open('/index.html', '_blank');
    });
    document.documentElement.appendChild(badge);
  } catch (e) {
    console.error('[EcoStyle] content script error', e);
  }
})();
