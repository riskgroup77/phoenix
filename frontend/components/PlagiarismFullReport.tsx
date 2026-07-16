import React from 'react';

// Full plagiarism report interfaces
export interface PlagiarismSource {
    id: number;
    percentage: string;
    sourceName: string;
    sourceUrl?: string;
    searchModule: string;
}

export interface PlagiarismFullReportData {
    // Tekshiruvchi ma'lumotlari
    checkerName: string;
    checkerId: string;
    checkerOrganization?: string;
    
    // Hujjat ma'lumotlari
    documentNumber: string;
    uploadDate: string;
    originalFileName: string;
    documentName: string;
    documentType: string;
    characterCount: number;
    sentenceCount: number;
    fileSize: string;
    
    // Natijalar
    plagiarismPercent: number;
    selfCitationPercent: number;
    citationPercent: number;
    originalityPercent: number;
    
    // Qidiruv modullari
    searchModules: string[];
    
    // Manbalar
    sources: PlagiarismSource[];
}

// Phoenix Logo
const PhoenixLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
    const sizes = {
        sm: { svg: 30, text: 'text-lg', sub: 'text-[8px]' },
        md: { svg: 45, text: 'text-2xl', sub: 'text-[10px]' },
        lg: { svg: 60, text: 'text-3xl', sub: 'text-xs' }
    };
    const s = sizes[size];
    
    return (
        <div className="flex items-center gap-2">
            <svg width={s.svg} height={s.svg} viewBox="0 0 50 50">
                <path 
                    d="M25,5 C18,8 15,15 17,22 C14,25 12,30 15,38 C18,42 22,44 25,42 C28,44 32,42 35,38 C38,30 36,25 33,22 C35,15 32,8 25,5 M15,25 C8,27 5,33 10,38 M35,25 C42,27 45,33 40,38"
                    fill="none"
                    stroke="#0891b2"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
            <div className="flex flex-col">
                <span className={`${s.text} font-bold text-[#0891b2] tracking-wide`} style={{ fontFamily: 'Georgia, serif' }}>
                    Phoenix
                </span>
                <span className={`${s.sub} text-[#f97316] tracking-[0.25em] -mt-0.5 font-semibold`}>
                    ANTIPLAGIAT
                </span>
            </div>
        </div>
    );
};

// Result Circle Component
const ResultCircle: React.FC<{
    value: number;
    label: string;
    color: string;
    bgColor: string;
}> = ({ value, label, color, bgColor }) => (
    <div className="flex flex-col items-center">
        <div 
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
        >
            <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                <span className={`text-2xl font-bold`} style={{ color }}>{value}%</span>
            </div>
        </div>
        <span className="text-xs font-semibold mt-2 text-center text-gray-700 uppercase tracking-wide max-w-[100px]">
            {label}
        </span>
    </div>
);

