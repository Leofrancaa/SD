"""Download do relatório "Pedidos - Por Período - Analítico" no BMWeb."""
from __future__ import annotations

import re
from datetime import date, datetime
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

BASE = "https://bmweb.azurewebsites.net"
PAGINA_RELATORIOS = f"{BASE}/RelatoriosDavs"
RE_ACAO = re.compile(r"RelatorioDavsPorPeriodoAnalitico$")
FUSO = ZoneInfo("America/Sao_Paulo")


class LoginRecusado(Exception):
    """O BMWeb recusou domínio, usuário ou senha."""


class RespostaInesperada(Exception):
    """O BMWeb respondeu algo que não é o PDF esperado."""


def agora() -> datetime:
    return datetime.now(FUSO).replace(tzinfo=None)


def _ocultos(form) -> dict:
    return {
        i["name"]: i.get("value", "")
        for i in form.find_all("input", type="hidden")
        if i.get("name")
    }


def sessao(dominio: str, usuario: str, senha: str) -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 SuperdeliColetor"
    )
    r = s.get(f"{BASE}/login", timeout=60)
    r.raise_for_status()
    form = BeautifulSoup(r.text, "html.parser").find("form", id="formLogin")
    if form is None:
        raise RespostaInesperada("Tela de login do BMWeb mudou.")
    t = agora()
    dados = _ocultos(form)
    # Igual ao JS do botão "Login": Data=AAAA-MM-DD, Hora=HH:MM (hora de Brasília)
    dados.update(
        Data=t.strftime("%Y-%m-%d"),
        Hora=t.strftime("%H:%M"),
        cnpj=dominio,
        Usuario=usuario,
        Senha=senha,
    )
    r2 = s.post(urljoin(r.url, form.get("action") or "/login"), data=dados, timeout=60)
    r2.raise_for_status()
    if r2.url.rstrip("/").lower().endswith("/login"):
        raise LoginRecusado("O BMWeb recusou o domínio, o usuário ou a senha.")
    return s


def baixar(s: requests.Session, ini: date, fim: date) -> bytes:
    r = s.get(PAGINA_RELATORIOS, timeout=60)
    r.raise_for_status()
    form = BeautifulSoup(r.text, "html.parser").find("form", action=RE_ACAO)
    if form is None:
        raise LoginRecusado("Sessão do BMWeb expirou ou o usuário não vê relatórios.")
    dados = _ocultos(form)
    # Os campos ocultos recebem o valor cru de um <input type="date">: AAAA-MM-DD.
    dados.update(
        dataIni=ini.strftime("%Y-%m-%d"),
        dataFim=fim.strftime("%Y-%m-%d"),
        pendente="true",
        finalizada="true",
    )
    r = s.post(urljoin(r.url, form["action"]), data=dados, timeout=900)
    r.raise_for_status()
    tipo = r.headers.get("Content-Type", "").lower()
    if "pdf" not in tipo or not r.content.startswith(b"%PDF"):
        raise RespostaInesperada(f"O BMWeb não devolveu um PDF ({tipo or 'sem tipo'}).")
    return r.content
