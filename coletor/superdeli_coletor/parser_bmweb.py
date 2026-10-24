"""
Leitura do relatório BMWeb "Pedidos - Por Período - Analítico" (PDF).
Mesmo parser do pipeline (bmweb_parser.py), aceitando o PDF em memória.
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pymupdf

# --- layout (x inicial das colunas, em pontos, página rotacionada) ---------
X_NOME = 100      # código < 100 <= nome
X_CLIENTE = 420   # número < 420 <= cliente
X_SITUACAO = 720  # cliente < 720 <= situação

# Diferença aceita entre soma dos itens e total do pedido (arredondamento do BMWeb)
TOLERANCIA = Decimal("0.05")

RE_NUM = re.compile(r"^-?[\d.]*,\d+$")
RE_COD = re.compile(r"^\d{8,14}$")
RE_DATA = re.compile(r"^\d{2}/\d{2}/\d{4}$")
RE_PERIODO = re.compile(r"Período:\s*(\d{2}/\d{2}/\d{4})\s*a\s*(\d{2}/\d{2}/\d{4})")
RE_PAG = re.compile(r"^Forma de Pagamento:\s*(?:(\d+)\s*-\s*)?(.+?)\s*=\s*(-?[\d.]*,\d+)$")


def br(s: str) -> Decimal:
    return Decimal(s.replace(".", "").replace(",", "."))


def dt(s: str) -> str:
    return datetime.strptime(s, "%d/%m/%Y").date().isoformat()


@dataclass
class Pedido:
    numero: int
    data: str
    hora: str
    cliente: str
    situacao: str
    itens: list = field(default_factory=list)
    pagamentos: list = field(default_factory=list)
    qtd_produtos: int | None = None
    total: Decimal | None = None


def _abrir(pdf):
    if isinstance(pdf, (bytes, bytearray)):
        return pymupdf.open(stream=bytes(pdf), filetype="pdf")
    return pymupdf.open(pdf)


def linhas(pdf):
    """Gera (página, [(x, texto), ...]) por linha visual, já corrigindo a rotação."""
    with _abrir(pdf) as doc:
        for pno, page in enumerate(doc, 1):
            m = page.rotation_matrix
            rows: dict[int, list] = {}
            for w in page.get_text("words"):
                r = pymupdf.Rect(w[:4]) * m
                rows.setdefault(round(r.y1), []).append((r.x0, w[4]))
            # junta linhas com y muito próximo (jitter de 1pt)
            ys = sorted(rows)
            merged: list[list] = []
            last_y = None
            for y in ys:
                if last_y is not None and y - last_y <= 1:
                    merged[-1].extend(rows[y])
                else:
                    merged.append(list(rows[y]))
                last_y = y
            for row in merged:
                row.sort()
                yield pno, row


def parse(pdf, nome: str = "relatorio.pdf"):
    pedidos: dict[int, Pedido] = {}
    atual: Pedido | None = None
    pdf_path = Path(nome)
    meta = {"arquivo": nome, "periodo_ini": None, "periodo_fim": None,
            "qtd_davs": None, "total_geral": None}
    desconhecidas: list[str] = []
    esperando_cab = False
    ultimo_item = None

    for pno, row in linhas(pdf):
        toks = [t for _, t in row]
        texto = " ".join(toks)

        # cabeçalho de página
        if "DELICATESSEN" in texto and "/0001-" in texto or texto.startswith("Relatório Pedidos"):
            continue
        if texto.startswith("Período:"):
            if meta["periodo_ini"] is None and (m := RE_PERIODO.search(texto)):
                meta["periodo_ini"], meta["periodo_fim"] = dt(m[1]), dt(m[2])
            continue

        if toks[0] == "Data:" and "Situação:" in toks:
            esperando_cab = True
            ultimo_item = None
            continue

        if esperando_cab and RE_DATA.match(toks[0]):
            esperando_cab = False
            numero = int(toks[2])
            if atual is not None and atual.numero == numero:
                continue  # cabeçalho repetido por quebra de página
            cliente = " ".join(t for x, t in row if X_CLIENTE <= x < X_SITUACAO)
            situacao = " ".join(t for x, t in row if x >= X_SITUACAO)
            if numero in pedidos:
                raise ValueError(f"{pdf_path.name} p.{pno}: pedido {numero} duplicado")
            atual = Pedido(numero, dt(toks[0]), toks[1], cliente, situacao)
            pedidos[numero] = atual
            continue

        if texto.startswith("Forma de Pagamento:"):
            m = RE_PAG.match(texto)
            if not m:
                desconhecidas.append(f"p.{pno}: {texto}")
                continue
            atual.pagamentos.append({"codigo": m[1] or "", "forma": m[2], "valor": br(m[3])})
            continue

        if toks[0] in ("Produto(s)", "Código"):
            continue

        if RE_COD.match(toks[0]) and row[0][0] < X_NOME and len(toks) >= 7 and all(
                RE_NUM.match(t) for t in toks[-4:]):
            corpo = toks[1:-4]
            item = {"codigo": toks[0], "nome": " ".join(corpo[:-1]), "unidade": corpo[-1],
                    "qtd": br(toks[-4]), "preco": br(toks[-3]),
                    "desconto": br(toks[-2]), "total": br(toks[-1])}
            atual.itens.append(item)
            ultimo_item = item
            continue

        # continuação do nome do produto (quebra de linha na célula)
        if ultimo_item is not None and all(X_NOME <= x < 330 for x, _ in row):
            ultimo_item["nome"] += " " + texto
            continue

        if texto.startswith("Quantidade de Produtos:"):
            atual.qtd_produtos = int(toks[3])
            atual.total = br(toks[-1])
            ultimo_item = None
            continue

        if texto.startswith("Quantidade de DAVs:"):
            meta["qtd_davs"] = int(toks[3])
            meta["total_geral"] = br(toks[-1])
            continue

        desconhecidas.append(f"p.{pno}: {texto}")

    return meta, pedidos, desconhecidas


def validar(meta, pedidos, desconhecidas) -> tuple[list[str], list[str], int]:
    """erros = estruturais (abortam); alertas = divergência de valor vinda do próprio BMWeb."""
    erros, alertas, ajustes = [], [], 0
    if desconhecidas:
        erros += [f"linha não reconhecida: {d}" for d in desconhecidas[:20]]
        if len(desconhecidas) > 20:
            erros.append(f"... +{len(desconhecidas) - 20} linhas não reconhecidas")
    for p in pedidos.values():
        if p.total is None:
            erros.append(f"pedido {p.numero}: sem rodapé de total")
            continue
        if p.qtd_produtos != len(p.itens):
            erros.append(f"pedido {p.numero}: {len(p.itens)} itens lidos != {p.qtd_produtos} declarados")
        soma = sum((i["total"] for i in p.itens), Decimal(0))
        if abs(soma - p.total) > TOLERANCIA:
            alertas.append(f"pedido {p.numero}: soma itens {soma} != total {p.total}")
        elif soma != p.total:
            ajustes += 1
    if meta["qtd_davs"] is None and not pedidos and not desconhecidas and meta["periodo_ini"]:
        # Relatório de um dia ainda sem pedidos: cabeçalho sem rodapé.
        meta["qtd_davs"], meta["total_geral"] = 0, Decimal(0)
    if meta["qtd_davs"] is None:
        erros.append("rodapé 'Quantidade de DAVs' não encontrado (PDF truncado?)")
    else:
        if meta["qtd_davs"] != len(pedidos):
            erros.append(f"{len(pedidos)} pedidos lidos != {meta['qtd_davs']} declarados")
        tg = sum((p.total or 0 for p in pedidos.values()), Decimal(0))
        if tg != meta["total_geral"]:
            erros.append(f"total geral {tg} != {meta['total_geral']}")
    return erros, alertas, ajustes


