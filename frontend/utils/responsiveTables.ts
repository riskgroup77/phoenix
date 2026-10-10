/**
 * Telefonda jadvallarni kartalarga aylantirish.
 *
 * `table.rtable` dagi har bir katakka (td) o'z ustuni sarlavhasi `data-label` sifatida yoziladi.
 * CSS (phoenix-theme.css, "Responsive jadvallar") kichik ekranda har qatorni karta qilib,
 * katak oldiga ustun nomini chiqaradi. Qatorlar keyin qo'shilsa ham (API, filtr) — MutationObserver yangilaydi.
 */
function headerLabels(table: HTMLTableElement): string[] {
  const row = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!row) return [];
  const labels: string[] = [];
  for (const cell of Array.from(row.cells)) {
    const text = (cell.textContent || '').trim();
    for (let i = 0; i < (cell.colSpan || 1); i += 1) labels.push(text);
  }
  return labels;
}

export function labelTable(table: HTMLTableElement): void {
  const labels = headerLabels(table);
  if (!labels.length) return;
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const label = labels[col] ?? '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
        col += cell.colSpan || 1;
      }
    }
  }
}

function labelAll(root: ParentNode): void {
  root.querySelectorAll<HTMLTableElement>('table.rtable').forEach(labelTable);
}

let started = false;

export function initResponsiveTables(): void {
  if (started || typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  started = true;
  let scheduled = false;
  const run = () => {
    scheduled = false;
    labelAll(document);
  };
  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      // requestAnimationFrame fon tabida to'xtaydi — setTimeout ishonchliroq
      window.setTimeout(run, 30);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  run();
}
