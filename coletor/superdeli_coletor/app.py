"""Janela do Coletor Superdeli (customtkinter) + agendador + ícone na bandeja."""
from __future__ import annotations

import logging
import os
import queue
import sys
import threading
from datetime import datetime, timedelta
from decimal import Decimal
from logging.handlers import RotatingFileHandler
from pathlib import Path

import customtkinter as ctk

from . import __version__, bmweb, envio
from .config import carregar, confere_pin, hash_pin, pasta_logs, salvar, salvar_segredo
from .parser_bmweb import parse, validar
from .sync import Resultado, executar, ler_estado

# Paleta da Superdeli (mesma do painel)
COR = {
    "fundo": "#F7F8F5", "cartao": "#FFFFFF", "borda": "#E5E7E0", "tinta": "#282925",
    "suave": "#6D716B", "laranja": "#BD480C", "laranja_escuro": "#9C3C0A",
    "verde": "#426148", "verde_claro": "#EDF3E9", "vermelho": "#AC3535",
    "vermelho_claro": "#FBECEC", "amarelo": "#825615", "amarelo_claro": "#FFF4D9",
    "carvao": "#272B27",
}
FONTE = "Segoe UI" if sys.platform == "win32" else "DejaVu Sans"
log = logging.getLogger("coletor")


def configurar_log() -> None:
    handler = RotatingFileHandler(pasta_logs() / "coletor.log", maxBytes=1_000_000, backupCount=5, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)


def caminho_recurso(nome: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "assets" / nome


def brl(valor: Decimal | None) -> str:
    if valor is None:
        return "—"
    texto = f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


# ---------------------------------------------------------------------------
# Windows: iniciar com o sistema e instância única
# ---------------------------------------------------------------------------
def definir_inicio_automatico(ativo: bool) -> None:
    if sys.platform != "win32":
        return
    import winreg

    chave = r"Software\Microsoft\Windows\CurrentVersion\Run"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, chave, 0, winreg.KEY_SET_VALUE) as k:
        if ativo:
            exe = sys.executable if getattr(sys, "frozen", False) else f'"{sys.executable}" -m superdeli_coletor'
            valor = f'"{exe}" --minimizado' if getattr(sys, "frozen", False) else f"{exe} --minimizado"
            winreg.SetValueEx(k, "SuperdeliColetor", 0, winreg.REG_SZ, valor)
        else:
            try:
                winreg.DeleteValue(k, "SuperdeliColetor")
            except FileNotFoundError:
                pass


_mutex = None


def ja_esta_aberto() -> bool:
    global _mutex
    if sys.platform != "win32":
        return False
    import ctypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    _mutex = kernel32.CreateMutexW(None, False, "Local\\SuperdeliColetor")
    return ctypes.get_last_error() == 183  # ERROR_ALREADY_EXISTS


# ---------------------------------------------------------------------------
# Agendador em segundo plano
# ---------------------------------------------------------------------------
class Agendador(threading.Thread):
    def __init__(self, fila: queue.Queue):
        super().__init__(daemon=True)
        self.fila = fila
        self.acordar = threading.Event()
        self.parar = threading.Event()
        self.proxima: datetime | None = None
        self.falhas = 0

    def agora_ja(self) -> None:
        self.acordar.set()

    def run(self) -> None:
        while not self.parar.is_set():
            cfg = carregar()
            if cfg.completa():
                self.fila.put(("inicio", None))
                resultado = executar(cfg)
                self.fila.put(("resultado", resultado))
                if resultado.ok:
                    self.falhas = 0
                    espera = cfg.intervalo_min * 60
                else:
                    self.falhas += 1
                    # 5, 10, 15... minutos, até o intervalo normal
                    espera = min(cfg.intervalo_min * 60, 300 * self.falhas)
                    if resultado.grave:
                        espera = cfg.intervalo_min * 60
            else:
                self.fila.put(("resultado", Resultado(False, "Falta configurar", "Clique em Configurações para começar.", grave=True)))
                espera = 60
            self.proxima = bmweb.agora() + timedelta(seconds=espera)
            self.fila.put(("proxima", self.proxima))
            self.acordar.wait(timeout=espera)
            self.acordar.clear()


