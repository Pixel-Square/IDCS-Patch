from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0007_merge_0006_alter_applicationformversion_unique_together_0006_approvalstep_is_final'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='approvalflow',
            unique_together=set(),
        ),
    ]
