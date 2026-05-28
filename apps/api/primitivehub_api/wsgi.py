"""WSGI entrypoint — kept for compatibility, ASGI is preferred."""

from __future__ import annotations

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "primitivehub_api.settings")

application = get_wsgi_application()
