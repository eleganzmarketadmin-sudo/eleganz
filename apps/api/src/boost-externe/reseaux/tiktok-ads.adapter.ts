import { Injectable, Logger } from "@nestjs/common";
import { BoostCanal } from "@eleganz/database";
import {
  AppConfigReseau,
  ConnexionReseau,
  DemandeCampagneExterne,
  ReseauPubAdapter,
  ResultatCreationCampagne,
  ResultatEchangeToken,
  StatistiquesExterne,
  StatutExterne,
  StatutMappe,
} from "./reseau-pub-adapter.interface";

// À reconfirmer auprès de TikTok au moment de l'activation réelle.
const API_VERSION = "v1.3";
const API_BASE = `https://business-api.tiktok.com/open_api/${API_VERSION}`;

function mapperStatutTiktok(status: string): StatutMappe {
  switch (status) {
    case "CAMPAIGN_STATUS_NOT_START":
    case "ADVERTISER_AUDIT":
    case "AD_PENDING":
      return "EN_ATTENTE_APPROBATION";
    case "CAMPAIGN_STATUS_ENABLE":
    case "AD_STATUS_DELIVERY_OK":
      return "DIFFUSION_EN_COURS";
    case "CAMPAIGN_STATUS_DISABLE":
    case "AD_STATUS_DISABLE":
      return "EN_PAUSE";
    case "AD_STATUS_REJECTED":
    case "AUDIT_DENY":
      return "REJETEE";
    case "CAMPAIGN_STATUS_DELETE":
      return "TERMINEE";
    default:
      return "EN_ATTENTE_APPROBATION";
  }
}

