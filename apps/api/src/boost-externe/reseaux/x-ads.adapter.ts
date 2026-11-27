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

// À reconfirmer auprès de X au moment de l'activation réelle.
const ADS_API_BASE = "https://ads-api.x.com/12";
const OAUTH_AUTHORIZE_BASE = "https://x.com/i/oauth2/authorize";
const OAUTH_TOKEN_URL = "https://api.x.com/2/oauth2/token";

function mapperStatutX(status: string): StatutMappe {
  switch (status) {
    case "DRAFT":
      return "EN_ATTENTE_APPROBATION";
    case "ACTIVE":
      return "DIFFUSION_EN_COURS";
    case "PAUSED":
      return "EN_PAUSE";
    case "DELETED":
      return "TERMINEE";
    default:
      return "EN_ATTENTE_APPROBATION";
  }
}

async function appelXAds(chemin: string, methode: "GET" | "POST", accessToken: string, corps?: Record<string, unknown>): Promise<any> {
  const reponse = await fetch(`${ADS_API_BASE}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const json = await reponse.json().catch(() => ({}) as any);
  if (!reponse.ok) {
    const message = json?.errors?.[0]?.message ?? `Erreur X Ads API (HTTP ${reponse.status})`;
    throw new Error(message);
  }
  return json;
}

/**
 * Adaptateur X Ads API (27 nov. 2026, ELEGANZ BOOST 360°). Nécessite côté
 * app ELEGANZ un accès approuvé à l'API publicitaire X (accès nettement
 * plus restreint/sur candidature que les 3 autres réseaux — démarche à
 * faire par le propriétaire, hors de cet environnement, voir le guide
 * fourni séparément). Nécessite côté boutique un compte publicitaire X
 * existant, avec un moyen de paiement déjà enregistré dessus (requis par X
 * pour obtenir un `funding_instrument_id`, voir creerCampagne ci-dessous).
 *
 * OAuth2 avec PKCE (norme X depuis l'API v2) : `code_challenge`/
 * `code_verifier` gérés par boost-externe.service.ts (state signé portant
 * aussi le verifier), cet adaptateur ne reçoit que le `code` final.
 */
@Injectable()
export class XAdsAdapter implements ReseauPubAdapter {
  readonly canal = BoostCanal.X;
  private readonly logger = new Logger(XAdsAdapter.name);

  genererUrlAutorisation(app: AppConfigReseau, state: string): string {
    const url = new URL(OAUTH_AUTHORIZE_BASE);
    url.searchParams.set("client_id", app.clientId);
    url.searchParams.set("redirect_uri", app.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", app.scopes || "ads.read ads.write offline.access");
    url.searchParams.set("state", state);
    // PKCE : code_challenge attendu dans `state` encodé côté service
    // (contrainte X Ads), simplifié ici à "plain" — à durcir en S256 avant
    // activation réelle.
    url.searchParams.set("code_challenge", "challenge");
    url.searchParams.set("code_challenge_method", "plain");
    return url.toString();
  }

  async echangerCodeContreToken(app: AppConfigReseau, code: string): Promise<ResultatEchangeToken> {
    const reponse = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: app.redirectUri,
        code_verifier: "challenge",
      }).toString(),
    });
    const jeton = await reponse.json().catch(() => ({}) as any);
    if (!reponse.ok) {
      throw new Error(jeton?.error_description ?? `Erreur d'échange de jeton X (HTTP ${reponse.status})`);
    }
    const accessToken = jeton.access_token as string;
    const expiresAt = jeton.expires_in ? new Date(Date.now() + Number(jeton.expires_in) * 1000) : null;

    const comptes = await appelXAds("/accounts", "GET", accessToken);
    const compte = (comptes.data ?? [])[0];
    if (!compte) {
      throw new Error("Aucun compte publicitaire X trouvé sur ce profil — créez-en un sur ads.x.com avant de reconnecter.");
    }

    return {
      accessToken,
      refreshToken: jeton.refresh_token ?? null,
      expiresAt,
      compteExterneId: compte.id,
      compteExterneNom: compte.name ?? null,
      scopesAccordes: jeton.scope ?? null,
    };
  }

  async rafraichirToken(app: AppConfigReseau, refreshToken: string): Promise<ResultatEchangeToken> {
    const reponse = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
    });
    const jeton = await reponse.json().catch(() => ({}) as any);
    if (!reponse.ok) {
      throw new Error(jeton?.error_description ?? `Erreur de rafraîchissement du jeton X (HTTP ${reponse.status})`);
    }
    return {
      accessToken: jeton.access_token,
      refreshToken: jeton.refresh_token ?? refreshToken,
      expiresAt: jeton.expires_in ? new Date(Date.now() + Number(jeton.expires_in) * 1000) : null,
      compteExterneId: "",
    };
  }

  async creerCampagne(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    demande: DemandeCampagneExterne,
  ): Promise<ResultatCreationCampagne> {
    void app;
    const accountId = connexion.compteExterneId;

    const financements = await appelXAds(`/accounts/${accountId}/funding_instruments`, "GET", connexion.accessToken);
    const financement = (financements.data ?? [])[0];
    if (!financement) {
      throw new Error("Aucun moyen de paiement enregistré sur ce compte publicitaire X — à ajouter sur ads.x.com avant de lancer une campagne.");
    }

    const budgetMicro = Math.round(demande.budgetUSD * 1_000_000);
    const campagne = await appelXAds(`/accounts/${accountId}/campaigns`, "POST", connexion.accessToken, {
      name: demande.nomCampagne,
      funding_instrument_id: financement.id,
      daily_budget_amount_local_micro: budgetMicro,
      entity_status: "PAUSED",
      start_time: demande.dateDebut.toISOString(),
      end_time: demande.dateFin.toISOString(),
    });
    const campagneId = campagne.data.id as string;

    const ligneAnnonce = await appelXAds(`/accounts/${accountId}/line_items`, "POST", connexion.accessToken, {
      campaign_id: campagneId,
      name: `${demande.nomCampagne} — ligne d'annonce`,
      product_type: "PROMOTED_TWEETS",
      placements: ["ALL_ON_TWITTER"],
      objective: "WEBSITE_CLICKS",
      entity_status: "PAUSED",
    });

    try {
      const localisations = await appelXAds(
        `/targeting_criteria/locations?location_type=COUNTRIES&q=${encodeURIComponent(demande.audienceGeoISO2)}`,
        "GET",
        connexion.accessToken,
      );
      const lieu = (localisations.data ?? [])[0];
      if (lieu) {
        await appelXAds(`/accounts/${accountId}/targeting_criteria`, "POST", connexion.accessToken, {
          line_item_id: ligneAnnonce.data.id,
          targeting_type: "LOCATION",
          targeting_value: lieu.location_id,
        });
      }
    } catch (err) {
      this.logger.warn(`Ciblage géographique X non appliqué (campagne ${campagneId}) : ${err instanceof Error ? err.message : err}`);
    }

    this.logger.log(`Campagne X créée (en pause) : ${campagneId} — tweet promu à finaliser séparément.`);
    return { externalCampaignId: campagneId, externalAdSetId: ligneAnnonce.data.id, externalStatusRaw: "DRAFT" };
  }

  async recupererStatut(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<StatutExterne> {
    void app;
    const resultat = await appelXAds(`/accounts/${connexion.compteExterneId}/campaigns/${externalCampaignId}`, "GET", connexion.accessToken);
    const statusRaw = resultat.data?.entity_status ?? "DRAFT";
    return { statutMappe: mapperStatutX(statusRaw), statusRaw };
  }

  async recupererStatistiques(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatistiquesExterne> {
    void app;
    const maintenant = new Date();
    const ilYA90Jours = new Date(maintenant.getTime() - 90 * 24 * 60 * 60 * 1000);
    const resultat = await appelXAds(
      `/stats/accounts/${connexion.compteExterneId}?entity=CAMPAIGN&entity_ids=${externalCampaignId}&metric_groups=ENGAGEMENT,BILLING&placement=ALL_ON_TWITTER&granularity=TOTAL&start_time=${ilYA90Jours.toISOString()}&end_time=${maintenant.toISOString()}`,
      "GET",
      connexion.accessToken,
    );
    const metrics = (resultat.data ?? [])[0]?.id_data?.[0]?.metrics ?? {};
    const somme = (valeurs: number[] | null | undefined) => (valeurs ?? []).reduce((a, b) => a + (b ?? 0), 0);
    return {
      impressions: somme(metrics.impressions),
      clics: somme(metrics.clicks),
      portee: 0, // X Ads ne rapporte pas de "portée" (reach) distincte au niveau campagne
      depenseUSD: somme(metrics.billed_charge_local_micro) / 1_000_000,
    };
  }

  async mettreEnPause(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    void app;
    await appelXAds(`/accounts/${connexion.compteExterneId}/campaigns/${externalCampaignId}`, "POST", connexion.accessToken, {
      entity_status: "PAUSED",
    });
  }

  async reprendre(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    void app;
    await appelXAds(`/accounts/${connexion.compteExterneId}/campaigns/${externalCampaignId}`, "POST", connexion.accessToken, {
      entity_status: "ACTIVE",
    });
  }
}
