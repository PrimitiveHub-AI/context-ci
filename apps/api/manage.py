#!/usr/bin/env python
"""Django management entrypoint."""

import os
import sys


def main() -> None:
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "primitivehub_api.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Could not import Django. Are you sure it's installed and "
            "available in your PYTHONPATH? Did you forget to activate a "
            "virtual environment? Run `uv sync` first."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
