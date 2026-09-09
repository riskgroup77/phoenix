import React from 'react';

export const REPORT_COLOR_DARK = '#1e2d4a';
export const REPORT_COLOR_NAVY = '#0f2744';
export const REPORT_COLOR_TEAL = '#0a7a8c';
export const REPORT_COLOR_TEAL_LIGHT = '#14b8a6';
export const REPORT_COLOR_GOLD = '#b8860b';
export const REPORT_COLOR_TEXT = '#1e293b';

/** A4 o'lchamlari */
export const A4_PORTRAIT_STYLE: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    maxWidth: '210mm',
    margin: '0 auto',
};

export const A4_LANDSCAPE_CERT_STYLE: React.CSSProperties = {
    width: '297mm',
    minHeight: '210mm',
    maxWidth: '297mm',
    margin: '0 auto',
};

/** hisobot1 / hisobot2 — fon to'lqin chiziqlari */
export const WaveLinesPattern: React.FC = () => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.35]" aria-hidden>
        <defs>
            <pattern id="wave-mesh" width="120" height="120" patternUnits="userSpaceOnUse">
                <path d="M0 60 Q30 20 60 60 T120 60" fill="none" stroke="#94a3b8" strokeWidth="0.6" />
                <path d="M0 80 Q40 40 80 80 T160 80" fill="none" stroke="#cbd5e1" strokeWidth="0.4" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wave-mesh)" />
        <path d="M-20 80 Q180 20 400 100" fill="none" stroke="#cbd5e1" strokeWidth="0.8" opacity="0.5" />
        <path d="M-40 200 Q200 120 500 180" fill="none" stroke="#e2e8f0" strokeWidth="0.6" opacity="0.6" />
        <path d="M100 520 Q350 460 600 540" fill="none" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.45" />
    </svg>
);

/** hisobot1.jpg — muqova sahifa ramkasi */
export const ReportCoverFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative overflow-hidden bg-white a4-portrait-page" style={A4_PORTRAIT_STYLE}>
        <WaveLinesPattern />
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 h-14 flex items-stretch">
            <div className="w-16 shrink-0" style={{ background: REPORT_COLOR_NAVY, clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }} />
            <div
                className="flex-1 flex items-center justify-end px-4"
                style={{
                    background: `linear-gradient(90deg, ${REPORT_COLOR_TEAL} 0%, ${REPORT_COLOR_TEAL_LIGHT} 55%, ${REPORT_COLOR_NAVY} 100%)`,
                    clipPath: 'polygon(2% 0, 100% 0, 100% 100%, 0 100%)',
                }}
            >
                <span className="text-[11px] font-semibold tracking-wide text-white/95">www.ilmiyfaoliyat.uz</span>
            </div>
        </div>
        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 z-10 h-14 flex items-stretch">
            <div
                className="w-[45%]"
                style={{
                    background: `linear-gradient(90deg, ${REPORT_COLOR_TEAL_LIGHT}, ${REPORT_COLOR_TEAL})`,
                    clipPath: 'polygon(0 0, 92% 0, 100% 100%, 0 100%)',
                }}
            />
            <div className="flex-1" style={{ background: REPORT_COLOR_NAVY, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8% 100%)' }} />
            <div className="absolute bottom-0 right-0 w-20 h-full" style={{ background: REPORT_COLOR_NAVY, clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%)' }} />
        </div>
        <div className="relative z-20 h-full flex flex-col pt-16 pb-16 px-8 sm:px-10">{children}</div>
    </div>
);

/** hisobot2.jpg — davomiy sahifalar ramkasi */
export const ReportInnerFrame: React.FC<{ children: React.ReactNode; pageNum?: number }> = ({ children, pageNum }) => (
    <div className="relative overflow-hidden bg-white a4-portrait-page" style={A4_PORTRAIT_STYLE}>
        <WaveLinesPattern />
        <div className="absolute top-0 left-0 right-0 z-10 h-12 flex items-stretch">
            <div className="w-14 shrink-0" style={{ background: REPORT_COLOR_NAVY, clipPath: 'polygon(0 0, 100% 0, 65% 100%, 0 100%)' }} />
            <div
                className="flex-1 flex items-center justify-between px-4"
                style={{
                    background: `linear-gradient(90deg, ${REPORT_COLOR_TEAL}, ${REPORT_COLOR_TEAL_LIGHT} 60%, ${REPORT_COLOR_NAVY})`,
                    clipPath: 'polygon(3% 0, 100% 0, 100% 100%, 0 100%)',
                }}
            >
                <span className="text-[10px] font-medium text-white/90">Phoenix Antiplagiat — ilmiyfaoliyat.uz</span>
                {pageNum != null && <span className="text-[10px] text-white/80">Sahifa {pageNum}</span>}
            </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 h-12 flex items-stretch">
            <div className="w-[38%]" style={{ background: `linear-gradient(90deg, ${REPORT_COLOR_TEAL_LIGHT}, ${REPORT_COLOR_TEAL})`, clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)' }} />
            <div className="flex-1" style={{ background: REPORT_COLOR_NAVY }} />
            <div className="absolute bottom-0 right-0 w-16 h-full" style={{ background: REPORT_COLOR_NAVY, clipPath: 'polygon(35% 0, 100% 0, 100% 100%, 0 100%)' }} />
        </div>
        <div className="relative z-20 h-full flex flex-col pt-14 pb-14 px-6 sm:px-8">{children}</div>
    </div>
);

/** sertifikat.jpg — o'ng tomondagi geometrik chiziqlar */
export const CertificateSideStripes: React.FC = () => (
    <div className="absolute top-0 right-0 bottom-0 w-[38%] pointer-events-none overflow-hidden" aria-hidden>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="xMaxYMid slice">
            <polygon points="120,0 400,0 400,600 40,600" fill={REPORT_COLOR_NAVY} opacity="0.95" />
            <polygon points="180,0 400,0 400,600 100,600" fill="#1e4d7b" opacity="0.85" />
            <polygon points="240,0 400,0 400,600 160,600" fill={REPORT_COLOR_TEAL} opacity="0.75" />
            <polygon points="300,0 400,0 400,600 220,600" fill={REPORT_COLOR_TEAL_LIGHT} opacity="0.65" />
        </svg>
    </div>
);

/** sertifikat.jpg — muhr */
export const PhoenixSealBadge: React.FC = () => (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
            <circle cx="60" cy="60" r="56" fill={REPORT_COLOR_NAVY} />
            {[...Array(24)].map((_, i) => {
                const a = (i * 15 * Math.PI) / 180;
                const x1 = 60 + Math.cos(a) * 48;
                const y1 = 60 + Math.sin(a) * 48;
                const x2 = 60 + Math.cos(a) * 56;
                const y2 = 60 + Math.sin(a) * 56;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth="2" opacity="0.35" />;
            })}
            <circle cx="60" cy="60" r="42" fill={REPORT_COLOR_TEAL} />
            <path
                d="M60,28 C52,32 48,42 52,50 C46,54 44,62 48,70 C52,76 56,78 60,76 C64,78 68,76 72,70 C76,62 74,54 68,50 C72,42 68,32 60,28"
                fill="none"
                stroke={REPORT_COLOR_NAVY}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    </div>
);

/** sertifikat.jpg — oltin ramka */
export const GoldOrnateFrame: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`relative ${className}`}>
        <div
            className="absolute -inset-1 rounded-sm pointer-events-none"
            style={{ border: `1.5px solid ${REPORT_COLOR_GOLD}`, opacity: 0.85 }}
        />
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: REPORT_COLOR_GOLD }} />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: REPORT_COLOR_GOLD }} />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: REPORT_COLOR_GOLD }} />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: REPORT_COLOR_GOLD }} />
        <div className="relative px-4 py-3">{children}</div>
    </div>
);

