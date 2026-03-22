from django.db import migrations, models
import django.db.models.deletion


def backfill_subject_batch_section(apps, schema_editor):
    """Best-effort: set StudentSubjectBatch.section when all its students share one section."""
    StudentSubjectBatch = apps.get_model('academics', 'StudentSubjectBatch')
    StudentProfile = apps.get_model('academics', 'StudentProfile')

    # Section model exists but we can assign via *_id.
    qs = StudentSubjectBatch.objects.filter(section__isnull=True)
    for batch in qs.iterator():
        try:
            section_ids = list(
                StudentProfile.objects.filter(subject_batches=batch)
                .exclude(section_id__isnull=True)
                .values_list('section_id', flat=True)
                .distinct()
            )
            if len(section_ids) == 1:
                batch.section_id = int(section_ids[0])
                batch.save(update_fields=['section'])
        except Exception:
            # Keep migration resilient; do not fail the whole migration.
            continue


def noop_reverse(apps, schema_editor):
    # We don't unset section on reverse.
    return


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0070_alter_studentcourseenrollment_course_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentsubjectbatch',
            name='section',
            field=models.ForeignKey(
                blank=True,
                help_text='Section this subject batch belongs to (used to prevent cross-section leakage).',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='subject_batches',
                to='academics.section',
            ),
        ),
        migrations.RunPython(backfill_subject_batch_section, reverse_code=noop_reverse),
    ]
