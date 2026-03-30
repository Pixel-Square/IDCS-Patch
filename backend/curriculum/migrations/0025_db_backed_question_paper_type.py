from django.db import migrations, models
import curriculum.models


class Migration(migrations.Migration):

    dependencies = [
        ('curriculum', '0024_alter_questionpapertype_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='curriculummaster',
            name='qp_type',
            field=models.CharField(
                blank=True,
                default='QP1',
                max_length=16,
                null=True,
                validators=[curriculum.models.validate_question_paper_type_code],
            ),
        ),
        migrations.AlterField(
            model_name='curriculumdepartment',
            name='question_paper_type',
            field=models.CharField(
                blank=True,
                default='QP1',
                max_length=64,
                validators=[curriculum.models.validate_question_paper_type_code],
            ),
        ),
        migrations.AlterField(
            model_name='electivesubject',
            name='question_paper_type',
            field=models.CharField(
                blank=True,
                default='QP1',
                max_length=64,
                validators=[curriculum.models.validate_question_paper_type_code],
            ),
        ),
    ]
