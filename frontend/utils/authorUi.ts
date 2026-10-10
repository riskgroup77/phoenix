/** Muallif interfeysi: 'ai' (standart — AI ish maydoni) yoki 'classic' (oddiy boshqaruv paneli). */
const KEY = 'phoenix_author_ui';

export type AuthorUi = 'ai' | 'classic';

export function getAuthorUi(): AuthorUi {
  try {
    return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'ai';
  } catch {
    return 'ai';
  }
}

export function setAuthorUi(mode: AuthorUi): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* localStorage yopiq */
  }
}

/** Kirgandan keyingi bosh sahifa */
export function homePathFor(role: string | undefined): string {
  if (role === 'operator') return '/operator-dashboard';
  if (role === 'author' && getAuthorUi() === 'ai') return '/ai';
  return '/dashboard';
}
