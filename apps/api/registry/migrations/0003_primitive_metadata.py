"""Add Primitive Spec v0.1 frontmatter fields to PrimitiveVersion.

The bootstrap migration (0001) captured the core record shape; this migration
adds the frontmatter metadata the API surface returns to clients:

    - compatible_agents  (list[str])  — agent IDs the primitive targets
    - use_when           (list[str])  — situations the primitive helps with
    - do_not_use_when    (list[str])  — situations where it should NOT load

All three are per-version because they're declared in the version's
frontmatter (docs/spec.md §3). All three default to an empty list so
existing rows (none in production yet) remain valid.
"""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("registry", "0002_rls_policies"),
    ]

    operations = [
        migrations.AddField(
            model_name="primitiveversion",
            name="compatible_agents",
            field=models.JSONField(
                default=list,
                help_text="List of agent IDs (Claude Code, Cursor, …) the primitive targets.",
            ),
        ),
        migrations.AddField(
            model_name="primitiveversion",
            name="use_when",
            field=models.JSONField(
                default=list,
                help_text="Situations where the agent SHOULD load this primitive (frontmatter use_when).",
            ),
        ),
        migrations.AddField(
            model_name="primitiveversion",
            name="do_not_use_when",
            field=models.JSONField(
                default=list,
                help_text="Situations where the agent should NOT load this primitive (frontmatter do_not_use_when).",
            ),
        ),
    ]
