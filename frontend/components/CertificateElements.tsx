import React from 'react';

// More sophisticated Phoenix Logo
export const PhoenixLogo: React.FC = () => (
    <div className="flex flex-col items-center w-20 h-20 justify-center">
         <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0D2A4F" />
                    <stop offset="100%" stopColor="#3A527A" />
                </linearGradient>
            </defs>
            <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c5.52,0,10-4.48,10-10S17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8s8,3.59,8,8S16.41,20,12,20z" fill="url(#logoGrad)"/>
            <path d="M17.5,8.5c-1.66,0-3.16,0.83-4.06,2.09c-0.9-1.26-2.4-2.09-4.06-2.09C6.98,8.5,5,10.48,5,12.88c0,2.69,2.67,4.88,5.4,6.91l1.6,1.21l1.6-1.21c2.73-2.03,5.4-4.22,5.4-6.91C19.02,10.48,17.02,8.5,17.5,8.5z" fill="#C09D58" />
        </svg>
    </div>
);

// Enhanced Seal with a more metallic/3D look
export const Seal: React.FC = () => (
    <div className="relative w-32 h-32 flex items-center justify-center drop-shadow-lg">
        <svg viewBox="0 0 100 100" className="absolute w-full h-full text-[#C09D58]">
            <defs>
                <radialGradient id="sealGrad" cx="50%" cy="50%" r="50%" fx="25%" fy="25%">
                    <stop offset="0%" stopColor="#FDEEBE" />
                    <stop offset="100%" stopColor="#A47D3A" />
                </radialGradient>
                <filter id="sealShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#000" floodOpacity="0.3"/>
                </filter>
            </defs>
            <path d="M50 0 L61.8 38.2 L100 38.2 L69.1 61.8 L80.9 100 L50 76.4 L19.1 100 L30.9 61.8 L0 38.2 L38.2 38.2 Z" 
                  fill="url(#sealGrad)" filter="url(#sealShadow)"/>
        </svg>
        <div className="absolute w-[80%] h-[80%] rounded-full bg-gradient-to-br from-[#d4af6a] to-[#b48c4a]" style={{boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'}}></div>
        <svg viewBox="0 0 100 100" className="absolute w-[75%] h-[75%]">
            <path id="circlePath" d="M 10, 50 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" fill="none" />
            <text fill="#8b6b33" className="text-[7px] font-bold tracking-widest uppercase">
                <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
                    PHOENIX SCIENTIFIC • AUTHENTIC DOCUMENT •
                </textPath>
            </text>
        </svg>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute text-[#8b6b33]/80">
            <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c5.52,0,10-4.48,10-10S17.52,2,12,2z M17.5,8.5c-1.66,0-3.16,0.83-4.06,2.09c-0.9-1.26-2.4-2.09-4.06-2.09C6.98,8.5,5,10.48,5,12.88c0,2.69,2.67,4.88,5.4,6.91l1.6,1.21l1.6-1.21c2.73-2.03,5.4-4.22,5.4-6.91C19.02,10.48,17.02,8.5,17.5,8.5z" fill="currentColor" />
        </svg>
    </div>
);


export const CertificateBorderAndBackground: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" className="absolute inset-0 z-0">
        <defs>
             <pattern id="guilloche1" patternUnits="userSpaceOnUse" width="50" height="50">
                <path d="M 50,25 C 50,38.807 38.807,50 25,50 C 11.193,50 0,38.807 0,25 C 0,11.193 11.193,0 25,0 C 38.807,0 50,11.193 50,25 Z M 25,10 a 15,15 0 1,0 0,30 a 15,15 0 1,0 0,-30" 
                      stroke="#0D2A4F" strokeWidth="0.25" fill="none" opacity="0.1"/>
            </pattern>
            <pattern id="guilloche2" patternUnits="userSpaceOnUse" width="30" height="30" patternTransform="rotate(45)">
                 <path d="M0 0 H15 V15 H0Z M15 15 H30 V30 H15Z" fill="#C09D58" opacity="0.05" />
            </pattern>
             <radialGradient id="parchment">
                <stop offset="0%" stopColor="#FDFBF5" />
                <stop offset="100%" stopColor="#F5F1E8" />
            </radialGradient>
            <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0D2A4F" />
                <stop offset="100%" stopColor="#3A527A" />
            </linearGradient>
            <path id="microtextPath" d="M60 40 H1120 V750 H60 Z"></path>
        </defs>
        
        {/* Background */}
        <rect width="100%" height="100%" fill="url(#parchment)" />
        <rect width="100%" height="100%" fill="url(#guilloche1)" />
        <rect width="100%" height="100%" fill="url(#guilloche2)" />
        
        {/* Watermark */}
        <g transform="translate(595 395) scale(6)" opacity="0.03" fill="#0D2A4F">
            <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c5.52,0,10-4.48,10-10S17.52,2,12,2z M17.5,8.5c-1.66,0-3.16,0.83-4.06,2.09c-0.9-1.26-2.4-2.09-4.06-2.09C6.98,8.5,5,10.48,5,12.88c0,2.69,2.67,4.88,5.4,6.91l1.6,1.21l1.6-1.21c2.73-2.03,5.4-4.22,5.4-6.91C19.02,10.48,17.02,8.5,17.5,8.5z" />
        </g>
        
        {/* Intricate Border */}
        <g stroke="url(#borderGrad)" fill="none" strokeWidth="1">
            <rect x="30" y="25" width="1120" height="740" rx="10"/>
            <path d="M 40,35 H 1110 V 730 H 40 Z" strokeWidth="0.5" strokeDasharray="5 5" opacity="0.5"/>
            <path d="M 50,45 a 10,10 0 0,1 10,-10 H 1100 a 10,10 0 0,1 10,10 V 720 a 10,10 0 0,1 -10,10 H 60 a 10,10 0 0,1 -10,-10 Z" strokeWidth="2.5" />
        </g>
        
        {/* Corner Flourishes */}
        <g fill="url(#borderGrad)" opacity="0.8">
            <path transform="translate(50, 45)" d="M0,0 l20,0 a-20,-20 0 0 0 -20,-20 v20z" />
            <path transform="translate(1130, 45) scale(-1, 1)" d="M0,0 l20,0 a-20,-20 0 0 0 -20,-20 v20z" />
            <path transform="translate(50, 755) scale(1, -1)" d="M0,0 l20,0 a-20,-20 0 0 0 -20,-20 v20z" />
            <path transform="translate(1130, 755) scale(-1, -1)" d="M0,0 l20,0 a-20,-20 0 0 0 -20,-20 v20z" />
        </g>
        
        {/* Microtext Security Line */}
        <text fill="#0D2A4F" fontSize="3" opacity="0.5" letterSpacing="1">
            <textPath href="#microtextPath">
                <tspan>PHOENIX ILMIY NASHRLAR MARKAZI AUTHENTIC DOCUMENT</tspan>
                <tspan> PHOENIX ILMIY NASHRLAR MARKAZI AUTHENTIC DOCUMENT</tspan>
                <tspan> PHOENIX ILMIY NASHRLAR MARKAZI AUTHENTIC DOCUMENT</tspan>
                 <tspan> PHOENIX ILMIY NASHRLAR MARKAZI AUTHENTIC DOCUMENT</tspan>
            </textPath>
        </text>

    </svg>
);