async function appelTiktok(chemin: string, accessToken: string | null, corps?: Record<string, unknown>): Promise<any> {
  const reponse = await fetch(`${API_BASE}${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { "Access-Token": accessToken } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const json = await reponse.json().catch(() => ({}) as any);
  if (!reponse.ok || (typeof json.code === "number" && json.code !== 0)) {
    const message = json?.message ?? `Erreur TikTok Marketing API (HTTP ${reponse.status})`;
    throw new Error(message);
  }
  return json.data ?? json;
}

/**
 * Adaptateur TikTok Marketing API / "TikTok for Business" (27 nov. 2026,
 * ELEGANZ BOOST 360°). Nécessite côté app ELEGANZ une app TikTok for
 * Business Partner approuvée (démarche à faire par le propriétaire, hors
 * de cet environnement). Nécessite côté boutique un compte publicitaire
 * (`advertiser_id`) existant dans TikTok Ads Manager.
 *
 * `location_ids` (ciblage géographique) est un identifiant numérique
 * propre à TikTok, pas un code ISO — résolu dynamiquement via l'API de
 * référence géographique TikTok (resoudreLocationId ci-dessous) à partir du
 * code ISO 3166-1 alpha-2 fourni par la boutique.
 */
@Injectable()
export class TiktokAdsAdapter implements ReseauPubAdapter {
  readonly canal = BoostCanal.TIKTOK;
  private readonly logger = new Logger(TiktokAdsAdapter.name);

  genererUrlAutorisation(app: AppConfigReseau, state: string): string {
    const url = new URL("https://ads.tiktok.com/marketing_api/auth");
    url.searchParams.set("app_id", app.clientId);
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", app.redirectUri);
    return url.toString();
  }

  async echangerCodeContreToken(app: AppConfigReseau, code: string): Promise<ResultatEchangeToken> {
    const resultat = await appelTiktok("/oauth2/access_token/", null, {
      app_id: app.clientId,
      secret: app.clientSecret,
      auth_code: code,
    });
    const accessToken = resultat.access_token as string;
    const advertiserIds: string[] = resultat.advertiser_ids ?? [];
    if (advertiserIds.length === 0) {
      throw new Error("Aucun compte publicitaire TikTok trouvé sur ce profil — créez-en un dans TikTok Ads Manager avant de reconnecter.");
    }
    return {
      accessToken,
      refreshToken: null, // TikTok : le jeton n'expire pas tant qu'il n'est pas révoqué par la boutique
      expiresAt: null,
      compteExterneId: advertiserIds[0],
      compteExterneNom: null,
      scopesAccordes: resultat.scope ? JSON.stringify(resultat.scope) : null,
    };
  }

  private async resoudreLocationId(accessToken: string, advertiserId: string, codeISO2: string): Promise<string> {
    const resultat = await appelTiktok(
      `/tool/region/?advertiser_id=${encodeURIComponent(advertiserId)}&placements=["PLACEMENT_TIKTOK"]`,
      accessToken,
    );
    const regions: Array<{ id: string; country_code?: string }> = resultat?.region_list ?? resultat?.regions ?? [];
    const trouve = regions.find((r) => (r.country_code ?? "").toUpperCase() === codeISO2.toUpperCase());
    if (!trouve) {
      throw new Error(`Audience géographique "${codeISO2}" introuvable dans le référentiel TikTok pour ce compte.`);
    }
    return trouve.id;
  }

  async creerCampagne(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    demande: DemandeCampagneExterne,
  ): Promise<ResultatCreationCampagne> {
    void app;
    const advertiserId = connexion.compteExterneId;

    const campagne = await appelTiktok("/campaign/create/", connexion.accessToken, {
      advertiser_id: advertiserId,
      campaign_name: demande.nomCampagne,
      objective_type: "TRAFFIC",
      budget_mode: "BUDGET_MODE_TOTAL",
      budget: demande.budgetUSD,
    });

    const locationId = await this.resoudreLocationId(connexion.accessToken, advertiserId, demande.audienceGeoISO2);
    const adgroup = await appelTiktok("/adgroup/create/", connexion.accessToken, {
      advertiser_id: advertiserId,
      campaign_id: campagne.campaign_id,
      adgroup_name: `${demande.nomCampagne} — groupe de publicités`,
      placement_type: "PLACEMENT_TYPE_AUTOMATIC",
      location_ids: [locationId],
      budget_mode: "BUDGET_MODE_TOTAL",
      budget: demande.budgetUSD,
      schedule_type: "SCHEDULE_START_END",
      schedule_start_time: demande.dateDebut.toISOString().slice(0, 19).replace("T", " "),
      schedule_end_time: demande.dateFin.toISOString().slice(0, 19).replace("T", " "),
      optimization_goal: "CLICK",
      billing_event: "CPC",
    });

    this.logger.log(
      `Campagne TikTok créée (campagne ${campagne.campaign_id}, groupe de publicités ${adgroup.adgroup_id}) — annonce (visuel/texte) à finaliser séparément.`,
    );
    return {
      externalCampaignId: campagne.campaign_id,
      externalAdSetId: adgroup.adgroup_id,
      externalStatusRaw: "CAMPAIGN_STATUS_NOT_START",
    };
  }

  async recupererStatut(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatutExterne> {
    void app;
    const resultat = await appelTiktok(
      `/campaign/get/?advertiser_id=${encodeURIComponent(connexion.compteExterneId)}&campaign_ids=["${externalCampaignId}"]`,
      connexion.accessToken,
    );
    const campagne = (resultat?.list ?? [])[0];
    const statusRaw = campagne?.operation_status ?? "CAMPAIGN_STATUS_NOT_START";
    return { statutMappe: mapperStatutTiktok(statusRaw), statusRaw };
  }

  async recupererStatistiques(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatistiquesExterne> {
    void app;
    const resultat = await appelTiktok("/report/integrated/get/", connexion.accessToken, {
      advertiser_id: connexion.compteExterneId,
      report_type: "BASIC",
      dimensions: ["campaign_id"],
      metrics: ["impressions", "clicks", "spend", "reach"],
      data_level: "AUCTION_CAMPAIGN",
      filtering: [{ field_name: "campaign_id", filter_type: "IN", filter_value: JSON.stringify([externalCampaignId]) }],
    });
    const ligne = (resultat?.list ?? [])[0]?.metrics ?? {};
    return {
      impressions: Number(ligne.impressions ?? 0),
      clics: Number(ligne.clicks ?? 0),
      portee: Number(ligne.reach ?? 0),
      depenseUSD: Number(ligne.spend ?? 0),
    };
  }

  async mettreEnPause(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    void app;
    await appelTiktok("/campaign/update/status/", connexion.accessToken, {
      advertiser_id: connexion.compteExterneId,
      campaign_ids: [externalCampaignId],
      operation_status: "DISABLE",
    });
  }

  async reprendre(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    void app;
    await appelTiktok("/campaign/update/status/", connexion.accessToken, {
      advertiser_id: connexion.compteExterneId,
      campaign_ids: [externalCampaignId],
      operation_status: "ENABLE",
    });
  }
}
