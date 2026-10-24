# Coletor Superdeli

Programa para Windows que fica ligado no computador da loja e, a cada 30 minutos,
baixa o relatório **Pedidos – Por Período – Analítico** do BMWeb, confere os
números e envia para o Supabase (função `ingest_bmweb`). O painel passa a mostrar
as vendas quase em tempo real.

## Como funciona

- Atualiza o dia de hoje a cada 15/30/60 min (configurável).
- Uma vez por dia, depois das 3h, confere o dia anterior inteiro (pega cancelamentos e
  pedidos finalizados tarde).
- Se a internet ou o BMWeb caírem, tenta de novo em 5, 10, 15… minutos.
- O banco recusa relatórios suspeitos (total que não bate, sumiço de muitos pedidos) e
  ignora relatórios idênticos já importados.
- Fechar a janela só esconde: o coletor continua perto do relógio do Windows. Para sair
  de verdade é preciso o PIN.

## Segurança

- Senha do BMWeb e chave do banco ficam no **Gerenciador de Credenciais do Windows**,
  nunca em arquivo.
- As configurações são protegidas por PIN (guardado só como hash).
- A chave do banco só consegue chamar as funções do painel; use uma chave secreta
  exclusiva para o coletor (Supabase → Project Settings → API Keys → *New secret key*),
  para poder trocá-la sem mexer no site.

## Onde ficam os arquivos

| O quê | Onde |
|---|---|
| Configurações | `%APPDATA%\SuperdeliColetor\config.json` |
| Último estado | `%APPDATA%\SuperdeliColetor\estado.json` |
| Registro de atividade | `%LOCALAPPDATA%\SuperdeliColetor\logs\coletor.log` |

## Gerar o .exe

O GitHub Actions (`.github/workflows/coletor.yml`) gera `SuperdeliColetor.exe` em
cada mudança em `coletor/`, roda um autoteste no próprio .exe e publica como artefato.

Para rodar localmente (Python 3.12):

```bash
cd coletor
pip install -r requirements.txt
python run_coletor.py
```

Ícone: `python make_icon.py` regenera `assets/icone.png` e `assets/icone.ico`.
