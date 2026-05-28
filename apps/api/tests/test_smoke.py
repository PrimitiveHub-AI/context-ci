"""Smoke tests — verify the Django project loads and the API responds.

These tests do not exercise business logic; they confirm the bones work.
Business logic lands in app-specific test modules in later PRs.
"""

from __future__ import annotations

import pytest
from django.test import Client


@pytest.mark.django_db
def test_healthz_ok(client: Client) -> None:
    """/api/v1/healthz returns 200 and a JSON body with `status`."""
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "primitivehub-api"
    assert data["version"] == "0.1.0"
    assert "checks" in data
    assert "db" in data["checks"]
    assert "cache" in data["checks"]


@pytest.mark.django_db
def test_whoami_with_dev_bypass(client: Client) -> None:
    """In DEV_AUTH_BYPASS mode, /whoami returns the dev subject."""
    response = client.get("/api/v1/whoami")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["dev_bypass"] is True
    assert "subject" in data


def test_openapi_schema_available(client: Client) -> None:
    """/api/v1/openapi.json is present and well-formed."""
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "PrimitiveHub API"
    assert schema["info"]["version"] == "0.1.0"
    assert "/healthz" in schema["paths"]
    assert "/whoami" in schema["paths"]
