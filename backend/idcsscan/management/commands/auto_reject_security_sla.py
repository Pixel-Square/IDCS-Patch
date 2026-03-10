"""
Management command: auto_reject_security_sla

Finds all IN_REVIEW applications where:
  - The current pending step is the FINAL step assigned to the SECURITY role
  - The flow has an SLA (sla_hours) configured
  - submitted_at + sla_hours is in the past (deadline exceeded)
  - gatepass_scanned_at is null (gate never scanned)

For each matching application the command:
  1. Records a REJECTED ApprovalAction (acted_by=None, system auto-reject)
  2. Transitions the application state to REJECTED

The REJECTED action will appear in the application's timeline for all
escalation roles to see in their inbox / history views.

Usage:
  python manage.py auto_reject_security_sla [--dry-run]

Intended to be run periodically via cron / Celery beat, e.g. every 5 minutes.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from applications import models as app_models
from applications.services import application_state
from applications.services.approval_engine import _get_flow_for_application


class Command(BaseCommand):
    help = 'Auto-reject gatepass applications whose security-scan SLA has expired'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Print what would be rejected without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        now = timezone.now()
        rejected = 0
        skipped = 0
        errors = 0

        candidates = app_models.Application.objects.filter(
            current_state__in=['SUBMITTED', 'IN_REVIEW'],
            gatepass_scanned_at__isnull=True,
        ).select_related(
            'application_type',
            'current_step__role',
            'student_profile__user',
        )

        for app in candidates:
            current_step = app.current_step
            # Must be waiting at the final SECURITY step
            if not current_step:
                skipped += 1
                continue
            if not (current_step.is_final
                    and current_step.role
                    and current_step.role.name.upper() == 'SECURITY'):
                skipped += 1
                continue

            flow = _get_flow_for_application(app)
            if not flow or not flow.sla_hours:
                skipped += 1
                continue

            if not app.submitted_at:
                skipped += 1
                continue

            deadline = app.submitted_at + timedelta(hours=flow.sla_hours)
            if deadline > now:
                skipped += 1
                continue

            # SLA exceeded — log and optionally reject
            label = (
                f"App #{app.id} ({app.application_type}) "
                f"| student: {getattr(app.student_profile, 'reg_no', '?')} "
                f"| deadline was {deadline.strftime('%Y-%m-%d %H:%M')}"
            )

            if dry_run:
                self.stdout.write(self.style.WARNING(f'[DRY-RUN] Would reject: {label}'))
                rejected += 1
                continue

            try:
                with transaction.atomic():
                    locked = app_models.Application.objects.select_for_update().get(pk=app.pk)

                    # Re-validate inside the lock
                    if locked.current_state not in ('SUBMITTED', 'IN_REVIEW'):
                        skipped += 1
                        continue
                    if locked.current_step_id != current_step.id:
                        skipped += 1
                        continue

                    app_models.ApprovalAction.objects.create(
                        application=locked,
                        step=current_step,
                        acted_by=None,
                        action=app_models.ApprovalAction.Action.REJECTED,
                        remarks=(
                            f'Auto-rejected: SLA of {flow.sla_hours}h exceeded. '
                            f'Gate scan not performed by deadline {deadline.strftime("%Y-%m-%d %H:%M")}.'
                        ),
                    )
                    application_state.reject_application(locked, rejected_by=None)

                self.stdout.write(self.style.WARNING(f'Rejected: {label}'))
                rejected += 1

            except Exception as exc:
                self.stdout.write(self.style.ERROR(f'Error rejecting {label}: {exc}'))
                errors += 1

        summary = f'Done — rejected: {rejected}, skipped: {skipped}, errors: {errors}'
        if dry_run:
            summary = f'[DRY-RUN] {summary}'
        self.stdout.write(self.style.SUCCESS(summary))
