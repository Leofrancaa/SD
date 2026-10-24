"""Envio ao Supabase por HTTPS (função ingest_bmweb) e leituras simples."""
from __future__ import annotations

import hashlib
from decimal import Decimal

import requests


class ChaveRecusada(Exception):
    """A chave do Supabase foi recusada (401/403)."""


class BancoRecusou(Exception):
    """O banco recusou os dados (ex.: total não bate, remoção suspeita)."""


def _headers(chave: str) -> dict:
    h = {"apikey": chave, "Content-Type": "application/json", "Accept": "application/json"}
    if chave.startswith("eyJ"):
        h["Authorization"] = f"Bearer {chave}"
    return h


def _rpc(url: str, chave: str, funcao: str, corpo: dict, timeout: int = 120):
    r = requests.post(
        f"{url.rstrip('/')}/rest/v1/rpc/{funcao}",
        json=corpo,
        headers=_headers(chave),
        timeout=timeout,
    )
    if r.status_code in (401, 403):
        raise ChaveRecusada("A chave do banco foi recusada.")
    if r.status_code >= 400:
        try:
            msg = r.json().get("message", r.text)
        except ValueError:
            msg = r.text
        raise BancoRecusou(str(msg)[:300])
    return r.json() if r.content else None


def _num(v: Decimal) -> float:
    return float(v)


def montar_payload(empresa_id: str, meta: dict, pedidos: dict, pdf: bytes) -> dict:
    ped, itn, pag = [], [], []
    for p in pedidos.values():
        soma = sum((i["total"] for i in p.itens), Decimal(0))
        ped.append({
            "numero": p.numero, "data": p.data, "hora": p.hora, "cliente": p.cliente,
            "situacao": p.situacao, "qtd_produtos": p.qtd_produtos,
            "total": _num(p.total), "diferenca_itens": _num(p.total - soma),
        })
        for seq, i in enumerate(p.itens, 1):
            itn.append({
                "numero": p.numero, "seq": seq, "codigo": i["codigo"], "nome": i["nome"],
                "unidade": i["unidade"], "qtd": _num(i["qtd"]), "preco": _num(i["preco"]),
                "desconto": _num(i["desconto"]), "total": _num(i["total"]),
            })
        for seq, g in enumerate(p.pagamentos, 1):
            pag.append({
                "numero": p.numero, "seq": seq, "codigo_forma": g["codigo"] or "",
                "forma": g["forma"], "valor": _num(g["valor"]),
            })
    return {
        "p_empresa": empresa_id,
        "p_arquivo": meta["arquivo"],
        "p_sha256": hashlib.sha256(pdf).hexdigest(),
        "p_periodo_ini": meta["periodo_ini"],
        "p_periodo_fim": meta["periodo_fim"],
        "p_total": _num(meta["total_geral"]),
        "p_pedidos": ped,
        "p_itens": itn,
        "p_pagamentos": pag,
    }


def enviar(url: str, chave: str, payload: dict) -> dict:
    return _rpc(url, chave, "ingest_bmweb", payload, timeout=180) or {}


def testar_banco(url: str, chave: str, empresa_id: str, dia: str) -> dict:
    """Confere chave e empresa lendo o resumo do dia (somente leitura)."""
    dados = _rpc(url, chave, "painel_vendas", {
        "p_empresa": empresa_id, "p_ini": dia, "p_fim": dia, "p_situacao": "todas",
    }, timeout=60)
    return (dados or {}).get("base") or {}
