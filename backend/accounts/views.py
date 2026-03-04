from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, 
    RegisterSerializer, 
    MeSerializer, 
    IdentifierTokenObtainPairSerializer, 
    NotificationTemplateSerializer,
    UserQuerySerializer,
    UserQueryListSerializer,
)
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from datetime import timedelta
import re
import logging
from django.conf import settings

from .models import MobileOtp, NotificationTemplate, UserQuery, Role
from .services.sms import send_sms, send_whatsapp, verify_otp
from .permissions_api import HasPermissionCode

log = logging.getLogger(__name__)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    # Uses identifier-based serializer (identifier may be email, student reg_no, or staff staff_id)
    serializer_class = IdentifierTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


def _normalize_mobile_number(raw: str) -> str:
    s = str(raw or '').strip()
    if not s:
        return ''
    # keep leading +, strip everything else to digits
    plus = s.startswith('+')
    digits = re.sub(r'[^0-9]', '', s)
    if plus:
        s2 = f'+{digits}'
    else:
        s2 = digits
    # Basic sanity: allow 10-15 digits (E.164-like)
    digits_only = re.sub(r'[^0-9]', '', s2)
    if len(digits_only) < 10 or len(digits_only) > 15:
        return ''
    return s2


def _set_verified_mobile_on_profile(user, mobile_number: str, verified_at):
    """Persist verified mobile number on the attached student/staff profile."""
    if hasattr(user, 'student_profile') and getattr(user, 'student_profile') is not None:
        sp = user.student_profile
        sp.mobile_number = mobile_number
        sp.mobile_number_verified_at = verified_at
        sp.save(update_fields=['mobile_number', 'mobile_number_verified_at'])
        return
    if hasattr(user, 'staff_profile') and getattr(user, 'staff_profile') is not None:
        st = user.staff_profile
        st.mobile_number = mobile_number
        st.mobile_number_verified_at = verified_at
        st.save(update_fields=['mobile_number', 'mobile_number_verified_at'])
        return
    # If no profile, still allow storing on User


