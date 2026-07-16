/**
 * Generates "MAQOLALAR NASHRI HAQIDA HISOBOT" as .docx and triggers download.
 * Layout matches the sample: cover with author block, second page with table.
 */
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    BorderStyle,
    WidthType,
    HeadingLevel,
    Header,
    Footer,
    PageNumber,
    VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import type { NashrHisobotData } from '../components/NashrHisobotCertificate';

export async function downloadNashrHisobotDocx(data: NashrHisobotData): Promise<void> {
    const tableHeaderColor = 'E2E8F0'; // Slate 200 equivalent
    const tableBorderColor = '94A3B8'; // Slate 400 equivalent

    const doc = new Document({
        creator: 'Phoenix Scientific Platform',
        title: 'Maqolalar Nashri Haqida Hisobot',
        description: 'Maqolalar Nashri Haqida Hisobot',
        styles: {
            default: {
                document: {
                    run: {
                        size: 28, // 14pt (28 half-points)
                        font: 'Times New Roman',
                        color: '000000',
                    },
                    paragraph: {
                        spacing: {
                            line: 360, // 1.5 line spacing (240 is 1.0)
                        },
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch
                            right: 1440,  // 1 inch
                            bottom: 1440, // 1 inch
                            left: 1440,   // 1 inch
                        },
                    },
                },
                children: [
                    // Header Date & ID
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({ text: 'Sana: ', bold: true, size: 24 }),
                            new TextRun({ text: data.documentDate, size: 24 }),
                        ],
                        spacing: { after: 120 },
                    }),
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({ text: 'Hujjat raqami: ', bold: true, size: 24 }),
                            new TextRun({ text: data.documentNumber, size: 24 }),
                        ],
                        spacing: { after: 800 },
                    }),

                    // Title
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "MAQOLALAR NASHRI HAQIDA HISOBOT",
                                bold: true,
                                size: 36, // 18pt
                                color: '0A225F',
                            }),
                        ],
                        spacing: { before: 400, after: 800 },
                    }),

                    // Author Info
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Muallif: ', bold: true }),
                            new TextRun({ text: data.authorFullName }),
                        ],
                        spacing: { after: 300 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Ish yoki o'qish joyi: ", bold: true }),
                            new TextRun({ text: data.authorWorkplace }),
                        ],
                        spacing: { after: 300 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Lavozimi: ", bold: true }),
                            new TextRun({ text: data.authorPosition }),
                        ],
                        spacing: { after: 800 },
                    }),

                    // Branding / Verification
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: 'Phoenix ', bold: true, color: '0A225F', size: 32 }),
                            new TextRun({ text: 'NASHRIYOTI', size: 32, bold: true, color: '279EFF' }),
                        ],
                        spacing: { before: 400, after: 200 },
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: 'HUJJATNI TEKSHIRISH UCHUN QR KODDAN FOYDALANING',
                                italics: true,
                                size: 24,
                                color: '64748B',
                            }),
                        ],
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'www.ilmiyfaoliyat.uz', bold: true, size: 24, color: '0A225F' })],
                    }),
                ],
            },
            {
                // Page 2: Table
                properties: {
                    page: {
                        margin: {
                            top: 1440,
                            right: 900,  // slightly wider table area
                            bottom: 1440,
                            left: 900,
                        },
                    },
                },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "NASHRLAR RO'YXATI",
                                bold: true,
                                size: 28,
                                color: '0A225F',
                            }),
                        ],
                        spacing: { after: 600 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 4, color: tableBorderColor },
                            bottom: { style: BorderStyle.SINGLE, size: 4, color: tableBorderColor },
                            left: { style: BorderStyle.SINGLE, size: 4, color: tableBorderColor },
                            right: { style: BorderStyle.SINGLE, size: 4, color: tableBorderColor },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: tableBorderColor },
                            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: tableBorderColor },
                        },
                        rows: [
                            new TableRow({
                                tableHeader: true,
                                children: [
                                    new TableCell({
                                        width: { size: 5, type: WidthType.PERCENTAGE },
                                        shading: { fill: tableHeaderColor },
                                        verticalAlign: VerticalAlign.CENTER,
                                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '№', bold: true, size: 24 })] })],
                                    }),
                                    new TableCell({
                                        width: { size: 30, type: WidthType.PERCENTAGE },
                                        shading: { fill: tableHeaderColor },
                                        verticalAlign: VerticalAlign.CENTER,
                                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ilmiy ish nomi', bold: true, size: 24 })] })],
                                    }),
                                    new TableCell({
                                        width: { size: 25, type: WidthType.PERCENTAGE },
                                        shading: { fill: tableHeaderColor },
                                        verticalAlign: VerticalAlign.CENTER,
                                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nashr nomi va yili', bold: true, size: 24 })] })],
                                    }),
                                    new TableCell({
                                        width: { size: 20, type: WidthType.PERCENTAGE },
                                        shading: { fill: tableHeaderColor },
                                        verticalAlign: VerticalAlign.CENTER,
                                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Internet havolasi (DOI)', bold: true, size: 24 })] })],
                                    }),
                                    new TableCell({
                                        width: { size: 20, type: WidthType.PERCENTAGE },
                                        shading: { fill: tableHeaderColor },
                                        verticalAlign: VerticalAlign.CENTER,
                                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Hammualliflar', bold: true, size: 24 })] })],
                                    }),
                                ],
                            }),
                            ...data.articles.map(
                                (article, index) =>
                                    new TableRow({
                                        children: [
                                            new TableCell({
                                                verticalAlign: VerticalAlign.CENTER,
                                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(index + 1), size: 24 })] })],
                                            }),
                                            new TableCell({
                                                verticalAlign: VerticalAlign.CENTER,
                                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: article.title, size: 24 })] })],
                                            }),
                                            new TableCell({
                                                verticalAlign: VerticalAlign.CENTER,
                                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                                children: [
                                                    new Paragraph({
                                                        alignment: AlignmentType.LEFT,
                                                        children: [
                                                            new TextRun({
                                                                text: article.publishDate ? `${article.publishName} (${article.publishDate})` : article.publishName,
                                                                size: 24
                                                            }),
                                                        ],
                                                    }),
                                                ],
                                            }),
                                            new TableCell({
                                                verticalAlign: VerticalAlign.CENTER,
                                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: article.internetLink || '-', size: 24, color: article.internetLink ? '0563C1' : '000000', underline: !!article.internetLink ? { type: 'single', color: '0563C1' } : undefined })] })],
                                            }),
                                            new TableCell({
                                                verticalAlign: VerticalAlign.CENTER,
                                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                                children: [
                                                    new Paragraph({
                                                        alignment: AlignmentType.LEFT,
                                                        children: [
                                                            new TextRun({
                                                                text: article.coAuthors.length > 0
                                                                    ? article.coAuthors.map((a, i) => `${i + 1}. ${a}`).join('\n')
                                                                    : '-',
                                                                size: 24
                                                            }),
                                                        ],
                                                    }),
                                                ],
                                            }),
                                        ],
                                    })
                            ),
                        ],
                    }),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `Maqolalar_Nashri_Hisoboti_${data.documentNumber}.docx`;
    saveAs(blob, fileName);
}
