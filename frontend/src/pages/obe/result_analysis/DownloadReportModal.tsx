import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { RANGES, computeRangeCounts } from './BellGraphPage';
import { SheetCol, SheetRow } from './MarkAnalysisSheetPage';
import bannerSrc from '../../../assets/banner.png';
import krLogoSrc from '../../../assets/krlogo.png';
import idcsLogoSrc from '../../../assets/idcs-logo.png';

/* ── helpers ───────────────────────────────────────────────────── */
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

/* ── types ─────────────────────────────────────────────────────── */
export type DownloadReportModalProps = {
  open: boolean;
  onClose: () => void;
  courseId: string;
  ct: string;
  sectionName: string;
  staffName: string;
  studentCount: number;
  cycleName: string;
  cols: SheetCol[];
  rows: SheetRow[];
  totals: number[];
};

/* ─────────────────────────────────────────────────────────────── */
export default function DownloadReportModal({
  open,
  onClose,
  courseId,
  ct,
  sectionName,
  staffName,
  studentCount,
  cycleName,
  cols,
  rows,
  totals,
}: DownloadReportModalProps): JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  if (!open) return null;

  /* ── Excel Export ─────────────────────────────────────────────── */
  const handleExcel = () => {
    setBusy(true);
    setStatus('Building Excel…');
    try {
      const wb = XLSX.utils.book_new();

      /* ── Sheet 1: Mark Analysis ── */
      const header1 = [
        [`Course: ${courseId}`, '', `Class Type: ${ct}`, '', `Section: ${sectionName}`],
        [`Staff: ${staffName || '—'}`, '', `Students: ${studentCount}`, '', `Cycle: ${cycleName}`],
        [],
        ['Roll No.', 'Name', ...cols.map((c) => `${c.label} / ${c.max}`), 'Total / 100'],
      ];
      const dataRows = rows.map((r) => [
        r.regNo,
        r.name,
        ...cols.map((c) => (r.marks[c.key] != null ? r.marks[c.key] : '')),
        r.total100 != null ? r.total100 : '',
      ]);
      const ws1 = XLSX.utils.aoa_to_sheet([...header1, ...dataRows]);
      ws1['!cols'] = [{ wch: 14 }, { wch: 36 }, ...cols.map(() => ({ wch: 14 })), { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Mark Analysis');

      /* ── Sheet 2: Range Analysis ── */
      const rangeCounts = computeRangeCounts(totals);
      const ws2 = XLSX.utils.aoa_to_sheet([
        [`Range Analysis — ${cycleName}`, '', ''],
        ['Range', 'Count', 'Strength (%)'],
        ...rangeCounts.map((r) => [
          r.label,
          r.count,
          totals.length > 0 ? `${((r.count / totals.length) * 100).toFixed(1)}%` : '0%',
        ]),
        [],
        ['Total Attended', totals.length, ''],
        ['Total Absent', studentCount - totals.length, ''],
      ]);
      ws2['!cols'] = [{ wch: 16 }, { wch: 8 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Range Analysis');

      /* ── Sheet 3: Bell Distribution ── */
      const bellCounts = computeRangeCounts(totals);
      const ws3 = XLSX.utils.aoa_to_sheet([
        [`Bell Graph Data — ${cycleName}`, ''],
        ['Range Bucket', 'Count'],
        ...bellCounts.map((r) => [r.label, r.count]),
      ]);
      ws3['!cols'] = [{ wch: 16 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Bell Graph');

      XLSX.writeFile(wb, `Result_Analysis_${courseId}_${sectionName}_${cycleName}.xlsx`);
    } catch (e: any) {
      alert('Excel export failed: ' + (e?.message || e));
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  /* ── PDF Export ───────────────────────────────────────────────── */
  const handlePDF = async () => {
    setBusy(true);
    setStatus('Loading assets…');
    try {
      /* load images */
      const [b64Banner, b64Kr, b64Idcs] = await Promise.all([
        toBase64(bannerSrc).catch(() => ''),
        toBase64(krLogoSrc).catch(() => ''),
        toBase64(idcsLogoSrc).catch(() => ''),
      ]);

      /* Landscape A4: 297 × 210 mm */
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297;
      const ML = 10;   // margin left
      const MR = 10;   // margin right
      const UW = PW - ML - MR; // usable width = 277

      let curY = 10;

      /* ── Banner ─────────────────────────────────────────── */
      if (b64Banner) {
        setStatus('Placing banner…');
        const { w: bw, h: bh } = await imgSize(b64Banner);
        const bannerH = Math.min(28, (bh / bw) * UW);
        const bannerDisplayW = (bw / bh) * bannerH;
        const bannerX = ML + (UW - bannerDisplayW) / 2;
        doc.addImage(b64Banner, 'PNG', bannerX, curY, bannerDisplayW, bannerH);
        curY += bannerH + 4;
      } else {
        doc.setFillColor(30, 58, 95);
        doc.rect(ML, curY, UW, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('KARPAGAM INSTITUTE OF TECHNOLOGY', PW / 2, curY + 9, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        curY += 18;
      }

      /* ── Info section ────────────────────────────────────── */
      const infoY = curY;
      const logoW = 32;
      const logoCol = PW - MR - logoW * 2 - 6; // x where logos start
      const infoUW = logoCol - ML - 4;

      /* left: text block */
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 95);
      const infoLines: [string, string][] = [
        ['Course Code', courseId],
        ['Class Type', ct],
        ['Section', sectionName || '—'],
        ['Staff', staffName || '—'],
        ['Students', String(studentCount)],
        ['Cycle', cycleName],
      ];
      infoLines.forEach(([label, val], i) => {
        const ly = infoY + i * 6.5;
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, ML, ly);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(val, ML + 28, ly);
        doc.setTextColor(30, 58, 95);
      });

      /* right: logos */
      if (b64Kr) {
        const { w: kw, h: kh } = await imgSize(b64Kr);
        const kh2 = Math.min(16, (kh / kw) * logoW);
        doc.addImage(b64Kr, 'PNG', logoCol, infoY, logoW, kh2);
      }
      if (b64Idcs) {
        const { w: iw, h: ih } = await imgSize(b64Idcs);
        const ih2 = Math.min(16, (ih / iw) * logoW);
        doc.addImage(b64Idcs, 'PNG', logoCol + logoW + 6, infoY, logoW, ih2);
      }

      /* divider */
      const afterInfo = infoY + infoLines.length * 6.5 + 4;
      curY = Math.max(afterInfo, infoY + 16);
      doc.setDrawColor(200, 200, 200);
      doc.line(ML, curY, PW - MR, curY);
      curY += 4;

      /* ── Mark Analysis Sheet Table ────────────────────────── */
      setStatus('Building mark sheet…');

      const sheetHead = [
        ['Roll No.', 'Name', ...cols.map((c) => `${c.label}\n/ ${c.max}`), 'Total\n/ 100'],
      ];
      const sheetBody = rows.map((r) => [
        r.regNo,
        r.name,
        ...cols.map((c) => (r.marks[c.key] != null ? String(r.marks[c.key]) : '—')),
        r.total100 != null ? String(r.total100) : '—',
      ]);

      autoTable(doc, {
        startY: curY,
        head: sheetHead,
        body: sheetBody,
        margin: { left: ML, right: MR },
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 95],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 22 },
          1: { halign: 'left', cellWidth: 55 },
          ...Object.fromEntries(
            cols.map((_, i) => [i + 2, { halign: 'center', cellWidth: 20 }])
          ),
          [cols.length + 2]: {
            halign: 'center',
            cellWidth: 18,
            fontStyle: 'bold',
            fillColor: [254, 240, 138],
            textColor: [31, 41, 55],
          },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const totalIdx = cols.length + 2;
            if (data.column.index === totalIdx) {
              const val = Number(data.cell.raw);
              if (!isNaN(val)) {
                if (val >= 75) data.cell.styles.textColor = [5, 150, 105];
                else if (val >= 50) data.cell.styles.textColor = [37, 99, 235];
                else if (val >= 40) data.cell.styles.textColor = [217, 119, 6];
                else data.cell.styles.textColor = [220, 38, 38];
              }
            }
          }
        },
      });

      const afterSheet = (doc as any).lastAutoTable?.finalY ?? curY + 50;
      curY = afterSheet + 6;

      /* ── Check if we need a new page for split section ───── */
      const splitMinH = 60;
      if (curY + splitMinH > 200) {
        doc.addPage();
        curY = 10;
      }

      /* ── Section title ────────────────────────────────────── */
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 95);
      doc.text('Analysis Summary', ML, curY);
      curY += 6;

      /* ── Split: Range Analysis (left) | Bell Graph Counts (right) ── */
      const halfW = UW / 2 - 3;
      const rightX = ML + halfW + 6;

      /* compute range data */
      const rangeCounts = computeRangeCounts(totals);
      const absent = studentCount - totals.length;

      /* Range Analysis table (left half) */
      setStatus('Building range table…');
      autoTable(doc, {
        startY: curY,
        head: [['RANGE', 'STRENGTH', 'ATTENDED', 'ABSENT']],
        body: [
          ...rangeCounts.map((r) => [
            r.label,
            r.count > 0 ? `${r.count} (${((r.count / studentCount) * 100).toFixed(0)}%)` : '—',
            String(totals.length),
            String(absent),
          ]),
          ['Total', String(totals.length), String(totals.length), String(absent)],
        ],
        margin: { left: ML, right: rightX },
        tableWidth: halfW,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === rangeCounts.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 252, 231];
          }
        },
      });

      /* Bell Graph counts table (right half) — same startY as range table */
      setStatus('Building bell table…');
      autoTable(doc, {
        startY: curY,
        head: [['Range Bucket', 'Students', 'Distribution']],
        body: rangeCounts.map((r) => {
          const pct = totals.length > 0 ? (r.count / totals.length) * 100 : 0;
          const bar = '█'.repeat(Math.round(pct / 5));
          return [r.label, String(r.count), bar || '—'];
        }),
        margin: { left: rightX, right: MR },
        tableWidth: halfW,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'center' },
          2: { halign: 'left', textColor: [37, 99, 235] },
        },
        alternateRowStyles: { fillColor: [239, 246, 255] },
      });

      /* ── Footer ───────────────────────────────────────────── */
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.text(
          `Generated: ${new Date().toLocaleString()}  |  ${courseId} · ${sectionName} · ${cycleName}  |  Page ${p} / ${pageCount}`,
          PW / 2,
          205,
          { align: 'center' },
        );
      }

      setStatus('Saving PDF…');
      doc.save(`Result_Analysis_${courseId}_${sectionName}_${cycleName}.pdf`);
    } catch (e: any) {
      alert('PDF export failed: ' + (e?.message || e));
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          padding: '32px 36px',
          width: 420,
          maxWidth: '90vw',
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1e3a5f' }}>Download Report</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {courseId} · {sectionName || ct} · {cycleName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Info pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            { label: 'Students', val: String(studentCount) },
            { label: 'Columns', val: String(cols.length) },
            { label: 'With Data', val: String(totals.length) },
          ].map(({ label, val }) => (
            <span
              key={label}
              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}
            >
              {label}: {val}
            </span>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {/* Excel */}
          <button
            onClick={handleExcel}
            disabled={busy}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: busy ? '#d1fae5' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              opacity: busy ? 0.6 : 1,
              transition: 'opacity 0.2s, transform 0.1s',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            }}
          >
            <span style={{ fontSize: 28 }}>📊</span>
            <span>Excel</span>
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>Sheets + Range data</span>
          </button>

          {/* PDF */}
          <button
            onClick={handlePDF}
            disabled={busy}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: busy ? '#dbeafe' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              opacity: busy ? 0.6 : 1,
              transition: 'opacity 0.2s, transform 0.1s',
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            <span style={{ fontSize: 28 }}>📄</span>
            <span>PDF</span>
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>Full report layout</span>
          </button>
        </div>

        {/* PDF layout description */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 11.5, color: '#374151', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>PDF Layout</div>
          <div style={{ display: 'grid', rowGap: 3 }}>
            {[
              '🏳️  Banner — centred header',
              '📋  Course details (left) + Logos (right)',
              '📝  Full Mark Analysis Sheet table',
              '📊  Range Analysis  |  Bell Graph Counts',
            ].map((line) => (
              <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{line}</div>
            ))}
          </div>
        </div>

        {/* Status / spinner */}
        {busy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" fill="none" stroke="#bfdbfe" strokeWidth="4" />
              <path d="M12 2A10 10 0 0 1 22 12" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            {status || 'Processing…'}
          </div>
        )}

        {/* Cancel */}
        <button
          onClick={onClose}
          disabled={busy}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#fff',
            color: '#6b7280',
            fontWeight: 600,
            fontSize: 13,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