# ---------------------------------------------------------------------------
# Janela principal
# ---------------------------------------------------------------------------
class App(ctk.CTk):
    def __init__(self, minimizado: bool = False):
        super().__init__(fg_color=COR["fundo"])
        ctk.set_appearance_mode("light")
        self.title("Coletor Superdeli")
        self.geometry("560x720")
        self.resizable(False, False)
        icone = caminho_recurso("icone.ico")
        if icone.exists() and sys.platform == "win32":
            self.iconbitmap(str(icone))
        self.fila: queue.Queue = queue.Queue()
        self.historico: list[tuple[str, bool, str]] = []
        self.ultimo: Resultado | None = None
        self.sincronizando = False
        self.tray = None
        self._montar()
        self._carregar_estado_salvo()
        self.protocol("WM_DELETE_WINDOW", self.esconder)
        self.agendador = Agendador(self.fila)
        self.agendador.start()
        self.after(300, self._processar_fila)
        self.after(1000, self._relogio)
        self._iniciar_bandeja()
        if minimizado and self.tray:
            self.after(50, self.withdraw)
        if not carregar().completa():
            self.after(600, self.abrir_configuracoes)

    # ---- layout ----------------------------------------------------------
    def _montar(self) -> None:
        topo = ctk.CTkFrame(self, fg_color=COR["carvao"], corner_radius=0, height=86)
        topo.pack(fill="x")
        topo.pack_propagate(False)
        marca = ctk.CTkFrame(topo, fg_color="transparent")
        marca.pack(side="left", padx=24)
        ctk.CTkLabel(marca, text="superdeli", font=(FONTE, 26, "bold"), text_color="#FFFFFF").pack(anchor="w", pady=(18, 0))
        ctk.CTkLabel(marca, text="COLETOR DE VENDAS · CIFRAI", font=(FONTE, 11, "bold"), text_color="#EAAA35").pack(anchor="w")
        ctk.CTkLabel(topo, text=f"v{__version__}", font=(FONTE, 11), text_color="#B4BCB1").pack(side="right", padx=24)

        rodape = ctk.CTkFrame(self, fg_color="transparent")
        rodape.pack(side="bottom", fill="x", padx=24, pady=(0, 16))
        ctk.CTkLabel(
            rodape, text="Pode fechar esta janela: o coletor continua funcionando\nperto do relógio do Windows.",
            font=(FONTE, 12), text_color=COR["suave"], justify="left",
        ).pack(side="left")
        ctk.CTkButton(
            rodape, text="Configurações", width=130, height=34, corner_radius=8,
            fg_color="transparent", border_width=1, border_color=COR["borda"],
            text_color=COR["tinta"], hover_color="#ECEFE7", font=(FONTE, 13),
            command=self.abrir_configuracoes,
        ).pack(side="right")

        corpo = ctk.CTkFrame(self, fg_color="transparent")
        corpo.pack(fill="both", expand=True, padx=24, pady=(20, 12))

        # Cartão de status
        self.cartao = ctk.CTkFrame(corpo, fg_color=COR["cartao"], corner_radius=14, border_width=1, border_color=COR["borda"])
        self.cartao.pack(fill="x")
        linha = ctk.CTkFrame(self.cartao, fg_color="transparent")
        linha.pack(fill="x", padx=20, pady=(20, 6))
        self.bolinha = ctk.CTkLabel(linha, text="●", font=(FONTE, 30), text_color=COR["suave"])
        self.bolinha.pack(side="left")
        self.status_titulo = ctk.CTkLabel(linha, text="Iniciando…", font=(FONTE, 24, "bold"), text_color=COR["tinta"])
        self.status_titulo.pack(side="left", padx=(10, 0))
        self.status_detalhe = ctk.CTkLabel(
            self.cartao, text="Preparando a primeira atualização.", font=(FONTE, 14),
            text_color=COR["suave"], wraplength=470, justify="left", anchor="w",
        )
        self.status_detalhe.pack(fill="x", padx=20, pady=(0, 18))

        # Números
        grade = ctk.CTkFrame(corpo, fg_color="transparent")
        grade.pack(fill="x", pady=(16, 0))
        grade.columnconfigure((0, 1), weight=1, uniform="g")
        self.v_pedidos = self._numero(grade, "Pedidos de hoje", 0, 0)
        self.v_faturamento = self._numero(grade, "Vendas de hoje", 0, 1)
        self.v_ultima = self._numero(grade, "Última atualização", 1, 0, pequeno=True)
        self.v_proxima = self._numero(grade, "Próxima atualização", 1, 1, pequeno=True)

        self.botao = ctk.CTkButton(
            corpo, text="Atualizar agora", height=52, corner_radius=12,
            font=(FONTE, 17, "bold"), fg_color=COR["laranja"], hover_color=COR["laranja_escuro"],
            text_color="#FFFFFF", text_color_disabled="#F6D8C6", command=self.atualizar_agora,
        )
        self.botao.pack(fill="x", pady=(18, 0))

        ctk.CTkLabel(corpo, text="O que aconteceu", font=(FONTE, 15, "bold"), text_color=COR["tinta"]).pack(anchor="w", pady=(20, 6))
        self.lista = ctk.CTkTextbox(
            corpo, height=110, font=(FONTE, 13), fg_color=COR["cartao"], border_width=1,
            border_color=COR["borda"], corner_radius=10, text_color=COR["tinta"], wrap="word",
        )
        self.lista.pack(fill="x")
        self.lista.configure(state="disabled")


    def _numero(self, pai, rotulo: str, lin: int, col: int, pequeno: bool = False):
        caixa = ctk.CTkFrame(pai, fg_color=COR["cartao"], corner_radius=12, border_width=1, border_color=COR["borda"])
        caixa.grid(row=lin, column=col, sticky="nsew", padx=(0 if col == 0 else 6, 6 if col == 0 else 0), pady=6)
        ctk.CTkLabel(caixa, text=rotulo, font=(FONTE, 13), text_color=COR["suave"]).pack(anchor="w", padx=16, pady=(12, 0))
        valor = ctk.CTkLabel(caixa, text="—", font=(FONTE, 18 if pequeno else 26, "bold"), text_color=COR["tinta"])
        valor.pack(anchor="w", padx=16, pady=(0, 12))
        return valor

    # ---- estado ----------------------------------------------------------
    def _carregar_estado_salvo(self) -> None:
        estado = ler_estado()
        if estado.get("dia") == bmweb.agora().date().isoformat():
            self.v_pedidos.configure(text=f"{estado.get('pedidos_hoje', 0):,}".replace(",", "."))
            self.v_faturamento.configure(text=brl(Decimal(estado.get("faturamento_hoje", "0"))))
        if estado.get("ultimo_sucesso"):
            self.v_ultima.configure(text=datetime.fromisoformat(estado["ultimo_sucesso"]).strftime("%d/%m às %H:%M"))

    def _status(self, titulo: str, detalhe: str, tipo: str) -> None:
        cores = {"ok": COR["verde"], "trabalhando": COR["laranja"], "atencao": COR["amarelo"], "erro": COR["vermelho"], "parado": COR["suave"]}
        fundos = {"ok": COR["verde_claro"], "atencao": COR["amarelo_claro"], "erro": COR["vermelho_claro"]}
        self.bolinha.configure(text_color=cores[tipo])
        self.status_titulo.configure(text=titulo)
        self.status_detalhe.configure(text=detalhe)
        self.cartao.configure(fg_color=fundos.get(tipo, COR["cartao"]))

    def _registrar(self, ok: bool, texto: str) -> None:
        hora = bmweb.agora().strftime("%H:%M")
        self.historico.insert(0, (hora, ok, texto))
        self.historico = self.historico[:30]
        self.lista.configure(state="normal")
        self.lista.delete("1.0", "end")
        for h, bom, t in self.historico:
            self.lista.insert("end", f"{h}  {'✔' if bom else '✖'}  {t}\n")
        self.lista.configure(state="disabled")

    def no_tk(self, func, *args) -> None:
        """Agenda func(*args) na thread da janela (seguro a partir de outras threads)."""
        self.fila.put(("chamar", (func, args)))

    def _processar_fila(self) -> None:
        while True:
            try:
                tipo, valor = self.fila.get_nowait()
            except queue.Empty:
                break
            try:
                if tipo == "inicio":
                    self.sincronizando = True
                    self.botao.configure(state="disabled", text="Atualizando…")
                    self._status("Atualizando…", "Buscando o relatório no BMWeb e enviando para o painel.", "trabalhando")
                elif tipo == "resultado":
                    self._mostrar_resultado(valor)
                elif tipo == "proxima":
                    self.proxima = valor
                elif tipo == "chamar":
                    func, args = valor
                    func(*args)
            except Exception:  # noqa: BLE001 - ex.: janela de configurações já fechada
                log.debug("evento da fila ignorado", exc_info=True)
        self.after(200, self._processar_fila)

    def _mostrar_resultado(self, r: Resultado) -> None:
        self.sincronizando = False
        repetido = not r.ok and self.ultimo is not None and not self.ultimo.ok and self.ultimo.titulo == r.titulo == "Falta configurar"
        self.ultimo = r
        self.botao.configure(state="normal", text="Atualizar agora")
        if r.ok:
            self._status("Tudo certo", "As vendas do caixa estão chegando no painel.", "ok")
            self.v_pedidos.configure(text=f"{r.pedidos_hoje or 0:,}".replace(",", "."))
            self.v_faturamento.configure(text=brl(r.faturamento_hoje))
            self.v_ultima.configure(text=r.quando.strftime("%d/%m às %H:%M"))
        else:
            self._status(r.titulo, r.detalhe, "erro" if r.grave else "atencao")
        if not repetido:
            self._registrar(r.ok, r.detalhe if r.ok else f"{r.titulo}: {r.detalhe}")
        self._atualizar_bandeja(r)

    def _relogio(self) -> None:
        proxima = getattr(self, "proxima", None)
        if self.sincronizando:
            self.v_proxima.configure(text="agora")
        elif proxima:
            falta = max(0, int((proxima - bmweb.agora()).total_seconds()))
            self.v_proxima.configure(text=f"em {falta // 60} min" if falta >= 60 else f"em {falta} s")
        self.after(1000, self._relogio)

    # ---- ações -----------------------------------------------------------
    def atualizar_agora(self) -> None:
        if not self.sincronizando:
            self.agendador.agora_ja()

    def esconder(self) -> None:
        if self.tray:
            self.withdraw()
        else:
            self.iconify()

    def mostrar(self) -> None:
        self.deiconify()
        self.lift()
        self.focus_force()

    def sair(self) -> None:
        if self.tray:
            self.tray.stop()
        self.agendador.parar.set()
        self.agendador.acordar.set()
        self.destroy()

    def pedir_pin(self, titulo: str) -> bool:
        cfg = carregar()
        if not cfg.pin_hash:
            return True
        dlg = DialogoPin(self, titulo)
        self.wait_window(dlg)
        return bool(dlg.valor) and confere_pin(dlg.valor, cfg.pin_hash)

    def abrir_configuracoes(self) -> None:
        if not self.pedir_pin("Digite o PIN para abrir as configurações"):
            return
        janela = Configuracoes(self)
        self.wait_window(janela)
        if janela.salvou:
            self._registrar(True, "Configurações salvas")
            self.atualizar_agora()

    # ---- bandeja ---------------------------------------------------------
    def _iniciar_bandeja(self) -> None:
        try:
            import pystray
            from PIL import Image
        except Exception:  # sem suporte (ex.: Linux sem GTK)
            return
        imagem_arq = caminho_recurso("icone.png")
        imagem = Image.open(imagem_arq) if imagem_arq.exists() else Image.new("RGB", (64, 64), COR["laranja"])

        def no_tk(func):
            return lambda *_: self.no_tk(func)

        menu = pystray.Menu(
            pystray.MenuItem("Abrir o coletor", no_tk(self.mostrar), default=True),
            pystray.MenuItem("Atualizar agora", no_tk(self.atualizar_agora)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair (para de enviar vendas)", no_tk(self._sair_confirmado)),
        )
        self.tray = pystray.Icon("SuperdeliColetor", imagem, "Coletor Superdeli", menu)
        self.tray.run_detached()

    def _atualizar_bandeja(self, r: Resultado) -> None:
        if self.tray:
            self.tray.title = f"Coletor Superdeli · {r.titulo}"

    def _sair_confirmado(self) -> None:
        if self.pedir_pin("Digite o PIN para fechar o coletor"):
            self.sair()


class DialogoPin(ctk.CTkToplevel):
    def __init__(self, pai, titulo: str):
        super().__init__(pai, fg_color=COR["fundo"])
        self.title("PIN")
        self.geometry("340x190")
        self.resizable(False, False)
        self.valor = ""
        ctk.CTkLabel(self, text=titulo, font=(FONTE, 14), text_color=COR["tinta"], wraplength=300).pack(pady=(20, 10))
        self.entrada = ctk.CTkEntry(self, show="•", width=200, height=40, font=(FONTE, 18), justify="center")
        self.entrada.pack()
        self.entrada.bind("<Return>", lambda _: self._ok())
        ctk.CTkButton(self, text="Confirmar", fg_color=COR["laranja"], hover_color=COR["laranja_escuro"], command=self._ok).pack(pady=14)
        self.transient(pai)
        self.after(100, self._focar)

    def _focar(self) -> None:
        self.grab_set()
        self.entrada.focus()

    def _ok(self) -> None:
        self.valor = self.entrada.get().strip()
        self.destroy()


class Configuracoes(ctk.CTkToplevel):
    def __init__(self, pai: App):
        super().__init__(pai, fg_color=COR["fundo"])
        self.title("Configurações do coletor")
        self.geometry("520x680")
        self.resizable(False, True)
        self.app = pai
        self.salvou = False
        self.cfg = carregar()
        barra = ctk.CTkFrame(self, fg_color=COR["cartao"], corner_radius=0, border_width=1, border_color=COR["borda"])
        barra.pack(side="bottom", fill="x")
        self.mensagem = ctk.CTkLabel(barra, text="", font=(FONTE, 13), wraplength=460, justify="left")
        self.mensagem.pack(anchor="w", padx=20, pady=(10, 0))
        self.botao = ctk.CTkButton(
            barra, text="Testar e salvar", height=46, font=(FONTE, 15, "bold"),
            fg_color=COR["laranja"], hover_color=COR["laranja_escuro"], text_color="#FFFFFF",
            text_color_disabled="#F6D8C6", command=self._testar_e_salvar,
        )
        self.botao.pack(fill="x", padx=20, pady=(6, 14))
        quadro = ctk.CTkScrollableFrame(self, fg_color="transparent")
        quadro.pack(fill="both", expand=True, padx=20, pady=(16, 4))
        ctk.CTkLabel(quadro, text="Configurações", font=(FONTE, 22, "bold"), text_color=COR["tinta"]).pack(anchor="w")
        ctk.CTkLabel(
            quadro, text="Preencha uma vez. As senhas ficam guardadas no cofre do Windows.",
            font=(FONTE, 13), text_color=COR["suave"],
        ).pack(anchor="w", pady=(0, 10))

        self.campos: dict[str, ctk.CTkEntry] = {}
        self._secao(quadro, "Acesso ao BMWeb")
        self._campo(quadro, "bm_dominio", "Domínio", self.cfg.bm_dominio)
        self._campo(quadro, "bm_usuario", "Usuário", self.cfg.bm_usuario)
        self._campo(quadro, "bm_senha", "Senha", "", segredo=True, dica="deixe em branco para manter a atual" if self.cfg.bm_senha else "")
        self._secao(quadro, "Banco de dados (Supabase)")
        self._campo(quadro, "supabase_url", "Endereço", self.cfg.supabase_url)
        self._campo(quadro, "supabase_chave", "Chave secreta (sb_secret_…)", "", segredo=True, dica="deixe em branco para manter a atual" if self.cfg.supabase_chave else "")
        self._campo(quadro, "empresa_id", "ID da empresa", self.cfg.empresa_id)
        self._secao(quadro, "Funcionamento")
        ctk.CTkLabel(quadro, text="Atualizar a cada", font=(FONTE, 13), text_color=COR["tinta"]).pack(anchor="w")
        self.intervalo = ctk.CTkSegmentedButton(quadro, values=["15 min", "30 min", "60 min"], selected_color=COR["laranja"], selected_hover_color=COR["laranja_escuro"])
        self.intervalo.set(f"{self.cfg.intervalo_min} min" if self.cfg.intervalo_min in (15, 30, 60) else "30 min")
        self.intervalo.pack(anchor="w", pady=(2, 10))
        self.inicio = ctk.CTkCheckBox(quadro, text="Abrir sozinho quando o computador ligar", font=(FONTE, 13), fg_color=COR["laranja"])
        if self.cfg.iniciar_com_windows:
            self.inicio.select()
        self.inicio.pack(anchor="w", pady=(0, 10))
        self._campo(quadro, "pin", "PIN para proteger as configurações (4 a 8 números)", "", segredo=True, dica="deixe em branco para manter o atual" if self.cfg.pin_hash else "")

        ctk.CTkLabel(quadro, text=f"Registro de atividade: {pasta_logs()}", font=(FONTE, 11), text_color=COR["suave"], wraplength=440, justify="left").pack(anchor="w", pady=(6, 0))
        self.transient(pai)
        self.after(100, self.grab_set)

    def _secao(self, pai, texto: str) -> None:
        ctk.CTkLabel(pai, text=texto, font=(FONTE, 15, "bold"), text_color=COR["laranja"]).pack(anchor="w", pady=(12, 4))

    def _campo(self, pai, chave: str, rotulo: str, valor: str, segredo: bool = False, dica: str = "") -> None:
        ctk.CTkLabel(pai, text=rotulo, font=(FONTE, 13), text_color=COR["tinta"]).pack(anchor="w")
        e = ctk.CTkEntry(pai, height=38, font=(FONTE, 14), show="•" if segredo else "", placeholder_text=dica)
        if valor:
            e.insert(0, valor)
        e.pack(fill="x", pady=(2, 8))
        self.campos[chave] = e

    def _msg(self, texto: str, ok: bool | None = None) -> None:
        cor = COR["verde"] if ok else COR["vermelho"] if ok is False else COR["suave"]
        self.mensagem.configure(text=texto, text_color=cor)
        self.update_idletasks()

    def _testar_e_salvar(self) -> None:
        v = {k: e.get().strip() for k, e in self.campos.items()}
        senha = v["bm_senha"] or self.cfg.bm_senha
        chave = v["supabase_chave"] or self.cfg.supabase_chave
        if not all([v["bm_dominio"], v["bm_usuario"], senha, v["supabase_url"], chave, v["empresa_id"]]):
            return self._msg("Preencha todos os campos.", False)
        if v["pin"] and not (v["pin"].isdigit() and 4 <= len(v["pin"]) <= 8):
            return self._msg("O PIN precisa ter de 4 a 8 números.", False)
        if not v["pin"] and not self.cfg.pin_hash:
            return self._msg("Crie um PIN para proteger as configurações.", False)
        self.botao.configure(state="disabled", text="Testando…")
        threading.Thread(target=self._testar, args=(v, senha, chave), daemon=True).start()

    def _testar(self, v: dict, senha: str, chave: str) -> None:
        tk = self.app.no_tk  # esta função roda fora da thread da janela
        try:
            tk(self._msg, "Entrando no BMWeb…")
            s = bmweb.sessao(v["bm_dominio"], v["bm_usuario"], senha)
            tk(self._msg, "Entrou. Baixando o relatório de hoje…")
            hoje = bmweb.agora().date()
            meta, pedidos, desconhecidas = parse(bmweb.baixar(s, hoje, hoje), "teste.pdf")
            erros, _, _ = validar(meta, pedidos, desconhecidas)
            if erros:
                return tk(self._falhou, "O relatório do BMWeb veio num formato diferente do esperado.")
            tk(self._msg, f"Relatório ok ({len(pedidos)} pedidos hoje). Testando o banco…")
            envio.testar_banco(v["supabase_url"], chave, v["empresa_id"], hoje.isoformat())
        except bmweb.LoginRecusado:
            return tk(self._falhou, "O BMWeb recusou o domínio, o usuário ou a senha (ou o usuário não vê relatórios).")
        except envio.ChaveRecusada:
            return tk(self._falhou, "O banco recusou a chave secreta.")
        except envio.BancoRecusou:
            return tk(self._falhou, "O banco não reconheceu o ID da empresa.")
        except Exception as e:  # noqa: BLE001
            log.warning("teste de configuração falhou: %s", e.__class__.__name__)
            return tk(self._falhou, f"Não consegui testar: {str(e)[:160] or e.__class__.__name__}")
        tk(self._salvar, v, senha, chave)

    def _falhou(self, texto: str) -> None:
        self.botao.configure(state="normal", text="Testar e salvar")
        self._msg(texto, False)

    def _salvar(self, v: dict, senha: str, chave: str) -> None:
        try:
            salvar_segredo("bm_senha", senha)
            salvar_segredo("supabase_chave", chave)
        except Exception as e:  # noqa: BLE001
            return self._falhou(f"Não consegui guardar as senhas no cofre do Windows: {e}")
        cfg = self.cfg
        cfg.bm_dominio, cfg.bm_usuario = v["bm_dominio"], v["bm_usuario"]
        cfg.supabase_url, cfg.empresa_id = v["supabase_url"], v["empresa_id"]
        cfg.intervalo_min = int(self.intervalo.get().split()[0])
        cfg.iniciar_com_windows = bool(self.inicio.get())
        if v["pin"]:
            cfg.pin_hash = hash_pin(v["pin"])
        salvar(cfg)
        try:
            definir_inicio_automatico(cfg.iniciar_com_windows)
        except OSError as e:
            log.warning("início automático: %s", e)
        self.salvou = True
        self._msg("Tudo certo! Configurações salvas.", True)
        self.after(900, self.destroy)


def autoteste() -> str:
    """Confere se o .exe empacotou tudo (usado no build)."""
    linhas = []

    def item(nome, func):
        try:
            linhas.append(f"ok {nome}: {func()}")
        except Exception as e:  # noqa: BLE001
            linhas.append(f"FALHA {nome}: {e.__class__.__name__}: {e}")

    import pymupdf

    item("pymupdf", lambda: pymupdf.open().page_count == 0 and pymupdf.VersionBind)
    item("parser", lambda: parse.__name__)
    item("icone", lambda: caminho_recurso("icone.ico").exists() or (_ for _ in ()).throw(FileNotFoundError("icone.ico")))
    item("tema", lambda: bool(ctk.ThemeManager.theme) or (_ for _ in ()).throw(RuntimeError("tema vazio")))

    def janela():
        raiz = ctk.CTk()
        raiz.withdraw()
        raiz.update()
        raiz.destroy()
        return "abriu"

    item("janela", janela)

    def cofre():
        import keyring

        return type(keyring.get_keyring()).__name__

    item("cofre", cofre)

    def bandeja():
        import pystray

        return pystray.Icon.__module__

    item("bandeja", bandeja)
    return "\n".join(linhas) + "\n"


def main() -> None:
    if "--autoteste" in sys.argv:
        destino = Path(sys.argv[sys.argv.index("--autoteste") + 1])
        destino.write_text(autoteste(), encoding="utf-8")
        return
    configurar_log()
    if ja_esta_aberto():
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, "O Coletor Superdeli já está aberto perto do relógio do Windows.", "Coletor Superdeli", 0x40)
        finally:
            return
    log.info("coletor iniciado v%s", __version__)
    app = App(minimizado="--minimizado" in sys.argv)
    app.mainloop()
    os._exit(0)
