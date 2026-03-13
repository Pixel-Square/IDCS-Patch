"""
IDCSScan API views

Provides endpoints for the RFID hardware scanner integration:
  - GET  /api/idscan/lookup/?uid=<UID>         look up student by RFID UID
  - GET  /api/idscan/search/?q=<query>          search students (name / reg_no)
  - POST /api/idscan/assign-uid/               assign RFID UID to a student
  - POST /api/idscan/unassign-uid/             remove RFID UID from a student
  - POST /api/idscan/gatepass-check/           check & lock a gatepass for a student
  - GET  /api/idscan/search-staff/?q=<query>   search staff (staff_id / name)
  - POST /api/idscan/assign-staff-uid/         assign RFID UID to a staff member
  - POST /api/idscan/unassign-staff-uid/       remove RFID UID from a staff member

All endpoints require authentication. Assign/unassign/gatepass-check require SECURITY role.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

from academics.models import StudentProfile, StaffProfile
from applications import models as app_models

def _staff_detail(sp: StaffProfile) -> dict:
    """Serialize a StaffProfile into a dict for the scanner UI."""
    user = sp.user
    full_name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    display_name = full_name if full_name else user.username
    dept = getattr(sp, 'current_department', None) or sp.department
    return {
        'id': sp.pk,
        'staff_id': sp.staff_id,
        'name': display_name,
        'rfid_uid': sp.rfid_uid or None,
        'department': dept.name if dept else None,
        'designation': sp.designation,
        'status': sp.status,
    }


from applications.services.approval_engine import _get_flow_for_application
from applications.services import application_state


def _student_detail(sp: StudentProfile) -> dict:
    """Serialize a StudentProfile into a dict for the scanner UI."""
    user = sp.user
    full_name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    display_name = full_name if full_name else user.username

    section = None
    batch_name = None
    dept_name = None
    try:
        sec = sp.section
        if sec:
            section = sec.name
            b = getattr(sec, 'batch', None)
            if b:
                batch_name = str(b)
                c = getattr(b, 'course', None)
                if c:
                    d = getattr(c, 'department', None)
                    if d:
                        dept_name = d.name
    except Exception:
        pass

    # Fallback department via home_department
    if not dept_name:
        try:
            hd = sp.home_department
            if hd:
                dept_name = hd.name
        except Exception:
            pass

    return {
        'id': sp.pk,
        'reg_no': sp.reg_no,
        'name': display_name,
        'rfid_uid': sp.rfid_uid or None,
        'section': section,
        'batch': batch_name,
        'department': dept_name,
        'status': sp.status,
    }


def _display_name(user) -> str | None:
    if not user:
        return None
    name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return name if name else user.username


def _build_timeline(application, flow) -> list:
    """Return approval timeline in the same shape as ApplicationDetailSerializer."""
    steps = list(flow.steps.select_related('role').order_by('order'))
    if not steps:
        return []

    actions_by_step = {}
    for action in application.actions.order_by('acted_at').select_related('step__role', 'acted_by'):
        if action.step_id is not None:
            actions_by_step[action.step_id] = action

    first_order = steps[0].order
    last_order = steps[-1].order
    result = []
    for step in steps:
        action = actions_by_step.get(step.id)
        is_starter = step.order == first_order
        is_final = step.order == last_order
        if action:
            raw_status = action.action
            status_val = 'SUBMITTED' if is_starter else raw_status
            result.append({
                'step_order': step.order,
                'step_role': step.role.name if step.role else None,
                'is_starter': is_starter,
                'is_final': is_final,
                'status': status_val,
                'acted_by': _display_name(action.acted_by),
                'acted_at': action.acted_at.isoformat() if action.acted_at else None,
                'remarks': action.remarks or None,
            })
        else:
            result.append({
                'step_order': step.order,
                'step_role': step.role.name if step.role else None,
                'is_starter': is_starter,
                'is_final': is_final,
                'status': 'PENDING',
                'acted_by': None,
                'acted_at': None,
                'remarks': None,
            })
    return result


class LookupByUIDView(APIView):
    """GET /api/idscan/lookup/?uid=<UID> — find a student by their RFID UID."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        uid = (request.query_params.get('uid') or '').strip().upper()
        if not uid:
            return Response({'error': 'uid parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sp = StudentProfile.objects.select_related(
                'user', 'section__batch__course__department', 'home_department'
            ).get(rfid_uid__iexact=uid)
        except StudentProfile.DoesNotExist:
            return Response({'found': False, 'uid': uid}, status=status.HTTP_200_OK)

        return Response({'found': True, 'uid': uid, 'student': _student_detail(sp)})


class SearchStudentsView(APIView):
    """GET /api/idscan/search/?q=<query> — search students by name or reg_no."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response([])

        qs = StudentProfile.objects.select_related(
            'user', 'section__batch__course__department', 'home_department'
        ).filter(
            Q(reg_no__icontains=q) |
            Q(user__username__icontains=q) |
            Q(user__first_name__icontains=q) |
            Q(user__last_name__icontains=q)
        ).order_by('reg_no')[:30]

        return Response([_student_detail(sp) for sp in qs])


def _has_scan_permission(user) -> bool:
    """Return True if the user may assign/unassign RFID UIDs."""
    roles = [r.name.upper() for r in user.roles.all()] if hasattr(user, 'roles') else []
    return 'SECURITY' in roles


class AssignUIDView(APIView):
    """POST /api/idscan/assign-uid/ — assign or re-assign a UID to a student.

    Body: { student_id: <int>, uid: <str> }
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not _has_scan_permission(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get('student_id')
        uid = (request.data.get('uid') or '').strip().upper()

        if not student_id or not uid:
            return Response({'error': 'student_id and uid are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicate UID across students
        conflict = StudentProfile.objects.filter(rfid_uid__iexact=uid).exclude(pk=student_id).first()
        if conflict:
            return Response(
                {'error': f'UID {uid} is already assigned to student {conflict.reg_no}.'},
                status=status.HTTP_409_CONFLICT
            )

        try:
            sp = StudentProfile.objects.get(pk=student_id)
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        sp.rfid_uid = uid
        sp.save(update_fields=['rfid_uid'])
        return Response({'success': True, 'student': _student_detail(sp)})


class UnassignUIDView(APIView):
    """POST /api/idscan/unassign-uid/ — remove the RFID UID from a student.

    Body: { student_id: <int> }
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not _has_scan_permission(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get('student_id')
        if not student_id:
            return Response({'error': 'student_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sp = StudentProfile.objects.get(pk=student_id)
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        sp.rfid_uid = ''
        sp.save(update_fields=['rfid_uid'])
        return Response({'success': True})


class GatepassCheckView(APIView):
    """POST /api/idscan/gatepass-check/

    When the final step of an application flow is SECURITY, scanning the
    student's RFID card at the gate IS the security approval:
      - Finds the pending application where all pre-security steps are done
        and the current pending step is the final SECURITY step.
      - Records an APPROVED ApprovalAction for that step, finalises the
        application as APPROVED, and sets gatepass_scanned_at.
      - If the application was already approved via the inbox (unusual), just
        records the physical gate scan time.
      - Returns approval_timeline in all responses for display in the popup.
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not _has_scan_permission(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        uid = (request.data.get('uid') or '').strip().upper()
        if not uid:
            return Response({'error': 'uid is required'}, status=status.HTTP_400_BAD_REQUEST)

        # ── 1. Find student ───────────────────────────────────────────────────
        try:
            sp = StudentProfile.objects.select_related(
                'user', 'section__batch__course__department', 'home_department'
            ).get(rfid_uid__iexact=uid)
        except StudentProfile.DoesNotExist:
            return Response({
                'allowed': False, 'reason': 'unknown_uid',
                'message': 'This RFID card is not registered to any student.',
                'approval_timeline': [],
            }, status=status.HTTP_200_OK)

        student_data = _student_detail(sp)

        # ── 2. Find a "ready to scan" application ─────────────────────────────
        # Case A: IN_REVIEW, current_step is the final SECURITY step, all
        #         preceding steps are APPROVED/SKIPPED.
        # Case B: Already APPROVED via the inbox but gate scan not yet recorded.
        ready_app = None
        ready_flow = None
        blocking_app = None
        blocking_flow = None

        pending_qs = app_models.Application.objects.filter(
            student_profile=sp,
            current_state__in=['SUBMITTED', 'IN_REVIEW'],
            gatepass_scanned_at__isnull=True,
        ).select_related('application_type', 'current_step__role', 'current_step')

        for app in pending_qs:
            flow = _get_flow_for_application(app)
            if not flow:
                continue
            final_step = flow.steps.filter(is_final=True).select_related('role').first()
            if not (final_step and final_step.role and final_step.role.name.upper() == 'SECURITY'):
                continue  # Not a gatepass-type flow

            steps = list(flow.steps.select_related('role').order_by('order'))
            actions = {a.step_id: a.action for a in app.actions.all()}

            blocking_here = None
            starter_step = steps[0] if steps else None
            for step in steps:
                if step.is_final and step.role and step.role.name.upper() == 'SECURITY':
                    break  # Security step itself — expected to be pending
                act = actions.get(step.id)
                if step == starter_step:
                    # Starter step only needs any action (SUBMITTED counts)
                    if not act:
                        blocking_here = step
                        break
                else:
                    if not act or act not in ('APPROVED', 'SKIPPED'):
                        blocking_here = step
                        break

            if blocking_here is None:
                ready_app = app
                ready_flow = flow
                break
            elif blocking_app is None:
                blocking_app = app
                blocking_flow = flow

        # Case B: already fully approved via inbox, physical scan pending
        if ready_app is None:
            for app in app_models.Application.objects.filter(
                student_profile=sp,
                current_state='APPROVED',
                gatepass_scanned_at__isnull=True,
            ).select_related('application_type'):
                flow = _get_flow_for_application(app)
                if not flow:
                    continue
                final_step = flow.steps.filter(is_final=True).select_related('role').first()
                if final_step and final_step.role and final_step.role.name.upper() == 'SECURITY':
                    ready_app = app
                    ready_flow = flow
                    break

        # ── 3. Process ready app ──────────────────────────────────────────────
        if ready_app is not None:
            now = timezone.now()
            with transaction.atomic():
                locked = app_models.Application.objects.select_for_update().get(pk=ready_app.pk)

                if locked.current_state in ('SUBMITTED', 'IN_REVIEW'):
                    security_step = locked.current_step
                    if security_step:
                        already = app_models.ApprovalAction.objects.filter(
                            application=locked,
                            step=security_step,
                            action=app_models.ApprovalAction.Action.APPROVED,
                        ).exists()
                        if not already:
                            app_models.ApprovalAction.objects.create(
                                application=locked,
                                step=security_step,
                                acted_by=request.user,
                                action=app_models.ApprovalAction.Action.APPROVED,
                                remarks='Approved by RFID gatepass scan',
                            )
                    application_state.approve_application(locked)
                    locked.refresh_from_db()

                locked.gatepass_scanned_at = now
                locked.gatepass_scanned_by = request.user
                locked.save(update_fields=['gatepass_scanned_at', 'gatepass_scanned_by'])

            ready_app.refresh_from_db()
            timeline = _build_timeline(ready_app, ready_flow)
            return Response({
                'allowed': True,
                'message': 'You may leave the college.',
                'application_id': ready_app.id,
                'application_type': ready_app.application_type.name,
                'scanned_at': now.isoformat(),
                'student': student_data,
                'approval_timeline': timeline,
            }, status=status.HTTP_200_OK)

        # ── 4. Application found but preceding steps still blocking ───────────
        if blocking_app is not None:
            timeline = _build_timeline(blocking_app, blocking_flow)
            steps = list(blocking_flow.steps.select_related('role').order_by('order'))
            actions = {a.step_id: a.action for a in blocking_app.actions.all()}
            blocking_step = None
            starter_step_b = steps[0] if steps else None
            for step in steps:
                if step.is_final and step.role and step.role.name.upper() == 'SECURITY':
                    break
                act = actions.get(step.id)
                if step == starter_step_b:
                    if not act:
                        blocking_step = step
                        break
                else:
                    if not act or act not in ('APPROVED', 'SKIPPED'):
                        blocking_step = step
                        break
            msg = f'Application #{blocking_app.id} is not fully approved yet'
            if blocking_step:
                msg += f' — step {blocking_step.order} ({blocking_step.role.name}) is pending'
            return Response({
                'allowed': False,
                'reason': 'not_fully_approved',
                'message': msg + '.',
                'student': student_data,
                'application_id': blocking_app.id,
                'approval_timeline': timeline,
            }, status=status.HTTP_200_OK)

        # ── 5. Already gate-scanned ───────────────────────────────────────────────
        already_scanned = app_models.Application.objects.filter(
            student_profile=sp,
            gatepass_scanned_at__isnull=False,
        ).order_by('-gatepass_scanned_at').first()

        if already_scanned:
            flow = _get_flow_for_application(already_scanned)
            # Only show "already exited" while the SLA window is still open.
            # Once sla_hours have elapsed since the exit scan, the gatepass has
            # expired — treat the student as having no current gatepass so they
            # can apply for a new one (fall through to no_gatepass).
            sla_still_open = True
            if flow and flow.sla_hours:
                from datetime import timedelta
                sla_expiry = already_scanned.gatepass_scanned_at + timedelta(hours=flow.sla_hours)
                if timezone.now() >= sla_expiry:
                    sla_still_open = False

            if sla_still_open:
                timeline = _build_timeline(already_scanned, flow) if flow else []
                return Response({
                    'allowed': False,
                    'reason': 'already_scanned',
                    'message': 'Student already exited at ' + already_scanned.gatepass_scanned_at.strftime('%I:%M %p') + '.',
                    'student': student_data,
                    'approval_timeline': timeline,
                }, status=status.HTTP_200_OK)
            # SLA expired → fall through to no_gatepass below

        # ── 6. No gatepass application found at all ───────────────────────────
        return Response({
            'allowed': False,
            'reason': 'no_gatepass',
            'message': 'Gatepass not Applied in IDCS',
            'student': student_data,
            'approval_timeline': [],
        }, status=status.HTTP_200_OK)


# ── Staff endpoints ────────────────────────────────────────────────────────────


class SearchStaffView(APIView):
    """GET /api/idscan/search-staff/?q=<query> — search staff by staff_id or name."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 1:
            return Response([])

        qs = StaffProfile.objects.select_related('user', 'department').filter(
            Q(staff_id__icontains=q) |
            Q(user__username__icontains=q) |
            Q(user__first_name__icontains=q) |
            Q(user__last_name__icontains=q)
        ).order_by('staff_id')[:20]

        return Response([_staff_detail(sp) for sp in qs])


class AssignStaffUIDView(APIView):
    """POST /api/idscan/assign-staff-uid/ — assign or re-assign a UID to a staff member.

    Body: { staff_id: <int (pk)>, uid: <str> }
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not _has_scan_permission(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        staff_pk = request.data.get('staff_id')
        uid = (request.data.get('uid') or '').strip().upper()

        if not staff_pk or not uid:
            return Response({'error': 'staff_id and uid are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicate UID across staff
        conflict_staff = StaffProfile.objects.filter(rfid_uid__iexact=uid).exclude(pk=staff_pk).first()
        if conflict_staff:
            return Response(
                {'error': f'UID {uid} is already assigned to staff {conflict_staff.staff_id}.'},
                status=status.HTTP_409_CONFLICT,
            )

        # Prevent duplicate UID across students
        conflict_student = StudentProfile.objects.filter(rfid_uid__iexact=uid).first()
        if conflict_student:
            return Response(
                {'error': f'UID {uid} is already assigned to student {conflict_student.reg_no}.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            sp = StaffProfile.objects.select_related('user', 'department').get(pk=staff_pk)
        except StaffProfile.DoesNotExist:
            return Response({'error': 'Staff not found'}, status=status.HTTP_404_NOT_FOUND)

        sp.rfid_uid = uid
        sp.save(update_fields=['rfid_uid'])
        return Response({'success': True, 'staff': _staff_detail(sp)})


class UnassignStaffUIDView(APIView):
    """POST /api/idscan/unassign-staff-uid/ — remove the RFID UID from a staff member.

    Body: { staff_id: <int (pk)> }
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not _has_scan_permission(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        staff_pk = request.data.get('staff_id')
        if not staff_pk:
            return Response({'error': 'staff_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sp = StaffProfile.objects.select_related('user', 'department').get(pk=staff_pk)
        except StaffProfile.DoesNotExist:
            return Response({'error': 'Staff not found'}, status=status.HTTP_404_NOT_FOUND)

        sp.rfid_uid = ''
        sp.save(update_fields=['rfid_uid'])
        return Response({'success': True})


class LookupAnyView(APIView):
    """GET /api/idscan/lookup-any/?uid=<UID>

    Resolves an RFID UID against *both* StudentProfile and StaffProfile tables
    and returns whichever record matches first (student takes priority).
    Used by the browser-side WebSerial scanner on TestStudentsPage.
    """
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        uid = (request.query_params.get('uid') or '').strip().upper()
        if not uid:
            return Response({'error': 'uid parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        # Try student first
        try:
            sp = StudentProfile.objects.select_related(
                'user', 'section__batch__course__department', 'home_department'
            ).get(rfid_uid__iexact=uid)
            return Response({
                'found': True,
                'uid': uid,
                'profile_type': 'student',
                'profile': _student_detail(sp),
            })
        except StudentProfile.DoesNotExist:
            pass

        # Try staff
        try:
            staff = StaffProfile.objects.select_related('user', 'department').get(rfid_uid__iexact=uid)
            return Response({
                'found': True,
                'uid': uid,
                'profile_type': 'staff',
                'profile': _staff_detail(staff),
            })
        except StaffProfile.DoesNotExist:
            pass

        return Response({'found': False, 'uid': uid, 'profile_type': None, 'profile': None})
