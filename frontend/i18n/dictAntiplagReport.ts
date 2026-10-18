/**
 * Antiplagiat hisoboti (to'liq/qisqacha, A4 sahifalar) matnlari: [uz, ru, en].
 * Kalit — koddagi t('…') matni bilan aynan bir xil. uz-Cyrl — avtomatik transliteratsiya.
 */
export const ANTIPLAG_REPORT_ROWS: [string, string, string][] = [
  ['Matnli kesishmalar', 'Текстовые пересечения', 'Text overlaps'],
  ['(davomi)', '(продолжение)', '(continued)'],
  ['Manbalar soni', 'Количество источников', 'Number of sources'],
  ['Qidiruv modullari', 'Модули поиска', 'Search modules'],
  [
    "Belgilangan matn manbalarda topilgan; raqam — manbalar ro'yxatidagi tartib raqami.",
    'Выделенный текст найден в источниках; число — порядковый номер в списке источников.',
    'Highlighted text was found in sources; the number is the item in the source list.',
  ],
  [
    "Hujjatdagi matn va manbadagi mos fragment yonma-yon ko'rsatilgan.",
    'Текст документа и соответствующий фрагмент источника показаны рядом.',
    'The document text and the matching source fragment are shown side by side.',
  ],
];
