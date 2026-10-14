/** UDK ma'lumotnoma shabloni (public/udk-template/udk_malumotnoma.jpg) ustidagi qiymatlar.
 *  backend/assets/udk_template/layout.json bilan bir xil bo'lishi shart — udkTemplateLayout.test.ts tekshiradi.
 *  Koordinatalar asl rasm pikselida (2000x1414); y — yorliq bilan umumiy tayanch chizig'i. */

export type UdkFieldSpec = {
  x: number;
  y: number;
  size: number;
  color: string;
  max_width: number;
  bold?: boolean;
  min_size?: number;
  /** Bir qatorga sig'masa: shu shriftlardan birida max_lines qatorga bo'linadi, oxirgi qator last_y da */
  wrap?: { sizes: number[]; max_lines: number; last_y: number };
  multiline?: boolean;
  line_height?: number;
  max_lines?: number;
};

export type UdkTemplateLayout = {
  image: string;
  size: [number, number];
  fields: Record<string, UdkFieldSpec>;
  qr: { center_x: number; center_y: number; size: number };
};

export const UDK_TEMPLATE_IMAGE = '/udk-template/udk_malumotnoma.jpg';

export const UDK_TEMPLATE_LAYOUT: UdkTemplateLayout = {
  image: 'udk_malumotnoma.jpg',
  size: [2000, 1414],
  fields: {
    document_number: { x: 405, y: 84, size: 36, color: '#094ba6', max_width: 300, bold: true },
    document_date: { x: 1060, y: 84, size: 36, color: '#094ba6', max_width: 190, bold: true },
    author: { x: 719, y: 564, size: 36, color: '#0d2f6e', max_width: 700, bold: true },
    title: {
      x: 719, y: 614, size: 30, min_size: 24, color: '#0d2f6e', max_width: 760,
      wrap: { sizes: [22, 20, 18], max_lines: 2, last_y: 626 },
    },
    udk_code: { x: 719, y: 664, size: 38, color: '#094ba6', max_width: 700, bold: true },
    udk_description: { x: 719, y: 772, size: 22, color: '#11697f', max_width: 690, multiline: true, line_height: 28, max_lines: 3 },
  },
  qr: { center_x: 552, center_y: 1105, size: 190 },
};
