"""Custom User model — identity comes from OIDC, not from a password.

PrimitiveHub never stores passwords. Authentication is delegated to Authentik
(or any standards-compliant OIDC provider for enterprise deployments). The
`User` row exists only as a local denormalization of OIDC identity so we can
link Django ORM relations against it.
"""

from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager["User"]):
    """Manager for User.

    `create_user` and `create_superuser` are required by Django's auth tooling
    (used by `manage.py createsuperuser` in dev). They never set a password;
    administrative access in production is via OIDC subject + role
    membership.
    """

    def create_user(self, subject: str, email: str = "", **extra_fields: object) -> User:
        if not subject:
            msg = "OIDC subject is required"
            raise ValueError(msg)
        user = self.model(
            subject=subject,
            email=self.normalize_email(email) if email else "",
            **extra_fields,
        )
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, subject: str, email: str = "", **extra_fields: object) -> User:
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(subject=subject, email=email, **extra_fields)


class User(AbstractBaseUser):
    """A PrimitiveHub user, identified by OIDC subject (`sub` claim).

    There is no `password` field. `set_unusable_password()` is called on
    creation; Django's auth framework treats this as "this user cannot log
    in by password" which is exactly what we want.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(
        max_length=255,
        unique=True,
        help_text="The OIDC `sub` claim. Stable identifier from the IdP.",
    )
    email = models.EmailField(blank=True, db_index=True)
    display_name = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "subject"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "accounts_user"
        verbose_name = "user"
        verbose_name_plural = "users"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        return self.display_name or self.email or self.subject

    @property
    def is_anonymous(self) -> bool:  # type: ignore[override]
        return False

    @property
    def is_authenticated(self) -> bool:  # type: ignore[override]
        return True

    def has_perm(self, perm: str, obj: object | None = None) -> bool:
        # Superusers retain Django admin access; otherwise role checks happen
        # via apps.orgs.OrganizationMember.has_role(...).
        return bool(self.is_superuser)

    def has_module_perms(self, app_label: str) -> bool:
        return bool(self.is_superuser)
