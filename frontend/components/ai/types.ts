/** Backend apps/assistant javoblari bilan bir xil tuzilma */

export type AiQuote = { amount: number | null; note?: string } | null;

export type AiJournal = {
  id: string;
  name: string;
  category: string;
  pricing_type: string;
  publication_fee: number;
  price_per_page: number;
  payment_model: string;
  plagiarism_max_percent: number | null;
  match?: number;
};

export type AiAction = {
  intent: string;
  path: string;
  label: string;
  fields: Record<string, unknown>;
  filled: string[];
  missing: string[];
  needs_file: boolean;
  has_file: boolean;
  quote: AiQuote;
  journal: AiJournal | null;
};

export type AiArticleItem = {
  id: string;
  title: string;
  status: string;
  status_label: string;
  hint: string;
  journal: string;
  stage: number;
  stages: string[];
  submitted: string | null;
  needs_payment: boolean;
};

export type AiPaymentRow = { id: string; service_type: string; amount: number; status: string; created: string | null };

export type AiFileInfo = {
  filename: string;
  title: string;
  abstract: string;
  keywords: string[];
  language: string;
  word_count: number;
  page_estimate: number;
  has_text: boolean;
};

export type AiCard =
  | { type: 'file'; file: AiFileInfo }
  | { type: 'articles'; items: AiArticleItem[] }
  | { type: 'payments'; pending: AiPaymentRow[]; recent: AiPaymentRow[]; pending_count: number }
  | { type: 'prices'; items: { label: string; amount: number; unit: string }[] }
  | { type: 'journals'; items: AiJournal[] };

export type AiPayload = {
  action?: AiAction;
  cards?: AiCard[];
  suggestions?: string[];
  open?: { path: string; label: string };
  file?: { name: string; size: number };
};

export type AiMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  text: string;
  payload: AiPayload;
  created_at: string;
  pending?: boolean;
};

export type AiConversation = { id: string; title: string; updated_at: string; created_at: string };

/** Panelda ochiladigan narsa: xizmat formasi yoki oddiy sahifa */
export type PanelTarget = { path: string; label: string; action?: AiAction; nonce: number };

export const FIELD_LABELS: Record<string, string> = {
  title: 'Sarlavha',
  abstract: 'Annotatsiya',
  keywords: "Kalit so'zlar",
  journalId: 'Jurnal',
  authorName: 'Muallif',
  pageCount: 'Betlar',
  documentName: 'Hujjat nomi',
  documentType: 'Hujjat turi',
  documentDescription: 'Tavsif',
  authorFirstName: 'Ism',
  authorLastName: 'Familiya',
  firstName: 'Ism',
  lastName: 'Familiya',
  middleName: 'Otasining ismi',
  sourceLang: 'Manba tili',
  targetLang: 'Tarjima tili',
  wordCount: "So'zlar soni",
  pages: 'Betlar soni',
  copies: 'Nusxalar soni',
  paperQuality: "Qog'oz sifati",
  coverType: 'Muqova',
  isbn: 'ISBN',
  design: 'Muqova dizayni',
  publicationType: 'Nashr turi',
  shippingRegion: 'Viloyat',
  shippingAddress: 'Manzil',
  shippingFirstName: 'Qabul qiluvchi ismi',
  shippingLastName: 'Qabul qiluvchi familiyasi',
  shippingPhone: 'Telefon',
  synopsis: 'Annotatsiya',
  language: 'Til',
  structure: 'Tuzilish',
  articleType: 'Maqola turi',
  topic: 'Mavzu',
  qualityLevel: 'Daraja',
  file: 'Fayl',
};

export const VALUE_LABELS: Record<string, string> = {
  uz: "O'zbekcha",
  ru: 'Ruscha',
  en: 'Inglizcha',
  fr: 'Fransuzcha',
  de: 'Nemischa',
  es: 'Ispancha',
  ar: 'Arabcha',
  eco: 'Eko',
  standart: 'Standart',
  soft: 'Yumshoq',
  hard: 'Qattiq',
  bosma: 'Bosma',
  raqamli: 'Raqamli',
  quyi: 'Quyi',
  orta: "O'rta",
  yuqori: 'Yuqori',
};

export const formatSom = (n: number | null | undefined): string =>
  n == null ? '' : `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')}`;
