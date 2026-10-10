/** Maqolalar sahifasi: API javob turlari */
import { ArticleStatus, TranslationStatus } from '../../types';

// Type for the API response which has different field names
export interface ArticleApiResponse {
    id: string;
    title: string;
    abstract: string;
    keywords: string[];
    status: ArticleStatus;
    author: string;
    author_name?: string;
    journal: string;
    journal_name?: string;
    submission_date: string;
    fast_track: boolean;
    file_url?: string;
    views: number;
    downloads: number;
    plagiarism_percentage?: number;
    ai_content_percentage?: number;
    plagiarism_checked_at?: string | null;
    pending_payment_transaction_id?: string | null;
}

export interface TranslationRequestApiResponse {
    id: string;
    author: string;
    reviewer?: string;
    title: string;
    source_language: string;
    target_language: string;
    source_file_path: string;
    translated_file_path?: string;
    status: TranslationStatus;
    word_count: number;
    cost: number;
    submission_date: string;
    completion_date?: string;
    author_name?: string;
    reviewer_name?: string;
    /** Backend: Transaction (service_type translation) completed */
    payment_completed?: boolean;
    payment_pending?: boolean;
    payment_status_label?: string;
}

export interface JournalApiResponse {
    id: string;
    name: string;
    issn: string;
    category: string;
    journal_admin?: string;
    journalAdminId?: string;
    journalAdmin?: string;
    admin_id?: string;
    admin?: { id: string };
}

/** Get article's journal ID whether API returns string or nested object */
export function getArticleJournalId(a: ArticleApiResponse): string {
    const j = (a as any).journal;
    if (typeof j === 'string') return j;
    if (j && typeof j === 'object' && typeof j.id === 'string') return j.id;
    return '';
}

/** Admin / super-admin: drafts and payment stages (not yet "Yangi" in workflow) */
