import { Buffer } from 'node:buffer';
import type { Money, PlanItemType, PlanReportDto } from '@trazo/shared';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 64;
const COVER_BAND_TOP = PAGE_HEIGHT;
const COVER_BAND_BOTTOM = 552;

type Rgb = readonly [number, number, number];

const FOREST: Rgb = [0.063, 0.149, 0.165];
const MINT: Rgb = [0.812, 0.918, 0.89];
const MINT_LIGHT: Rgb = [0.89, 0.953, 0.933];
const TEAL: Rgb = [0.604, 0.859, 0.796];
const ORANGE: Rgb = [1, 0.42, 0.239];
const GOLD: Rgb = [1, 0.827, 0.42];
const MUTED: Rgb = [0.247, 0.341, 0.357];
const BORDER: Rgb = [0.835, 0.867, 0.839];
const WHITE: Rgb = [1, 1, 1];

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
  '\u2192': '->',
  '\u20ac': 'EUR',
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

function rgb(color: Rgb): string {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function wrap(text: string, size: number, maxWidth: number, factor = 0.52): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * factor)));
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

function approxWidth(text: string, size: number, bold = false): number {
  return text.length * size * (bold ? 0.56 : 0.52);
}

function formatMoney(money: Money): string {
  const value = money.amountMinor / 100;
  try {
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return `${money.currency} ${formatted}`;
  } catch {
    return `${money.currency} ${value.toFixed(0)}`;
  }
}

