import { Buffer } from 'node:buffer';
import type { Money, PlanReportDto } from '@turiviaje/shared';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const CHARACTER_MAP: Record<string, string> = {
  '\u2013': '-',
  '\u2014': '-',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2026': '...',
  '\u2022': '-',
  '\u202f': ' ',
  '\u00a0': ' ',
};

function toLatin1(text: string): string {
  let output = '';
  for (const char of text) {
    const mapped = CHARACTER_MAP[char];
    if (mapped !== undefined) {
      output += mapped;
      continue;
    }
    const code = char.codePointAt(0) ?? 0;
    output += code <= 0xff ? char : '?';
  }
  return output;
}

function escapePdfText(text: string): string {
  return toLatin1(text)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function formatMoney(money: Money): string {
  const value = money.amountMinor / 100;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${money.currency} ${value.toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function statusLabel(status: PlanReportDto['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'SAVED':
      return 'Guardado';
    case 'PUBLISHED':
      return 'Publicado';
    case 'ARCHIVED':
      return 'Archivado';
  }
}

class PdfDocument {
  private readonly pages: string[][] = [];
  private current: string[] = [];
  private y = PAGE_HEIGHT - MARGIN;

  private pageBreak(): void {
    if (this.current.length > 0) this.pages.push(this.current);
    this.current = [];
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number): void {
    if (this.y - height < MARGIN) this.pageBreak();
  }

  text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      indent?: number;
      gap?: number;
    } = {},
  ): void {
    const size = options.size ?? 11;
    const gap = options.gap ?? 4;
    const indent = options.indent ?? 0;
    const font = options.bold ? 'F2' : 'F1';
    const color = options.color ?? [0.12, 0.16, 0.2];
    const lines = wrap(value, size, CONTENT_WIDTH - indent);

    for (const line of lines) {
      this.ensureSpace(size + gap);
      this.current.push(
        `BT /${font} ${size} Tf ${color[0]} ${color[1]} ${color[2]} rg ${MARGIN + indent} ${this.y.toFixed(2)} Td (${escapePdfText(line)}) Tj ET`,
      );
      this.y -= size + gap;
    }
  }

  space(height: number): void {
    this.y -= height;
  }

  rule(): void {
    this.ensureSpace(10);
    this.current.push(
      `0.82 0.86 0.9 RG 0.7 w ${MARGIN} ${this.y.toFixed(2)} m ${PAGE_WIDTH - MARGIN} ${this.y.toFixed(2)} l S`,
    );
    this.y -= 12;
  }

  toBuffer(): Buffer {
    if (this.current.length > 0) this.pages.push(this.current);
    if (this.pages.length === 0) this.pages.push([]);

    const objects: string[] = [];
    const pageIds = this.pages.map((_, index) => 5 + index * 2);
    const contentIds = this.pages.map((_, index) => 6 + index * 2);

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`;
    objects[3] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    this.pages.forEach((commands, index) => {
      const footer = `BT /F1 8 Tf 0.45 0.5 0.55 rg ${MARGIN} 30 Td (TuriViajes - pagina ${index + 1} de ${this.pages.length}) Tj ET`;
      const stream = [...commands, footer].join('\n');
      objects[pageIds[index]!] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
      objects[contentIds[index]!] =
        `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    });

    let output = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = Buffer.byteLength(output, 'latin1');
      output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(output, 'latin1');
    output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      output += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(output, 'latin1');
  }
}

/** Minimal, dependency-free PDF report. All prices come from the persisted plan. */
export function renderPlanPdf(report: PlanReportDto): Buffer {
  const doc = new PdfDocument();

  doc.text('TuriViajes', { size: 10, bold: true, color: [0.05, 0.45, 0.42], gap: 2 });
  doc.text(report.title ?? 'Plan turístico', { size: 22, bold: true, gap: 6 });
  doc.text(
    `${report.destination}  |  ${statusLabel(report.status)}  |  ${formatDate(report.generatedAt)}`,
    { size: 10, color: [0.35, 0.4, 0.45], gap: 2 },
  );
  doc.rule();

  doc.text('Resumen de presupuesto', { size: 13, bold: true, gap: 6 });
  doc.text(`Vuelos y transporte: ${formatMoney(report.budget.flights)}`, { size: 10 });
  doc.text(`Alojamiento: ${formatMoney(report.budget.hotels)}`, { size: 10 });
  doc.text(`Actividades: ${formatMoney(report.budget.activities)}`, { size: 10 });
  doc.text(`Subtotal: ${formatMoney(report.budget.subtotal)}`, { size: 10, bold: true });
  doc.text(
    `Margen (${report.budget.marginPercent.toFixed(2)}%): ${formatMoney(report.budget.margin)}`,
    { size: 10 },
  );
  doc.text(`Total: ${formatMoney(report.budget.total)}`, { size: 13, bold: true, gap: 8 });
  doc.rule();

  doc.text('Itinerario', { size: 13, bold: true, gap: 8 });

  for (const day of report.days) {
    doc.ensureSpace(60);
    doc.text(`Día ${day.dayNumber} - ${formatDate(day.date)}`, { size: 12, bold: true, gap: 3 });
    doc.text(`Subtotal del día: ${formatMoney(day.subtotal)}`, {
      size: 9,
      color: [0.35, 0.4, 0.45],
      gap: 4,
    });
    for (const item of day.items) {
      doc.text(`${item.name}  x${item.quantity}`, { size: 10, indent: 10, gap: 2 });
      doc.text(formatMoney(item.subtotal), {
        size: 9,
        indent: 22,
        color: [0.35, 0.4, 0.45],
        gap: 3,
      });
    }
    doc.space(4);
  }

  return doc.toBuffer();
}
