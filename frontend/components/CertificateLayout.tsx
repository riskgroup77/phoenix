import React, { useId } from 'react';

/**
 * Unified design for all certificates and ma'lumotnomas.
 * — Rich background (patterns, border, corners) — sohtalashtirish qiyin
 * — No logos; QR block without frame
 * — Content area has safe margins so nothing overlaps
 */

export const CERT_COLOR_DARK = '#1a365d';
export const CERT_COLOR_TEAL = '#0d9488';
export const CERT_COLOR_BG = '#f8fafc';
export const CERT_COLOR_TEXT = '#1e293b';
export const CERT_COLOR_MUTED = '#64748b';

/** Rich certificate background: naqshinkor, gradient, patterns, border, corners — soxtalashtirish qiyin */
export const CertificateBackground: React.FC = () => {
    const id = useId().replace(/:/g, '');
    const id2 = useId().replace(/:/g, '') + 'b';
    const id3 = useId().replace(/:/g, '') + 'c';
    const id5 = useId().replace(/:/g, '') + 'e';
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            {/* Base: warm off-white gradient (not plain white) */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(160deg, #f0f4f8 0%, #e8ecf2 25%, #dce4ee 50%, #e2e8f2 75%, #e8eef6 100%)`,
                }}
            />
            {/* Crosshatch — diagonal + reverse diagonal (security pattern) */}
            <div className="absolute inset-0 opacity-[0.06]" style={{ zIndex: 1 }}>
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id={`cert-hatch-${id}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="20" stroke={CERT_COLOR_DARK} strokeWidth="0.5" />
                        </pattern>
                        <pattern id={`cert-hatch2-${id3}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                            <line x1="0" y1="0" x2="0" y2="20" stroke={CERT_COLOR_TEAL} strokeWidth="0.35" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#cert-hatch-${id})`} />
                    <rect width="100%" height="100%" fill={`url(#cert-hatch2-${id3})`} />
                </svg>
            </div>
            {/* Dot grid — naqsh */}
            <div className="absolute inset-0 opacity-[0.08]" style={{ zIndex: 2 }}>
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id={`cert-dots-${id2}`} width="14" height="14" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="0.6" fill={CERT_COLOR_DARK} />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#cert-dots-${id2})`} />
                </svg>
            </div>
            {/* Concentric circles watermark (center) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
                <div className="w-[85%] h-[85%] max-w-[520px] max-h-[520px] rounded-full border opacity-[0.04]" style={{ borderWidth: 1, borderColor: CERT_COLOR_DARK }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] max-w-[400px] max-h-[400px] rounded-full border opacity-[0.03]" style={{ borderWidth: 1, borderColor: CERT_COLOR_TEAL }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] h-[55%] max-w-[300px] max-h-[300px] rounded-full border opacity-[0.025]" style={{ borderWidth: 1, borderColor: CERT_COLOR_DARK }} />
            </div>
            {/* Corner arcs and shapes — more visible */}
            <div className="absolute top-0 right-0 w-80 h-80 opacity-[0.12]" style={{ zIndex: 3 }}>
                <div className="absolute top-0 right-0 w-52 h-52 rounded-full border-[24px]" style={{ borderColor: CERT_COLOR_TEAL }} />
            </div>
            <div className="absolute bottom-0 left-0 w-64 h-64 opacity-[0.10]" style={{ zIndex: 3 }}>
                <div className="absolute bottom-0 left-0 w-44 h-44 rounded-full" style={{ backgroundColor: CERT_COLOR_DARK }} />
            </div>
            <div className="absolute top-1/4 left-0 w-36 h-36 opacity-[0.08]" style={{ zIndex: 3 }}>
                <div className="absolute top-0 left-0 w-28 h-28 rounded-lg rotate-12" style={{ backgroundColor: CERT_COLOR_TEAL }} />
            </div>
            <div className="absolute bottom-1/4 right-0 w-44 h-44 opacity-[0.09]" style={{ zIndex: 3 }}>
                <div className="absolute bottom-0 right-0 w-32 h-32 rounded-lg -rotate-12" style={{ backgroundColor: CERT_COLOR_DARK }} />
            </div>
            {/* Small diamond pattern along edges */}
            <div className="absolute inset-0 opacity-[0.05]" style={{ zIndex: 3 }}>
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id={`cert-diamonds-${id5}`} width="32" height="32" patternUnits="userSpaceOnUse">
                            <path d="M16 0 L32 16 L16 32 L0 16 Z" fill="none" stroke={CERT_COLOR_TEAL} strokeWidth="0.4" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#cert-diamonds-${id5})`} />
                </svg>
            </div>
            {/* Double decorative frame */}
            <div
                className="absolute inset-3 sm:inset-5 rounded-lg border-2 opacity-40"
                style={{ borderColor: CERT_COLOR_TEAL, zIndex: 4 }}
            />
            <div
                className="absolute inset-5 sm:inset-7 rounded-md border opacity-25"
                style={{ borderColor: CERT_COLOR_DARK, zIndex: 4 }}
            />
            <div
                className="absolute inset-7 sm:inset-9 rounded border opacity-15"
                style={{ borderColor: CERT_COLOR_TEAL, zIndex: 4 }}
            />
            {/* Right edge stripe + left thin accent */}
            <div
                className="absolute top-0 right-0 w-3 sm:w-4 h-full opacity-30"
                style={{ backgroundColor: CERT_COLOR_DARK, zIndex: 5 }}
            />
            <div
                className="absolute top-0 left-0 w-1.5 h-full opacity-15"
                style={{ backgroundColor: CERT_COLOR_TEAL, zIndex: 5 }}
            />
            {/* Corner L-ornaments — bolder */}
            <div className="absolute top-2 left-2 w-12 h-12 opacity-40" style={{ zIndex: 5 }}>
                <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                    <path d="M0 48 L0 16 L16 0 L48 0" stroke={CERT_COLOR_TEAL} strokeWidth="2.5" fill="none" />
                </svg>
            </div>
            <div className="absolute top-2 right-2 w-12 h-12 opacity-40 rotate-90" style={{ zIndex: 5 }}>
                <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                    <path d="M0 48 L0 16 L16 0 L48 0" stroke={CERT_COLOR_TEAL} strokeWidth="2.5" fill="none" />
                </svg>
            </div>
            <div className="absolute bottom-2 left-2 w-12 h-12 opacity-40 -rotate-90" style={{ zIndex: 5 }}>
                <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                    <path d="M0 48 L0 16 L16 0 L48 0" stroke={CERT_COLOR_TEAL} strokeWidth="2.5" fill="none" />
                </svg>
            </div>
            <div className="absolute bottom-2 right-2 w-12 h-12 opacity-40 rotate-180" style={{ zIndex: 5 }}>
                <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                    <path d="M0 48 L0 16 L16 0 L48 0" stroke={CERT_COLOR_TEAL} strokeWidth="2.5" fill="none" />
                </svg>
            </div>
            {/* Small corner dots (security detail) */}
            <div className="absolute top-4 left-4 w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: CERT_COLOR_TEAL, zIndex: 5 }} />
            <div className="absolute top-4 right-4 w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: CERT_COLOR_TEAL, zIndex: 5 }} />
            <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: CERT_COLOR_TEAL, zIndex: 5 }} />
            <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: CERT_COLOR_TEAL, zIndex: 5 }} />
        </div>
    );
};

