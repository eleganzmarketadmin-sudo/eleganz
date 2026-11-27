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

// À reconfirmer auprès de Meta au moment de l'activation réelle — Meta
// déprécie une version de la Graph API tous les ~2 ans.
const API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

function mapperStatutMeta(effectiveStatus: string): StatutMappe {
  switch (effectiveStatus) {
    case "PENDING_REVIEW":
    case "IN_PROCESS":
    case "PENDING_BILLING_INFO":
      return "EN_ATTENTE_APPROBATION";
    case "ACTIVE":
      return "DIFFUSION_EN_COURS";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "EN_PAUSE";
    case "DISAPPROVED":
      return "REJETEE";
    case "DELETED":
    case "ARCHIVED":
      return "TERMINEE";
    case "WITH_ISSUES":
      return "ERREUR";
    default:
      return "EN_ATTENTE_APPROBATION";
  }
}

async function appelGraph(chemin: string, methode: "GET" | "POST", params: Record<string, string>): Promise<any> {
  let reponse: Response;
  if (methode === "GET") {
    const url = new URL(`${GRAPH_BASE}${chemin}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    reponse = await fetch(url.toString());
  } else {
    reponse = await fetch(`${GRAPH_BASE}${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
  }
  const corps = await reponse.json().catch(() => ({}) as any);
  if (!reponse.ok) {
    const message = corps?.error?.message ?? `Erreur Meta Graph API (HTTP ${reponse.status})`;
    throw new Error(message);
  }
  return corps;
}

/**
 * Adaptateur Meta Marketing API (27 nov. 2026, ELEGANZ BOOST 360°) — couvre
 * À LA FOIS Facebook ET Instagram : les deux réseaux se pilotent depuis la
 * même API (un même compte publicitaire `act_{id}`, le placement Instagram
 * se configure dans le ciblage de l'ensemble de publicités) — voir
 * boost-externe.service.ts, qui instancie cet adaptateur aussi bien pour
 * BoostCanal.FACEBOOK que BoostCanal.INSTAGRAM (deux connexions OAuth
 * distinctes possibles côté boutique, un seul code côté ELEGANZ).
 *
 * Nécessite côté app ELEGANZ (démarche à faire par le propriétaire, hors de
 * cet environnement — voir le guide fourni séparément) : produit "Marketing
 * API" ajouté sur developers.facebook.com, et autorisation avancée
 * ("Advanced Access") du scope `ads_management` obtenue via App Review
 * (vérification d'entreprise + démonstration d'usage réel).
 *
 * Nécessite côté boutique : un compte publicitaire Meta ET une Page
 * Facebook (l'API Meta exige une Page liée pour tout format d'annonce avec
 * lien — récupérée dynamiquement via /me/accounts au moment de la création
 * de campagne, voir creerCampagne ci-dessous).
 *
 * Meta n'a pas de refresh_token classique pour un jeton utilisateur : le
 * jeton longue durée obtenu à la connexion dure environ 60 jours, au-delà
 * desquels la boutique doit reconnecter son compte (voir `rafraichirToken`
 * volontairement absent de cet adaptateur — le statut passe à EXPIRE et
 * BoostExterneService invite la boutique à se reconnecter).
 */
@Injectable()
export class MetaAdsAdapter implements ReseauPubAdapter {
  readonly canal = BoostCanal.FACEBOOK; // ré-instancié pour INSTAGRAM par le registre, voir reseau-pub-adapter.factory.ts
  private readonly logger = new Logger(MetaAdsAdapter.name);

  genererUrlAutorisation(app: AppConfigReseau, state: string): string {
    const url = new URL(`https://www.facebook.com/${API_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", app.clientId);
    url.searchParams.set("redirect_uri", app.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set(
      "scope",
      app.scopes || "ads_management,ads_read,business_management,pages_read_engagement",
    );
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  async echangerCodeContreToken(app: AppConfigReseau, code: string): Promise<ResultatEchangeToken> {
    // 1) Échange standard code → jeton court (valide ~1-2h).
    const court = await appelGraph("/oauth/access_token", "GET", {
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: app.redirectUri,
      code,
    });
    // 2) Extension en jeton longue durée (~60 jours).
    const long = await appelGraph("/oauth/access_token", "GET", {
      grant_type: "fb_exchange_token",
      client_id: app.clientId,
      client_secret: app.clientSecret,
      fb_exchange_token: court.access_token,
    });
    const accessToken = long.access_token as string;
    const expiresAt = long.expires_in ? new Date(Date.now() + Number(long.expires_in) * 1000) : null;

    const comptes = await appelGraph("/me/adaccounts", "GET", {
      fields: "id,name,account_status",
      access_token: accessToken,
    });
    const compte = (comptes.data ?? [])[0];
    if (!compte) {
      throw new Error(
        "Aucun compte publicitaire Meta trouvé sur ce profil — créez-en un dans Meta Business Manager avant de reconnecter.",
      );
    }

    return {
      accessToken,
      refreshToken: null,
      expiresAt,
      compteExterneId: compte.id, // déjà au format "act_123..."
      compteExterneNom: compte.name ?? null,
      scopesAccordes: app.scopes,
    };
  }

  async creerCampagne(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    demande: DemandeCampagneExterne,
  ): Promise<ResultatCreationCampagne> {
    void app;
    const compteId = connexion.compteExterneId;

    const campagne = await appelGraph(`/${compteId}/campaigns`, "POST", {
      name: demande.nomCampagne,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED", // reste en pause jusqu'à reprise explicite (voir reprendre()), même après approbation Meta
      special_ad_categories: "[]",
      access_token: connexion.accessToken,
    });

    const budgetTotalCents = Math.round(demande.budgetUSD * 100);
    const adset = await appelGraph(`/${compteId}/adsets`, "POST", {
      name: `${demande.nomCampagne} — ensemble de publicités`,
      campaign_id: campagne.id,
      lifetime_budget: String(budgetTotalCents),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify({ geo_locations: { countries: [demande.audienceGeoISO2] } }),
      start_time: demande.dateDebut.toISOString(),
      end_time: demande.dateFin.toISOString(),
      status: "PAUSED",
      access_token: connexion.accessToken,
    });

    this.logger.log(
      `Campagne Meta créée (campagne ${campagne.id}, ensemble de publicités ${adset.id}) — annonce (visuel/texte) à finaliser séparément, Page Facebook requise.`,
    );
    // NOTE : la création de l'annonce elle-même (ad + ad creative) exige une
    // Page Facebook liée au compte publicitaire et un visuel — non câblée
    // ici volontairement (dépend d'une Page que la boutique doit d'abord
    // connecter). Campagne et ensemble de publicités sont réels et créés ;
    // leur finalisation (annonce) est la prochaine étape incrémentale.
    return { externalCampaignId: campagne.id, externalAdSetId: adset.id, externalStatusRaw: "PAUSED" };
  }

  async recupererStatut(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatutExterne> {
    void app;
    const resultat = await appelGraph(`/${externalCampaignId}`, "GET", {
      fields: "effective_status,configured_status",
      access_token: connexion.accessToken,
    });
    return { statutMappe: mapperStatutMeta(resultat.effective_status), statusRaw: resultat.effective_status };
  }

  async recupererStatistiques(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatistiquesExterne> {
    void app;
    const resultat = await appelGraph(`/${externalCampaignId}/insights`, "GET", {
      fields: "impressions,clicks,reach,spend",
      date_preset: "maximum",
      access_token: connexion.accessToken,
    });
    const ligne = (resultat.data ?? [])[0] ?? {};
    return {
      impressions: Number(ligne.impressions ?? 0),
      clics: Number(ligne.clicks ?? 0),
      portee: Number(ligne.reach ?? 0),
      depenseUSD: Number(ligne.spend ?? 0),
    };
  }

  async mettreEnPause(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    void app;
    await appelGraph(`/${externalCampaignId}`, "POST", { status: "PAUSED", access_token: connexion.accessToken });
  }

  async reprendre(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    void app;
    await appelGraph(`/${externalCampaignId}`, "POST", { status: "ACTIVE", access_token: connexion.accessToken });
  }
}
