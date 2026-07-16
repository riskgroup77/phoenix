import React from 'react';
import { CertificateData } from '../types';
import { PhoenixLogo, Seal, CertificateBorderAndBackground } from './CertificateElements';

const Certificate: React.FC<{ data: CertificateData }> = ({ data }) => {
    return (
        <div className="bg-white text-gray-800 aspect-[297/210] w-full max-w-6xl mx-auto shadow-2xl overflow-hidden relative font-sans p-2">
            
            <CertificateBorderAndBackground />
            
            <div className="relative z-10 flex flex-col h-full w-full px-16 py-8">
                {/* Header */}
                <header className="flex justify-between items-center w-full border-b-2 border-[#C09D58] pb-3">
                    <PhoenixLogo />
                    <div className="text-center">
                        <p className="font-serif text-sm text-[#0D2A4F]/70 tracking-[0.2em] uppercase">Phoenix Ilmiy Nashrlar Markazi</p>
                        <h1 className="font-serif text-5xl font-bold text-[#0D2A4F] tracking-wide my-1">
                           SERTIFIKAT
                        </h1>
                        <p className="text-xs text-[#0D2A4F]/60 tracking-[0.4em] uppercase">Originality & Plagiarism Check</p>
                    </div>
                    <PhoenixLogo />
                </header>

                <main className="flex-grow flex flex-col items-center justify-center text-center my-4">
                    <p className="text-base text-slate-700">Ushbu sertifikat quyidagi ilmiy ishning tekshiruv natijalarini tasdiqlaydi:</p>
                    
                    <h2 className="font-serif text-xl font-medium text-slate-800 mt-4 max-w-3xl">
                        "{data.fileName}"
                    </h2>

                    <p className="text-base text-slate-700 mt-4">Muallif</p>
                    <h3 className="text-4xl font-bold text-[#0D2A4F] font-serif tracking-wide">{data.author}</h3>

                    <div className="w-full grid grid-cols-2 gap-6 items-center mt-6 p-4">
                        <div className="text-center p-4 border border-[#C09D58]/50 bg-gradient-to-br from-white/50 to-transparent rounded-lg">
                            <p className="text-sm font-semibold text-[#0D2A4F] uppercase tracking-wider">Originallik</p>
                            <p className="font-serif text-7xl font-bold text-green-800">{data.originality}</p>
                        </div>
                        <div className="text-center p-4 border border-[#C09D58]/50 bg-gradient-to-br from-white/50 to-transparent rounded-lg">
                            <p className="text-sm font-semibold text-[#0D2A4F] uppercase tracking-wider">O'zlashtirish (Plagiat)</p>
                            <p className="font-serif text-7xl font-bold text-red-800">{data.plagiarism}</p>
                        </div>
                    </div>
                     <div className="text-xs text-slate-500 mt-2">
                        Tekshiruv sanasi: {data.checkDate} <span className="mx-2">|</span> Sertifikat raqami: {data.certificateNumber}
                    </div>
                </main>

                <footer className="flex justify-between items-end w-full pt-3 border-t-2 border-[#C09D58]">
                     <div className="text-center">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://ilmiyfaoliyat.uz/verify/${data.certificateNumber}&bgcolor=ffffff`} alt="QR Code" className="p-1 bg-white border border-slate-400"/>
                        <p className="text-[9px] text-slate-600 max-w-[80px] mt-1">Hujjatni tasdiqlang</p>
                    </div>
                    
                    <Seal />
                    
                    <div className="text-center">
                        <div className="w-48 h-10 mb-1">
                            {/* Placeholder for a signature image */}
                        </div>
                        <div className="w-48 h-px bg-slate-600"></div>
                        <p className="text-sm font-semibold text-slate-800 mt-1">Bosh Redaktor</p>
                        <p className="text-xs text-slate-600">PINM Tahririyati</p>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default Certificate;
