import React, { useEffect, useState } from 'react';
import fetchWithAuth from '../../services/fetchAuth';

export default function StudentAcademics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth('/api/academics/student/marks/');
        if (!mounted) return;
        if (!res.ok) {
          const msg = `Failed to load marks (HTTP ${res.status}).`;
          setError(msg);
          setData(null);
          return;
        }
        const j = await res.json();
        if (mounted) setData(j);
      } catch (e) {
        if (mounted) {
          setError('Failed to load marks.');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const courses = Array.isArray(data?.courses) ? data.courses : [];

  const fmt = (v: any) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isFinite(n)) return String(n);
    return String(v);
  };

  const semesterNumber = data?.semester?.number ?? null;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900">My Marks</h1>
        <p className="text-sm text-gray-600 mt-1">
          {semesterNumber ? `Semester ${semesterNumber} · ` : ''}All enrolled courses and marks.
        </p>

        <div className="mt-6 bg-white shadow rounded p-4">
          {loading ? (
            <div className="text-gray-600">Loading marks…</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">{error}</div>
          ) : (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {courses.length === 0 ? (
                  <div className="text-gray-600">No courses found for your semester.</div>
                ) : courses.map((c: any) => {
                  const m = c.marks || {};
                  const internalObj = m.internal || {};
                  const hasCqi = !!m.has_cqi;

                  return (
                    <div key={c.code || String(c.id)} className="p-3 border rounded bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{c.code} — {c.name}</div>
                          <div className="text-sm text-gray-500">
                            {c.class_type ? String(c.class_type) : ''}
                            {hasCqi ? (c.class_type ? ' · CQI available' : 'CQI available') : ''}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {semesterNumber ? `Semester ${semesterNumber}` : ''}
                        </div>
                      </div>

                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <tbody className="divide-y">
                            <tr>
                              <td className="py-1 pr-3 text-gray-500">CIA 1</td>
                              <td className="py-1 pr-6 font-medium text-gray-900">{fmt(m.cia1)}</td>
                              <td className="py-1 pr-3 text-gray-500">CIA 2</td>
                              <td className="py-1 font-medium text-gray-900">{fmt(m.cia2)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-3 text-gray-500">SSA 1</td>
                              <td className="py-1 pr-6 font-medium text-gray-900">{fmt(m.ssa1)}</td>
                              <td className="py-1 pr-3 text-gray-500">SSA 2</td>
                              <td className="py-1 font-medium text-gray-900">{fmt(m.ssa2)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-3 text-gray-500">Review 1</td>
                              <td className="py-1 pr-6 font-medium text-gray-900">{fmt(m.review1)}</td>
                              <td className="py-1 pr-3 text-gray-500">Review 2</td>
                              <td className="py-1 font-medium text-gray-900">{fmt(m.review2)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-3 text-gray-500">Formative 1</td>
                              <td className="py-1 pr-6 font-medium text-gray-900">{fmt(m.formative1)}</td>
                              <td className="py-1 pr-3 text-gray-500">Formative 2</td>
                              <td className="py-1 font-medium text-gray-900">{fmt(m.formative2)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 pr-3 text-gray-500">Internal (Cycle 1)</td>
                              <td className="py-1 pr-6 font-medium text-gray-900">
                                {fmt(internalObj.cycle1 ?? internalObj.computed)}
                                {internalObj.max_cycle1 || internalObj.max_total ? (
                                  <span className="text-gray-400">/{fmt(internalObj.max_cycle1 ?? internalObj.max_total)}</span>
                                ) : null}
                              </td>
                              <td className="py-1 pr-3 text-gray-500">Internal (Cycle 2)</td>
                              <td className="py-1 font-medium text-gray-900">
                                {fmt(internalObj.cycle2 ?? internalObj.computed)}
                                {internalObj.max_cycle2 || internalObj.max_total ? (
                                  <span className="text-gray-400">/{fmt(internalObj.max_cycle2 ?? internalObj.max_total)}</span>
                                ) : null}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
