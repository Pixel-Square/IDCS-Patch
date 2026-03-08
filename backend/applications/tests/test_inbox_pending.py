from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.models import Role
from applications import models as app_models
from applications.services import approval_engine
from applications.services import inbox_service


class InboxPendingApprovalsTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='approver')
        self.applicant = User.objects.create_user(username='applicant')

        self.role_staff = Role.objects.create(name='STAFF')
        self.role_other = Role.objects.create(name='OTHER')
        self.user.roles.add(self.role_staff)

        self.at = app_models.ApplicationType.objects.create(name='A', code='A')

        # Active flow expects OTHER (not STAFF)
        self.flow_active = app_models.ApprovalFlow.objects.create(application_type=self.at, is_active=True)
        self.step_active = app_models.ApprovalStep.objects.create(
            approval_flow=self.flow_active,
            order=1,
            role=self.role_other,
            sla_hours=24,
        )

        # Inactive flow has STAFF (should not grant eligibility)
        self.flow_inactive = app_models.ApprovalFlow.objects.create(application_type=self.at, is_active=False)
        self.step_inactive = app_models.ApprovalStep.objects.create(
            approval_flow=self.flow_inactive,
            order=1,
            role=self.role_staff,
            sla_hours=24,
        )

        self.app = app_models.Application.objects.create(
            application_type=self.at,
            applicant_user=self.applicant,
            current_state=app_models.Application.ApplicationState.IN_REVIEW,
            current_step=self.step_inactive,
        )

    def test_get_current_step_ignores_inactive_flow_step(self):
        step = approval_engine.get_current_approval_step(self.app)
        self.assertIsNotNone(step)
        self.assertEqual(step.id, self.step_active.id)

    def test_inbox_does_not_include_due_to_stale_step_role(self):
        items = inbox_service.get_pending_approvals_for_user(self.user)
        self.assertEqual([a.id for a in items], [])
