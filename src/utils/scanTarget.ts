/** Normalizes scan targets so baseline comparisons only match equivalent destinations. */
export function normalizeScanTarget(raw: string | undefined | null): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.protocol}//${url.host.toLowerCase()}${path}`;
  } catch {
    return value.toLowerCase().replace(/\/+$/, '');
  }
}
