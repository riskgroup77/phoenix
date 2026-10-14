import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { verifyUrl } from '../utils/verifyLink';
import { UDK_TEMPLATE_IMAGE, UDK_TEMPLATE_LAYOUT, type UdkFieldSpec } from '../constants/udkTemplateLayout';

export interface UDKCertificateData {
    certificateNumber: string;
    issueDate: string;
    author: string;
    workTitle: string;
    udkCode: string;
    udkDescription?: string;
}

const [BASE_W, BASE_H] = UDK_TEMPLATE_LAYOUT.size;

// Arial: ascent 0.905em, descent 0.212em — tayanch chizig'idan quti chegarasigacha bo'lgan masofa (em)
const baselineFromTop = (lineHeight: number) => (lineHeight - 1.117) / 2 + 0.905;
const baselineFromBottom = (lineHeight: number) => (lineHeight - 1.117) / 2 + 0.212;

// Backend (PIL) aniq o'lchaydi; brauzerda taxmin: Arial o'rtacha belgi kengligi ~0.5em (qalin ~0.56em)
const estWidth = (text: string, size: number, bold?: boolean) => text.length * size * (bold ? 0.56 : 0.5);

const fontSize = (size: number) => `calc(100cqw * ${size / BASE_W})`;

type Placement =
    | { mode: 'line'; size: number }
    | { mode: 'wrap'; size: number; lines: number };

/** Backend pdf_generator._draw_value bilan bir xil tartib: kichraytirish → ikki qator → "…" */
const placeValue = (text: string, spec: UdkFieldSpec): Placement => {
    const fits = (size: number) => estWidth(text, size, spec.bold) <= spec.max_width;
    if (fits(spec.size)) return { mode: 'line', size: spec.size };
    const minSize = spec.min_size ?? spec.size * 0.8;
    const shrunk = (spec.size * spec.max_width) / estWidth(text, spec.size, spec.bold);
    if (shrunk >= minSize || !spec.wrap) return { mode: 'line', size: Math.max(minSize, shrunk) };
    const { sizes, max_lines } = spec.wrap;
    // So'z bo'yicha bo'linishda qator oxirida bo'sh joy qoladi — ~8% zaxira
    const linesAt = (size: number) => Math.ceil((estWidth(text, size, spec.bold) * 1.08) / spec.max_width);
    const size = sizes.find((s) => linesAt(s) <= max_lines) ?? sizes[sizes.length - 1];
    const lines = Math.min(max_lines, linesAt(size));
    return lines <= 1 ? { mode: 'line', size } : { mode: 'wrap', size, lines };
};

const pct = (v: number, base: number) => `${(v / base) * 100}%`;

const TemplateValue: React.FC<{ spec: UdkFieldSpec; value: string }> = ({ spec, value }) => {
    const text = (value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const common: React.CSSProperties = {
        position: 'absolute',
        left: pct(spec.x, BASE_W),
        maxWidth: pct(spec.max_width, BASE_W),
        color: spec.color,
        fontWeight: spec.bold ? 700 : 400,
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
    };

    if (spec.multiline) {
        const lh = (spec.line_height ?? spec.size * 1.25) / spec.size;
        return (
            <span
                className="pointer-events-none select-none"
                style={{
                    ...common,
                    top: pct(spec.y, BASE_H),
                    fontSize: fontSize(spec.size),
                    lineHeight: lh,
                    transform: `translateY(-${baselineFromTop(lh)}em)`,
                    display: '-webkit-box',
                    WebkitLineClamp: spec.max_lines ?? 3,
                    WebkitBoxOrient: 'vertical',
                }}
            >
                {text}
            </span>
        );
    }

    const placement = placeValue(text, spec);
    if (placement.mode === 'wrap' && spec.wrap) {
        const lh = 1.15;
        // Oxirgi qator tayanch chizig'i last_y da — blok pastdan joylashtiriladi
        return (
            <span
                className="pointer-events-none select-none"
                style={{
                    ...common,
                    bottom: pct(BASE_H - spec.wrap.last_y, BASE_H),
                    fontSize: fontSize(placement.size),
                    lineHeight: lh,
                    transform: `translateY(${baselineFromBottom(lh)}em)`,
                    display: '-webkit-box',
                    WebkitLineClamp: spec.wrap.max_lines,
                    WebkitBoxOrient: 'vertical',
                }}
            >
                {text}
            </span>
        );
    }
    return (
        <span
            className="pointer-events-none select-none"
            style={{
                ...common,
                top: pct(spec.y, BASE_H),
                fontSize: fontSize(placement.size),
                lineHeight: 1,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                transform: `translateY(-${baselineFromTop(1)}em)`,
            }}
        >
            {text}
        </span>
    );
};

/** UDK HAQIDA MA'LUMOTNOMA — asl dizayn rasmi ustida qiymatlar (backend PDF bilan bir xil joylashuv). */
const UDKCertificate: React.FC<{ data: UDKCertificateData }> = ({ data }) => {
    const { fields, qr } = UDK_TEMPLATE_LAYOUT;
    const values: Record<string, string> = {
        document_number: data.certificateNumber,
        document_date: data.issueDate,
        author: data.author,
        title: data.workTitle,
        udk_code: data.udkCode,
        udk_description: data.udkDescription || '',
    };

    return (
        <div
            id="udk-certificate"
            data-paper
            className="relative mx-auto overflow-hidden bg-white shadow-xl print:shadow-none"
            style={{ width: '100%', maxWidth: '297mm', aspectRatio: `${BASE_W} / ${BASE_H}`, containerType: 'inline-size' }}
        >
            {/* Shablon <img> sifatida: CSS fon rasmi chop etishda ko'pincha tushib qoladi */}
            <img
                src={UDK_TEMPLATE_IMAGE}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
                style={{ objectFit: 'fill' }}
            />
            {Object.entries(fields).map(([key, spec]) => (
                <TemplateValue key={key} spec={spec} value={values[key] || ''} />
            ))}
            <div
                role="img"
                aria-label="QR"
                className="absolute bg-white [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
                style={{
                    left: pct(qr.center_x, BASE_W),
                    top: pct(qr.center_y, BASE_H),
                    width: pct(qr.size, BASE_W),
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <QRCodeSVG value={verifyUrl(data.certificateNumber)} size={256} level="M" fgColor="#17306f" bgColor="#ffffff" marginSize={1} />
            </div>
        </div>
    );
};

export default UDKCertificate;
