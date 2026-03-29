/** Grupuje pozycje sprzętu zlecenia po polu `category` (jak w PDF oferty). Kolejność kategorii: alfabetycznie `pl`. */
export function groupOrderEquipmentByCategory<T extends { category?: string | null }>(
  items: T[]
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const raw = item.category != null ? String(item.category).trim() : '';
    const cat = raw || 'Inne';
    const list = map.get(cat);
    if (list) list.push(item);
    else map.set(cat, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pl', { sensitivity: 'base' }))
    .map(([category, grouped]) => ({ category, items: grouped }));
}
