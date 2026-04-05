from django.db import migrations, models
import secrets


def _generate_unique_internal_id(StaffProfile):
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for _ in range(200):
        candidate = ''.join(secrets.choice(alphabet) for _ in range(7))
        if not StaffProfile.objects.filter(internal_id=candidate).exists():
            return candidate
    return None


def backfill_internal_ids(apps, schema_editor):
    StaffProfile = apps.get_model('academics', 'StaffProfile')
    qs = StaffProfile.objects.filter(internal_id__isnull=True)
    for staff in qs.iterator():
        value = _generate_unique_internal_id(StaffProfile)
        if not value:
            # Skip hard-fail to keep migration resilient in constrained environments.
            continue
        staff.internal_id = value
        staff.save(update_fields=['internal_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0081_remove_organisation_from_ext_staff'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffprofile',
            name='internal_id',
            field=models.CharField(blank=True, db_index=True, max_length=16, null=True, unique=True),
        ),
        migrations.RunPython(backfill_internal_ids, migrations.RunPython.noop),
    ]
