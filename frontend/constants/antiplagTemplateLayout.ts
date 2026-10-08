/** JPG shablon ustidagi matn koordinatalari (backend layout.json bilan sinxron).
 *  Avtomatik yaratilgan: scripts/build_antiplag_templates.py — qo'lda o'zgartirmang. */

export const ANTIPLAG_TEMPLATE_BASE = '/antiplag-templates';

export type TemplateFieldSpec = {
  x: number;
  y: number;
  size: number;
  color: string;
  max_width: number;
  bold?: boolean;
  multiline?: boolean;
  line_height?: number;
  /** y — matnning tayanch chizig'i (yorliq bilan bir chiziqda); aks holda yuqori chegara */
  baseline?: boolean;
  max_lines?: number;
};

export type QrSpec = {
  size: number;
  center_x?: number;
  center_y?: number;
  x?: number;
  y?: number;
};

export const CERTIFICATE_TEMPLATE = {
  image: `${ANTIPLAG_TEMPLATE_BASE}/sertifikat.jpg`,
  width: 3509,
  height: 2481,
  aspect: '3509 / 2481',
  fields: {
    check_date: { x: 0.0519, y: 0.1354, size: 54, color: '#1f2f4a', max_width: 0.2166, bold: true, baseline: true },
    document_number: { x: 0.2867, y: 0.1354, size: 54, color: '#1f2f4a', max_width: 0.2508, bold: true, baseline: true },
    author: { x: 0.2665, y: 0.3841, size: 50, color: '#1f2f4a', max_width: 0.2793, bold: true, baseline: true },
    work_type: { x: 0.2665, y: 0.4091, size: 48, color: '#1f2f4a', max_width: 0.2793, baseline: true },
    file_name: { x: 0.2665, y: 0.4345, size: 44, color: '#1f2f4a', max_width: 0.2793, baseline: true },
    citations: { x: 0.2665, y: 0.4595, size: 48, color: '#1f2f4a', max_width: 0.2793, baseline: true },
    self_citation: { x: 0.2665, y: 0.4845, size: 48, color: '#1f2f4a', max_width: 0.2793, baseline: true },
    plagiarism: { x: 0.2665, y: 0.5099, size: 52, color: '#b91c1c', max_width: 0.2793, bold: true, baseline: true },
    originality: { x: 0.2665, y: 0.5349, size: 52, color: '#15803d', max_width: 0.2793, bold: true, baseline: true },
    search_modules: { x: 0.2665, y: 0.5857, size: 38, color: '#1f2f4a', max_width: 0.2793, baseline: true, max_lines: 5, multiline: true, line_height: 1.37 },
  } satisfies Record<string, TemplateFieldSpec>,
  qr: { center_x: 0.1471, center_y: 0.8444, size: 0.0769 } satisfies QrSpec,
} as const;

export const REPORT_COVER_TEMPLATE = {
  image: `${ANTIPLAG_TEMPLATE_BASE}/hisobot1.jpg`,
  width: 2481,
  height: 3509,
  aspect: '2481 / 3509',
  fields: {
    upload_date: { x: 0.1205, y: 0.1385, size: 60, color: '#1f2f4a', max_width: 0.4031, bold: true, baseline: true },
    document_number: { x: 0.6082, y: 0.1385, size: 60, color: '#1f2f4a', max_width: 0.3547, bold: true, baseline: true },
    author: { x: 0.5038, y: 0.4141, size: 56, color: '#1f2f4a', max_width: 0.4555, bold: true, baseline: true },
    workplace: { x: 0.5038, y: 0.44, size: 52, color: '#1f2f4a', max_width: 0.4555, baseline: true },
    position: { x: 0.5038, y: 0.4657, size: 52, color: '#1f2f4a', max_width: 0.4555, baseline: true },
  } satisfies Record<string, TemplateFieldSpec>,
  qr: { center_x: 0.2717, center_y: 0.7538, size: 0.1169 } satisfies QrSpec,
} as const;

export const REPORT_INNER_TEMPLATE = {
  image: `${ANTIPLAG_TEMPLATE_BASE}/hisobot2.jpg`,
  width: 2481,
  height: 3509,
  aspect: '2481 / 3509',
  content_box: { x: 0.085, y: 0.135, w: 0.83, h: 0.735 },
} as const;