function formatDateLong(iso: string): string {
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

function formatDateShort(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(parsed)
    .replaceAll(',', '');
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

function typeLabel(type: PlanItemType): string {
  switch (type) {
    case 'TRANSPORT':
      return 'Transporte';
    case 'ACCOMMODATION':
      return 'Alojamiento';
    case 'ACTIVITY':
      return 'Actividad';
  }
}

function typeFill(type: PlanItemType): Rgb {
  switch (type) {
    case 'TRANSPORT':
      return MINT_LIGHT;
    case 'ACCOMMODATION':
      return GOLD;
    case 'ACTIVITY':
      return MINT;
  }
}

class PdfDocument {
  private readonly pages: string[][] = [];
  current: string[] = [];
  y = COVER_BAND_BOTTOM - 24;

  constructor(private readonly report: PlanReportDto) {
    this.newPage(true);
  }

  get pageCount(): number {
    return this.pages.length + (this.current.length > 0 ? 1 : 0);
  }

  raw(command: string): void {
    this.current.push(command);
  }

  circle(cx: number, cy: number, radius: number, color: Rgb, alpha?: 'GS1' | 'GS2' | 'GS3'): void {
    const k = radius * 0.5523;
    this.current.push(`q ${alpha ? `/${alpha} gs ` : ''}${rgb(color)} rg`);
    this.current.push(`${cx + radius} ${cy} m`);
    this.current.push(`${cx + radius} ${cy + k} ${cx + k} ${cy + radius} ${cx} ${cy + radius} c`);
    this.current.push(`${cx - k} ${cy + radius} ${cx - radius} ${cy + k} ${cx - radius} ${cy} c`);
    this.current.push(`${cx - radius} ${cy - k} ${cx - k} ${cy - radius} ${cx} ${cy - radius} c`);
    this.current.push(`${cx + k} ${cy - radius} ${cx + radius} ${cy - k} ${cx + radius} ${cy} c`);
    this.current.push('f Q');
  }

  private newPage(cover: boolean): void {
    this.current = [];
    this.drawBackground(cover);
    if (cover) {
      this.drawCoverBand();
      this.y = COVER_BAND_BOTTOM - 26;
    } else {
      this.drawRunningHeader();
      this.y = PAGE_HEIGHT - HEADER_HEIGHT - 22;
    }
  }

  private drawBackground(cover: boolean): void {
    // Full-page warm paper gradient: sand at the top, white at the bottom.
    this.current.push(`q /Sh1 sh Q`);

    // Soft colour fields, kept at very low alpha so they read as a print tint.
    this.circle(520, 760, 170, MINT, 'GS1');
    this.circle(-20, 80, 150, ORANGE, 'GS1');
    this.circle(560, 120, 110, TEAL, 'GS1');

    // Topographic contour watermark, drawn as a quiet signature in the corners.
    this.current.push('q /GS1 gs');
    this.current.push(`${rgb(FOREST)} RG 0.9 w`);
    for (let index = 0; index < 7; index += 1) {
      const offset = index * 13;
      this.current.push(
        `${360 + offset} -30 m ${410 + offset} 80 ${510 + offset} 90 ${548 + offset} 178 c ${572 + offset} 222 ${540 + offset} 268 ${500 + offset} 296 c`,
      );
    }
    for (let index = 0; index < 5; index += 1) {
      const offset = index * 15;
      this.current.push(
        `${-40} ${118 + offset} m ${40} ${132 + offset} ${92} ${190 + offset} ${150} ${214 + offset} c`,
      );
    }
    this.current.push('S Q');

    if (!cover) {
      // A faint mint wash behind the running header keeps the page from feeling flat.
      this.current.push(`q /GS2 gs ${rgb(MINT_LIGHT)} rg 0 ${PAGE_HEIGHT - HEADER_HEIGHT} ${PAGE_WIDTH} ${HEADER_HEIGHT} re f Q`);
    }
  }

  private drawLogo(x: number, y: number, size: number, dark: boolean): void {
    const circle = dark ? MINT : FOREST;
    const line = ORANGE;
    const dot = dark ? WHITE : TEAL;

    this.circle(x + size / 2, y + size / 2, size / 2, circle);
    this.current.push('q 1 J 1 j');
    this.current.push(`${rgb(line)} RG ${size * 0.085} w [1 ${size * 0.16}] 0 d`);
    this.current.push(
      `${x + size * 0.18} ${y + size * 0.7} m ${x + size * 0.32} ${y + size * 0.18} ${x + size * 0.6} ${y + size * 0.94} ${x + size * 0.82} ${y + size * 0.3} c S`,
    );
    this.current.push('Q');
    this.circle(x + size * 0.82, y + size * 0.29, size * 0.09, dot);
  }

  private drawWordmark(x: number, y: number, size: number, dark: boolean): void {
    const color = dark ? WHITE : FOREST;
    this.current.push(
      `BT /F2 ${size} Tf ${rgb(color)} rg ${x} ${y} Td (trazo) Tj ET`,
    );
  }

  private drawCoverBand(): void {
    this.current.push(`q ${rgb(FOREST)} rg 0 ${COVER_BAND_BOTTOM} ${PAGE_WIDTH} ${COVER_BAND_TOP - COVER_BAND_BOTTOM} re f Q`);

    // Large translucent mint disc and route line.
    this.circle(548, 790, 150, MINT, 'GS2');
    this.current.push('q /GS1 gs');
    this.current.push(`${rgb(MINT)} RG 1.2 w [2 7] 0 d`);
    this.current.push(`44 610 m 150 650 190 742 330 730 c 410 724 452 690 520 704 c S`);
    this.current.push('Q');
    this.circle(332, 731, 5.5, ORANGE);
    this.circle(519, 705, 5.5, TEAL);
    this.circle(149, 648, 4, GOLD);

    this.drawLogo(MARGIN, 774, 34, true);
    this.drawWordmark(MARGIN + 44, 784, 22, true);
    this.current.push(
      `BT /F1 7.5 Tf ${rgb(MINT)} rg ${MARGIN + 45} 774 Td (DISEÑO DE VIAJES) Tj ET`,
    );

    const title = this.report.title ?? 'Plan turístico';
    const titleLines = wrap(title, 29, 430, 0.54).slice(0, 2);
    let titleY = 700;
    for (const line of titleLines) {
      this.current.push(
        `BT /F2 29 Tf ${rgb(WHITE)} rg ${MARGIN} ${titleY} Td (${escapePdfText(line)}) Tj ET`,
      );
      titleY -= 33;
    }

    const meta = `${this.report.destination}  |  ${statusLabel(this.report.status)}  |  ${formatDateLong(this.report.generatedAt)}`;
    this.current.push(
      `BT /F1 9 Tf ${rgb(MINT)} rg ${MARGIN} ${titleY - 4} Td (${escapePdfText(meta)}) Tj ET`,
    );

    if (this.report.summary) {
      const summaryLines = wrap(this.report.summary, 9.5, 440, 0.52).slice(0, 2);
      let summaryY = titleY - 24;
      for (const line of summaryLines) {
        this.current.push(
          `BT /F1 9.5 Tf ${rgb(MINT_LIGHT)} rg ${MARGIN} ${summaryY} Td (${escapePdfText(line)}) Tj ET`,
        );
        summaryY -= 13;
      }
    }

    // Tags as small translucent pills.
    let tagX = MARGIN;
    const tagY = COVER_BAND_BOTTOM + 18;
    for (const tag of this.report.tags.slice(0, 6)) {
      const label = tag.toUpperCase();
      const width = approxWidth(label, 6.5, true) + 16;
      if (tagX + width > PAGE_WIDTH - MARGIN) break;
      this.current.push(`q /GS2 gs ${rgb(WHITE)} rg ${tagX} ${tagY} ${width} 17 re f Q`);
      this.current.push(
        `BT /F2 6.5 Tf ${rgb(WHITE)} rg ${tagX + 8} ${tagY + 5} Td (${escapePdfText(label)}) Tj ET`,
      );
      tagX += width + 6;
    }
  }

  private drawRunningHeader(): void {
    this.drawLogo(MARGIN, PAGE_HEIGHT - 43, 22, false);
    this.drawWordmark(MARGIN + 29, PAGE_HEIGHT - 39, 15, false);
    const title = this.report.title ?? 'Plan turístico';
    const shortTitle = title.length > 54 ? `${title.slice(0, 51)}...` : title;
    this.at(shortTitle, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 36, {
      size: 8.5,
      color: MUTED,
      align: 'right',
    });
    this.current.push(
      `${rgb(BORDER)} RG 0.7 w ${MARGIN} ${PAGE_HEIGHT - HEADER_HEIGHT} m ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - HEADER_HEIGHT} l S`,
    );
  }

  ensureSpace(height: number): boolean {
    if (this.y - height < 58) {
      this.pageBreak();
      return true;
    }
    return false;
  }

  pageBreak(): void {
    if (this.current.length > 0) this.pages.push(this.current);
    this.current = [];
    this.newPage(false);
  }

  at(
    value: string,
    x: number,
    y: number,
    options: { size?: number; bold?: boolean; color?: Rgb; align?: 'left' | 'right' } = {},
  ): void {
    const size = options.size ?? 10;
    const font = options.bold ? 'F2' : 'F1';
    const color = options.color ?? FOREST;
    const textX = options.align === 'right' ? x - approxWidth(value, size, options.bold) : x;
    this.current.push(
      `BT /${font} ${size} Tf ${rgb(color)} rg ${textX.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(value)}) Tj ET`,
    );
  }

  text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: Rgb;
      indent?: number;
      gap?: number;
      width?: number;
      x?: number;
    } = {},
  ): void {
    const size = options.size ?? 10;
    const gap = options.gap ?? 4;
    const indent = options.indent ?? 0;
    const x = options.x ?? MARGIN + indent;
    const width = options.width ?? CONTENT_WIDTH - indent;
    const lines = wrap(value, size, width);

    for (const line of lines) {
      this.ensureSpace(size + gap);
      this.at(line, x, this.y, { size, bold: options.bold, color: options.color });
      this.y -= size + gap;
    }
  }

  space(height: number): void {
    this.y -= height;
  }

  rule(color: Rgb = BORDER, width = 0.7): void {
    this.ensureSpace(10);
    this.current.push(
      `${rgb(color)} RG ${width} w ${MARGIN} ${this.y.toFixed(2)} m ${PAGE_WIDTH - MARGIN} ${this.y.toFixed(2)} l S`,
    );
    this.y -= 12;
  }

  roundedRect(x: number, y: number, width: number, height: number, radius: number, color: Rgb): void {
    const r = Math.min(radius, width / 2, height / 2);
    const k = r * 0.5523;
    this.current.push(`q ${rgb(color)} rg`);
    this.current.push(`${x + r} ${y} m ${x + width - r} ${y} l`);
    this.current.push(`${x + width - r + k} ${y} ${x + width} ${y + r - k} ${x + width} ${y + r} c`);
    this.current.push(`${x + width} ${y + height - r} l`);
    this.current.push(`${x + width} ${y + height - r + k} ${x + width - r + k} ${y + height} ${x + width - r} ${y + height} c`);
    this.current.push(`${x + r} ${y + height} l`);
    this.current.push(`${x + r - k} ${y + height} ${x} ${y + height - r + k} ${x} ${y + height - r} c`);
    this.current.push(`${x} ${y + r} l`);
    this.current.push(`${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`);
    this.current.push('f Q');
  }

  strokeRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: Rgb,
    lineWidth = 0.8,
  ): void {
    const r = Math.min(radius, width / 2, height / 2);
    const k = r * 0.5523;
    this.current.push(`q ${rgb(color)} RG ${lineWidth} w`);
    this.current.push(`${x + r} ${y} m ${x + width - r} ${y} l`);
    this.current.push(`${x + width - r + k} ${y} ${x + width} ${y + r - k} ${x + width} ${y + r} c`);
    this.current.push(`${x + width} ${y + height - r} l`);
    this.current.push(`${x + width} ${y + height - r + k} ${x + width - r + k} ${y + height} ${x + width - r} ${y + height} c`);
    this.current.push(`${x + r} ${y + height} l`);
    this.current.push(`${x + r - k} ${y + height} ${x} ${y + height - r + k} ${x} ${y + height - r} c`);
    this.current.push(`${x} ${y + r} l`);
    this.current.push(`${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`);
    this.current.push('S Q');
  }

  drawTypeIcon(x: number, y: number, type: PlanItemType): void {
    const size = 22;
    this.roundedRect(x, y, size, size, 7, typeFill(type));
    this.current.push('q 1 J 1 j');
    this.current.push(`${rgb(FOREST)} RG 1.15 w`);
    if (type === 'TRANSPORT') {
      this.current.push(
        `${x + 5} ${y + 12} m ${x + 17} ${y + 6} l ${x + 13} ${y + 17} l ${x + 10.5} ${y + 12} l ${x + 5} ${y + 12} l S`,
      );
    } else if (type === 'ACCOMMODATION') {
      this.current.push(
        `${x + 5} ${y + 15} m ${x + 5} ${y + 7} l ${x + 7} ${y + 7} l ${x + 7} ${y + 11} l ${x + 16} ${y + 11} l ${x + 16} ${y + 8} l ${x + 18} ${y + 8} l ${x + 18} ${y + 15} l S`,
      );
      this.current.push(`${x + 6} ${y + 11} m ${x + 17} ${y + 11} l S`);
    } else {
      this.current.push(
        `${x + 11} ${y + 5} m ${x + 7.5} ${y + 5} ${x + 5} ${y + 7.5} ${x + 5} ${y + 11} c ${x + 5} ${y + 15.5} ${x + 11} ${y + 19} ${x + 11} ${y + 19} c ${x + 11} ${y + 19} ${x + 17} ${y + 15.5} ${x + 17} ${y + 11} c ${x + 17} ${y + 7.5} ${x + 14.5} ${y + 5} ${x + 11} ${y + 5} c S`,
      );
      this.current.push(`q ${rgb(FOREST)} rg ${x + 9.3} ${y + 9.3} 3.4 3.4 re f Q`);
    }
    this.current.push('Q');
  }

  toBuffer(): Buffer {
    if (this.current.length > 0) this.pages.push(this.current);
    if (this.pages.length === 0) this.pages.push([]);

    const objects: string[] = [];
    const pageIds = this.pages.map((_, index) => 10 + index * 2);
    const contentIds = this.pages.map((_, index) => 11 + index * 2);
    const total = this.pages.length;

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${total} >>`;
    objects[3] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objects[5] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
    objects[6] = '<< /Type /ExtGState /ca 0.07 /CA 0.07 >>';
    objects[7] = '<< /Type /ExtGState /ca 0.13 /CA 0.13 >>';
    objects[8] = '<< /Type /ExtGState /ca 0.35 /CA 0.35 >>';
    objects[9] =
      '<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 841.89 0 0] /Function << /FunctionType 2 /Domain [0 1] /C0 [0.949 0.961 0.945] /C1 [1 1 1] /N 1 >> /Extend [true true] >>';

    this.pages.forEach((commands, index) => {
      const footerY = 30;
      const footer = [
        `${rgb(BORDER)} RG 0.6 w ${MARGIN} 45 m ${PAGE_WIDTH - MARGIN} 45 l S`,
        `q ${rgb(FOREST)} rg ${MARGIN + 4.5} ${footerY + 4.5} m ${MARGIN + 9} ${footerY + 4.5} ${MARGIN + 9} ${footerY + 9} ${MARGIN + 4.5} ${footerY + 9} c ${MARGIN} ${footerY + 9} ${MARGIN} ${footerY + 4.5} ${MARGIN + 4.5} ${footerY + 4.5} c f Q`,
        `q ${rgb(ORANGE)} rg ${MARGIN + 3.2} ${footerY + 3.2} 2.6 2.6 re f Q`,
        `BT /F2 7.5 Tf ${rgb(MUTED)} rg ${MARGIN + 15} ${footerY + 1} Td (Trazo - planes que se sienten escritos a mano) Tj ET`,
        `BT /F1 7.5 Tf ${rgb(MUTED)} rg ${PAGE_WIDTH - MARGIN - approxWidth(`Página ${index + 1} de ${total}`, 7.5)} ${footerY + 1} Td (Página ${index + 1} de ${total}) Tj ET`,
      ].join('\n');
      const stream = [...commands, footer].join('\n');
      objects[pageIds[index]!] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /ExtGState << /GS1 6 0 R /GS2 7 0 R /GS3 8 0 R >> /Shading << /Sh1 9 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
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

/** Branded, dependency-free PDF report. All prices come from the persisted plan. */
export function renderPlanPdf(report: PlanReportDto): Buffer {
  const doc = new PdfDocument(report);

  // Budget summary card, sitting under the cover band.
  doc.space(2);
  doc.at('PRESUPUESTO', MARGIN, doc.y, { size: 8, bold: true, color: MUTED });
  doc.space(14);
  const cardTop = doc.y;
  const cardHeight = 112;
  doc.roundedRect(MARGIN, cardTop - cardHeight, CONTENT_WIDTH, cardHeight, 18, WHITE);
  doc.strokeRoundedRect(MARGIN, cardTop - cardHeight, CONTENT_WIDTH, cardHeight, 18, BORDER);

  const columns: Array<{ label: string; value: Money }> = [
    { label: 'Vuelos y traslados', value: report.budget.flights },
    { label: 'Alojamiento', value: report.budget.hotels },
    { label: 'Actividades', value: report.budget.activities },
    { label: 'Subtotal', value: report.budget.subtotal },
  ];
  const columnWidth = CONTENT_WIDTH / columns.length;
  columns.forEach((column, index) => {
    const x = MARGIN + 16 + index * columnWidth;
    doc.at(column.label.toUpperCase(), x, cardTop - 24, { size: 6.5, bold: true, color: MUTED });
    doc.at(formatMoney(column.value), x, cardTop - 43, { size: 11.5, bold: true, color: FOREST });
  });

  doc.raw(
    `${rgb(BORDER)} RG 0.6 w ${MARGIN + 16} ${cardTop - 60} m ${PAGE_WIDTH - MARGIN - 16} ${cardTop - 60} l S`,
  );
  doc.at(
    `Margen ${report.budget.marginPercent.toFixed(2)}%`,
    MARGIN + 16,
    cardTop - 80,
    { size: 8.5, color: MUTED },
  );
  doc.at(formatMoney(report.budget.margin), MARGIN + 150, cardTop - 80, { size: 8.5, color: MUTED });
  doc.at('TOTAL CLIENTE', PAGE_WIDTH - MARGIN - 16, cardTop - 76, {
    size: 6.5,
    bold: true,
    color: MUTED,
    align: 'right',
  });
  doc.at(formatMoney(report.budget.total), PAGE_WIDTH - MARGIN - 16, cardTop - 92, {
    size: 17,
    bold: true,
    color: FOREST,
    align: 'right',
  });

  doc.y = cardTop - cardHeight - 26;
  doc.at('Itinerario', MARGIN, doc.y, { size: 11, bold: true, color: FOREST });
  doc.at(
    `${report.days.length} ${report.days.length === 1 ? 'dia' : 'dias'}  |  ${report.days[0] ? formatDateShort(report.days[0].date) : ''}${report.days.length > 1 ? ` - ${formatDateShort(report.days[report.days.length - 1]!.date)}` : ''}`,
    PAGE_WIDTH - MARGIN,
    doc.y,
    { size: 8, color: MUTED, align: 'right' },
  );
  doc.y -= 18;

  for (const day of report.days) {
    doc.ensureSpace(64);
    const dayTop = doc.y;
    doc.roundedRect(MARGIN, dayTop - 25, CONTENT_WIDTH, 28, 14, MINT_LIGHT);
    doc.roundedRect(MARGIN + 7, dayTop - 21, 42, 20, 10, FOREST);
    doc.at(`DIA ${day.dayNumber}`, MARGIN + 28, dayTop - 14, {
      size: 6.5,
      bold: true,
      color: WHITE,
      align: 'right',
    });
    doc.at(formatDateShort(day.date), MARGIN + 58, dayTop - 15, {
      size: 8,
      color: MUTED,
    });
    doc.at(formatMoney(day.subtotal), PAGE_WIDTH - MARGIN - 12, dayTop - 15, {
      size: 8.5,
      bold: true,
      color: FOREST,
      align: 'right',
    });
    doc.y = dayTop - 36;

    let firstItem = true;
    for (const item of day.items) {
      const broke = doc.ensureSpace(38);
      if (broke) {
        doc.at(`Día ${day.dayNumber} - continuación`, MARGIN, doc.y, {
          size: 8,
          bold: true,
          color: MUTED,
        });
        doc.y -= 18;
      }
      const rowTop = doc.y;
      doc.drawTypeIcon(MARGIN, rowTop - 16, item.type);
      doc.at(item.name, MARGIN + 32, rowTop - 4, { size: 10, bold: true, color: FOREST });
      const metaParts = [
        typeLabel(item.type),
        item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : item.startTime,
        `x${item.quantity}`,
      ].filter(Boolean);
      doc.at(metaParts.join('  |  '), MARGIN + 32, rowTop - 16, { size: 7.5, color: MUTED });
      doc.at(formatMoney(item.subtotal), PAGE_WIDTH - MARGIN, rowTop - 7, {
        size: 9.5,
        bold: true,
        color: FOREST,
        align: 'right',
      });
      if (item.notes) {
        doc.at(item.notes, MARGIN + 32, rowTop - 26, { size: 7.5, color: MUTED });
        doc.y -= 34;
      } else {
        doc.y -= 28;
      }
      if (!firstItem) {
        doc.raw(
          `${rgb(BORDER)} RG 0.5 w ${MARGIN + 32} ${rowTop + 8} m ${PAGE_WIDTH - MARGIN} ${rowTop + 8} l S`,
        );
      }
      firstItem = false;
    }
    doc.space(8);
  }

  // Closing note, anchored at the end of the document.
  doc.ensureSpace(60);
  doc.roundedRect(MARGIN, doc.y - 42, CONTENT_WIDTH, 42, 14, MINT);
  doc.at('Este plan es una propuesta editable.', MARGIN + 14, doc.y - 17, {
    size: 8.5,
    bold: true,
    color: FOREST,
  });
  doc.at(
    'Los precios provienen del catálogo y se recalculan en Trazo.',
    MARGIN + 14,
    doc.y - 30,
    { size: 7.5, color: MUTED },
  );
  doc.y -= 56;

  return doc.toBuffer();
}
