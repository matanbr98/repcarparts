"""Operator CLI.  Usage: python -m app.cli set-password <username> [--role manager] [--create]"""
from __future__ import annotations

import argparse
import getpass
import sys
from datetime import date

from . import models
from .bootstrap import ensure_ready
from .database import SessionLocal
from .security import hash_password


def set_password(username: str, role: str | None, create: bool, require_change: bool) -> int:
    ensure_ready(check_secret=False)
    pw = getpass.getpass("New password: ")
    if len(pw) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 2
    if getpass.getpass("Repeat password: ") != pw:
        print("Passwords do not match.", file=sys.stderr)
        return 2
    with SessionLocal() as db:
        u = db.query(models.User).filter(models.User.username == username).first()
        if u is None:
            if not create:
                print(f"No such user: {username} (use --create to create it)", file=sys.stderr)
                return 1
            u = models.User(username=username, role=role or "user", password_hash="", created_at=date.today())
            db.add(u)
        if role:
            u.role = role
        u.password_hash = hash_password(pw)
        u.pwd_version = int(u.pwd_version or 0) + 1
        u.must_change_password = bool(require_change)
        db.commit()
        print(f"Password updated for {username} (role: {u.role}).")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("set-password", help="set/reset a user's password (prompts, no echo)")
    sp.add_argument("username")
    sp.add_argument("--role", choices=["user", "manager"], help="also set the account role")
    sp.add_argument("--create", action="store_true", help="create the user if missing")
    sp.add_argument("--require-change", action="store_true", help="force a password change at next login")
    a = p.parse_args(argv)
    if a.cmd == "set-password":
        return set_password(a.username, a.role, a.create, a.require_change)
    return 1


if __name__ == "__main__":
    sys.exit(main())
