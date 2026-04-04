from django.db.models import Q


def _safe_text(value):
    return str(value or '').strip()


def _safe_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _extract_model_total_for_student(data, student_id):
    if not isinstance(data, dict):
        return None
    sid = str(student_id)

    marks = data.get('marks')
    if isinstance(marks, dict):
        qmarks = marks.get(sid) or marks.get(student_id)
        if isinstance(qmarks, dict):
            total = 0.0
            has_any = False
            for v in qmarks.values():
                n = _safe_float(v)
                if n is not None:
                    total += n
                    has_any = True
            return round(total, 2) if has_any else None

    sheet = data.get('sheet') if isinstance(data, dict) else None
    if isinstance(sheet, dict):
        rows = sheet.get('rowsByStudentId')
        if isinstance(rows, dict):
            row = rows.get(sid) or rows.get(student_id)
            if isinstance(row, dict):
                direct = _safe_float(row.get('ciaExam'))
                if direct is not None:
                    return round(direct, 2)

    return None


def _assessment_map(model, field_name, subject_id, student_ids, ta_id):
    out = {}
    if not subject_id or not student_ids:
        return out

    base = model.objects.filter(subject_id=subject_id, student_id__in=student_ids)
    scoped = base.filter(Q(teaching_assignment_id=ta_id) | Q(teaching_assignment__isnull=True)).values('student_id', 'teaching_assignment_id', field_name)

    for row in scoped:
        sid = int(row.get('student_id'))
        current = out.get(sid)
        val = _safe_float(row.get(field_name))
        is_ta = row.get('teaching_assignment_id') == ta_id

        if current is None:
            out[sid] = {'value': val, 'is_ta': is_ta}
            continue
        if current.get('is_ta'):
            continue
        if is_ta:
            out[sid] = {'value': val, 'is_ta': True}
        elif current.get('value') is None and val is not None:
            out[sid] = {'value': val, 'is_ta': False}

    missing = [sid for sid in student_ids if sid not in out]
    if missing:
        for row in base.filter(student_id__in=missing).values('student_id', field_name):
            sid = int(row.get('student_id'))
            if sid in out:
                continue
            out[sid] = {'value': _safe_float(row.get(field_name)), 'is_ta': False}

    return {sid: data.get('value') for sid, data in out.items()}


def _students_for_ta(ta):
    from academics.models import StudentSectionAssignment, StudentProfile

    students = []
    existing_ids = set()

    if getattr(ta, 'section_id', None):
        s_qs = (
            StudentSectionAssignment.objects.filter(section_id=ta.section_id, end_date__isnull=True)
            .exclude(student__status__in=['INACTIVE', 'DEBAR'])
            .select_related('student__user')
        )
        for s in s_qs:
            sp = s.student
            u = getattr(sp, 'user', None)
            name = ' '.join([
                _safe_text(getattr(u, 'first_name', '')),
                _safe_text(getattr(u, 'last_name', '')),
            ]).strip() if u else ''
            if not name:
                name = _safe_text(getattr(u, 'username', '')) if u else ''
            students.append({
                'id': sp.id,
                'reg_no': _safe_text(getattr(sp, 'reg_no', '')),
                'name': name,
            })
            existing_ids.add(int(sp.id))

        legacy_qs = (
            StudentProfile.objects.filter(section_id=ta.section_id)
            .exclude(status__in=['INACTIVE', 'DEBAR'])
            .select_related('user')
        )
        for sp in legacy_qs:
            try:
                sid = int(sp.id)
            except Exception:
                continue
            if sid in existing_ids:
                continue
            u = getattr(sp, 'user', None)
            name = ' '.join([
                _safe_text(getattr(u, 'first_name', '')),
                _safe_text(getattr(u, 'last_name', '')),
            ]).strip() if u else ''
            if not name:
                name = _safe_text(getattr(u, 'username', '')) if u else ''
            students.append({
                'id': sp.id,
                'reg_no': _safe_text(getattr(sp, 'reg_no', '')),
                'name': name,
            })

    students.sort(key=lambda r: (_safe_text(r.get('reg_no')), _safe_text(r.get('name'))))
    return students


