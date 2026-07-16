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
  [ArticleStatus.PaymentCompleted]: 0,
  [ArticleStatus.ContractProcessing]: 0,
  [ArticleStatus.IsbnProcessing]: 0,
  [ArticleStatus.AuthorDataVerified]: 0,
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
 * Builds a 5-step workflow for the author UI from backend status when workflow_steps is absent.
 */
export function getAuthorWorkflowStepsFromStatus(status: ArticleStatus): {
  name: string;
  done: boolean;
  current: boolean;
}[] {
  const idx = STATUS_TO_STEP[status] ?? 0;

  if (idx === 5) {
    return STEP_LABELS.map((name) => ({ name, done: true, current: false }));
  }

  if (idx === -1) {
    return STEP_LABELS.map((name, i) => ({
      name,
      done: i < 3,
      current: i === 3,
    }));
  }

  return STEP_LABELS.map((name, i) => ({
    name,
    done: i < idx,
    current: i === idx,
  }));
}

export function getAuthorWorkflowStageLabel(status: ArticleStatus): string {
  const steps = getAuthorWorkflowStepsFromStatus(status);
  const cur = steps.find((s) => s.current);
  if (status === ArticleStatus.Rejected) return "Rad etilgan";
  if (status === ArticleStatus.Published) return "Nashr etilgan";
  return cur?.name ?? STEP_LABELS[0];
}

export function getAuthorWorkflowProgressPercent(status: ArticleStatus): number {
  if (status === ArticleStatus.Published) return 100;
  if (status === ArticleStatus.Rejected) return 60;
  const steps = getAuthorWorkflowStepsFromStatus(status);
  const doneCount = steps.filter((s) => s.done).length;
  const currentCount = steps.some((s) => s.current) ? 1 : 0;
  return Math.round(((doneCount + currentCount * 0.5) / steps.length) * 100);
}
