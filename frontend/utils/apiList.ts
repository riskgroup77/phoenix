/**
 * DRF va boshqa API javoblarini massivga aylantirish.
 * Qo'llab-quvvatlanadi: [], { results: [] }, { data: [] }, { data: { results: [] } }
 */
export function asApiList<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== 'object') return [];

  const o = raw as {
    results?: unknown;
    data?: unknown;
    items?: unknown;
  };

  if (Array.isArray(o.results)) return o.results as T[];
  if (Array.isArray(o.items)) return o.items as T[];

  const nested = o.data;
  if (Array.isArray(nested)) return nested as T[];
  if (nested && typeof nested === 'object') {
    const n = nested as { results?: unknown; items?: unknown };
    if (Array.isArray(n.results)) return n.results as T[];
    if (Array.isArray(n.items)) return n.items as T[];
  }

  return [];
}
