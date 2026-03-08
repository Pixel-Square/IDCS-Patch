from typing import Dict
from django.utils import timezone
from rest_framework import serializers

from applications import models as app_models
from applications.services import approval_engine
from applications.services import application_state
from applications.serializers.approval import ApprovalActionSerializer


def _display_name(user) -> str | None:
    """Return the best display name for a user: full name, else username."""
    if user is None:
        return None
    full = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return full if full else getattr(user, 'username', None)


class ApplicationCreateSerializer(serializers.Serializer):
    application_type = serializers.PrimaryKeyRelatedField(queryset=app_models.ApplicationType.objects.filter(is_active=True))
    data = serializers.DictField(child=serializers.JSONField(), allow_empty=False)

    def validate(self, attrs):
        app_type = attrs['application_type']
        provided_keys = set(attrs['data'].keys())

        # Load expected fields for the application type
        fields_qs = app_models.ApplicationField.objects.filter(application_type=app_type)
        expected_keys = set(f.field_key for f in fields_qs)

        # Required fields must be present
        required_keys = set(f.field_key for f in fields_qs if f.is_required)
        missing = required_keys - provided_keys
        if missing:
            raise serializers.ValidationError({
                'data': f'Missing required fields: {", ".join(sorted(missing))}'
            })

        # Ensure no unknown keys provided
        unknown = provided_keys - expected_keys
        if unknown:
            raise serializers.ValidationError({
                'data': f'Unknown field keys for this application type: {", ".join(sorted(unknown))}'
            })

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            raise serializers.ValidationError('Authentication required to create application')

        student_profile = None
        staff_profile = None
        try:
            student_profile = getattr(user, 'student_profile', None)
        except Exception:
            student_profile = None
        try:
            staff_profile = getattr(user, 'staff_profile', None)
        except Exception:
            staff_profile = None

        if student_profile is not None and not getattr(student_profile, 'pk', None):
            student_profile = None
        if staff_profile is not None and not getattr(staff_profile, 'pk', None):
            staff_profile = None

        app_type = validated_data['application_type']
        data: Dict = validated_data['data']

        application = app_models.Application.objects.create(
            application_type=app_type,
            applicant_user=user,
            student_profile=student_profile,
            staff_profile=staff_profile,
            current_state=app_models.Application.ApplicationState.DRAFT,
            status=app_models.Application.ApplicationState.DRAFT,
        )

        # Persist ApplicationData rows
        fields_map = {f.field_key: f for f in app_models.ApplicationField.objects.filter(application_type=app_type)}
        rows = []
        for key, val in data.items():
            field = fields_map.get(key)
            if not field:
                continue
            rows.append(app_models.ApplicationData(application=application, field=field, value=val))

        app_models.ApplicationData.objects.bulk_create(rows)

        # Submit via canonical state transition (binds form version + flow step)
        application = application_state.submit_application(application, user)

        return application


class ApplicationListSerializer(serializers.ModelSerializer):
    application_type_name = serializers.SerializerMethodField()
    current_step_role = serializers.SerializerMethodField()

    class Meta:
        model = app_models.Application
        fields = ('id', 'application_type_name', 'current_state', 'status', 'submitted_at', 'created_at', 'current_step_role')

    def get_application_type_name(self, obj):
        return obj.application_type.name if obj.application_type else None

    def get_current_step_role(self, obj):
        step = approval_engine.get_current_approval_step(obj)
        return step.role.name if step and step.role else None


class ApplicationDetailSerializer(serializers.ModelSerializer):
    application_type = serializers.SerializerMethodField()
    dynamic_fields = serializers.SerializerMethodField()
    current_step = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()
    approval_timeline = serializers.SerializerMethodField()

    class Meta:
        model = app_models.Application
        fields = ('id', 'application_type', 'current_state', 'status', 'created_at', 'submitted_at', 'dynamic_fields', 'current_step', 'approval_history', 'approval_timeline')

    def get_application_type(self, obj):
        return obj.application_type.name if obj.application_type else None

    def get_dynamic_fields(self, obj):
        # Return list of {label, field_key, value}
        data = []
        qs = obj.data.select_related('field')
        for ad in qs:
            data.append({
                'label': ad.field.label,
                'field_key': ad.field.field_key,
                'value': ad.value,
            })
        return data

    def get_current_step(self, obj):
        step = approval_engine.get_current_approval_step(obj)
        return step.role.name if step and step.role else None

    def get_approval_history(self, obj):
        actions = obj.actions.order_by('acted_at')
        return ApprovalActionSerializer(actions, many=True).data

    def get_approval_timeline(self, obj):
        """Return all flow steps merged with completed actions.

        Each entry has:
          step_order, step_role, is_starter, is_final,
          status (SUBMITTED | APPROVED | REJECTED | SKIPPED | PENDING),
          acted_by (display name or None), acted_at, remarks
        """
        flow = approval_engine._get_flow_for_application(obj)
        if not flow:
            # Fall back to returning just the existing actions when no flow
            result = []
            for idx, action in enumerate(obj.actions.order_by('acted_at').select_related('step__role', 'acted_by')):
                result.append({
                    'step_order': action.step.order if action.step else idx + 1,
                    'step_role': action.step.role.name if action.step and action.step.role else None,
                    'is_starter': idx == 0,
                    'is_final': False,
                    'status': 'SUBMITTED' if idx == 0 else action.action,
                    'acted_by': _display_name(action.acted_by),
                    'acted_at': action.acted_at.isoformat() if action.acted_at else None,
                    'remarks': action.remarks or None,
                })
            return result

        steps = list(flow.steps.select_related('role').order_by('order'))
        if not steps:
            return []

        # Build a map: step_id -> ApprovalAction (latest per step)
        actions_by_step = {}
        for action in obj.actions.order_by('acted_at').select_related('step__role', 'acted_by'):
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
                raw_status = action.action  # APPROVED / REJECTED / SKIPPED
                status = 'SUBMITTED' if is_starter else raw_status
                result.append({
                    'step_order': step.order,
                    'step_role': step.role.name if step.role else None,
                    'is_starter': is_starter,
                    'is_final': is_final,
                    'status': status,
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
