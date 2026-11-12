// The reader's light or dark choice. It is a preference of this browser, not of the account,
// so it lives in localStorage. public/theme.js reads the same key before the page draws.

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'dirigo.theme';

declare global {
  interface Window { dirigoApplyTheme?: () => void }
}

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice);
  } catch {
    // Storage is blocked: the choice still applies until the page is reloaded.
  }
  if (window.dirigoApplyTheme) window.dirigoApplyTheme();
  else document.documentElement.setAttribute('data-theme', choice === 'dark' ? 'dark' : 'light');
}
