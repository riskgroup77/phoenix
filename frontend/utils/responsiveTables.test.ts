import { describe, expect, it } from 'vitest';
import { labelTable } from './responsiveTables';

type FakeCell = {
  textContent: string;
  colSpan: number;
  attrs: Record<string, string>;
  getAttribute: (k: string) => string | null;
  setAttribute: (k: string, v: string) => void;
};

function cell(text: string, colSpan = 1): FakeCell {
  const attrs: Record<string, string> = {};
  return {
    textContent: text,
    colSpan,
    attrs,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => {
      attrs[k] = v;
    },
  };
}

function table(head: FakeCell[], body: FakeCell[][]) {
  return {
    tHead: { rows: [{ cells: head }] },
    tBodies: [{ rows: body.map((cells) => ({ cells })) }],
  } as unknown as HTMLTableElement;
}

describe('labelTable', () => {
  it('har katakka ustun sarlavhasini yozadi', () => {
    const row = [cell('Ali'), cell('Muallif'), cell('')];
    labelTable(table([cell(' Ism '), cell('Rol'), cell('')], [row]));
    expect(row.map((c) => c.attrs['data-label'])).toEqual(['Ism', 'Rol', '']);
  });

  it('colspan ni hisobga oladi', () => {
    const row = [cell('a'), cell('b'), cell('c')];
    labelTable(table([cell('Birinchi', 2), cell('Uchinchi')], [row]));
    expect(row.map((c) => c.attrs['data-label'])).toEqual(['Birinchi', 'Birinchi', 'Uchinchi']);
  });

  it('sarlavhasiz jadvalga tegmaydi', () => {
    const row = [cell('x')];
    labelTable({ tHead: null, tBodies: [{ rows: [{ cells: row }] }] } as unknown as HTMLTableElement);
    expect(row[0].attrs['data-label']).toBeUndefined();
  });
});
