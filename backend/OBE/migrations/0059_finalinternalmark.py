# Generated manually for FinalInternalMark model.

from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0081_remove_organisation_from_ext_staff'),
        ('OBE', '0058_rename_obe_batch_q_batch_i_9e8b71_idx_obe_batch_q_batch_i_d7999f_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='FinalInternalMark',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('final_mark', models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('max_mark', models.DecimalField(decimal_places=2, default=40, max_digits=6)),
                ('computed_from', models.CharField(blank=True, default='SYSTEM', max_length=32)),
                ('computed_by', models.IntegerField(blank=True, null=True)),
                ('computed_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'student',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='final_internal_marks',
                        to='academics.studentprofile',
                    ),
                ),
                (
                    'subject',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='final_internal_marks',
                        to='academics.subject',
                    ),
                ),
                (
                    'teaching_assignment',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='final_internal_marks',
                        to='academics.teachingassignment',
                    ),
                ),
            ],
            options={
                'db_table': 'obe_final_internal_mark',
                'indexes': [
                    models.Index(fields=['subject', 'student'], name='obe_final_i_subject_8c1d53_idx'),
                    models.Index(fields=['teaching_assignment', 'student'], name='obe_final_i_teachin_b6f785_idx'),
                    models.Index(fields=['computed_at'], name='obe_final_i_compute_a8e65f_idx'),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='finalinternalmark',
            constraint=models.UniqueConstraint(
                condition=Q(('teaching_assignment__isnull', False)),
                fields=('subject', 'student', 'teaching_assignment'),
                name='unique_final_internal_mark_subject_student_ta',
            ),
        ),
        migrations.AddConstraint(
            model_name='finalinternalmark',
            constraint=models.UniqueConstraint(
                condition=Q(('teaching_assignment__isnull', True)),
                fields=('subject', 'student'),
                name='unique_final_internal_mark_subject_student_legacy',
            ),
        ),
    ]
