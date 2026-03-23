from django.db import migrations, models


def ensure_comment_mode_column(apps, schema_editor):
    """Ensure feedback_forms.comment_mode exists and is non-null for all rows.

    Some deployments already have this legacy column (NOT NULL, no default).
    Other deployments may not. This migration adds the field to Django state
    and conditionally adds the DB column if missing.
    """

    FeedbackForm = apps.get_model('feedback', 'FeedbackForm')
    table_name = FeedbackForm._meta.db_table
    column_name = 'comment_mode'
    table_name_quoted = schema_editor.quote_name(table_name)
    column_name_quoted = schema_editor.quote_name(column_name)

    with schema_editor.connection.cursor() as cursor:
        existing_cols = {
            col.name for col in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }

    if column_name not in existing_cols:
        vendor = schema_editor.connection.vendor
        if vendor == 'postgresql':
            schema_editor.execute(
                f"ALTER TABLE {table_name_quoted} ADD COLUMN {column_name_quoted} varchar(20) NOT NULL DEFAULT 'question_wise'"
            )
        elif vendor == 'sqlite':
            schema_editor.execute(
                f"ALTER TABLE {table_name_quoted} ADD COLUMN {column_name_quoted} varchar(20) NOT NULL DEFAULT 'question_wise'"
            )
        else:
            schema_editor.execute(
                f"ALTER TABLE {table_name_quoted} ADD COLUMN {column_name_quoted} varchar(20) NOT NULL DEFAULT 'question_wise'"
            )

    # Backfill any NULLs defensively.
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f"UPDATE {table_name_quoted} SET {column_name_quoted} = %s WHERE {column_name_quoted} IS NULL",
            ['question_wise'],
        )

    # Keep a DB-level default on Postgres for compatibility with older code paths.
    if schema_editor.connection.vendor == 'postgresql':
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                f"ALTER TABLE {table_name_quoted} ALTER COLUMN {column_name_quoted} SET DEFAULT 'question_wise'"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('feedback', '0019_common_comment_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(ensure_comment_mode_column, reverse_code=migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='feedbackform',
                    name='comment_mode',
                    field=models.CharField(
                        choices=[('question_wise', 'Question-wise'), ('common', 'Common')],
                        default='question_wise',
                        help_text='Legacy field: how comments are collected. Kept for DB compatibility.',
                        max_length=20,
                    ),
                ),
            ],
        ),
    ]