/** Brand block: Phoenix Ilmiy Nashrlar Markazi + ilmiyfaoliyat.uz — barcha hujjatlar uchun */
export const CertificateBrandBlock: React.FC = () => (
    <div className="relative z-10 flex flex-col items-center gap-0.5 text-center">
        <p
            className="text-sm font-bold tracking-wide"
            style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}
        >
            Phoenix Ilmiy Nashrlar Markazi
        </p>
        <a
            href="https://ilmiyfaoliyat.uz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hover:underline"
            style={{ color: CERT_COLOR_TEAL }}
        >
            ilmiyfaoliyat.uz
        </a>
    </div>
);

/** QR block: QR image + text. Ramka yo'q. */
export const CertificateQRBlock: React.FC<{
    qrUrl: string;
    label?: string;
}> = ({ qrUrl, label = 'TEKSHIRISH UCHUN QR KODDAN FOYDALANING' }) => (
    <div className="flex flex-col items-center gap-2 relative z-10">
        <img
            src={qrUrl}
            alt="QR"
            className="w-14 h-14 sm:w-16 sm:h-16 block"
            width={64}
            height={64}
        />
        <p
            className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider leading-tight text-center max-w-[120px]"
            style={{ color: CERT_COLOR_TEAL }}
        >
            {label}
        </p>
    </div>
);
