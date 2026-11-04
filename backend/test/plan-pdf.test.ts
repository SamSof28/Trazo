import { describe, expect, it } from 'vitest';
import { renderPlanPdf } from '../src/infrastructure/pdf/plan-pdf.js';
import { toPlanReportDto } from '../src/application/planning/presenter.js';
import { makeDestination } from './catalog-fakes.js';
import { makePlan } from './planning-fakes.js';

describe('renderPlanPdf', () => {
  it('produces a valid minimal PDF with the plan content', () => {
    const report = toPlanReportDto(makePlan(), makeDestination());
    const pdf = renderPlanPdf(report);
    const text = pdf.toString('latin1');

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('Trazo');
    expect(text).toContain('Cartagena');
    expect(text).toContain('Itinerario');
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it('escapes parentheses and backslashes in plan text', () => {
    const report = toPlanReportDto(
      makePlan({ title: 'Plan (especial) \\ prueba' }),
      makeDestination(),
    );
    const text = renderPlanPdf(report).toString('latin1');
    expect(text).toContain('Plan \\(especial\\) \\\\ prueba');
  });
});
