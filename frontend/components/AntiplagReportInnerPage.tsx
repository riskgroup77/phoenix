import React, { useLayoutEffect, useRef, useState } from 'react';
import { REPORT_INNER_TEMPLATE } from '../constants/antiplagTemplateLayout';
import './antiplagReport.css';

/**
 * A4 varaq (210×297 mm). Ichidagi «sahna» doim haqiqiy A4 o'lchamida chiziladi va ekranda varaq kengligiga
 * moslab kichraytiriladi — shu sababli matn hajmi va sahifalash ekran kengligiga bog'liq emas, PDF/chop etishda
 * ham aynan shunday chiqadi (chop etishda masshtab 1:1).
 */
export const ReportSheet: React.FC<{
  children: React.ReactNode;
  className?: string;
  landscape?: boolean;
}> = ({ children, className = '', landscape }) => (
  <section className={`ap-sheet${landscape ? ' ap-sheet--landscape' : ''} ${className}`} data-paper>
    {children}
  </section>
);

function useStageScale() {
  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const stage = stageRef.current;
    if (!outer || !stage) return;
    const update = () => {
      const base = stage.offsetWidth;
      const w = outer.clientWidth;
      if (base > 0 && w > 0) setScale(Math.min(4, w / base));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  return { outerRef, stageRef, scale };
}

/** hisobot2.jpg — ichki sahifa: fon shablon + layout.json dagi content_box ichida kontent. */
const AntiplagReportInnerPage: React.FC<{
  children: React.ReactNode;
  /** Pastki qatordagi yozuvlar (sahifa raqami va h.k.) */
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
}> = ({ children, footerLeft, footerRight }) => {
  const { outerRef, stageRef, scale } = useStageScale();
  const showFooter = footerLeft != null || footerRight != null;
  return (
    <ReportSheet>
      <div ref={outerRef} className="absolute inset-0">
        <div
          ref={stageRef}
          className="ap-stage"
          style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
        >
          {/* Shablon <img> sifatida — PDF/chop etishda ham chiqadi (CSS fon rasmi tushib qolishi mumkin) */}
          <img className="ap-bg" src={REPORT_INNER_TEMPLATE.image} alt="" aria-hidden="true" draggable={false} />
          <div className="ap-content">
            <div className="ap-flow">{children}</div>
            {showFooter && (
              <div className="ap-page-footer">
                <span>{footerLeft}</span>
                <span>{footerRight}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ReportSheet>
  );
};

export default AntiplagReportInnerPage;
