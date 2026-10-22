import { ArticleStatus } from '../types';

/** Visible stages for authors when API does not send workflow_steps */
const STEP_LABELS = [
  "To'lov va qoralama",
  'Jurnal tekshiruvi',
  'Antiplagiat',
  'Taqriz',
  'Nashr',
] as const;

const STATUS_TO_STEP: Partial<Record<ArticleStatus, number>> = {
  [ArticleStatus.Draft]: 0,
  [ArticleStatus.WritingInProgress]: 0,
  [ArticleStatus.Yangi]: 1,
  [ArticleStatus.WithEditor]: 1,
  [ArticleStatus.PlagiarismReview]: 2,
  [ArticleStatus.QabulQilingan]: 3,
  [ArticleStatus.Revision]: 3,
  [ArticleStatus.Accepted]: 4,
  [ArticleStatus.NashrgaYuborilgan]: 4,
  [ArticleStatus.Published]: 5,
  [ArticleStatus.Rejected]: -1,
};

/**
 * "Qabuldan keyin to'lov" jurnali: to'lov taqrizdan keyin. Avval umumiy zanjirda "To'lov va qoralama" bajarilgan
 * ko'rinib, qabul qilingan (to'lanmagan) maqola "Nashr" bosqichida turgandek chiqardi.
 */
const POST_PAYMENT_STEP_LABELS = ['Yuborildi', 'Jurnal tekshiruvi', 'Antiplagiat', 'Taqriz', "To'lov", 'Nashr'] as const;

function postPaymentIndex(status: string, awaitingPayment: boolean): number {
  if (status === ArticleStatus.Accepted || status === ArticleStatus.NashrgaYuborilgan) return awaitingPayment ? 4 : 5;
  if (status === ArticleStatus.Published) return 6;
  if (status === ArticleStatus.Rejected) return -1;
  return Math.min(Math.max(STATUS_TO_STEP[status as ArticleStatus] ?? 1, 1), 3);
}

/** Zanjir variantlari: post-payment jurnal va muallif hali to'lamagani */
export type WorkflowOptions = { postPayment?: boolean; awaitingPayment?: boolean };

/**
 * Kitob buyurtmasi bosqichlari (backend ArticleSerializer.BOOK_STEPS bilan bir xil). Avval kitob kartasida
 * jurnal bosqichlari (Antiplagiat → Taqriz) ko'rinardi.
 */
const BOOK_STEP_LABELS = ["To'lov", 'Shartnoma va ISBN', 'Bosmaxona', 'Tayyorlash', 'Yetkazish'] as const;

const BOOK_STATUS_TO_STEP: Record<string, number> = {
  Draft: 0,
  Yangi: 1,
  QabulQilingan: 1,
  ContractProcessing: 1,
  IsbnProcessing: 1,
  AuthorDataVerified: 1,
  PaymentCompleted: 1,
  ProcessPaused: 1,
  SentToPrint: 2,
  Printing: 2,
  Ready: 3,
  Packaging: 3,
  Shipping: 4,
  Delivered: 5,
  Rejected: -1,
};

type Step = { name: string; done: boolean; current: boolean };

function buildSteps(labels: readonly string[], idx: number): Step[] {
  if (idx >= labels.length) {
    return labels.map((name) => ({ name, done: true, current: false }));
  }
  if (idx === -1) {
    // Rad etilgan: oxirgi bosqichdan oldin to'xtagan
    const stop = Math.max(labels.length - 2, 0);
    return labels.map((name, i) => ({ name, done: i < stop, current: i === stop }));
  }
  return labels.map((name, i) => ({ name, done: i < idx, current: i === idx }));
}

export const isBookTitle = (title?: string | null): boolean =>
  (title || '').trim().toUpperCase().startsWith('[KITOB]');

/**
 * Builds the workflow for the author UI from backend status when workflow_steps is absent.
 */
export function getAuthorWorkflowStepsFromStatus(
  status: ArticleStatus | string,
  isBook = false,
  opts: WorkflowOptions = {},
): Step[] {
  if (isBook) {
    return buildSteps(BOOK_STEP_LABELS, BOOK_STATUS_TO_STEP[status] ?? 1);
  }
  if (opts.postPayment) {
    return buildSteps(POST_PAYMENT_STEP_LABELS, postPaymentIndex(String(status), !!opts.awaitingPayment));
  }
  return buildSteps(STEP_LABELS, STATUS_TO_STEP[status as ArticleStatus] ?? 0);
}

export function getAuthorWorkflowStageLabel(
  status: ArticleStatus | string,
  isBook = false,
  opts: WorkflowOptions = {},
): string {
  if (status === ArticleStatus.Rejected) return "Rad etilgan";
  if (status === ArticleStatus.Published) return "Nashr etilgan";
  if (isBook && status === 'Delivered') return 'Yetkazildi';
  const steps = getAuthorWorkflowStepsFromStatus(status, isBook, opts);
  const cur = steps.find((s) => s.current);
  return cur?.name ?? (isBook ? BOOK_STEP_LABELS[0] : STEP_LABELS[0]);
}

export function getAuthorWorkflowProgressPercent(status: ArticleStatus | string, isBook = false): number {
  if (status === ArticleStatus.Published || (isBook && status === 'Delivered')) return 100;
  if (status === ArticleStatus.Rejected) return 60;
  const steps = getAuthorWorkflowStepsFromStatus(status, isBook);
  const doneCount = steps.filter((s) => s.done).length;
  const currentCount = steps.some((s) => s.current) ? 1 : 0;
  return Math.round(((doneCount + currentCount * 0.5) / steps.length) * 100);
}
