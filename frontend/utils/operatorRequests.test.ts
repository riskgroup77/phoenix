import { describe, expect, it } from 'vitest';
import {
  mapDoiRequests,
  mapUdkRequests,
  mergeOperatorRequests,
} from './operatorRequests';

describe('operatorRequests mappers', () => {
  it('maps UDK requests', () => {
    const rows = mapUdkRequests([
      {
        id: 1,
        title: 'Test mavzu',
        author_first_name: 'Ali',
        author_last_name: 'Valiyev',
        status: 'submitted',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(rows[0].serviceType).toBe('UDK');
    expect(rows[0].authorName).toContain('Valiyev');
  });

  it('maps DOI requests', () => {
    const rows = mapDoiRequests([
      {
        id: 'abc',
        author_short: 'A. B.',
        status: 'pending',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]);
    expect(rows[0].serviceType).toBe('DOI');
    expect(rows[0].id).toBe('doi-abc');
  });

  it('merges and sorts by date desc', () => {
    const merged = mergeOperatorRequests([
      mapUdkRequests([
        { id: 1, title: 'Old', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
      ]),
      mapDoiRequests([
        { id: '2', author_short: 'X', status: 'pending', created_at: '2026-02-01T00:00:00Z' },
      ]),
    ]);
    expect(merged[0].id).toBe('doi-2');
  });
});
