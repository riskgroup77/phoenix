import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { QrSpec, TemplateFieldSpec } from '../constants/antiplagTemplateLayout';

type FieldMap = Record<string, string>;

const TemplateField: React.FC<{ spec: TemplateFieldSpec; value: string; baseWidth: number }> = ({
  spec,
  value,
  baseWidth,
}) => {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  let size = spec.size;
  if (!spec.multiline) {
    // Backend bilan bir xil: uzun qiymat avval 80% gacha kichrayadi, keyin "…" bilan qisqaradi.
    // Arial'da o'rtacha belgi kengligi ~0.52em.
    const estWidth = text.length * 0.52 * size;
    const maxPx = spec.max_width * baseWidth;
    if (estWidth > maxPx) size = Math.max(spec.size * 0.8, (size * maxPx) / estWidth);
  }
  const lineHeight = spec.multiline ? spec.line_height || 1.25 : 1;
  // baseline: y — yorliq bilan umumiy tayanch chizig'i. Arial: ascent 0.905em, descent 0.212em —
  // birinchi qator tayanch chizig'i quti tepasidan (L - 1.117) / 2 + 0.905 em pastda.
  const baselineShift = spec.baseline ? (lineHeight - 1.117) / 2 + 0.905 : 0;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${spec.x * 100}%`,
    top: `${spec.y * 100}%`,
    maxWidth: `${spec.max_width * 100}%`,
    color: spec.color,
    fontWeight: spec.bold ? 700 : 400,
    fontSize: `calc(100cqw * ${size / baseWidth})`,
    lineHeight,
    fontFamily: 'Arial, Helvetica, sans-serif',
    whiteSpace: spec.multiline ? 'normal' : 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transform: baselineShift ? `translateY(-${baselineShift}em)` : undefined,
    ...(spec.multiline && spec.max_lines
      ? { display: '-webkit-box', WebkitLineClamp: spec.max_lines, WebkitBoxOrient: 'vertical' as const }
      : {}),
  };
  return (
    <span className="pointer-events-none select-none" style={style}>
      {text}
    </span>
  );
};

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Matn kengligi (shablon pikselida): brauzerda canvas bilan aniq, test muhitida (canvas yo'q) — taxminiy */
function textWidth(text: string, size: number, bold: boolean): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    measureCtx.font = `${bold ? 700 : 400} ${size}px Arial, Helvetica, sans-serif`;
    return measureCtx.measureText(text).width;
  }
  return text.length * (bold ? 0.6 : 0.52) * size;
}

/**
 * Bir nechta ism (mualliflar): avval bitta qatorga (shrift 70% gacha kichrayadi), sig'masa — ism o'rtasidan emas,
 * mualliflar orasidan qatorlarga bo'linadi. Pastdagi qator (ISH TURI) band — blok yuqoriga o'sadi: oxirgi qator
 * yorliq bilan bir tayanch chizig'ida, oldingilari undan yuqorida (sertifikatda bu joy bo'sh).
 */
export function layoutNameList(
  names: string[],
  spec: Pick<TemplateFieldSpec, 'size' | 'max_width' | 'bold'>,
  baseWidth: number,
  maxLines = 3,
  measure: (text: string, size: number, bold: boolean) => number = textWidth,
): { size: number; lines: string[] } {
  const clean = names.map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const maxPx = spec.max_width * baseWidth;
  const bold = !!spec.bold;
  const joined = clean.join(', ');
  // Bitta qator — boshqa maydonlar kabi 80% gacha kichrayadi
  for (let size = spec.size; size >= spec.size * 0.8; size -= 1) {
    if (measure(joined, size, bold) <= maxPx) return { size, lines: [joined] };
  }
  const pack = (size: number) => {
    const lines: string[] = [];
    clean.forEach((name, i) => {
      const piece = i < clean.length - 1 ? `${name},` : name;
      const last = lines[lines.length - 1];
      if (last !== undefined && measure(`${last} ${piece}`, size, bold) <= maxPx) lines[lines.length - 1] = `${last} ${piece}`;
      else lines.push(piece);
    });
    return lines;
  };
  // Ko'p qator: o'qilishi uchun imkon qadar katta shrift (80% dan), qatorlar soni maxLines dan oshmaguncha
  let size = Math.floor(spec.size * 0.8);
  let lines = pack(size);
  while (lines.length > maxLines && size > spec.size * 0.5) {
    size -= 1;
    lines = pack(size);
  }
  if (lines.length > maxLines) {
    // Juda ko'p muallif — oxirgi qator «…» bilan tugaydi (to'liq ro'yxat hisobot va QR tekshiruvida)
    lines = [...lines.slice(0, maxLines - 1), `${lines.slice(maxLines - 1).join(' ').replace(/,$/, '')}`];
  }
  return { size, lines };
}

const NameListField: React.FC<{ spec: TemplateFieldSpec; names: string[]; baseWidth: number }> = ({
  spec,
  names,
  baseWidth,
}) => {
  const { size, lines } = layoutNameList(names, spec, baseWidth);
  const lineHeight = lines.length > 1 ? 1.2 : 1;
  // Oxirgi qatorning tayanch chizig'i y da: qator qutisi pastidan (L - 1.117) / 2 + 0.212 em yuqorida (Arial)
  const baselineFromBottom = (lineHeight - 1.117) / 2 + 0.212;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${spec.x * 100}%`,
    bottom: `${(1 - spec.y) * 100}%`,
    width: `${spec.max_width * 100}%`,
    color: spec.color,
    fontWeight: spec.bold ? 700 : 400,
    fontSize: `calc(100cqw * ${size / baseWidth})`,
    lineHeight,
    fontFamily: 'Arial, Helvetica, sans-serif',
    transform: `translateY(${baselineFromBottom}em)`,
  };
  return (
    <span className="pointer-events-none select-none" style={style} data-testid="template-name-list">
      {lines.map((line, i) => (
        <span key={i} style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {line}
        </span>
      ))}
    </span>
  );
};

