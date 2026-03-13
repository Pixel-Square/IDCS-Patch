from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import RFReaderGate, RFReaderStudent, RFReaderScan
from .permissions import IsIQAC
from .rfreader_serializers import RFReaderGateSerializer, RFReaderStudentSerializer, RFReaderScanSerializer


def _resolve_uid_profile(uid: str) -> dict:
    """Cross-reference a scanned UID against StudentProfile and StaffProfile.

    Returns a dict with keys:
      profile_type: 'student' | 'staff' | None
      profile:      serialised profile dict or None
    """
    if not uid:
        return {'profile_type': None, 'profile': None}

    # Import here to avoid circular-import issues at module load
    from academics.models import StudentProfile, StaffProfile

    # ── Try StudentProfile ──────────────────────────────────────────────────
    try:
        sp = StudentProfile.objects.select_related(
            'user', 'section__batch__course__department', 'home_department'
        ).get(rfid_uid__iexact=uid)
        user = sp.user
        full_name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()

        # Resolve department: home_department > section chain
        department = None
        if sp.home_department:
            department = sp.home_department.name
        elif sp.section and getattr(sp.section, 'batch', None):
            try:
                department = sp.section.batch.course.department.name
            except AttributeError:
                pass

        return {
            'profile_type': 'student',
            'profile': {
                'id': sp.pk,
                'reg_no': sp.reg_no,
                'name': full_name or user.username,
                'section': sp.section.name if sp.section else None,
                'batch': str(sp.section.batch) if sp.section and getattr(sp.section, 'batch', None) else None,
                'department': department,
                'status': sp.status,
            },
        }
    except StudentProfile.DoesNotExist:
        pass

    # ── Try StaffProfile ────────────────────────────────────────────────────
    try:
        staff = StaffProfile.objects.select_related('user', 'department').get(rfid_uid__iexact=uid)
        user = staff.user
        full_name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
        dept = getattr(staff, 'current_department', None) or staff.department
        return {
            'profile_type': 'staff',
            'profile': {
                'id': staff.pk,
                'staff_id': staff.staff_id,
                'name': full_name or user.username,
                'department': dept.name if dept else None,
                'designation': staff.designation,
                'status': staff.status,
            },
        }
    except StaffProfile.DoesNotExist:
        pass

    return {'profile_type': None, 'profile': None}


class RFReaderGateListCreateView(generics.ListCreateAPIView):
    queryset = RFReaderGate.objects.all()
    serializer_class = RFReaderGateSerializer
    permission_classes = [IsAuthenticated, IsIQAC]


class RFReaderStudentListCreateView(generics.ListCreateAPIView):
    queryset = RFReaderStudent.objects.all()
    serializer_class = RFReaderStudentSerializer
    permission_classes = [IsAuthenticated, IsIQAC]


class RFReaderLastScanView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsIQAC]

    def get(self, request, *args, **kwargs):
        scan = RFReaderScan.objects.select_related('gate', 'student').order_by('-scanned_at').first()
        if not scan:
            return Response({
                'scan_id': None,
                'scanned_at': None,
                'uid': None,
                'roll_no': None,
                'name': None,
                'impres_code': None,
                'gate': None,
                'profile_type': None,
                'profile': None,
            })

        data = RFReaderScanSerializer(scan).data
        student = data.get('student') or {}
        uid = data.get('uid') or ''
        profile_info = _resolve_uid_profile(uid)

        return Response({
            'scan_id': data.get('id'),
            'scanned_at': data.get('scanned_at'),
            'uid': uid,
            'roll_no': student.get('roll_no'),
            'name': student.get('name'),
            'impres_code': student.get('impres_code'),
            'gate': data.get('gate'),
            'profile_type': profile_info['profile_type'],
            'profile': profile_info['profile'],
        })
