import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type StoredScheme = 'light' | 'dark' | null;

function readStoredScheme(): StoredScheme {
  try {
    const val = localStorage.getItem('color-scheme');
    return val === 'light' || val === 'dark' ? val : null;
  } catch {
    return null;
  }
}

function getSystemScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncMetaElement(stored: StoredScheme): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = stored ?? 'light dark';
  }
}

/**
 * Two-state comfort theme toggle following modern-web-guidance `dark-mode-toggle`:
 * - Flips the currently rendered scheme.
 * - Removes `localStorage` override when returning to system preference so OS auto-switching isn't pinned.
 */
export function ThemeToggle() {
  const [stored, setStored] = useState<StoredScheme>(() => readStoredScheme());
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() => getSystemScheme());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemScheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const next = readStoredScheme();
        setStored(next);
        syncMetaElement(next);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const renderedScheme = stored ?? systemScheme;

  const handleToggle = useCallback(() => {
    const currentSys = getSystemScheme();
    const currentRendered = stored ?? currentSys;
    const target: 'light' | 'dark' = currentRendered === 'dark' ? 'light' : 'dark';

    if (target === currentSys) {
      // Returning to system preference: remove stored override so future OS switches work naturally
      try {
        localStorage.removeItem('color-scheme');
      } catch {
        // Ignore
      }
      setStored(null);
      syncMetaElement(null);
    } else {
      try {
        localStorage.setItem('color-scheme', target);
      } catch {
        // Ignore
      }
      setStored(target);
      syncMetaElement(target);
    }
  }, [stored]);

  const isDark = renderedScheme === 'dark';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
