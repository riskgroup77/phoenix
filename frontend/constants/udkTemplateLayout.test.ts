import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UDK_TEMPLATE_LAYOUT } from './udkTemplateLayout';

describe('UDK shablon koordinatalari', () => {
  it('backend layout.json bilan bir xil (PDF va sayt ko\'rinishi mos tushadi)', () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../../backend/assets/udk_template/layout.json'), 'utf-8'),
    );
    delete raw._comment;
    expect(UDK_TEMPLATE_LAYOUT).toEqual(raw);
  });
});
