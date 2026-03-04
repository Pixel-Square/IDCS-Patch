import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart as RBarChart, Bar, Cell,
  PieChart, Pie,
  ScatterChart as RScatterChart, Scatter, ZAxis,
  ReferenceLine,
} from 'recharts';
import { lsGet } from '../../utils/localStorage';
import { fetchTeachingAssignmentRoster, TeachingAssignmentRosterStudent } from '../../services/roster';

// ─── Data helpers ────────────────────────────────────────────────────────────

function safeGetLocal(key: string): any {
  try {
    return lsGet<any>(key);
  } catch {
    return null;
  }
}

type MaxDef = { key: string; max: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function coerceNum(v: any): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function getQuestionMaxMapFromMeta(meta: any): Record<string, number> {
  const m: Record<string, number> = {};
  const arr: MaxDef[] = Array.isArray(meta)
    ? meta
        .map((x: any) => ({ key: String(x?.key ?? ''), max: Number(x?.max ?? 0) }))
        .filter((x) => x.key && Number.isFinite(x.max) && x.max > 0)
    : [];
  arr.forEach((x) => {
    m[x.key] = x.max;
  });
  return m;
}

function guessMaxByQKey(keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  keys.forEach((k) => {
    const m = /^q(\d+)$/i.exec(String(k));
    if (!m) return;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx <= 0) return;

    // Heuristic:
    // - CIA style: Q1..Q6 are 2 marks, Q7+ are 16 marks.
    // - THEORY model style: Q1..Q10 are 2 marks, Q11..Q15 are 14, Q16 is 10.
    if (idx <= 6) out[k] = 2;
    else if (idx <= 10) out[k] = 2;
    else if (idx <= 15) out[k] = 14;
    else if (idx === 16) out[k] = 10;
    else out[k] = 16;
  });
  return out;
}

function guessModelMaxByQKey(keys: string[], variant: 'THEORY' | 'TCPL' | 'TCPR' | 'UNKNOWN'): Record<string, number> {
  if (variant === 'UNKNOWN') return guessMaxByQKey(keys);

  const out: Record<string, number> = {};
  keys.forEach((k) => {
    const m = /^q(\d+)$/i.exec(String(k));
    if (!m) return;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx <= 0) return;

    if (variant === 'THEORY') {
      if (idx <= 10) out[k] = 2;
      else if (idx <= 15) out[k] = 14;
      else if (idx === 16) out[k] = 10;
      else out[k] = 14;
      return;
    }

    if (variant === 'TCPL') {
      out[k] = idx <= 10 ? 2 : 16;
      return;
    }

    // TCPR
    out[k] = idx <= 8 ? 2 : 16;
  });
  return out;
}

function scorePercentFromQRow(row: any, maxByKey: Record<string, number>, fallbackMaxTotal?: number): number | null {
  if (!row) return null;
  const q = (row as any).q && typeof (row as any).q === 'object' ? (row as any).q : null;
  if (!q) return null;

  const isAbsent = Boolean((row as any).absent);
  const absentKind = String((row as any).absentKind || 'AL').toUpperCase();
  if (isAbsent && absentKind === 'AL') return 0;

  const keys = Object.keys(q);
  if (!keys.length) return null;

  // Treat a row as "entered" only if at least one question has a finite numeric mark.
  // This avoids counting placeholder strings (e.g., 'ABSENT') as entered and
  // accidentally producing a 0% score.
  const hasAnyEntered = keys.some((k) => {
    const v = (q as any)[k];
    const n = coerceNum(v);
    return n != null;
  });
  if (!hasAnyEntered) return null;

  const guessed = guessMaxByQKey(keys);
  const maxTotal = keys.reduce((sum, k) => {
    const mk = Number(maxByKey[k] ?? guessed[k] ?? 0);
    return sum + (Number.isFinite(mk) && mk > 0 ? mk : 0);
  }, 0);

  const denom = maxTotal > 0 ? maxTotal : Number(fallbackMaxTotal ?? 0);
  if (!Number.isFinite(denom) || denom <= 0) return null;

  const total = keys.reduce((sum, k) => {
    const mv = coerceNum((q as any)[k]);
    if (mv == null) return sum;
    const mk = Number(maxByKey[k] ?? guessed[k] ?? Infinity);
    const clamped = Number.isFinite(mk) && mk > 0 ? clamp(mv, 0, mk) : Math.max(0, mv);
    return sum + clamped;
  }, 0);

  const pct = (total / denom) * 100;
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : null;
}