// Cover Page
const CoverPage: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => (
    <div className="bg-white w-full min-h-[700px] relative overflow-hidden" style={{ aspectRatio: '210/297' }}>
        {/* Header stripe */}
        <div className="h-16 bg-gradient-to-r from-[#0891b2] via-[#0e7490] to-[#164e63] flex items-center justify-between px-8">
            <PhoenixLogo size="sm" />
            <span className="text-slate-900 text-sm font-medium">www.ilmiyfaoliyat.uz</span>
        </div>
        
        <div className="p-8">
            {/* Title */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-[#164e63] mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    Hujjat tekshirish natijalari
                </h1>
                <p className="text-gray-600">
                    Tekshiruvchi: <strong>{data.checkerName}</strong> (ID: {data.checkerId})
                </p>
                {data.checkerOrganization && (
                    <p className="text-slate-500 text-sm">Tashkilot: {data.checkerOrganization}</p>
                )}
                <p className="text-xs text-slate-500 mt-2 italic">
                    Hisobot "Phoenix Antiplagiat" servisi tomonidan taqdim etilgan
                </p>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Document info */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-sm font-bold text-[#0891b2] uppercase tracking-wide mb-4 pb-2 border-b border-gray-200">
                        Hujjat to'g'risidagi ma'lumotlar
                    </h3>
                    <div className="space-y-2 text-sm">
                        <InfoRow label="Hujjat raqami" value={data.documentNumber} />
                        <InfoRow label="Yuklangan vaqti" value={data.uploadDate} />
                        <InfoRow label="Dastlabki fayl nomi" value={data.originalFileName} small />
                        <InfoRow label="Hujjat nomi" value={data.documentName} small />
                        <InfoRow label="Hujjat turi" value={data.documentType} />
                        <InfoRow label="Matndagi belgilar" value={data.characterCount.toLocaleString()} />
                        <InfoRow label="Gaplar soni" value={data.sentenceCount.toLocaleString()} />
                        <InfoRow label="Matn o'lchami" value={data.fileSize} />
                    </div>
                </div>

                {/* Results */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-sm font-bold text-[#0891b2] uppercase tracking-wide mb-4 pb-2 border-b border-gray-200">
                        Tekshiruv natijalari
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <ResultCircle 
                            value={data.plagiarismPercent} 
                            label="O'zlashtirib olishlar" 
                            color="#dc2626" 
                            bgColor="#fecaca"
                        />
                        <ResultCircle 
                            value={data.originalityPercent} 
                            label="Originallik" 
                            color="#16a34a" 
                            bgColor="#bbf7d0"
                        />
                        <ResultCircle 
                            value={data.selfCitationPercent} 
                            label="O'z-o'zidan iqtibos" 
                            color="#ca8a04" 
                            bgColor="#fef08a"
                        />
                        <ResultCircle 
                            value={data.citationPercent} 
                            label="Iqtibos keltirishlar" 
                            color="#2563eb" 
                            bgColor="#bfdbfe"
                        />
                    </div>
                </div>
            </div>

            {/* Search modules */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 mb-6">
                <h3 className="text-sm font-bold text-[#0891b2] uppercase tracking-wide mb-3">
                    Qidiruv modullari
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                    {data.searchModules.join(', ')}
                </p>
            </div>

            {/* Legend */}
            <div className="bg-[#f0fdfa] rounded-xl p-4 border border-[#99f6e4] text-xs text-gray-600">
                <p className="mb-2">
                    <strong className="text-red-600">O'zlashtirib olish</strong> — topilgan barcha matnli kesishmalar ulushi, tizim hujjatning umumiy hajmiga nisbatan iqtibos keltirishga kiritganlaridan tashqari.
                </p>
                <p className="mb-2">
                    <strong className="text-yellow-600">O'z-o'zidan iqtibos</strong> — tekshirilayotgan hujjatdagi muallifi yoki hammuallifi tekshirilayotgan hujjatning muallifi bo'lgan manba matni fragmenti bilan mos tushuvchi matn fragmentlarining ulushi.
                </p>
                <p className="mb-2">
                    <strong className="text-blue-600">Iqtibos keltirish</strong> — muallifniki bo'lmagan, biroq tizim ulardan foydalanishni to'g'ri deb hisoblagan matnli kesishmalarning ulushi.
                </p>
                <p>
                    <strong className="text-green-600">Originallik</strong> — tekshirilayotgan hujjat matnidagi tekshiruv borgan birorta ham manbada topilmagan fragmentlarning ulushi.
                </p>
            </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-r from-[#164e63] to-[#0891b2] flex items-center justify-center">
            <span className="text-slate-900 text-xs">© Phoenix Nashriyoti — Ilmiy Faoliyat Platformasi</span>
        </div>
    </div>
);

// Sources Page
const SourcesPage: React.FC<{ data: PlagiarismFullReportData; pageNum: number; startIdx: number; endIdx: number }> = ({ 
    data, pageNum, startIdx, endIdx 
}) => {
    const pageSources = data.sources.slice(startIdx, endIdx);
    
    return (
        <div className="bg-white w-full min-h-[700px] relative overflow-hidden" style={{ aspectRatio: '210/297' }}>
            {/* Header */}
            <div className="h-12 bg-gradient-to-r from-[#0891b2] to-[#164e63] flex items-center justify-between px-6">
                <PhoenixLogo size="sm" />
                <span className="text-slate-900 text-xs">Sahifa {pageNum}</span>
            </div>

            <div className="p-6">
                <h2 className="text-lg font-bold text-[#164e63] mb-4">Manbalar ro'yxati</h2>
                
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-[#0891b2] text-slate-900">
                            <th className="border border-[#0e7490] px-2 py-2 text-center w-10">№</th>
                            <th className="border border-[#0e7490] px-2 py-2 text-center w-16">Ulushi</th>
                            <th className="border border-[#0e7490] px-2 py-2 text-left">Manba</th>
                            <th className="border border-[#0e7490] px-2 py-2 text-left w-40">Qidiruv moduli</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageSources.map((source, idx) => (
                            <tr key={source.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                <td className="border border-gray-200 px-2 py-1.5 text-center font-medium text-[#0891b2]">
                                    [{String(source.id).padStart(2, '0')}]
                                </td>
                                <td className="border border-gray-200 px-2 py-1.5 text-center">
                                    <span className={`font-semibold ${
                                        parseFloat(source.percentage) > 5 ? 'text-red-600' : 
                                        parseFloat(source.percentage) > 0 ? 'text-yellow-600' : 'text-slate-500'
                                    }`}>
                                        {source.percentage}
                                    </span>
                                </td>
                                <td className="border border-gray-200 px-2 py-1.5">
                                    <div className="font-medium text-gray-800">{source.sourceName}</div>
                                    {source.sourceUrl && (
                                        <a 
                                            href={source.sourceUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[#0891b2] hover:underline break-all text-[10px]"
                                        >
                                            {source.sourceUrl}
                                        </a>
                                    )}
                                </td>
                                <td className="border border-gray-200 px-2 py-1.5 text-gray-600 text-[10px]">
                                    {source.searchModule}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-100 flex items-center justify-between px-6 text-xs text-slate-500">
                <span>Hujjat: {data.documentNumber}</span>
                <span>{data.uploadDate}</span>
            </div>
        </div>
    );
};

// Info row component
const InfoRow: React.FC<{ label: string; value: string | number; small?: boolean }> = ({ label, value, small }) => (
    <div className="flex">
        <span className="text-slate-500 w-36 shrink-0">{label}:</span>
        <span className={`text-gray-800 font-medium ${small ? 'text-xs' : ''} break-words`}>{value}</span>
    </div>
);

// Main Full Report Component
const PlagiarismFullReport: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {
    const SOURCES_PER_PAGE = 15;
    const totalSourcePages = Math.ceil(data.sources.length / SOURCES_PER_PAGE);
    
    return (
        <div className="space-y-8" id="plagiarism-full-report">
            {/* Cover Page */}
            <div className="shadow-2xl">
                <CoverPage data={data} />
            </div>
            
            {/* Sources Pages */}
            {Array.from({ length: totalSourcePages }).map((_, pageIndex) => (
                <div key={pageIndex} className="shadow-2xl page-break-before">
                    <SourcesPage 
                        data={data}
                        pageNum={pageIndex + 2}
                        startIdx={pageIndex * SOURCES_PER_PAGE}
                        endIdx={(pageIndex + 1) * SOURCES_PER_PAGE}
                    />
                </div>
            ))}
        </div>
    );
};

export default PlagiarismFullReport;
