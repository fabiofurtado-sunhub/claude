#!/usr/bin/env python3
"""
Meta Ads Manager - Análise de Dados
Conecta à API do Meta Marketing e exibe dados de performance dos anúncios.
"""

import sys

from meta_ads_client import MetaAdsClient
from meta_ads_analyzer import (
    insights_to_dataframe,
    print_accounts_summary,
    print_campaigns_summary,
    print_insights_summary,
    export_to_csv,
)


def main():
    print("=" * 60)
    print("  META ADS MANAGER - Análise de Dados")
    print("=" * 60)

    try:
        client = MetaAdsClient()
    except ValueError as e:
        print(f"\nErro: {e}")
        sys.exit(1)

    # 1. Listar contas de anúncio
    print("\nBuscando contas de anúncio...")
    try:
        accounts = client.get_ad_accounts()
        print_accounts_summary(accounts)
    except Exception as e:
        print(f"Erro ao buscar contas: {e}")
        sys.exit(1)

    # 2. Listar campanhas
    print("\nBuscando campanhas...")
    try:
        campaigns = client.get_campaigns()
        print_campaigns_summary(campaigns)
    except Exception as e:
        print(f"Erro ao buscar campanhas: {e}")

    # 3. Obter insights de performance (últimos 30 dias)
    print("\nBuscando insights de performance (últimos 30 dias)...")
    try:
        insights = client.get_insights(level="campaign", date_preset="last_30d")
        if insights:
            df = insights_to_dataframe(insights)
            print_insights_summary(df)
            export_to_csv(df)
        else:
            print("Nenhum dado de insights encontrado no período.")
    except Exception as e:
        print(f"Erro ao buscar insights: {e}")

    # 4. Insights por conjunto de anúncio
    print("\nBuscando insights por conjunto de anúncios (últimos 30 dias)...")
    try:
        adset_insights = client.get_insights(level="adset", date_preset="last_30d")
        if adset_insights:
            df_adset = insights_to_dataframe(adset_insights)
            export_to_csv(df_adset, "meta_ads_adset_report.csv")
        else:
            print("Nenhum dado de insights por conjunto de anúncio.")
    except Exception as e:
        print(f"Erro ao buscar insights de adsets: {e}")

    # 5. Insights por anúncio individual
    print("\nBuscando insights por anúncio (últimos 30 dias)...")
    try:
        ad_insights = client.get_insights(level="ad", date_preset="last_30d")
        if ad_insights:
            df_ad = insights_to_dataframe(ad_insights)
            export_to_csv(df_ad, "meta_ads_ad_report.csv")
        else:
            print("Nenhum dado de insights por anúncio.")
    except Exception as e:
        print(f"Erro ao buscar insights de ads: {e}")

    print("\n" + "=" * 60)
    print("  Análise concluída!")
    print("=" * 60)


if __name__ == "__main__":
    main()
