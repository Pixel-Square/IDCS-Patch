from django.db import migrations, models


def seed_department_is_teaching(apps, schema_editor):
    Department = apps.get_model('academics', 'Department')
    SalaryPFConfig = apps.get_model('staff_salary', 'SalaryPFConfig')

    cfg = SalaryPFConfig.objects.order_by('-id').first()
    if not cfg:
        return

    try:
        type1_ids = {int(v) for v in (cfg.type1_department_ids or []) if str(v).strip()}
    except Exception:
        type1_ids = set()

    try:
        type2_ids = {int(v) for v in (cfg.type2_department_ids or []) if str(v).strip()}
    except Exception:
        type2_ids = set()

    if type1_ids:
        Department.objects.filter(id__in=type1_ids).update(is_teaching=True)
    if type2_ids:
        Department.objects.filter(id__in=type2_ids).update(is_teaching=False)


def reverse_seed_department_is_teaching(apps, schema_editor):
    Department = apps.get_model('academics', 'Department')
    Department.objects.update(is_teaching=True)


class Migration(migrations.Migration):

    dependencies = [
        ('staff_salary', '0005_monthly_cash_and_publish_toggle'),
        ('academics', '0072_merge_20260322_0001'),
    ]

    operations = [
        migrations.AddField(
            model_name='department',
            name='is_teaching',
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(seed_department_is_teaching, reverse_seed_department_is_teaching),
    ]
