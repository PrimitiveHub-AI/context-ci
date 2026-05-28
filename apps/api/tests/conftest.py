"""Pytest fixtures shared across the API test suite."""

from __future__ import annotations

import pytest
from django.test import Client


@pytest.fixture
def client() -> Client:
    """A vanilla Django test client. DEV_AUTH_BYPASS is on in settings_test."""
    return Client()
