import { lsRemove } from './localStorage';

function removeKeysByPrefix(prefix: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) lsRemove(key);
  } catch {
    // ignore
  }
}

export function clearLocalDraftCache(subjectId: string, assessment: string, teachingAssignmentId?: number | null) {
  const a = String(assessment || '').trim().toLowerCase();
  const sid = String(subjectId || '').trim();
  const taId = teachingAssignmentId == null ? null : String(teachingAssignmentId).trim();
  if (!sid || !a) return;

  // Generic fallback (used by simpler entry tables)
  lsRemove(`marks_${sid}_${a}`);
  if (taId) lsRemove(`marks_${sid}_${a}_ta_${taId}`);

  const removeSheetKeys = (base: string) => {
    lsRemove(`${base}_sheet_${sid}`);
    removeKeysByPrefix(`${base}_sheet_${sid}_ta_`);
    if (taId) lsRemove(`${base}_sheet_${sid}_ta_${taId}`);
  };

  // Sheet-style caches
  if (a === 'ssa1') {
    removeSheetKeys('ssa1');
    removeKeysByPrefix(`ssa1_selected_btls_${sid}`);
  }
  if (a === 'review1') {
    removeSheetKeys('review1');
    removeKeysByPrefix(`review1_selected_btls_${sid}`);
  }
  if (a === 'ssa2') {
    removeSheetKeys('ssa2');
    removeKeysByPrefix(`ssa2_selected_btls_${sid}`);
  }
  if (a === 'review2') {
    removeSheetKeys('review2');
    removeKeysByPrefix(`review2_selected_btls_${sid}`);
  }
  if (a === 'formative1') {
    removeSheetKeys('formative1');
    lsRemove(`formative1_part_btl_${sid}`);
  }
  if (a === 'formative2') {
    removeSheetKeys('formative2');
    lsRemove(`formative2_part_btl_${sid}`);
  }
  if (a === 'cia1') removeSheetKeys('cia1');
  if (a === 'cia2') removeSheetKeys('cia2');
  if (a === 'model') {
    removeSheetKeys('model');
    removeKeysByPrefix(`model_theory_sheet_${sid}_`);
    removeKeysByPrefix(`model_tcpl_sheet_${sid}_`);
    removeKeysByPrefix(`model_tcpr_sheet_${sid}_`);
    removeKeysByPrefix(`model_theory_questionBtl_${sid}_`);
    removeKeysByPrefix(`model_tcpl_questionBtl_${sid}_`);
    removeKeysByPrefix(`model_tcpr_questionBtl_${sid}_`);
    removeKeysByPrefix(`model_qp_type_${sid}_`);
  }
}