def _resolve_subject_for_ta(ta):
    from academics.models import Subject

    subj = getattr(ta, 'subject', None)
    if subj is not None:
        return subj

    code = ''
    if getattr(ta, 'curriculum_row', None) is not None:
        code = _safe_text(getattr(ta.curriculum_row, 'course_code', ''))
    if not code and getattr(ta, 'elective_subject', None) is not None:
        code = _safe_text(getattr(ta.elective_subject, 'course_code', ''))
    if not code:
        return None
    return Subject.objects.filter(code__iexact=code).first()


def recompute_final_internal_marks(*, actor_user_id=None, filters=None):
    from academics.models import TeachingAssignment
    from OBE.models import (
        Cia1Mark,
        Cia2Mark,
        Ssa1Mark,
        Ssa2Mark,
        Review1Mark,
        Review2Mark,
        Formative1Mark,
        Formative2Mark,
        ModelPublishedSheet,
        FinalInternalMark,
    )

    filters = filters or {}

    qs = TeachingAssignment.objects.filter(is_active=True, section__isnull=False).select_related(
        'subject',
        'curriculum_row',
        'elective_subject',
        'section',
        'section__semester',
        'section__batch',
    )

    ta_id = filters.get('teaching_assignment_id')
    if ta_id:
        qs = qs.filter(id=int(ta_id))

    subject_code = _safe_text(filters.get('subject_code'))
    if subject_code:
        qs = qs.filter(
            Q(subject__code__iexact=subject_code)
            | Q(curriculum_row__course_code__iexact=subject_code)
            | Q(elective_subject__course_code__iexact=subject_code)
        )

    semester = filters.get('semester')
    if semester:
        qs = qs.filter(section__semester__number=int(semester))

    processed_tas = 0
    upserted_rows = 0
    deleted_rows = 0

    for ta in qs.order_by('id'):
        subject = _resolve_subject_for_ta(ta)
        if subject is None:
            continue

        students = _students_for_ta(ta)
        student_ids = [int(s['id']) for s in students]
        if not student_ids:
            continue

        cia1 = _assessment_map(Cia1Mark, 'mark', subject.id, student_ids, ta.id)
        cia2 = _assessment_map(Cia2Mark, 'mark', subject.id, student_ids, ta.id)
        ssa1 = _assessment_map(Ssa1Mark, 'mark', subject.id, student_ids, ta.id)
        ssa2 = _assessment_map(Ssa2Mark, 'mark', subject.id, student_ids, ta.id)
        review1 = _assessment_map(Review1Mark, 'mark', subject.id, student_ids, ta.id)
        review2 = _assessment_map(Review2Mark, 'mark', subject.id, student_ids, ta.id)
        formative1 = _assessment_map(Formative1Mark, 'total', subject.id, student_ids, ta.id)
        formative2 = _assessment_map(Formative2Mark, 'total', subject.id, student_ids, ta.id)

        model_map = {}
        model_qs = ModelPublishedSheet.objects.filter(subject_id=subject.id)
        model_qs = model_qs.filter(Q(teaching_assignment_id=ta.id) | Q(teaching_assignment__isnull=True)).order_by('-updated_at')
        model_row = model_qs.first()
        if model_row is not None:
            data = getattr(model_row, 'data', None)
            for sid in student_ids:
                model_map[sid] = _extract_model_total_for_student(data, sid)

        existing_qs = FinalInternalMark.objects.filter(subject=subject, teaching_assignment=ta)
        stale_ids = set(existing_qs.values_list('student_id', flat=True)) - set(student_ids)
        if stale_ids:
            deleted_rows += existing_qs.filter(student_id__in=stale_ids).delete()[0]

        for sid in student_ids:
            parts = [
                formative1.get(sid),
                formative2.get(sid),
                ssa1.get(sid),
                ssa2.get(sid),
                review1.get(sid),
                review2.get(sid),
                cia1.get(sid),
                cia2.get(sid),
                model_map.get(sid),
            ]
            parts = [p for p in parts if p is not None]
            total = round(sum(parts), 2) if parts else None
            if total is not None:
                total = max(0.0, min(40.0, total))

            FinalInternalMark.objects.update_or_create(
                subject=subject,
                student_id=sid,
                teaching_assignment=ta,
                defaults={
                    'final_mark': total,
                    'max_mark': 40,
                    'computed_from': 'INTERNAL_MARK_PAGE_TOTAL',
                    'computed_by': actor_user_id,
                },
            )
            upserted_rows += 1

        processed_tas += 1

    return {
        'processed_teaching_assignments': processed_tas,
        'upserted_rows': upserted_rows,
        'deleted_rows': deleted_rows,
    }
