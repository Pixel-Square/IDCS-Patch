import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import newBannerSrc from '../assets/new_banner.png';
import krLogoSrc from '../assets/krlogo.png';
import idcsLogoSrc from '../assets/idcs-logo.png';

export type CqiPdfStudentRow = {
  regNo?: string;
  name: string;
  section?: string | null;
  flaggedCos: string[];
  total?: string | number | null;
};

async function toBase64(src: string): Promise<string> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function imgSize(b64: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = b64;
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function safeText(v: any): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

export function exportCqiPdf(args: {
  subjectCode: string;
  subjectName?: string | null;
  coNumbers: number[];
  rows: CqiPdfStudentRow[];
  title?: string;
  filename?: string;
  includeAllStudentsPage?: boolean;
  instructorName?: string | null;
  sectionName?: string | null;
  studentCount?: number | null;
  semester?: number | string | null;
  academicYear?: string | null;
  department?: string | null;
}): void {
  // Run async in background and save when done
  _exportCqiPdfAsync(args).catch((e) => {
    console.error('CQI PDF export failed:', e);
    alert('PDF export failed: ' + (e?.message || e));
  });
}

async function _exportCqiPdfAsync(args: {
  subjectCode: string;
  subjectName?: string | null;
  coNumbers: number[];
  rows: CqiPdfStudentRow[];
  title?: string;
  filename?: string;
  includeAllStudentsPage?: boolean;
  instructorName?: string | null;
  sectionName?: string | null;
  studentCount?: number | null;
  semester?: number | string | null;
  academicYear?: string | null;
  department?: string | null;
}): Promise<void> {
  const subjectCode = safeText(args.subjectCode || '') || '—';
  const subjectName = safeText(args.subjectName || '');
  const instructorName = safeText(args.instructorName || '');
  const coNumbers = (Array.isArray(args.coNumbers) ? args.coNumbers : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);

  const rowsAll = (Array.isArray(args.rows) ? args.rows : []).map((r) => ({
    regNo: safeText(r.regNo || ''),
    name: safeText(r.name || ''),
    section: r.section ?? null,
    flaggedCos: Array.isArray(r.flaggedCos) ? r.flaggedCos.map((c) => safeText(c)).filter(Boolean) : [],
    total: r.total ?? null,
  }));

  const includeTotal = rowsAll.some((r) => r.total != null && safeText(r.total) !== '');
  const rowsFlagged = rowsAll.filter((r) => r.flaggedCos.length > 0);

  /* ── Load images ─────────────────────────────── */
  const [b64Banner, b64Kr, b64Idcs] = await Promise.all([
    toBase64(newBannerSrc).catch(() => ''),
    toBase64(krLogoSrc).catch(() => ''),
    toBase64(idcsLogoSrc).catch(() => ''),
  ]);

  /* Portrait A4 in mm */
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const PH = 297;
  const ML = 10;
  const MR = 10;
  const UW = PW - ML - MR; // 190 mm

  let curY = 10;
  const HEADER_H = 26;

  /* ── Draw watermark ── */
  const drawWatermark = async () => {
    if (!b64Kr) return;
    const { w: kw, h: kh } = await imgSize(b64Kr);
    const wmW = 100;
    const wmH = (kh / kw) * wmW;
    const wmX = (PW - wmW) / 2;
    const wmY = (PH - wmH) / 2;
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.addImage(b64Kr, 'PNG', wmX, wmY, wmW, wmH);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  };

  /* ── Draw page banner ── */
  const drawPageBanner = async () => {
    if (b64Banner) {
      const { w: bw, h: bh } = await imgSize(b64Banner);
      const bannerDrawH = HEADER_H;
      const bannerDrawW = Math.min(UW * 0.90, (bw / bh) * bannerDrawH);
      doc.addImage(b64Banner, 'PNG', ML, curY, bannerDrawW, bannerDrawH);
    }
    const logoH = 18;
    const logoW = 22;
    const logoGap = 4;
    const logosX = PW - MR - logoW * 2 - logoGap;
    if (b64Kr) {
      const { w: kw, h: kh } = await imgSize(b64Kr);
      const kH = Math.min(logoH, (kh / kw) * logoW);
      doc.addImage(b64Kr, 'PNG', logosX, curY + (HEADER_H - kH) / 2, logoW, kH);
    }
    if (b64Idcs) {
      const { w: iw, h: ih } = await imgSize(b64Idcs);
      const iH = Math.min(logoH, (ih / iw) * logoW);
      doc.addImage(b64Idcs, 'PNG', logosX + logoW + logoGap, curY + (HEADER_H - iH) / 2, logoW, iH);
    }
    curY += HEADER_H + 2;
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.6);
    doc.line(ML, curY, PW - MR, curY);
    curY += 5;
  };

  await drawWatermark();
  await drawPageBanner();

  /* ── CQI Report heading ── */
  const totalStudents = rowsAll.length;
  const flaggedStudents = rowsFlagged.length;
  const clearedStudents = totalStudents - flaggedStudents;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(11, 74, 111);
  const reportTitle = safeText(args.title || 'CQI Report') || 'CQI Report';
  doc.text(reportTitle, ML, curY);
  curY += 7;

  /* ── Info box (3-column grid, same style as Result Analysis PDF) ── */
  const semLabel = args.semester != null ? `Semester ${args.semester}` : '';
  const infoCells: [string, string][] = [
    ['Course Code', subjectCode],
    ['Course Name', subjectName || '—'],
    ['Section',     safeText(args.sectionName || '') || '—'],
    ['Staff',       instructorName || '—'],
    ['Students',    args.studentCount != null ? String(args.studentCount) : String(totalStudents)],
    ['Flagged',     String(flaggedStudents)],
    ...(semLabel ? [['Semester', semLabel] as [string, string]] : []),
    ...(args.academicYear ? [['Acad. Year', safeText(args.academicYear)] as [string, string]] : []),
    ...(args.department ? [['Department', safeText(args.department)] as [string, string]] : []),
  ];
  while (infoCells.length % 3 !== 0) infoCells.push(['', '']);

  const colW3 = UW / 3;
  const labelW3 = 26;
  const valMaxW = colW3 - labelW3 - 7;
  const numInfoRows = infoCells.length / 3;

  // Pre-compute wrapped lines per visual row for dynamic row heights
  doc.setFontSize(8);
  const infoGrid: Array<{ cells: Array<{ lbl: string; lines: string[] }>; rH: number }> = [];
  for (let ri = 0; ri < numInfoRows; ri++) {
    const cells: Array<{ lbl: string; lines: string[] }> = [];
    let maxLines = 1;
    for (let ci = 0; ci < 3; ci++) {
      const [lbl, val] = infoCells[ri * 3 + ci];
      const lines = val ? (doc.splitTextToSize(val, valMaxW) as string[]) : [];
      cells.push({ lbl, lines });
      maxLines = Math.max(maxLines, lines.length);
    }
    infoGrid.push({ cells, rH: 4.5 + (maxLines - 1) * 3.8 + 2.0 });
  }
  const gridH = infoGrid.reduce((s, r) => s + r.rH, 0);

  doc.setFillColor(248, 250, 253);
  doc.roundedRect(ML, curY, UW, gridH, 1.5, 1.5, 'F');
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(ML, curY, UW, gridH, 1.5, 1.5, 'S');

  let sepY = curY;
  for (let i = 0; i < infoGrid.length - 1; i++) {
    sepY += infoGrid[i].rH;
    doc.setDrawColor(220, 228, 238);
    doc.setLineWidth(0.2);
    doc.line(ML + 1, sepY, PW - MR - 1, sepY);
  }
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.3);
  doc.line(ML + colW3,     curY + 1, ML + colW3,     curY + gridH - 1);
  doc.line(ML + colW3 * 2, curY + 1, ML + colW3 * 2, curY + gridH - 1);

  let cellRowY = curY;
  for (const { cells, rH } of infoGrid) {
    for (let ci = 0; ci < 3; ci++) {
      const { lbl, lines } = cells[ci];
      const cellX = ML + ci * colW3;
      if (lbl) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 95);
        doc.text(`${lbl}:`, cellX + 3, cellRowY + 4.5);
      }
      for (let li = 0; li < lines.length; li++) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(lines[li], cellX + 3 + labelW3, cellRowY + 4.5 + li * 3.8);
      }
    }
    cellRowY += rH;
  }
  curY += gridH + 5;

  /* thin divider */
  doc.setDrawColor(210, 215, 220);
  doc.setLineWidth(0.4);
  doc.line(ML, curY, PW - MR, curY);
  curY += 4;

  /* ── CQI Table — split into two side-by-side halves for single-page fit ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 95);
  doc.text('CQI Student Report', ML, curY);
  curY += 5;

  // Columns: S.No | Reg No. | Student Name | Flagged COs | Total
  const tableHead = [
    ['S.No', 'Reg No.', 'Student Name', 'Flagged COs', ...(includeTotal ? ['Total'] : [])],
  ];

  const mkBody = (subset: typeof rowsAll, startIdx: number) =>
    subset.map((r, i) => {
      const flaggedStr = r.flaggedCos.length > 0 ? r.flaggedCos.join(', ') : '—';
      const base = [String(startIdx + i + 1), r.regNo, r.name, flaggedStr];
      if (includeTotal) {
        const t = r.total;
        base.push(t == null ? '—' : (typeof t === 'number' ? String(round1(t)) : safeText(t)));
      }
      return base;
    });

  const halfGap   = 4;
  const halfW     = (UW - halfGap) / 2;          // ~93 mm per half
  const half1     = Math.ceil(rowsAll.length / 2);
  const leftRows  = rowsAll.slice(0, half1);
  const rightRows = rowsAll.slice(half1);

  const tSnoW  = 6;
  const tRegW  = 25;
  const tFlagW = 28;
  const tTotW  = includeTotal ? 13 : 0;
  const tNameW = Math.max(14, halfW - tSnoW - tRegW - tFlagW - tTotW);
  const flaggedColIdx = 3;
  const totalColIdx   = 4;

  const makeDidParseCell = (rowSubset: typeof rowsAll) => (data: any) => {
    if (data.section !== 'body') return;
    const row = rowSubset[data.row.index];
    if (!row) return;
    if (row.flaggedCos.length > 0) {
      data.cell.styles.fillColor = [254, 242, 242];
      if (data.column.index === flaggedColIdx) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    }
    if (includeTotal && data.column.index === totalColIdx) {
      const val = Number(data.cell.raw);
      if (!isNaN(val)) {
        if      (val >= 75) data.cell.styles.textColor = [5, 150, 105];
        else if (val >= 50) data.cell.styles.textColor = [30, 58, 95];
        else                data.cell.styles.textColor = [185, 28, 28];
      }
    }
  };

  const halfTableStyles = {
    theme: 'grid' as const,
    headStyles: {
      fillColor:  [30, 58, 95]   as [number, number, number],
      textColor:  [255, 255, 255] as [number, number, number],
      fontStyle:  'bold' as const,
      fontSize:   6.5,
      halign:     'center' as const,
      cellPadding: 1.5,
    },
    bodyStyles:  { fontSize: 6, cellPadding: 1.2 },
    columnStyles: {
      0: { halign: 'center' as const, cellWidth: tSnoW },
      1: { halign: 'center' as const, cellWidth: tRegW },
      2: { halign: 'left'   as const, cellWidth: tNameW },
      3: { halign: 'center' as const, cellWidth: tFlagW },
      ...(includeTotal ? { 4: { halign: 'center' as const, cellWidth: tTotW, fontStyle: 'bold' as const } } : {}),
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
  };

  const tableStartY = curY;
  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: mkBody(leftRows, 0),
    margin: { left: ML, right: PW - ML - halfW },
    tableWidth: halfW,
    ...halfTableStyles,
    didParseCell: makeDidParseCell(leftRows),
  });
  const afterLeft = (doc as any).lastAutoTable?.finalY ?? tableStartY + 30;

  if (rightRows.length > 0) {
    autoTable(doc, {
      startY: tableStartY,
      head: tableHead,
      body: mkBody(rightRows, half1),
      margin: { left: ML + halfW + halfGap, right: MR },
      tableWidth: halfW,
      ...halfTableStyles,
      didParseCell: makeDidParseCell(rightRows),
    });
  }

  const filename = safeText(args.filename || `CQI_${subjectCode}.pdf`) || 'CQI.pdf';
  doc.save(filename);
}
