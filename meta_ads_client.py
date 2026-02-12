"""
Cliente para a API do Meta (Facebook) Marketing.
Conecta à conta de anúncios e extrai dados de campanhas, conjuntos de anúncios,
anúncios e métricas de performance.
"""

import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.user import User

load_dotenv()


class MetaAdsClient:
    """Cliente para interagir com a API do Meta Ads Manager."""

    def __init__(self, access_token=None, ad_account_id=None):
        self.access_token = access_token or os.getenv("META_ACCESS_TOKEN")
        self.ad_account_id = ad_account_id or os.getenv("META_AD_ACCOUNT_ID")

        if not self.access_token:
            raise ValueError("META_ACCESS_TOKEN não configurado. Verifique o arquivo .env")

        FacebookAdsApi.init(access_token=self.access_token)
        self._api = FacebookAdsApi.get_default_api()

    def get_ad_accounts(self):
        """Lista todas as contas de anúncio acessíveis pelo token."""
        me = User(fbid="me")
        accounts = me.get_ad_accounts(fields=[
            AdAccount.Field.account_id,
            AdAccount.Field.name,
            AdAccount.Field.account_status,
            AdAccount.Field.currency,
            AdAccount.Field.balance,
            AdAccount.Field.amount_spent,
        ])
        return [
            {
                "id": acc["id"],
                "account_id": acc.get("account_id"),
                "name": acc.get("name"),
                "status": acc.get("account_status"),
                "currency": acc.get("currency"),
                "balance": acc.get("balance"),
                "amount_spent": acc.get("amount_spent"),
            }
            for acc in accounts
        ]

    def _get_account(self):
        """Retorna o objeto AdAccount configurado."""
        if not self.ad_account_id:
            accounts = self.get_ad_accounts()
            if not accounts:
                raise ValueError("Nenhuma conta de anúncio encontrada para este token.")
            self.ad_account_id = accounts[0]["id"]
            print(f"Usando conta: {accounts[0]['name']} ({self.ad_account_id})")
        account_id = self.ad_account_id
        if not account_id.startswith("act_"):
            account_id = f"act_{account_id}"
        return AdAccount(account_id)

    def get_campaigns(self, limit=100):
        """Lista as campanhas da conta de anúncios."""
        account = self._get_account()
        campaigns = account.get_campaigns(fields=[
            Campaign.Field.id,
            Campaign.Field.name,
            Campaign.Field.status,
            Campaign.Field.objective,
            Campaign.Field.daily_budget,
            Campaign.Field.lifetime_budget,
            Campaign.Field.start_time,
            Campaign.Field.stop_time,
            Campaign.Field.created_time,
            Campaign.Field.updated_time,
        ], params={"limit": limit})
        return [dict(c) for c in campaigns]

    def get_adsets(self, campaign_id=None, limit=100):
        """Lista os conjuntos de anúncios. Filtra por campanha se fornecido."""
        account = self._get_account()
        params = {"limit": limit}
        if campaign_id:
            params["filtering"] = [{"field": "campaign_id", "operator": "EQUAL", "value": campaign_id}]
        adsets = account.get_ad_sets(fields=[
            AdSet.Field.id,
            AdSet.Field.name,
            AdSet.Field.status,
            AdSet.Field.daily_budget,
            AdSet.Field.lifetime_budget,
            AdSet.Field.targeting,
            AdSet.Field.optimization_goal,
            AdSet.Field.billing_event,
            AdSet.Field.bid_amount,
            AdSet.Field.start_time,
            AdSet.Field.end_time,
        ], params=params)
        return [dict(a) for a in adsets]

    def get_ads(self, campaign_id=None, adset_id=None, limit=100):
        """Lista os anúncios. Filtra por campanha ou conjunto se fornecido."""
        account = self._get_account()
        params = {"limit": limit}
        filtering = []
        if campaign_id:
            filtering.append({"field": "campaign_id", "operator": "EQUAL", "value": campaign_id})
        if adset_id:
            filtering.append({"field": "adset_id", "operator": "EQUAL", "value": adset_id})
        if filtering:
            params["filtering"] = filtering
        ads = account.get_ads(fields=[
            Ad.Field.id,
            Ad.Field.name,
            Ad.Field.status,
            Ad.Field.creative,
            Ad.Field.created_time,
            Ad.Field.updated_time,
        ], params=params)
        return [dict(a) for a in ads]

    def get_insights(self, level="campaign", date_preset=None,
                     time_range=None, fields=None, limit=500):
        """
        Obtém métricas de performance (insights) da conta.

        Args:
            level: 'account', 'campaign', 'adset', ou 'ad'
            date_preset: Ex: 'last_7d', 'last_30d', 'last_90d', 'this_month', 'last_month'
            time_range: Dict com 'since' e 'until' (formato YYYY-MM-DD)
            fields: Lista de campos de métricas
            limit: Número máximo de resultados
        """
        account = self._get_account()

        if fields is None:
            fields = [
                "campaign_name",
                "campaign_id",
                "adset_name",
                "adset_id",
                "ad_name",
                "ad_id",
                "impressions",
                "clicks",
                "ctr",
                "cpc",
                "cpm",
                "spend",
                "reach",
                "frequency",
                "actions",
                "cost_per_action_type",
                "date_start",
                "date_stop",
            ]

        params = {
            "level": level,
            "limit": limit,
        }

        if date_preset:
            params["date_preset"] = date_preset
        elif time_range:
            params["time_range"] = time_range
        else:
            # Default: últimos 30 dias
            today = datetime.now()
            thirty_days_ago = today - timedelta(days=30)
            params["time_range"] = {
                "since": thirty_days_ago.strftime("%Y-%m-%d"),
                "until": today.strftime("%Y-%m-%d"),
            }

        insights = account.get_insights(fields=fields, params=params)
        return [dict(i) for i in insights]

    def get_campaign_insights(self, campaign_id, date_preset="last_30d", fields=None):
        """Obtém insights de uma campanha específica."""
        campaign = Campaign(campaign_id)
        if fields is None:
            fields = [
                "impressions",
                "clicks",
                "ctr",
                "cpc",
                "cpm",
                "spend",
                "reach",
                "frequency",
                "actions",
                "cost_per_action_type",
                "date_start",
                "date_stop",
            ]
        params = {"date_preset": date_preset}
        insights = campaign.get_insights(fields=fields, params=params)
        return [dict(i) for i in insights]