/** Phoenix logo — sertifikat pastki markaz */
export const PhoenixLogoMark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
    const icon = size === 'sm' ? 36 : 48;
    return (
        <div className="flex flex-col items-center gap-0.5">
            <svg width={icon} height={icon} viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="22" fill={REPORT_COLOR_TEAL} opacity="0.15" />
                <path
                    d="M25,8 C18,11 15,18 17,25 C14,28 12,33 15,40 C18,44 22,46 25,44 C28,46 32,44 35,40 C38,33 36,28 33,25 C35,18 32,11 25,8"
                    fill="none"
                    stroke={REPORT_COLOR_TEAL}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
            <span className="text-xl font-bold tracking-wide" style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}>
                Phoenix
            </span>
            <span className="text-[10px] font-semibold tracking-[0.35em] -mt-0.5" style={{ color: REPORT_COLOR_TEAL }}>
                NASHRIYOTI
            </span>
        </div>
    );
};

/** QR + dafna novdasi */
export const LaurelQRBlock: React.FC<{ qrUrl: string; label?: string }> = ({
    qrUrl,
    label = 'TEKSHIRISH UCHUN QR KODDAN FOYDALANING',
}) => (
    <div className="flex flex-col items-center gap-2">
        <div className="relative w-20 h-20 flex items-center justify-center">
            <svg viewBox="0 0 80 80" className="absolute inset-0 w-full h-full" aria-hidden>
                <path
                    d="M40 8 C28 8 12 16 12 28 C8 32 6 38 10 44 C12 52 20 58 28 60 L28 72 L40 68 L52 72 L52 60 C60 58 68 52 70 44 C74 38 72 32 68 28 C68 16 52 8 40 8"
                    fill="none"
                    stroke={REPORT_COLOR_TEAL}
                    strokeWidth="1.5"
                />
            </svg>
            <img src={qrUrl} alt="QR" className="relative w-12 h-12 bg-white" width={48} height={48} />
        </div>
        <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-center max-w-[130px] leading-tight" style={{ color: REPORT_COLOR_TEAL }}>
            {label}
        </p>
    </div>
);
