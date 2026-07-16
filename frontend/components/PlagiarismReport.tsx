import React, { useState } from 'react';
import { Shield, Bot, FileText, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Eye, BookOpen, Zap, BarChart3, Brain, Fingerprint } from 'lucide-react';

// ── Types ──
interface SectionAnalysis {
  index: number;
  preview: string;
  word_count: number;
  plagiarism_score: number;
  ai_score: number;
  risk: 'low' | 'medium' | 'high';
  flag?: string;
  note?: string;
}

interface PlagiarismBreakdown {
  direct_copy: number;
  paraphrase: number;
  mosaic: number;
  self_citation: number;
}

interface AiDetection {
  overall_ai_probability: number;
  human_probability: number;
  mixed_probability: number;
  model_confidence: 'low' | 'medium' | 'high';
  patterns: string[];
}

interface Stylometric {
  vocabulary_richness: number;
  avg_sentence_length: number;
  sentence_length_variance: number;
  readability_score: number;
  passive_voice_ratio: number;
  transition_density: number;
}

export interface PlagiarismReportData {
  overall_risk: string;
  confidence: number;
  word_count: number;
  sentence_count: number;
  sections: SectionAnalysis[];
  plagiarism_breakdown: PlagiarismBreakdown;
  ai_detection: AiDetection;
  stylometric: Stylometric;
  recommendations: string[];
  /** hybrid | heuristic_only | insufficient_text */
  analysis_mode?: string;
  llm_model?: string | null;
  disclaimer_uz?: string;
}

interface Props {
  plagiarismPercentage: number;
  aiContentPercentage: number;
  checkedAt: string | null;
  report: PlagiarismReportData | null;
  compact?: boolean;
}

// ── Helpers ──
const clamp = (v: number) => Math.max(0, Math.min(100, v));

const riskColor = (risk: string) => {
  if (risk === 'high') return 'text-red-700';
  if (risk === 'medium') return 'text-yellow-800';
  return 'text-emerald-800';
};

const riskBg = (risk: string) => {
  if (risk === 'high') return 'bg-red-500/15 border-red-500/30';
  if (risk === 'medium') return 'bg-yellow-500/15 border-yellow-500/30';
  return 'bg-green-500/15 border-green-500/30';
};

const riskLabel = (risk: string) => {
  if (risk === 'high') return 'Yuqori xavf';
  if (risk === 'medium') return 'O\'rtacha xavf';
  return 'Past xavf';
};

const confidenceLabel = (c: string) => {
  if (c === 'high') return 'Yuqori';
  if (c === 'medium') return 'O\'rtacha';
  return 'Past';
};

// ── Circular Gauge ──
const CircularGauge: React.FC<{ value: number; label: string; color: string; size?: number }> = ({ value, label, color, size = 120 }) => {
  const v = clamp(value);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-slate-900">{v.toFixed(1)}%</span>
      </div>
      <span className="text-xs text-slate-500 font-medium mt-1">{label}</span>
    </div>
  );
};

// ── Horizontal Bar ──
const HBar: React.FC<{ value: number; label: string; color: string; max?: number }> = ({ value, label, color, max = 100 }) => {
  const pct = clamp((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-600 font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

// ── Compact Badge (for article list) ──
export const PlagiarismBadges: React.FC<{ plagiarism: number; ai: number; checkedAt: string | null }> = ({ plagiarism, ai, checkedAt }) => {
  if (!checkedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/15 text-slate-500 border border-gray-500/30 text-xs">
        <Shield size={12} /> Tekshirilmagan
      </span>
    );
  }

  const plagColor = plagiarism > 50 ? 'bg-red-500/15 text-red-800 border-red-500/30' : plagiarism > 25 ? 'bg-yellow-500/15 text-yellow-900 border-yellow-500/30' : 'bg-green-500/15 text-emerald-900 border-green-500/30';
  const aiColor = ai > 50 ? 'bg-purple-500/15 text-purple-900 border-purple-500/30' : ai > 25 ? 'bg-cyan-500/15 text-cyan-900 border-cyan-500/30' : 'bg-green-500/15 text-emerald-900 border-green-500/30';

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${plagColor}`}>
        <Shield size={12} /> {plagiarism.toFixed(1)}%
      </span>
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${aiColor}`}>
        <Bot size={12} /> {ai.toFixed(1)}%
      </span>
    </div>
  );
};

