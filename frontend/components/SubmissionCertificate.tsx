import React from 'react';
import { SubmissionCertificateData } from '../types';
import { PhoenixLogo, Seal } from './CertificateElements';


const SubmissionCertificate: React.FC<{ data: SubmissionCertificateData }> = ({ data }) => {
    
    // Watermark Background
    const WatermarkBackground = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" className="absolute inset-0 z-0">
             <defs>
                <radialGradient id="grad-bg-sub">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f7f7f9" />
                </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad-bg-sub)" />
            <g transform="translate(420 297) rotate(15) scale(2.5)">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#3A527A]" opacity="0.04">
                    <path d="M16.88,7.31c-2.39-2.39-6.26-2.39-8.65,0L12,11.06L16.88,7.31z" fill="currentColor" opacity="0.5"/>
                    <path d="M11.06,12l-3.75,3.75c2.39,2.39,6.26,2.39,8.65,0l-4.9-4.9V12z" fill="currentColor"/>
                    <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c5.52,0,10-4.48,10-10S17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8s8,3.59,8,8S16.41,20,12,20z" fill="currentColor"/>
                </svg>
            </g>
        </svg>
    );

    return (
        <div className="bg-white text-gray-800 aspect-[210/297] w-full max-w-4xl mx-auto shadow-2xl overflow-hidden relative font-sans p-2">
            
            <WatermarkBackground />
            
            {/* Border */}
            <div className="absolute inset-4 border-2 border-[#3A527A] p-1">
                <div className="w-full h-full border border-[#3A527A]/50"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full w-full px-20 py-16">
                {/* Header */}
                <header className="flex flex-col items-center w-full pb-4">
                    <PhoenixLogo />
                    <p className="font-serif text-md text-slate-700 tracking-widest uppercase mt-2">Phoenix Ilmiy Nashrlar Markazi</p>
                </header>
                
                <h1 className="font-serif text-5xl font-bold text-[#3A527A] tracking-wide my-8 text-center">
                   MA'LUMOTNOMA
                </h1>

                <main className="flex-grow text-base text-slate-800 leading-relaxed text-justify">
                    <p className="mb-6">
                        Ushbu ma'lumotnoma <strong className="text-black">{data.authorFullName}</strong>ga
                        (<span className="italic">{data.authorAffiliation}</span>)
                        uning <strong className="text-black">"{data.articleTitle}"</strong> nomli ilmiy maqolasi
                        <strong className="text-black"> "{data.journalName}"</strong> jurnaliga 
                        <strong className="text-black"> {data.submissionDate}</strong> sanasida topshirilganligini tasdiqlash uchun berildi.
                    </p>
                    
                    <div className="my-8 border-y border-gray-200 py-4 px-6 bg-gray-50/50 rounded-md">
                        <h2 className="text-center font-semibold text-lg text-slate-700 mb-4">Batafsil ma'lumotlar</h2>
                        <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                            <strong className="text-slate-600 text-right">Maqola sarlavhasi:</strong>
                            <span className="text-slate-800">{data.articleTitle}</span>
                            
                            <strong className="text-slate-600 text-right">Jurnal:</strong>
                            <span className="text-slate-800">{data.journalName}</span>

                            <strong className="text-slate-600 text-right">Topshirilgan sana:</strong>
                            <span className="text-slate-800">{data.submissionDate}</span>

                            <strong className="text-slate-600 text-right">Joriy holati:</strong>
                            <span className="font-semibold text-blue-700">{data.currentStatus}</span>
                        </div>
                    </div>

                     <p>
                        Maqola tahririyat tomonidan qabul qilingan va belgilangan tartibda ko'rib chiqish jarayonida.
                    </p>
                </main>

                <footer className="flex justify-between items-end w-full pt-8 mt-auto">
                     <div className="text-left text-xs text-slate-500">
                        <p>Ma'lumotnoma raqami: {data.referenceNumber}</p>
                        <p>Berilgan sana: {data.issueDate}</p>
                     </div>
                    
                    <Seal />
                    
                    <div className="text-center">
                        <div className="w-48 h-12 mb-1">
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

export default SubmissionCertificate;
