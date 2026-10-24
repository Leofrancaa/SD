"""Configuração do coletor.

- Dados comuns: %APPDATA%\\SuperdeliColetor\\config.json
- Senha do BMWeb e chave do banco: Gerenciador de Credenciais do Windows
  (biblioteca keyring), nunca em arquivo.
- PIN das configurações: guardado só como hash PBKDF2.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from dataclasses import asdict, dataclass, field
from pathlib import Path

import sys

import keyring

if sys.platform == "win32":  # no .exe a descoberta automática de backends pode falhar
    from keyring.backends import Windows

    keyring.set_keyring(Windows.WinVaultKeyring())

SERVICO = "SuperdeliColetor"


def pasta_dados() -> Path:
    base = os.environ.get("APPDATA") or str(Path.home() / ".config")
    pasta = Path(base) / "SuperdeliColetor"
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta


def pasta_logs() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(pasta_dados())
    pasta = Path(base) / "SuperdeliColetor" / "logs"
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta


@dataclass
class Config:
    supabase_url: str = "https://kstcwvqsczmoflronqhg.supabase.co"
    empresa_id: str = "7b0a55b2-9ccc-4739-b845-51a7ae4da843"
    bm_dominio: str = "delicatessensuperdeli"
    bm_usuario: str = ""
    intervalo_min: int = 30
    iniciar_com_windows: bool = True
    pin_hash: str = ""
    extras: dict = field(default_factory=dict)

    # Segredos (não vão para o JSON)
    @property
    def bm_senha(self) -> str:
        return _ler_segredo("bm_senha")

    @property
    def supabase_chave(self) -> str:
        return _ler_segredo("supabase_chave")

    def completa(self) -> bool:
        return bool(
            self.supabase_url and self.empresa_id and self.bm_dominio
            and self.bm_usuario and self.bm_senha and self.supabase_chave
        )


def _ler_segredo(nome: str) -> str:
    env = os.environ.get(f"COLETOR_{nome.upper()}")  # testes/automação
    if env:
        return env
    try:
        return keyring.get_password(SERVICO, nome) or ""
    except Exception:  # cofre indisponível
        return ""


def salvar_segredo(nome: str, valor: str) -> None:
    keyring.set_password(SERVICO, nome, valor)


def carregar() -> Config:
    arq = pasta_dados() / "config.json"
    if not arq.exists():
        return Config()
    try:
        dados = json.loads(arq.read_text(encoding="utf-8"))
        conhecidos = {k: v for k, v in dados.items() if k in Config.__dataclass_fields__}
        return Config(**conhecidos)
    except (ValueError, TypeError):
        return Config()


def salvar(cfg: Config) -> None:
    arq = pasta_dados() / "config.json"
    tmp = arq.with_suffix(".tmp")
    tmp.write_text(json.dumps(asdict(cfg), ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(arq)


def hash_pin(pin: str) -> str:
    sal = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), sal, 200_000)
    return f"pbkdf2${sal.hex()}${dk.hex()}"


def confere_pin(pin: str, guardado: str) -> bool:
    try:
        _, sal, dk = guardado.split("$")
    except ValueError:
        return False
    teste = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(sal), 200_000)
    return hmac.compare_digest(teste.hex(), dk)
