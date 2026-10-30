// Synchronous FOUC-prevention script following modern-web-guidance `dark-mode-toggle`.
try {
  var saved = localStorage.getItem('color-scheme');
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta && (saved === 'light' || saved === 'dark')) {
    meta.content = saved;
  }
} catch (_) {
  // Ignore storage access errors in strict privacy contexts
}