// ── Main Report Component ──
const PlagiarismReport: React.FC<Props> = ({ plagiarismPercentage, aiContentPercentage, checkedAt, report, compact = false }) => {
  const [expandedSections, setExpandedSections] = useState(false);
  const [expandedPatterns, setExpandedPatterns] = useState(false);

  if (!checkedAt) {
    return (
      <div className="p-6 rounded-xl bg-slate-100/70 border border-slate-200/90 text-center">
        <Shield className="mx-auto h-10 w-10 text-slate-500 mb-3" />
        <p className="text-slate-500 text-sm">Antiplagiat tekshiruvi hali amalga oshirilmagan</p>
      </div>
    );
  }

  const plag = clamp(plagiarismPercentage);
  const ai = clamp(aiContentPercentage);
  const orig = clamp(report ? (100 - plag * 0.6 - ai * 0.4) : (100 - plag));
  const overallRisk = report?.overall_risk || (Math.max(plag, ai) > 60 ? 'high' : Math.max(plag, ai) > 30 ? 'medium' : 'low');

  if (compact) {
    return (
      <div className={`p-4 rounded-xl border ${riskBg(overallRisk)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-red-700" />
              <span className="text-sm text-slate-600">Plagiat: <strong className="text-slate-900">{plag.toFixed(1)}%</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-purple-400" />
              <span className="text-sm text-slate-600">AI: <strong className="text-slate-900">{ai.toFixed(1)}%</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Fingerprint size={16} className="text-emerald-800" />
              <span className="text-sm text-slate-600">Original: <strong className="text-slate-900">{orig.toFixed(1)}%</strong></span>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${riskBg(overallRisk)} ${riskColor(overallRisk)}`}>
            {riskLabel(overallRisk)}
          </span>
        </div>
      </div>
    );
  }

  const bd = report?.plagiarism_breakdown;
  const aiDet = report?.ai_detection;
  const stylo = report?.stylometric;
  const sections = report?.sections || [];
  const recommendations = report?.recommendations || [];
  const confidence = report?.confidence || 0;

  return (
    <div className="space-y-6">
      {/* ── Header Risk Banner ── */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${riskBg(overallRisk)}`}>
        <div className="flex items-center gap-3">
          {overallRisk === 'high' ? <XCircle className="text-red-700" size={24} /> : overallRisk === 'medium' ? <AlertTriangle className="text-yellow-800" size={24} /> : <CheckCircle className="text-emerald-800" size={24} />}
          <div>
            <p className={`font-bold text-lg ${riskColor(overallRisk)}`}>{riskLabel(overallRisk)}</p>
            <p className="text-xs text-slate-500">
              Tekshiruv vaqti: {new Date(checkedAt).toLocaleString()} · Ishonchlilik: {confidence}%
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{report?.word_count || 0} so'z · {report?.sentence_count || 0} gap</p>
        </div>
      </div>

      {(report?.disclaimer_uz || report?.analysis_mode) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-100/95">
          {report?.analysis_mode && (
            <p className="text-xs text-amber-950 mb-2 font-medium">
              Tahlil rejimi:{' '}
              {report.analysis_mode === 'hybrid'
                ? 'lokal heuristic + Gemini (LLM)'
                : report.analysis_mode === 'heuristic_only'
                  ? 'faqat lokal heuristic (API kaliti yo‘q yoki LLM xato)'
                  : report.analysis_mode === 'insufficient_text'
                    ? 'matn yetarli emas'
                    : report.analysis_mode}
              {report.llm_model ? ` · ${report.llm_model}` : ''}
            </p>
          )}
          {report?.disclaimer_uz && <p className="text-amber-50/90 leading-relaxed">{report.disclaimer_uz}</p>}
        </div>
      )}

      {/* ── Three Main Gauges ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center p-5 rounded-xl bg-slate-100/70 border border-slate-200/90 relative">
          <CircularGauge value={plag} label="Plagiat" color={plag > 50 ? '#ef4444' : plag > 25 ? '#eab308' : '#22c55e'} />
        </div>
        <div className="flex flex-col items-center p-5 rounded-xl bg-slate-100/70 border border-slate-200/90 relative">
          <CircularGauge value={ai} label="AI kontent" color={ai > 50 ? '#a855f7' : ai > 25 ? '#06b6d4' : '#22c55e'} />
        </div>
        <div className="flex flex-col items-center p-5 rounded-xl bg-slate-100/70 border border-slate-200/90 relative">
          <CircularGauge value={orig} label="Originallik" color={orig > 70 ? '#22c55e' : orig > 40 ? '#eab308' : '#ef4444'} />
        </div>
      </div>

      {/* ── Plagiarism Breakdown ── */}
      {bd && (
        <div className="p-5 rounded-xl bg-slate-100/70 border border-slate-200/90">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-red-700" /> Plagiat turlari bo'yicha taqsimot
          </h3>
          <div className="space-y-3">
            <HBar value={bd.direct_copy} label="To'g'ridan-to'g'ri ko'chirish" color="#ef4444" />
            <HBar value={bd.paraphrase} label="Parafraz (qayta ifodalash)" color="#f97316" />
            <HBar value={bd.mosaic} label="Mozaik plagiat (patchwork)" color="#eab308" />
            <HBar value={bd.self_citation} label="O'z-o'zini iqtibos qilish" color="#06b6d4" />
          </div>
        </div>
      )}

      {/* ── AI Detection Details ── */}
      {aiDet && (
        <div className="p-5 rounded-xl bg-slate-100/70 border border-slate-200/90">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Brain size={16} className="text-purple-400" /> AI detektor tahlili
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
              <p className="text-xl font-bold text-purple-900">{aiDet.overall_ai_probability.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">AI ehtimoli</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-xl font-bold text-emerald-900">{aiDet.human_probability.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">Inson ehtimoli</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
              <p className="text-xl font-bold text-cyan-900">{aiDet.mixed_probability.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">Aralash</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <Zap size={12} />
            Model ishonchliligi: <span className={`font-semibold ${aiDet.model_confidence === 'high' ? 'text-emerald-800' : aiDet.model_confidence === 'medium' ? 'text-yellow-800' : 'text-slate-500'}`}>
              {confidenceLabel(aiDet.model_confidence)}
            </span>
          </div>

          {aiDet.patterns && aiDet.patterns.length > 0 && (
            <div>
              <button
                onClick={() => setExpandedPatterns(!expandedPatterns)}
                className="flex items-center gap-2 text-xs text-blue-800 hover:text-blue-700 transition-colors"
              >
                {expandedPatterns ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Aniqlangan AI patternlar ({aiDet.patterns.length})
              </button>
              {expandedPatterns && (
                <div className="mt-2 space-y-1.5">
                  {aiDet.patterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600 p-2 rounded bg-slate-100/70">
                      <AlertTriangle size={12} className="text-yellow-800 mt-0.5 shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Stylometric Analysis ── */}
      {stylo && (
        <div className="p-5 rounded-xl bg-slate-100/70 border border-slate-200/90">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Fingerprint size={16} className="text-cyan-800" /> Stilometrik tahlil
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Lug'at boyligi", value: `${stylo.vocabulary_richness.toFixed(1)}%`, icon: <BookOpen size={14} className="text-blue-800" /> },
              { label: "O'rtacha gap uzunligi", value: `${stylo.avg_sentence_length.toFixed(1)} so'z`, icon: <FileText size={14} className="text-emerald-800" /> },
              { label: "Gap uzunligi variatsiyasi", value: stylo.sentence_length_variance.toFixed(1), icon: <BarChart3 size={14} className="text-yellow-800" /> },
              { label: "O'qilish darajasi", value: `${stylo.readability_score.toFixed(1)}`, icon: <Eye size={14} className="text-purple-400" /> },
              { label: "Passiv ovoz nisbati", value: `${stylo.passive_voice_ratio.toFixed(1)}%`, icon: <Zap size={14} className="text-orange-800" /> },
              { label: "Bog'lovchi so'z zichligi", value: `${stylo.transition_density.toFixed(1)}%`, icon: <Brain size={14} className="text-cyan-800" /> },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-100/70 border border-slate-200/90">
                <div className="flex items-center gap-2 mb-1">
                  {item.icon}
                  <span className="text-xs text-slate-500">{item.label}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-Section Analysis ── */}
      {sections.length > 0 && (
        <div className="p-5 rounded-xl bg-slate-100/70 border border-slate-200/90">
          <button
            onClick={() => setExpandedSections(!expandedSections)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-blue-800" /> Bo'limlar bo'yicha tahlil ({sections.length} bo'lim)
            </h3>
            {expandedSections ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {expandedSections && (
            <div className="mt-4 space-y-2">
              {sections.map((sec) => (
                <div key={sec.index} className={`p-3 rounded-lg border ${riskBg(sec.risk)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Bo'lim {sec.index} · {sec.word_count} so'z</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskBg(sec.risk)} ${riskColor(sec.risk)}`}>
                      {riskLabel(sec.risk)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2 italic line-clamp-2">"{sec.preview}"</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-slate-500">Plagiat: <strong className="text-red-800">{sec.plagiarism_score.toFixed(1)}%</strong></span>
                    <span className="text-slate-500">AI: <strong className="text-purple-900">{sec.ai_score.toFixed(1)}%</strong></span>
                  </div>
                  {sec.note && <p className="text-xs text-slate-500 mt-1">{sec.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Recommendations ── */}
      {recommendations.length > 0 && (
        <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-blue-800" /> Tavsiyalar
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-blue-800 font-bold mt-0.5">{i + 1}.</span>
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlagiarismReport;
