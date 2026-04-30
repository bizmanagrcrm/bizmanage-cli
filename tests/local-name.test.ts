import { normalizeLocalName } from '../lib/src/utils/local-name.js';

describe('normalizeLocalName', () => {
  it('preserves underscores', () => {
    expect(normalizeLocalName('customer_table')).toBe('customer_table');
  });

  it('preserves dots', () => {
    expect(normalizeLocalName('event.type')).toBe('event.type');
  });

  it('replaces Windows-unsafe characters', () => {
    expect(normalizeLocalName('sales:report*draft?')).toBe('sales-report-draft');
  });

  it('trims problematic leading and trailing characters', () => {
    expect(normalizeLocalName(' .Quarterly_Report. ')).toBe('quarterly_report');
  });

  it('avoids reserved Windows device names', () => {
    expect(normalizeLocalName('CON')).toBe('con-item');
  });

  it('falls back for empty names', () => {
    expect(normalizeLocalName('...')).toBe('unnamed');
  });
});