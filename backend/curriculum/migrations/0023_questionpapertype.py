from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('curriculum', '0022_add_is_dept_core'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuestionPaperType',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=32, unique=True)),
                ('label', models.CharField(max_length=64)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Question Paper Type',
                'verbose_name_plural': 'Question Paper Types',
                'ordering': ('sort_order', 'code'),
            },
        ),
        # Seed default QP types
        migrations.RunSQL(
            sql=[
                ("INSERT INTO curriculum_questionpapertype (code, label, is_active, sort_order, created_at, updated_at) VALUES (%s, %s, true, %s, NOW(), NOW()) ON CONFLICT (code) DO NOTHING", ['QP1', 'QP1', 1]),
                ("INSERT INTO curriculum_questionpapertype (code, label, is_active, sort_order, created_at, updated_at) VALUES (%s, %s, true, %s, NOW(), NOW()) ON CONFLICT (code) DO NOTHING", ['QP2', 'QP2', 2]),
                ("INSERT INTO curriculum_questionpapertype (code, label, is_active, sort_order, created_at, updated_at) VALUES (%s, %s, true, %s, NOW(), NOW()) ON CONFLICT (code) DO NOTHING", ['ASPR', 'ASPR', 3]),
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
