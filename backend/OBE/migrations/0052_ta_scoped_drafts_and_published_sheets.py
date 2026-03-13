from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0003_teachingassignment'),
        ('OBE', '0051_co_target_revision'),
    ]

    operations = [
        migrations.AddField(
            model_name='assessmentdraft',
            name='teaching_assignment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='obe_drafts', to='academics.teachingassignment'),
        ),
        migrations.RemoveConstraint(
            model_name='assessmentdraft',
            name='unique_obe_draft_per_subject_assessment',
        ),
        migrations.AddConstraint(
            model_name='assessmentdraft',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', False)), fields=('subject', 'assessment', 'teaching_assignment'), name='unique_obe_draft_per_subject_assessment_ta'),
        ),
        migrations.AddConstraint(
            model_name='assessmentdraft',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', True)), fields=('subject', 'assessment'), name='unique_obe_draft_per_subject_assessment_legacy'),
        ),
        migrations.AlterField(
            model_name='cia1publishedsheet',
            name='subject',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cia1_published_sheet', to='academics.subject'),
        ),
        migrations.AddField(
            model_name='cia1publishedsheet',
            name='teaching_assignment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cia1_published_sheets', to='academics.teachingassignment'),
        ),
        migrations.AddConstraint(
            model_name='cia1publishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', False)), fields=('subject', 'teaching_assignment'), name='unique_cia1_published_sheet_subject_ta'),
        ),
        migrations.AddConstraint(
            model_name='cia1publishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', True)), fields=('subject',), name='unique_cia1_published_sheet_subject_legacy'),
        ),
        migrations.AlterField(
            model_name='cia2publishedsheet',
            name='subject',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cia2_published_sheet', to='academics.subject'),
        ),
        migrations.AddField(
            model_name='cia2publishedsheet',
            name='teaching_assignment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cia2_published_sheets', to='academics.teachingassignment'),
        ),
        migrations.AddConstraint(
            model_name='cia2publishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', False)), fields=('subject', 'teaching_assignment'), name='unique_cia2_published_sheet_subject_ta'),
        ),
        migrations.AddConstraint(
            model_name='cia2publishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', True)), fields=('subject',), name='unique_cia2_published_sheet_subject_legacy'),
        ),
        migrations.AlterField(
            model_name='modelpublishedsheet',
            name='subject',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='model_published_sheet', to='academics.subject'),
        ),
        migrations.AddField(
            model_name='modelpublishedsheet',
            name='teaching_assignment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='model_published_sheets', to='academics.teachingassignment'),
        ),
        migrations.AddConstraint(
            model_name='modelpublishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', False)), fields=('subject', 'teaching_assignment'), name='unique_model_published_sheet_subject_ta'),
        ),
        migrations.AddConstraint(
            model_name='modelpublishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', True)), fields=('subject',), name='unique_model_published_sheet_subject_legacy'),
        ),
        migrations.AddField(
            model_name='labpublishedsheet',
            name='teaching_assignment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='lab_published_sheets', to='academics.teachingassignment'),
        ),
        migrations.RemoveConstraint(
            model_name='labpublishedsheet',
            name='unique_lab_published_sheet_per_subject_assessment',
        ),
        migrations.AddConstraint(
            model_name='labpublishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', False)), fields=('subject', 'assessment', 'teaching_assignment'), name='unique_lab_published_sheet_per_subject_assessment_ta'),
        ),
        migrations.AddConstraint(
            model_name='labpublishedsheet',
            constraint=models.UniqueConstraint(condition=Q(('teaching_assignment__isnull', True)), fields=('subject', 'assessment'), name='unique_lab_published_sheet_per_subject_assessment_legacy'),
        ),
    ]