type Student = {
  id: string;
  cia1?: number;
  cia2?: number;
  model?: number;
  avg?: number;
  cia1Absent?: boolean;
  cia2Absent?: boolean;
};

const FAIL_THRESHOLD = 58;

const GRADE_COLORS: Record<string, string> = {
  Fail: '#ef4444',
  '58-64': '#f59e0b',
  '65-74': '#3b82f6',
  '75+': '#10b981',
};

// ─── Card wrapper ──────────────────────────────────────────────────────────────

function Widget({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="obe-card" style={{ padding: '18px 18px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function NoData() {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
      <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth={1.5} style={{ margin: '0 auto 6px', display: 'block' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-5 4 3 4-6" />
      </svg>
      No marks saved yet
    </div>
  );
}

function buildStudentsWithRoster(subjectId: string, roster: TeachingAssignmentRosterStudent[] | null, teachingAssignmentId?: number | null): Student[] {
  const cia1Sheet = safeGetLocal(`cia1_sheet_${subjectId}`);
  const cia2Sheet = safeGetLocal(`cia2_sheet_${subjectId}`);

  const cia1Rows: Record<string, any> = cia1Sheet && typeof cia1Sheet === 'object' ? (cia1Sheet.rowsByStudentId || cia1Sheet.rows || {}) : {};
  const cia2Rows: Record<string, any> = cia2Sheet && typeof cia2Sheet === 'object' ? (cia2Sheet.rowsByStudentId || cia2Sheet.rows || {}) : {};

  const cia1MaxByKey = getQuestionMaxMapFromMeta((cia1Sheet as any)?.questionsMeta || (cia1Sheet as any)?.questions || null);
  const cia2MaxByKey = getQuestionMaxMapFromMeta((cia2Sheet as any)?.questionsMeta || (cia2Sheet as any)?.questions || null);

  const ta = teachingAssignmentId != null ? String(teachingAssignmentId) : 'none';
  const modelCandidates = [
    `model_theory_sheet_${subjectId}_${ta}`,
    `model_tcpl_sheet_${subjectId}_${ta}`,
    `model_tcpr_sheet_${subjectId}_${ta}`,
    `model_sheet_${subjectId}`,
  ];
  const modelHit = modelCandidates
    .map((k) => ({ k, v: safeGetLocal(k) }))
    .find((x) => x.v && typeof x.v === 'object');
  const modelSheetKey = modelHit?.k || '';
  const modelSheet: Record<string, any> = modelHit?.v && typeof modelHit.v === 'object' ? (modelHit.v as any) : {};

  const modelVariant: 'THEORY' | 'TCPL' | 'TCPR' | 'UNKNOWN' = modelSheetKey.includes('model_tcpl_sheet_')
    ? 'TCPL'
    : modelSheetKey.includes('model_tcpr_sheet_')
      ? 'TCPR'
      : modelSheetKey.includes('model_theory_sheet_')
        ? 'THEORY'
        : 'UNKNOWN';

  const isModelTcplLike = modelVariant === 'TCPL' || modelVariant === 'TCPR';
  const modelLabMax = 30;

  const ids = new Set<string>();
  if (Array.isArray(roster) && roster.length) {
    roster.forEach((s) => ids.add(String((s as any)?.id ?? '')));
  } else {
    Object.keys(cia1Rows || {}).forEach((k) => ids.add(String(k)));
    Object.keys(cia2Rows || {}).forEach((k) => ids.add(String(k)));
    Object.keys(modelSheet || {}).forEach((k) => {
      const kk = String(k);
      if (kk.startsWith('id:')) ids.add(kk.slice(3));
      else if (kk.startsWith('reg:')) ids.add(kk.slice(4));
      else ids.add(kk);
    });
  }

  const asNum = (v: any): number | null => {
    const n = coerceNum(v);
    return n == null ? null : n;
  };

  const rosterById = new Map<string, TeachingAssignmentRosterStudent>();
  if (Array.isArray(roster)) {
    roster.forEach((s) => {
      const sid = String((s as any)?.id ?? '');
      if (sid) rosterById.set(sid, s);
    });
  }

  return Array.from(ids)
    .filter(Boolean)
    .map((id) => {
      const cia1Row = cia1Rows?.[id] || null;
      const cia2Row = cia2Rows?.[id] || null;

      const cia1Absent = Boolean((cia1Row as any)?.absent);
      const cia2Absent = Boolean((cia2Row as any)?.absent);

      // CIA sheets are typically out of 60; convert to %.
      const v1 = scorePercentFromQRow(cia1Row, cia1MaxByKey, 60);
      const v2 = scorePercentFromQRow(cia2Row, cia2MaxByKey, 60);

      // Model sheet rows are keyed as id:{id} or reg:{reg_no} (newer sheet), or plain id (legacy).
      const rosterItem = rosterById.get(id) || null;
      const regNo = rosterItem ? String((rosterItem as any).reg_no || '').trim() : '';
      const modelRow =
        modelSheet?.[`id:${id}`] ||
        (regNo ? modelSheet?.[`reg:${regNo}`] : null) ||
        modelSheet?.[`reg:${id}`] ||
        modelSheet?.[id] ||
        null;
      let vm: number | null = null;
      if (modelRow && typeof modelRow === 'object') {
        const q = (modelRow as any).q && typeof (modelRow as any).q === 'object' ? (modelRow as any).q : null;
        const qKeys = q ? Object.keys(q) : [];
        const maxByKey = guessModelMaxByQKey(qKeys, modelVariant);
        const lab = asNum((modelRow as any).lab);

        // If only LAB/REVIEW is present (TCPL/TCPR), still consider it as "marks entered".
        const qAnyEntered = qKeys.some((k) => {
          const v = q ? (q as any)[k] : null;
          if (v === '' || v === null || v === undefined) return false;
          if (typeof v === 'string' && v.trim() === '') return false;
          return true;
        });

        const basePct = qAnyEntered ? scorePercentFromQRow({ q }, maxByKey, 100) : null;

        if (basePct != null) {
          // If TCPL/TCPR sheet also uses LAB/REVIEW, include it in the denom.
          if (isModelTcplLike && lab != null) {
            const denom = (qKeys.reduce((sum, k) => sum + Number(maxByKey[k] || 0), 0) || 100) + modelLabMax;
            const total = (qKeys.reduce((sum, k) => {
              const mv = asNum((q as any)[k]);
              if (mv == null) return sum;
              const mk = Number(maxByKey[k] || Infinity);
              const clamped = Number.isFinite(mk) && mk > 0 ? clamp(mv, 0, mk) : Math.max(0, mv);
              return sum + clamped;
            }, 0) || 0) + clamp(lab, 0, modelLabMax);
            const pct = (total / denom) * 100;
            vm = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : basePct;
          } else {
            vm = basePct;
          }
        }

        if (vm == null && isModelTcplLike && lab != null) {
          // No theory Qs entered, but LAB/REVIEW entered.
          vm = Math.max(0, Math.min(100, (clamp(lab, 0, modelLabMax) / modelLabMax) * 100));
        }
      }

      const vals = [v1, v2, vm].filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return {
        id,
        cia1: v1 ?? undefined,
        cia2: v2 ?? undefined,
        model: vm ?? undefined,
        avg: avg ?? undefined,
        cia1Absent,
        cia2Absent,
      };
    })
    .filter((s) => Boolean(s.id));
}

// ─── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ students, rosterTotal }: { students: Student[]; rosterTotal: number }) {
  const valid = students.filter((s) => typeof s.avg === 'number');
  const passed = valid.filter((s) => (s.avg ?? 0) >= FAIL_THRESHOLD).length;
  const classAvg = valid.length ? valid.reduce((a, s) => a + (s.avg ?? 0), 0) / valid.length : null;

  // Lowest should reflect the lowest *attended* mark; exclude rows marked absent.
  const c1 = students
    .filter((s) => !s.cia1Absent)
    .map((s) => s.cia1)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const c2 = students
    .filter((s) => !s.cia2Absent)
    .map((s) => s.cia2)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const cycle1Lowest = c1.length ? Math.min(...c1) : null;
  const cycle2Lowest = c2.length ? Math.min(...c2) : null;

  const kpis = [
    { label: 'Total Students', value: rosterTotal, color: '#0b74b8' },
    { label: 'Passed', value: passed, color: '#10b981' },
    { label: 'Class Avg', value: classAvg == null ? '—' : classAvg.toFixed(1), color: '#f59e0b' },
    { label: 'Cycle 1 Lowest', value: cycle1Lowest == null ? '—' : cycle1Lowest.toFixed(1), color: '#ef4444' },
    { label: 'Cycle 2 Lowest', value: cycle2Lowest == null ? '—' : cycle2Lowest.toFixed(1), color: '#ef4444' },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
      {kpis.map((k) => (
        <div key={k.label} style={{
          flex: '1 1 120px', background: '#fff', borderRadius: 12, padding: '14px 18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: `4px solid ${k.color}`,
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 600 }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Trend Widget (Recharts LineChart) ─────────────────────────────────────────

function TrendWidget({ students }: { students: Student[] }) {
  const hasAny = students.some((s) => typeof s.cia1 === 'number' || typeof s.cia2 === 'number' || typeof s.model === 'number');
  const avg = (vals: (number | undefined)[]) => {
    const nums = vals.filter((v) => typeof v === 'number') as number[];
    return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
  };
  const data = [
    { name: 'CIA 1', average: avg(students.map((s) => s.cia1)) },
    { name: 'CIA 2', average: avg(students.map((s) => s.cia2)) },
    { name: 'Model', average: avg(students.map((s) => s.model)) },
  ];

  if (!hasAny) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RLineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} />
        <Line type="monotone" dataKey="average" stroke="#0b74b8" strokeWidth={3}
          dot={{ r: 6, fill: '#ff8c42', stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 8 }} />
      </RLineChart>
    </ResponsiveContainer>
  );
}

    // ─── Grade Distribution Widget (Recharts PieChart) ─────────────────────────────

    const PIE_COLORS = ['#ef4444', '#f59e0b', '#06b6d4', '#10b981'];

    function GradeWidget({ students }: { students: Student[] }) {
      const valid = students.filter((s) => typeof s.avg === 'number');
      const bands = { 'Fail (<58)': 0, '58–64': 0, '65–74': 0, '75+': 0 } as Record<string, number>;
      valid.forEach((s) => {
        const v = s.avg ?? 0;
        if (v < 58) bands['Fail (<58)'] += 1;
        else if (v < 65) bands['58–64'] += 1;
        else if (v < 75) bands['65–74'] += 1;
        else bands['75+'] += 1;
      });
      const data = Object.entries(bands).map(([name, value]) => ({ name, value })).filter((d) => d.value > 0);
      const total = valid.length;
      const passRate = total ? Math.round(((total - bands['Fail (<58)']) / total) * 100) : 0;

      if (data.length === 0) return <NoData />;
      return (
        <>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: passRate >= 75 ? '#10b981' : '#f59e0b' }}>{passRate}%</span>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>Pass Rate</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.map((_entry, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </>
      );
    }

    // ─── Top / Bottom Performers (Recharts BarChart) ────────────────────────────────

    function TopBottomWidget({ students }: { students: Student[] }) {
      const sorted = [...students].filter((s) => typeof s.avg === 'number').sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
      const slice = [
        ...sorted.slice(0, 5).map((s) => ({ id: s.id.slice(-6), avg: +(s.avg ?? 0).toFixed(1), group: 'Top' })),
        ...sorted.slice(-5).reverse().map((s) => ({ id: s.id.slice(-6), avg: +(s.avg ?? 0).toFixed(1), group: 'Bottom' })),
      ];

      if (slice.length === 0) return <NoData />;
      return (
        <ResponsiveContainer width="100%" height={260}>
          <RBarChart data={slice} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis dataKey="id" type="category" tick={{ fontSize: 11, fill: '#475569' }} width={56} />
            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} />
            <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
              {slice.map((entry, idx) => (
                <Cell key={idx} fill={entry.group === 'Top' ? '#0b74b8' : '#ef4444'} />
              ))}
            </Bar>
          </RBarChart>
        </ResponsiveContainer>
      );
    }

    // ─── Assessment Comparison Widget (Recharts grouped BarChart) ──────────────────

    function AssessmentComparisonWidget({ students }: { students: Student[] }) {
      const data = students
        .filter((s) => s.cia1 != null || s.cia2 != null || s.model != null)
        .slice(0, 25)
        .map((s) => ({
          id: s.id.slice(-5),
          CIA1: s.cia1 != null ? +s.cia1.toFixed(1) : null,
          CIA2: s.cia2 != null ? +s.cia2.toFixed(1) : null,
          Model: s.model != null ? +s.model.toFixed(1) : null,
        }));

      if (data.length === 0) return <NoData />;
      return (
        <ResponsiveContainer width="100%" height={240}>
          <RBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 38 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="id"
              tick={{ fontSize: 9, fill: '#475569' }}
              angle={-30}
              textAnchor="end"
              height={52}
              minTickGap={14}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
            <Legend iconType="circle" iconSize={9} />
            <Bar dataKey="CIA1" fill="#0b74b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="CIA2" fill="#06b6d4" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Model" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      );
    }

    // ─── Scatter Widget (CIA1 vs CIA2 via Recharts ScatterChart) ───────────────────

    function ScatterWidget({ students }: { students: Student[] }) {
      const data = students
        .filter((s) => s.cia1 != null && s.cia2 != null)
        .map((s) => ({ x: +(s.cia1 ?? 0).toFixed(1), y: +(s.cia2 ?? 0).toFixed(1), id: s.id }));

      if (data.length === 0) return <NoData />;
      return (
        <ResponsiveContainer width="100%" height={220}>
          <RScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" name="CIA1" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'CIA 1', position: 'insideBottom', offset: -6, fontSize: 11, fill: '#475569' }} />
            <YAxis type="number" dataKey="y" name="CIA2" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'CIA 2', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#475569' }} />
            <ZAxis range={[40, 40]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 10, fontSize: 12 }}
              content={({ payload }) => payload?.length ? (
                <div style={{ background: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <div><b>{payload[0]?.payload?.id}</b></div>
                  <div>CIA1: {payload[0]?.payload?.x} &nbsp; CIA2: {payload[0]?.payload?.y}</div>
                </div>
              ) : null}
            />
            <ReferenceLine x={FAIL_THRESHOLD} stroke="#ef4444" strokeDasharray="5 3" label={{ value: 'Fail', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={FAIL_THRESHOLD} stroke="#ef4444" strokeDasharray="5 3" />
            <Scatter data={data} fill="#0b74b8" opacity={0.75} />
          </RScatterChart>
        </ResponsiveContainer>
      );
    }

export default function DashboardWidgets({
  subjectId,
  teachingAssignmentId,
}: {
  subjectId?: string | number | null;
  teachingAssignmentId?: number | null;
}) {
  const subj = String(subjectId || '');
  const [roster, setRoster] = useState<TeachingAssignmentRosterStudent[] | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!subj || teachingAssignmentId == null) {
      setRoster(null);
      return;
    }
    (async () => {
      try {
        const res = await fetchTeachingAssignmentRoster(Number(teachingAssignmentId));
        if (!mounted) return;
        setRoster(Array.isArray(res?.students) ? res.students : []);
      } catch {
        if (!mounted) return;
        setRoster(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [subj, teachingAssignmentId]);

  const students = useMemo(
    () => buildStudentsWithRoster(subj, roster, teachingAssignmentId),
    [subj, roster, teachingAssignmentId],
  );
  const rosterTotal = Array.isArray(roster) && roster.length ? roster.length : students.length;

  return (
    <div style={{ padding: '4px 0' }}>
      <KpiStrip students={students} rosterTotal={rosterTotal} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Widget title="Trend Over Time" subtitle="Class avg per assessment">
          <TrendWidget students={students} />
        </Widget>

        <Widget title="Grade Distribution" subtitle={'Pass rate (fail < 58)'}>
          <GradeWidget students={students} />
        </Widget>

        <Widget title="Top vs Bottom Performers" subtitle="Avg marks (last 5 digits of ID)">
          <TopBottomWidget students={students} />
        </Widget>

        <Widget title="CIA1 vs CIA2 Scatter" subtitle="Each dot = one student">
          <ScatterWidget students={students} />
        </Widget>

        <Widget title="Per-Student Assessment Comparison" subtitle="First 25 students · CIA1 / CIA2 / Model">
          <AssessmentComparisonWidget students={students} />
        </Widget>
      </div>
    </div>
  );
}
