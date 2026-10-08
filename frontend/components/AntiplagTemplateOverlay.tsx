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

export const AntiplagJpgPage: React.FC<{
  imageUrl: string;
  aspectRatio: string;
  baseWidth: number;
  fields: Record<string, TemplateFieldSpec>;
  values: FieldMap;
  /** QR ichidagi matn (tekshirish havolasi) — kod brauzerda yaratiladi */
  qrValue?: string;
  qrSpec?: QrSpec;
  className?: string;
  id?: string;
}> = ({ imageUrl, aspectRatio, baseWidth, fields, values, qrValue, qrSpec, className = '', id }) => (
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
    {Object.entries(fields).map(([key, spec]) => (
      <TemplateField key={key} spec={spec} value={values[key] || ''} baseWidth={baseWidth} />
    ))}
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
