import { describe, expect, it } from 'vitest';

import { formatBRL, formatCentsInput, formatDate, formatPhoneBR, formatTime } from './format.ts';

const nbsp = ' ';

describe('format', () => {
  it('formats BRL like the design system', () => {
    expect(formatBRL(69_000_000)).toBe(`R$${nbsp}690.000`);
    expect(formatBRL(656_340)).toBe(`R$${nbsp}6.563,40`);
    expect(formatBRL(2_000, { showCents: true })).toBe(`R$${nbsp}20,00`);
    expect(() => formatBRL(10.5)).toThrow();
  });

  it('formats cents for inputs', () => {
    expect(formatCentsInput(656_340)).toBe('6.563,40');
    expect(formatCentsInput(0)).toBe('0,00');
  });

  it('formats time in São Paulo as 14h / 14h03', () => {
    expect(formatTime(new Date('2026-11-16T17:00:00Z'))).toBe('14h');
    expect(formatTime(new Date('2026-11-16T17:03:00Z'))).toBe('14h03');
    expect(formatTime(new Date('2026-11-16T03:05:00Z'))).toBe('0h05');
  });

  it('formats dates as dd/MM/yyyy in São Paulo', () => {
    expect(formatDate(new Date('2026-03-08T01:00:00Z'))).toBe('07/03/2026');
  });

  it('formats Brazilian phones', () => {
    expect(formatPhoneBR('+5511927408912')).toBe('(11) 92740-8912');
    expect(formatPhoneBR('+551132651234')).toBe('(11) 3265-1234');
    expect(formatPhoneBR('+14155550100')).toBe('+14155550100');
  });
});
