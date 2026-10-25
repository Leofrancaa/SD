"""Um ciclo de sincronização: BMWeb → relatório → validação → Supabase."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal

import requests

from . import bmweb, envio
from .config import Config, pasta_dados
from .parser_bmweb import parse, validar

log = logging.getLogger("coletor")

HORA_FECHAMENTO = 3  # a partir das 3h, confere os dias anteriores inteiros uma vez
MAX_DIAS_ATRAS = 31  # se o computador ficou desligado, recupera até 31 dias


@dataclass
class Resultado:
    ok: bool
    titulo: str
    detalhe: str = ""
    quando: datetime = field(default_factory=bmweb.agora)
    pedidos_hoje: int | None = None
    faturamento_hoje: Decimal | None = None
    novos: int = 0
    removidos: int = 0
    grave: bool = False  # precisa de alguém (senha, chave), não adianta só tentar de novo


def _estado_arq():
    return pasta_dados() / "estado.json"


def ler_estado() -> dict:
    try:
        return json.loads(_estado_arq().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def gravar_estado(estado: dict) -> None:
    arq = _estado_arq()
    tmp = arq.with_suffix(".tmp")
    tmp.write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(arq)


def _periodos_para_sincronizar(estado: dict, agora: datetime) -> list[tuple[date, date]]:
    """Dias fechados que faltam (de uma vez, num relatório só) e o dia de hoje."""
    hoje = agora.date()
    ontem = hoje - timedelta(days=1)
    periodos: list[tuple[date, date]] = []
    if agora.hour >= HORA_FECHAMENTO:
        try:
            ultimo = date.fromisoformat(estado.get("ultimo_fechamento", ""))
        except ValueError:
            ultimo = ontem - timedelta(days=1)  # sem histórico: confere só ontem
        inicio = max(ultimo + timedelta(days=1), hoje - timedelta(days=MAX_DIAS_ATRAS))
        if inicio <= ontem:
            periodos.append((inicio, ontem))
    periodos.append((hoje, hoje))
    return periodos


def _sincronizar(s: requests.Session, cfg: Config, ini: date, fim: date) -> dict:
    pdf = bmweb.baixar(s, ini, fim)
    sufixo = f"{ini:%Y%m%d}" if ini == fim else f"{ini:%Y%m%d}_{fim:%Y%m%d}"
    nome = f"davs_{sufixo}_{bmweb.agora():%H%M%S}.pdf"
    meta, pedidos, desconhecidas = parse(pdf, nome)
    erros, alertas, _ = validar(meta, pedidos, desconhecidas)
    if erros:
        log.error("relatório %s..%s inválido: %s", ini, fim, erros[:5])
        raise ValueError("O relatório do BMWeb veio num formato diferente do esperado.")
    for a in alertas:
        log.warning("alerta %s..%s: %s", ini, fim, a)
    payload = envio.montar_payload(cfg.empresa_id, meta, pedidos, pdf)
    resp = envio.enviar(cfg.supabase_url, cfg.supabase_chave, payload)
    return {
        "pedidos": len(pedidos),
        "total": meta["total_geral"],
        "removidos": int(resp.get("removidos") or 0),
        "ja_importado": bool(resp.get("ja_importado")),
    }


def executar(cfg: Config) -> Resultado:
    """Roda um ciclo completo e devolve um resultado em linguagem simples."""
    if not cfg.completa():
        return Resultado(False, "Falta configurar", "Abra as Configurações.", grave=True)
    estado = ler_estado()
    agora = bmweb.agora()
    periodos = _periodos_para_sincronizar(estado, agora)
    try:
        s = bmweb.sessao(cfg.bm_dominio, cfg.bm_usuario, cfg.bm_senha)
        resumo_hoje = None
        removidos = 0
        recuperados = 0
        for ini, fim in periodos:
            r = _sincronizar(s, cfg, ini, fim)
            removidos += r["removidos"]
            log.info("%s..%s: %s pedidos, R$ %s, removidos %s", ini, fim, r["pedidos"], r["total"], r["removidos"])
            if ini == agora.date():
                resumo_hoje = r
            else:
                recuperados = (fim - ini).days + 1
                estado["ultimo_fechamento"] = fim.isoformat()
                gravar_estado(estado)  # se hoje falhar, os dias fechados não são baixados de novo
        anteriores = estado.get("pedidos_hoje") if estado.get("dia") == agora.date().isoformat() else None
        estado.update({
            "dia": agora.date().isoformat(),
            "pedidos_hoje": resumo_hoje["pedidos"] if resumo_hoje else 0,
            "faturamento_hoje": str(resumo_hoje["total"]) if resumo_hoje else "0",
            "ultimo_sucesso": agora.isoformat(timespec="seconds"),
        })
        gravar_estado(estado)
        pedidos = resumo_hoje["pedidos"] if resumo_hoje else 0
        novos = max(0, pedidos - anteriores) if anteriores is not None else 0
        detalhe = (
            f"{pedidos} pedidos de hoje no painel"
            + (f" ({novos} novos)" if novos else "")
            + (" · conferiu o dia de ontem" if recuperados == 1 else "")
            + (f" · recuperou {recuperados} dias que faltavam" if recuperados > 1 else "")
        )
        return Resultado(
            True, "Tudo certo", detalhe,
            pedidos_hoje=pedidos,
            faturamento_hoje=resumo_hoje["total"] if resumo_hoje else Decimal(0),
            novos=novos, removidos=removidos,
        )
    except bmweb.LoginRecusado as e:
        log.error("login: %s", e)
        return Resultado(False, "BMWeb recusou o acesso", "Confira domínio, usuário e senha nas Configurações.", grave=True)
    except envio.ChaveRecusada:
        log.error("chave do banco recusada")
        return Resultado(False, "Banco recusou a chave", "Confira a chave do banco nas Configurações.", grave=True)
    except envio.BancoRecusou as e:
        log.error("banco recusou: %s", e)
        if "remocao suspeita" in str(e):
            return Resultado(False, "Relatório incompleto", "Não enviei para proteger os dados. Vou tentar de novo.")
        return Resultado(False, "Banco recusou os dados", "Vou tentar de novo. Se continuar, chame o responsável.")
    except (requests.ConnectionError, requests.Timeout) as e:
        log.warning("rede: %s", e.__class__.__name__)
        return Resultado(False, "Sem conexão", "Sem internet ou BMWeb fora do ar. Vou tentar de novo.")
    except bmweb.RespostaInesperada as e:
        log.error("resposta inesperada: %s", e)
        return Resultado(False, "BMWeb respondeu diferente", "Vou tentar de novo. Se continuar, chame o responsável.")
    except Exception as e:  # noqa: BLE001 - nunca derrubar o programa
        log.exception("erro inesperado")
        return Resultado(False, "Algo deu errado", str(e)[:140] or e.__class__.__name__)
