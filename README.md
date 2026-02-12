# Meta Ads Manager - Análise de Dados

Projeto para conectar à API do Meta (Facebook) Marketing e analisar dados de performance dos anúncios.

## Funcionalidades

- Listar contas de anúncio vinculadas ao token
- Listar campanhas, conjuntos de anúncios e anúncios
- Obter métricas de performance (impressões, cliques, CTR, CPC, CPM, gasto, alcance, etc.)
- Análise por campanha, conjunto de anúncio e anúncio individual
- Exportação dos dados para CSV

## Setup

### 1. Instalar dependências

```bash
pip install -r requirements.txt
```

### 2. Configurar o token de acesso

Copie o arquivo `.env.example` para `.env` e insira seu token:

```bash
cp .env.example .env
```

Edite o `.env` com seu token do Meta Marketing API:

```
META_ACCESS_TOKEN=seu_token_aqui
META_AD_ACCOUNT_ID=act_XXXXXXXXX  # opcional
```

### 3. Executar

```bash
python main.py
```

## Estrutura do Projeto

```
├── main.py                 # Script principal
├── meta_ads_client.py      # Cliente da API do Meta Marketing
├── meta_ads_analyzer.py    # Módulo de análise e formatação de dados
├── requirements.txt        # Dependências Python
├── .env.example            # Exemplo de configuração
├── .env                    # Configuração local (não commitado)
└── output/                 # Relatórios CSV exportados
```

## Como obter o token de acesso

1. Acesse o [Meta Business Suite](https://business.facebook.com/)
2. Vá em Configurações > Integrações > Tokens de acesso
3. Ou use o [Graph API Explorer](https://developers.facebook.com/tools/explorer/) para gerar um token com as permissões `ads_read` e `ads_management`