class MobileOtpRequestView(APIView):
    # Allow both authenticated and unauthenticated users to request OTP
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        """Proxy OTP request to Node.js WhatsApp service."""
        raw_mobile = (request.data or {}).get('mobile_number')
        mobile = _normalize_mobile_number(raw_mobile)
        if not mobile:
            return Response({'detail': 'Invalid mobile number.'}, status=status.HTTP_400_BAD_REQUEST)

        # Use the Node.js WhatsApp service for OTP
        endpoint = str(getattr(settings, 'OBE_WHATSAPP_API_URL', '') or '').strip()
        api_key = str(getattr(settings, 'OBE_WHATSAPP_API_KEY', '') or '').strip()
        
        if not endpoint:
            return Response({
                'detail': 'WhatsApp OTP service not configured'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # Replace '/send-whatsapp' with '/mobile/request-otp' if needed
        if endpoint.endswith('/send-whatsapp'):
            endpoint = endpoint[:-len('/send-whatsapp')] + '/mobile/request-otp'
        elif not endpoint.endswith('/mobile/request-otp'):
            endpoint = endpoint.rstrip('/') + '/mobile/request-otp'

        payload = {
            'api_key': api_key,
            'mobile_number': mobile,
        }

        try:
            import requests
            timeout = float(getattr(settings, 'OBE_WHATSAPP_TIMEOUT_SECONDS', 15.0) or 15.0)
            response = requests.post(endpoint, json=payload, timeout=timeout)
            
            status_code = response.status_code
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            
            if 200 <= status_code < 300:
                # Optionally store OTP request in database for tracking (if user is authenticated)
                if request.user and request.user.is_authenticated:
                    try:
                        from datetime import timedelta
                        now = timezone.now()
                        expires_in_seconds = data.get('expires_in_seconds', 300)
                        
                        # Create a tracking record (without storing the actual OTP code)
                        otp = MobileOtp(
                            user=request.user,
                            purpose='VERIFY_MOBILE',
                            mobile_number=mobile,
                            expires_at=now + timedelta(seconds=expires_in_seconds),
                        )
                        # Don't store the code since it's managed by Node.js
                        otp.code_hash = ''  # Empty hash
                        otp.save()
                    except Exception as e:
                        log.warning(f'Failed to store OTP tracking record: {e}')
                
                return Response(data, status=status_code)
            else:
                # Forward the error from Node.js
                error_detail = data.get('error', 'Failed to send OTP')
                if 'detail' in data:
                    error_detail = f"{error_detail} - {data['detail']}"
                return Response({'detail': error_detail}, status=status_code)
                
        except requests.exceptions.Timeout:
            return Response({
                'detail': 'WhatsApp service timeout. Please try again.'
            }, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except requests.exceptions.ConnectionError:
            return Response({
                'detail': 'Cannot connect to WhatsApp service. Please try again later.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            log.exception('Failed to request OTP from Node.js service')
            return Response({
                'detail': f'Failed to send OTP: {str(e)}'
            }, status=status.HTTP_502_BAD_GATEWAY)


class NotificationTemplateApiView(APIView):
    """List/update notification templates. IQAC-only via notifications.manage."""

    permission_classes = (permissions.IsAuthenticated, HasPermissionCode)
    required_permission_code = 'notifications.manage'

    def get(self, request):
        qs = NotificationTemplate.objects.all().order_by('code')
        return Response({'templates': NotificationTemplateSerializer(qs, many=True).data})

    def put(self, request):
        payload = request.data or {}
        templates = payload.get('templates')
        if not isinstance(templates, list):
            return Response({'detail': 'templates must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        updated = []
        for row in templates:
            if not isinstance(row, dict):
                continue
            code = str(row.get('code') or '').strip()
            if not code:
                continue
            obj, _ = NotificationTemplate.objects.get_or_create(
                code=code,
                defaults={'name': code, 'template': '', 'enabled': False},
            )

            # update allowed fields
            if 'name' in row:
                obj.name = str(row.get('name') or '').strip() or obj.name
            if 'template' in row:
                obj.template = str(row.get('template') or '')
            if 'enabled' in row:
                obj.enabled = bool(row.get('enabled'))
            if 'expiry_minutes' in row:
                exp = row.get('expiry_minutes')
                if exp in (None, ''):
                    obj.expiry_minutes = None
                else:
                    try:
                        obj.expiry_minutes = int(exp)
                    except Exception:
                        pass

            obj.save()
            updated.append(obj)

        return Response({'ok': True, 'templates': NotificationTemplateSerializer(updated, many=True).data})


class MobileOtpVerifyView(APIView):
    # Require authentication for verification to link the verified mobile to user account
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        """Proxy OTP verification to Node.js WhatsApp service and update user profile."""
        raw_mobile = (request.data or {}).get('mobile_number')
        code = str((request.data or {}).get('otp') or '').strip()

        mobile = _normalize_mobile_number(raw_mobile)
        if not mobile:
            return Response({'detail': 'Invalid mobile number.'}, status=status.HTTP_400_BAD_REQUEST)
        if not code:
            return Response({'detail': 'OTP is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Use the Node.js WhatsApp service for OTP verification
        endpoint = str(getattr(settings, 'OBE_WHATSAPP_API_URL', '') or '').strip()
        api_key = str(getattr(settings, 'OBE_WHATSAPP_API_KEY', '') or '').strip()
        
        if not endpoint:
            return Response({
                'detail': 'WhatsApp OTP service not configured'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # Replace '/send-whatsapp' with '/mobile/verify-otp' if needed
        if endpoint.endswith('/send-whatsapp'):
            endpoint = endpoint[:-len('/send-whatsapp')] + '/mobile/verify-otp'
        elif not endpoint.endswith('/mobile/verify-otp'):
            endpoint = endpoint.rstrip('/') + '/mobile/verify-otp'

        payload = {
            'api_key': api_key,
            'mobile_number': mobile,
            'otp': code,
        }

        try:
            import requests
            timeout = float(getattr(settings, 'OBE_WHATSAPP_TIMEOUT_SECONDS', 15.0) or 15.0)
            response = requests.post(endpoint, json=payload, timeout=timeout)
            
            status_code = response.status_code
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            
            if 200 <= status_code < 300:
                # OTP verified successfully by Node.js service
                # Now update the user's profile with the verified mobile number
                now = timezone.now()
                
                # Persist to profile (student/staff) and also mirror to User.mobile_no
                _set_verified_mobile_on_profile(request.user, mobile, now)
                try:
                    request.user.mobile_no = mobile
                    request.user.save(update_fields=['mobile_no'])
                except Exception as e:
                    log.warning(f'Failed to save mobile_no to User: {e}')

                # Mark OTP as verified in database if it exists
                try:
                    otp = (
                        MobileOtp.objects.filter(
                            user=request.user,
                            purpose='VERIFY_MOBILE',
                            mobile_number=mobile,
                            verified_at__isnull=True,
                        )
                        .order_by('-created_at')
                        .first()
                    )
                    if otp:
                        otp.verified_at = now
                        otp.save(update_fields=['verified_at'])
                        
                        # Cleanup older OTP rows for this mobile
                        MobileOtp.objects.filter(
                            user=request.user,
                            purpose='VERIFY_MOBILE',
                            mobile_number=mobile
                        ).exclude(pk=otp.pk).delete()
                except Exception as e:
                    log.warning(f'Failed to update OTP tracking record: {e}')

                # Send WhatsApp confirmation (optional, best-effort)
                try:
                    template_text = (
                        'IDCS: Your mobile number {mobile} has been verified successfully. '
                        'You now have access to your Academic Panel. Thank you.'
                    )
                    try:
                        tpl = NotificationTemplate.objects.filter(code='mobile_verified', enabled=True).first()
                        if tpl and str(getattr(tpl, 'template', '') or '').strip():
                            template_text = str(tpl.template)
                    except Exception:
                        pass

                    full_name = ''
                    try:
                        full_name = str(getattr(request.user, 'get_full_name', lambda: '')() or '').strip()
                    except Exception:
                        pass

                    ctx = {
                        '{mobile}': str(mobile),
                        '{username}': str(getattr(request.user, 'username', '') or ''),
                        '{name}': full_name or str(getattr(request.user, 'username', '') or ''),
                    }
                    confirmation_message = str(template_text)
                    for k, v in ctx.items():
                        confirmation_message = confirmation_message.replace(k, v)
                    
                    # Send confirmation via WhatsApp
                    send_whatsapp(mobile, confirmation_message)
                except Exception as e:
                    log.warning(f'Failed to send WhatsApp confirmation: {e}')

                # Return success with updated user info
                from .serializers import MeSerializer
                me_data = MeSerializer(request.user).data
                
                return Response({
                    'ok': True,
                    'mobile_verified': True,
                    'mobile_number': mobile,
                    'me': me_data,
                }, status=status.HTTP_200_OK)
            else:
                # Forward the error from Node.js
                error_detail = data.get('error', 'Failed to verify OTP')
                if 'detail' in data:
                    error_detail = f"{error_detail}: {data['detail']}"
                return Response({'detail': error_detail}, status=status_code)
                
        except requests.exceptions.Timeout:
            return Response({
                'detail': 'WhatsApp service timeout. Please try again.'
            }, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except requests.exceptions.ConnectionError:
            return Response({
                'detail': 'Cannot connect to WhatsApp service. Please try again later.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            log.exception('Failed to verify OTP with Node.js service')
            return Response({
                'detail': f'Failed to verify OTP: {str(e)}'
            }, status=status.HTTP_502_BAD_GATEWAY)


class MobileRemoveView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        password = str((request.data or {}).get('password') or '').strip()
        if not password:
            return Response({'detail': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify password
        if not request.user.check_password(password):
            return Response({'detail': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        # Remove mobile from profile
        if hasattr(request.user, 'student_profile') and getattr(request.user, 'student_profile') is not None:
            sp = request.user.student_profile
            sp.mobile_number = ''
            sp.mobile_number_verified_at = None
            sp.save(update_fields=['mobile_number', 'mobile_number_verified_at'])
        elif hasattr(request.user, 'staff_profile') and getattr(request.user, 'staff_profile') is not None:
            st = request.user.staff_profile
            st.mobile_number = ''
            st.mobile_number_verified_at = None
            st.save(update_fields=['mobile_number', 'mobile_number_verified_at'])

        # Also clear from User.mobile_no if present
        try:
            request.user.mobile_no = ''
            request.user.save(update_fields=['mobile_no'])
        except Exception:
            pass

        # Return updated me payload
        serializer = MeSerializer(request.user)
        return Response({'ok': True, 'me': serializer.data})


class ChangePasswordView(APIView):
    """Allow authenticated users to change their password."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        current_password = str((request.data or {}).get('current_password') or '').strip()
        new_password = str((request.data or {}).get('new_password') or '').strip()
        confirm_password = str((request.data or {}).get('confirm_password') or '').strip()

        # Validate required fields
        if not current_password:
            return Response({'detail': 'Current password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({'detail': 'New password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not confirm_password:
            return Response({'detail': 'Please confirm your new password.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify current password
        if not request.user.check_password(current_password):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate new password matches confirmation
        if new_password != confirm_password:
            return Response({'detail': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate new password is different from current
        if current_password == new_password:
            return Response({'detail': 'New password must be different from current password.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength (minimum 6 characters)
        if len(new_password) < 6:
            return Response({'detail': 'New password must be at least 6 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        # Set new password
        request.user.set_password(new_password)
        request.user.save()

        return Response({'ok': True, 'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class ProfileUpdateView(APIView):
    """Allow authenticated users to update their profile information (name, email, username)."""
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request):
        user = request.user
        
        # Extract fields that can be updated
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        username = request.data.get('username')
        
        # Update user fields if provided
        updated = False
        
        if first_name is not None:
            user.first_name = str(first_name).strip()
            updated = True
            
        if last_name is not None:
            user.last_name = str(last_name).strip()
            updated = True
            
        if email is not None:
            user.email = str(email).strip()
            updated = True
        
        if username is not None:
            new_username = str(username).strip()
            if not new_username:
                return Response({'detail': 'Username cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if username is already taken by another user
            User = get_user_model()
            if User.objects.filter(username=new_username).exclude(pk=user.pk).exists():
                return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            
            user.username = new_username
            updated = True
        
        if updated:
            user.save()
            
        # Return updated user data
        serializer = MeSerializer(user)
        return Response({'ok': True, 'user': serializer.data}, status=status.HTTP_200_OK)


class UserQueryListCreateView(APIView):
    """List all queries for the current user or create a new query."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        """Get all queries for the current user."""
        queries = UserQuery.objects.filter(user=request.user).order_by('-created_at')
        serializer = UserQueryListSerializer(queries, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Create a new query."""
        serializer = UserQuerySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserQueryDetailView(APIView):
    """Retrieve a specific query by ID."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        """Get a specific query for the current user."""
        try:
            query = UserQuery.objects.get(pk=pk, user=request.user)
            serializer = UserQuerySerializer(query)
            return Response(serializer.data)
        except UserQuery.DoesNotExist:
            return Response({'detail': 'Query not found.'}, status=status.HTTP_404_NOT_FOUND)


class AllQueriesListView(APIView):
    """List all queries from all users - for admin/receivers only."""
    permission_classes = (permissions.IsAuthenticated, HasPermissionCode)
    required_permission_code = 'queries.manage'

    def get(self, request):
        """Get all queries with optional status, department, and role filters."""
        status_filter = request.GET.get('status')
        dept_filter = request.GET.get('department')
        role_filter = request.GET.get('role')
        
        queries = UserQuery.objects.select_related('user').prefetch_related(
            'user__user_roles__role',
            'user__staff_profile__department',
            'user__student_profile__section__batch__course__department'
        ).all()
        
        if status_filter:
            queries = queries.filter(status=status_filter)
        
        # Department filter
        if dept_filter:
            from django.db.models import Q
            queries = queries.filter(
                Q(user__staff_profile__department_id=dept_filter) |
                Q(user__student_profile__section__batch__course__department_id=dept_filter)
            )
        
        # Role filter
        if role_filter:
            queries = queries.filter(user__user_roles__role__name=role_filter)
        
        queries = queries.order_by('-created_at').distinct()
        
        # Store count before serialization
        filtered_count = queries.count()
        
        serializer = UserQuerySerializer(queries, many=True)
        
        # Get unique departments and roles for filter options
        from academics.models import Department
        departments = Department.objects.all().order_by('code').values('id', 'code', 'name', 'short_name')
        roles = Role.objects.all().order_by('name').values('id', 'name')
        
        return Response({
            'queries': serializer.data,
            'departments': list(departments),
            'roles': list(roles),
            'total_count': UserQuery.objects.count(),
            'filtered_count': filtered_count
        })


class QueryUpdateView(APIView):
    """Update query status and admin notes - for admin/receivers only."""
    permission_classes = (permissions.IsAuthenticated, HasPermissionCode)
    required_permission_code = 'queries.manage'

    def patch(self, request, pk):
        """Update query status and/or admin notes."""
        try:
            query = UserQuery.objects.get(pk=pk)
        except UserQuery.DoesNotExist:
            return Response({'detail': 'Query not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update allowed fields
        if 'status' in request.data:
            query.status = request.data['status']
        if 'admin_notes' in request.data:
            query.admin_notes = request.data['admin_notes']
        
        query.save()
        serializer = UserQuerySerializer(query)
        return Response(serializer.data)
