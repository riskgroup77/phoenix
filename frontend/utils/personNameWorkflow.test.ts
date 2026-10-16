import { describe, expect, it } from 'vitest';
import { personFullName } from './personName';
import { getAuthorWorkflowProgressPercent, getAuthorWorkflowStageLabel, getAuthorWorkflowStepsFromStatus, isBookTitle } from './articleAuthorWorkflow';
import { ArticleStatus } from '../types';

describe('personFullName', () => {
  it('backend get_full_name tartibi: Familiya Ism Otasining ismi', () => {
    expect(personFullName({ first_name: 'Muallif', last_name: 'Demo' })).toBe('Demo Muallif');
    expect(personFullName({ first_name: 'Ali', last_name: 'Valiyev', patronymic: 'Olimovich' })).toBe('Valiyev Ali Olimovich');
    expect(personFullName({ firstName: 'Ali', lastName: 'Valiyev' })).toBe('Valiyev Ali');
    expect(personFullName(null, '—')).toBe('—');
  });
});

describe('kitob buyurtmasi bosqichlari', () => {
  it('kitob jurnal bosqichlarini emas, o\'z bosqichlarini ko\'rsatadi', () => {
    expect(isBookTitle('[KITOB] Darslik')).toBe(true);
    const steps = getAuthorWorkflowStepsFromStatus('ContractProcessing', true);
    expect(steps.map((s) => s.name)).not.toContain('Antiplagiat');
    expect(steps.find((s) => s.current)?.name).toBe('Shartnoma va ISBN');
    expect(getAuthorWorkflowStageLabel('Printing', true)).toBe('Bosmaxona');
    expect(getAuthorWorkflowProgressPercent('Delivered', true)).toBe(100);
  });

  it('jurnal maqolasi bosqichlari o\'zgarmagan', () => {
    expect(getAuthorWorkflowStepsFromStatus(ArticleStatus.QabulQilingan).find((s) => s.current)?.name).toBe('Taqriz');
    expect(getAuthorWorkflowStageLabel(ArticleStatus.Published)).toBe('Nashr etilgan');
  });
});
