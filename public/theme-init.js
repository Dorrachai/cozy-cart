// Apply stored color-scheme preference before first paint to prevent FOUC.
try {
  var saved = localStorage.getItem('color-scheme');
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (meta && (saved === 'light' || saved === 'dark')) {
    meta.content = saved;
  }
} catch (_) {
  // Ignore storage access errors in restricted privacy contexts
}
