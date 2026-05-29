"""Django admin for User — read-mostly: identity is owned by the IdP."""

from __future__ import annotations

from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("subject", "email", "display_name", "is_active", "is_staff", "created_at")
    list_filter = ("is_active", "is_staff", "is_superuser")
    search_fields = ("subject", "email", "display_name")
    readonly_fields = ("id", "subject", "created_at", "updated_at")
    ordering = ("-created_at",)
