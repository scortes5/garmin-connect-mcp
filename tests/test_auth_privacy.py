"""Credentials and tokens must stay private on disk."""

import stat
from pathlib import Path

import pytest

import garmin_connect_mcp.scripts.setup_auth as setup_auth
from garmin_connect_mcp.auth import GarminConfig, can_authenticate, write_private_file


def test_private_files_are_owner_only(tmp_path):
    target = tmp_path / "nested" / "token.txt"

    write_private_file(target, "secret")

    assert target.read_text() == "secret"
    assert stat.S_IMODE(target.stat().st_mode) == 0o600


def test_saved_tokens_are_enough_without_a_password(tmp_path):
    tokens = tmp_path / "tokens"
    tokens.mkdir()
    (tokens / "garmin_tokens.json").write_text("{}")

    assert can_authenticate(GarminConfig(garmintokens=str(tokens)))
    assert not can_authenticate(GarminConfig(garmintokens=str(tmp_path / "missing")))


@pytest.fixture
def interactive_setup(tmp_path, monkeypatch):
    env_file = tmp_path / ".garminconnect.env"
    answers = iter(["athlete@example.com"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))
    monkeypatch.setattr(setup_auth, "getpass", lambda prompt="": "hunter2")
    monkeypatch.setattr(setup_auth, "get_env_file_path", lambda: env_file)
    monkeypatch.setattr(setup_auth, "init_garmin_client", lambda config, prompt_mfa: object())
    monkeypatch.setattr(setup_auth, "get_token_store", lambda: str(tmp_path / "tokens"))
    return env_file


def test_setup_does_not_keep_the_password_by_default(interactive_setup: Path):
    setup_auth.main()

    content = interactive_setup.read_text()
    assert "athlete@example.com" in content
    assert "hunter2" not in content
    assert stat.S_IMODE(interactive_setup.stat().st_mode) == 0o600


def test_setup_keeps_the_password_only_when_asked(interactive_setup: Path):
    setup_auth.main(save_password=True)

    assert "hunter2" in interactive_setup.read_text()
    assert stat.S_IMODE(interactive_setup.stat().st_mode) == 0o600
