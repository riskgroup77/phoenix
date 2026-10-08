import React from 'react';
import { REPORT_INNER_TEMPLATE } from '../constants/antiplagTemplateLayout';

/** hisobot2.jpg — ichki sahifalar (jadval, matn). */
const AntiplagReportInnerPage: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const box = REPORT_INNER_TEMPLATE.content_box;
  return (
    <div
      className={`relative mx-auto overflow-hidden bg-white shadow-xl print:shadow-none ${className}`}
      style={{
        width: '100%',
        maxWidth: '210mm',
        aspectRatio: REPORT_INNER_TEMPLATE.aspect,
      }}
    >
      {/* Shablon <img> sifatida — PDF/chop etishda ham chiqadi (CSS fon rasmi tushib qolishi mumkin) */}
      <img
        src={REPORT_INNER_TEMPLATE.image}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 w-full h-full select-none pointer-events-none"
        style={{ objectFit: 'fill' }}
      />
      <div
        className="absolute overflow-hidden flex flex-col antiplag-inner-report text-[11px] leading-snug"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default AntiplagReportInnerPage;
