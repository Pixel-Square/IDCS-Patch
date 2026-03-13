from django.apps import apps
from django.http import JsonResponse
from django.urls import reverse, NoReverseMatch
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect
from django.contrib.auth import login as auth_login


@staff_member_required
def admin_counts(request):
    """Return a JSON map of admin changelist URL -> object count.

    This endpoint is intended for the admin index dashboard to show
    live counts for each registered model.
    """
    data = {}
    for model in apps.get_models():
        try:
            admin_url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist")
        except NoReverseMatch:
            admin_url = None

        # Attempt to count objects for the model; on error return null
        try:
            count = model.objects.count()
        except Exception:
            count = None

        if admin_url:
            data[admin_url] = count

    return JsonResponse(data)


@csrf_protect
@require_POST
def rfid_admin_login(request):
    """POST /admin/rfid-login/

    Logs a user into the Django admin session by matching a scanned RFID UID
    against StaffProfile.rfid_uid or StudentProfile.rfid_uid.
    Only users with is_staff (or is_superuser) are permitted.

    Body (application/x-www-form-urlencoded or JSON):
        uid   – the raw RFID card UID
        next  – optional redirect URL (defaults to /admin/)
    """
    import json as _json
    from academics.models import StaffProfile, StudentProfile

    # Support both form-encoded and JSON bodies
    uid = ''
    next_url = '/admin/'
    if request.content_type and 'application/json' in request.content_type:
        try:
            payload = _json.loads(request.body)
            uid = (payload.get('uid') or '').strip().upper()
            next_url = payload.get('next') or next_url
        except Exception:
            pass
    else:
        uid = (request.POST.get('uid') or '').strip().upper()
        next_url = request.POST.get('next') or next_url

    if not uid:
        return JsonResponse({'error': 'uid is required'}, status=400)

    user = None

    # 1. Check StaffProfile
    try:
        sp = StaffProfile.objects.select_related('user').get(rfid_uid__iexact=uid)
        user = sp.user
    except StaffProfile.DoesNotExist:
        pass

    # 2. Fallback: check StudentProfile
    if user is None:
        try:
            sp = StudentProfile.objects.select_related('user').get(rfid_uid__iexact=uid)
            user = sp.user
        except StudentProfile.DoesNotExist:
            pass

    if user is None:
        return JsonResponse({'error': 'Card not recognised. This UID is not assigned to any profile.'}, status=401)

    if not user.is_active:
        return JsonResponse({'error': 'Account is disabled.'}, status=403)

    if not (user.is_staff or user.is_superuser):
        return JsonResponse({'error': 'This card does not have admin access.'}, status=403)

    # Establish the admin session
    auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')

    return JsonResponse({'success': True, 'redirect': next_url, 'username': user.get_full_name() or user.username})
