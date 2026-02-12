"""
Módulo de análise de dados do Meta Ads.
Processa e formata os dados extraídos da API para análise.
"""

import pandas as pd
from tabulate import tabulate


def parse_actions(actions):
    """Converte a lista de ações do Meta em um dicionário legível."""
    if not actions:
        return {}
    return {a["action_type"]: int(a["value"]) for a in actions}


def parse_cost_per_action(cost_per_action):
    """Converte custos por ação em dicionário."""
    if not cost_per_action:
        return {}
    return {a["action_type"]: float(a["value"]) for a in cost_per_action}


def insights_to_dataframe(insights):
    """Converte insights da API em um DataFrame do pandas."""
    rows = []
    for item in insights:
        row = {
            "campaign_name": item.get("campaign_name", ""),
            "campaign_id": item.get("campaign_id", ""),
            "adset_name": item.get("adset_name", ""),
            "adset_id": item.get("adset_id", ""),
            "ad_name": item.get("ad_name", ""),
            "ad_id": item.get("ad_id", ""),
            "impressions": int(item.get("impressions", 0)),
            "clicks": int(item.get("clicks", 0)),
            "ctr": float(item.get("ctr", 0)),
            "cpc": float(item.get("cpc", 0)),
            "cpm": float(item.get("cpm", 0)),
            "spend": float(item.get("spend", 0)),
            "reach": int(item.get("reach", 0)),
            "frequency": float(item.get("frequency", 0)),
            "date_start": item.get("date_start", ""),
            "date_stop": item.get("date_stop", ""),
        }

        actions = parse_actions(item.get("actions"))
        for action_type, value in actions.items():
            row[f"action_{action_type}"] = value

        cost_per_action = parse_cost_per_action(item.get("cost_per_action_type"))
        for action_type, value in cost_per_action.items():
            row[f"cost_per_{action_type}"] = value

        rows.append(row)

    return pd.DataFrame(rows)


def print_accounts_summary(accounts):
    """Exibe um resumo das contas de anúncio."""
    if not accounts:
        print("Nenhuma conta de anúncio encontrada.")
        return
    status_map = {1: "Ativa", 2: "Desativada", 3: "Não confirmada", 7: "Pendente"}
    table = []
    for acc in accounts:
        table.append([
            acc.get("name", "N/A"),
            acc.get("id", ""),
            status_map.get(acc.get("status"), acc.get("status", "N/A")),
            acc.get("currency", "N/A"),
            acc.get("amount_spent", "0"),
        ])
    print("\n=== CONTAS DE ANÚNCIO ===")
    print(tabulate(table, headers=["Nome", "ID", "Status", "Moeda", "Gasto Total"],
                   tablefmt="grid"))


def print_campaigns_summary(campaigns):
    """Exibe um resumo das campanhas."""
    if not campaigns:
        print("Nenhuma campanha encontrada.")
        return
    table = []
    for c in campaigns:
        budget = c.get("daily_budget") or c.get("lifetime_budget") or "N/A"
        budget_type = "Diário" if c.get("daily_budget") else "Vitalício" if c.get("lifetime_budget") else ""
        table.append([
            c.get("name", "N/A"),
            c.get("id", ""),
            c.get("status", "N/A"),
            c.get("objective", "N/A"),
            f"{budget} ({budget_type})" if budget_type else budget,
        ])
    print("\n=== CAMPANHAS ===")
    print(tabulate(table, headers=["Nome", "ID", "Status", "Objetivo", "Orçamento"],
                   tablefmt="grid"))


def print_insights_summary(df):
    """Exibe um resumo dos insights de performance."""
    if df.empty:
        print("Nenhum dado de insights encontrado.")
        return

    print("\n=== RESUMO DE PERFORMANCE ===")
    print(f"Período: {df['date_start'].min()} a {df['date_stop'].max()}")
    print(f"Total de registros: {len(df)}")

    print("\n--- Métricas Gerais ---")
    summary = {
        "Impressões": f"{df['impressions'].sum():,.0f}",
        "Alcance": f"{df['reach'].sum():,.0f}",
        "Cliques": f"{df['clicks'].sum():,.0f}",
        "CTR Médio": f"{df['ctr'].mean():.2f}%",
        "CPC Médio": f"R$ {df['cpc'].mean():.2f}",
        "CPM Médio": f"R$ {df['cpm'].mean():.2f}",
        "Gasto Total": f"R$ {df['spend'].sum():,.2f}",
        "Frequência Média": f"{df['frequency'].mean():.2f}",
    }
    for k, v in summary.items():
        print(f"  {k}: {v}")

    # Métricas por campanha
    if "campaign_name" in df.columns and df["campaign_name"].nunique() > 1:
        print("\n--- Performance por Campanha ---")
        campaign_summary = df.groupby("campaign_name").agg({
            "impressions": "sum",
            "clicks": "sum",
            "spend": "sum",
            "reach": "sum",
            "ctr": "mean",
            "cpc": "mean",
        }).round(2)
        campaign_summary.columns = ["Impressões", "Cliques", "Gasto", "Alcance", "CTR Médio", "CPC Médio"]
        print(tabulate(campaign_summary, headers="keys", tablefmt="grid", showindex=True))

    # Ações (conversões)
    action_cols = [c for c in df.columns if c.startswith("action_")]
    if action_cols:
        print("\n--- Ações / Conversões ---")
        action_table = []
        for col in action_cols:
            action_name = col.replace("action_", "")
            total = df[col].sum()
            if total > 0:
                cost_col = f"cost_per_{action_name}"
                avg_cost = f"R$ {df[cost_col].mean():.2f}" if cost_col in df.columns else "N/A"
                action_table.append([action_name, f"{total:,.0f}", avg_cost])
        if action_table:
            print(tabulate(action_table, headers=["Tipo de Ação", "Total", "Custo Médio"],
                           tablefmt="grid"))


def export_to_csv(df, filename="meta_ads_report.csv"):
    """Exporta os dados para CSV."""
    import os
    os.makedirs("output", exist_ok=True)
    path = os.path.join("output", filename)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"\nDados exportados para: {path}")
    return path