export const AntiplagJpgPage: React.FC<{
  imageUrl: string;
  aspectRatio: string;
  baseWidth: number;
  fields: Record<string, TemplateFieldSpec>;
  values: FieldMap;
  /** Bir nechta ismli maydonlar (masalan mualliflar) — mualliflar orasidan qatorlarga bo'linadi */
  nameLists?: Record<string, string[]>;
  /** QR ichidagi matn (tekshirish havolasi) — kod brauzerda yaratiladi */
  qrValue?: string;
  qrSpec?: QrSpec;
  className?: string;
  id?: string;
}> = ({ imageUrl, aspectRatio, baseWidth, fields, values, nameLists, qrValue, qrSpec, className = '', id }) => (
  <div
    id={id}
    className={`relative mx-auto overflow-hidden bg-white shadow-xl print:shadow-none ${className}`}
    style={{
      width: '100%',
      maxWidth: baseWidth > 3000 ? '297mm' : '210mm',
      aspectRatio,
      containerType: 'inline-size',
    }}
  >
    {/* Shablon <img> sifatida: CSS fon rasmi PDF/chop etishda ko'pincha tushib qoladi, rasm esa doim chiqadi */}
    <img
      src={imageUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="absolute inset-0 w-full h-full select-none pointer-events-none"
      style={{ objectFit: 'fill' }}
    />
    {Object.entries(fields).map(([key, spec]) =>
      (nameLists?.[key]?.length || 0) > 1 ? (
        <NameListField key={key} spec={spec} names={nameLists![key]} baseWidth={baseWidth} />
      ) : (
        <TemplateField key={key} spec={spec} value={values[key] || ''} baseWidth={baseWidth} />
      ),
    )}
    {qrValue && qrSpec ? (
      <div
        role="img"
        aria-label="QR"
        className="absolute bg-white rounded-sm [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
        style={
          qrSpec.center_x != null && qrSpec.center_y != null
            ? {
                left: `${qrSpec.center_x * 100}%`,
                top: `${qrSpec.center_y * 100}%`,
                width: `${qrSpec.size * 100}%`,
                transform: 'translate(-50%, -50%)',
              }
            : {
                left: `${(qrSpec.x ?? 0) * 100}%`,
                top: `${(qrSpec.y ?? 0) * 100}%`,
                width: `${qrSpec.size * 100}%`,
              }
        }
      >
        <QRCodeSVG value={qrValue} size={256} level="M" fgColor="#17306f" bgColor="#ffffff" marginSize={1} />
      </div>
    ) : null}
  </div>
);

export default AntiplagJpgPage;
