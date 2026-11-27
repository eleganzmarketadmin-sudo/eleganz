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

// À reconfirmer auprès de Google au moment de l'activation réelle — Google
// déprécie une version de l'API Google Ads environ une fois par an.
const API_VERSION = "v17";
const ADS_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

function mapperStatutGoogle(status: string): StatutMappe {
  switch (status) {
    case "PENDING":
      return "EN_ATTENTE_APPROBATION";
    case "ENABLED":
      return "DIFFUSION_EN_COURS";
    case "PAUSED":
      return "EN_PAUSE";
    case "REMOVED":
      return "TERMINEE";
    default:
      return "EN_ATTENTE_APPROBATION";
  }
}

/**
 * Jeton développeur Google Ads — PROPRE À ELEGANZ (pas à la boutique),
 * obtenu une seule fois auprès de Google (niveau d'accès Basic/Standard,
 * validé par Google) pour toute l'application. Réutilise le champ
 * `accountIdPartenaire` de AppConfigReseau (voir boost-externe.service.ts,
 * qui construit AppConfigReseau depuis BoostCanalConfig — pour le canal
 * GOOGLE, `accountId` porte ce jeton développeur plutôt qu'un identifiant
 * d'organisation, faute d'un champ dédié dans ce schéma).
 */
function jetonDeveloppeur(app: AppConfigReseau): string {
  if (!app.accountIdPartenaire) {
    throw new Error("Jeton développeur Google Ads manquant — à renseigner dans Centre de pilotage → Boost 360° → Google.");
  }
  return app.accountIdPartenaire;
}

async function appelGoogleAds(
  chemin: string,
  methode: "GET" | "POST",
  app: AppConfigReseau,
  accessToken: string,
  corps?: Record<string, unknown>,
): Promise<any> {
  const reponse = await fetch(`${ADS_BASE}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": jetonDeveloppeur(app),
      "Content-Type": "application/json",
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const json = await reponse.json().catch(() => ({}) as any);
  if (!reponse.ok) {
    const message = json?.error?.message ?? `Erreur Google Ads API (HTTP ${reponse.status})`;
    throw new Error(message);
  }
  return json;
}

/**
 * Adaptateur Google Ads API (27 nov. 2026, ELEGANZ BOOST 360°). Nécessite
 * côté app ELEGANZ un compte développeur Google Ads API avec jeton
 * développeur approuvé (démarche à faire par le propriétaire, hors de cet
 * environnement). Nécessite côté boutique un compte Google Ads existant,
 * accessible par le compte Google utilisé pour l'autorisation OAuth.
 */
@Injectable()
export class GoogleAdsAdapter implements ReseauPubAdapter {
  readonly canal = BoostCanal.GOOGLE;
  private readonly logger = new Logger(GoogleAdsAdapter.name);

  genererUrlAutorisation(app: AppConfigReseau, state: string): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", app.clientId);
    url.searchParams.set("redirect_uri", app.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", app.scopes || "https://www.googleapis.com/auth/adwords");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async echangerCodeContreToken(app: AppConfigReseau, code: string): Promise<ResultatEchangeToken> {
    const reponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: app.clientId,
        client_secret: app.clientSecret,
        redirect_uri: app.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const jeton = await reponse.json().catch(() => ({}) as any);
    if (!reponse.ok) {
      throw new Error(jeton?.error_description ?? `Erreur d'échange de jeton Google (HTTP ${reponse.status})`);
    }
    const accessToken = jeton.access_token as string;
    const expiresAt = jeton.expires_in ? new Date(Date.now() + Number(jeton.expires_in) * 1000) : null;

    const comptes = await appelGoogleAds("/customers:listAccessibleCustomers", "GET", app, accessToken);
    const resourceNames: string[] = comptes.resourceNames ?? [];
    if (resourceNames.length === 0) {
      throw new Error("Aucun compte Google Ads accessible depuis ce profil — créez-en un sur ads.google.com avant de reconnecter.");
    }
    const customerId = resourceNames[0].replace("customers/", "");

    return {
      accessToken,
      refreshToken: jeton.refresh_token ?? null,
      expiresAt,
      compteExterneId: customerId,
      compteExterneNom: null,
      scopesAccordes: app.scopes,
    };
  }

  async rafraichirToken(app: AppConfigReseau, refreshToken: string): Promise<ResultatEchangeToken> {
    const reponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: app.clientId,
        client_secret: app.clientSecret,
        grant_type: "refresh_token",
      }).toString(),
    });
    const jeton = await reponse.json().catch(() => ({}) as any);
    if (!reponse.ok) {
      throw new Error(jeton?.error_description ?? `Erreur de rafraîchissement du jeton Google (HTTP ${reponse.status})`);
    }
    return {
      accessToken: jeton.access_token,
      refreshToken,
      expiresAt: jeton.expires_in ? new Date(Date.now() + Number(jeton.expires_in) * 1000) : null,
      compteExterneId: "", // non pertinent pour un rafraîchissement — le code appelant conserve l'identifiant déjà connu
    };
  }

  private async resoudreGeoTargetConstant(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    codeISO2: string,
  ): Promise<string> {
    const resultat = await appelGoogleAds(
      `/customers/${connexion.compteExterneId}/googleAds:search`,
      "POST",
      app,
      connexion.accessToken,
      { query: `SELECT geo_target_constant.resource_name FROM geo_target_constant WHERE geo_target_constant.country_code = '${codeISO2}' AND geo_target_constant.target_type = 'Country'` },
    );
    const ligne = (resultat.results ?? [])[0];
    if (!ligne) throw new Error(`Audience géographique "${codeISO2}" introuvable dans le référentiel Google Ads.`);
    return ligne.geoTargetConstant.resourceName as string;
  }

  async creerCampagne(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    demande: DemandeCampagneExterne,
  ): Promise<ResultatCreationCampagne> {
    const customerId = connexion.compteExterneId;
    const budgetMicros = Math.round(demande.budgetUSD * 1_000_000);

    const budget = await appelGoogleAds(
      `/customers/${customerId}/campaignBudgets:mutate`,
      "POST",
      app,
      connexion.accessToken,
      {
        operations: [
          {
            create: {
              name: `${demande.nomCampagne} — budget`,
              amountMicros: String(budgetMicros),
              deliveryMethod: "STANDARD",
            },
          },
        ],
      },
    );
    const budgetResourceName = budget.results[0].resourceName as string;

    const campagne = await appelGoogleAds(
      `/customers/${customerId}/campaigns:mutate`,
      "POST",
      app,
      connexion.accessToken,
      {
        operations: [
          {
            create: {
              name: demande.nomCampagne,
              status: "PAUSED",
              advertisingChannelType: "DISPLAY",
              campaignBudget: budgetResourceName,
              startDate: demande.dateDebut.toISOString().slice(0, 10).replace(/-/g, ""),
              endDate: demande.dateFin.toISOString().slice(0, 10).replace(/-/g, ""),
            },
          },
        ],
      },
    );
    const campagneResourceName = campagne.results[0].resourceName as string;
    const campagneId = campagneResourceName.split("/").pop() as string;

    try {
      const geoResourceName = await this.resoudreGeoTargetConstant(app, connexion, demande.audienceGeoISO2);
      await appelGoogleAds(`/customers/${customerId}/campaignCriteria:mutate`, "POST", app, connexion.accessToken, {
        operations: [{ create: { campaign: campagneResourceName, location: { geoTargetConstant: geoResourceName } } }],
      });
    } catch (err) {
      this.logger.warn(`Ciblage géographique Google Ads non appliqué (campagne ${campagneId}) : ${err instanceof Error ? err.message : err}`);
    }

    this.logger.log(`Campagne Google Ads créée (en pause) : ${campagneId} — groupe d'annonces/annonce à finaliser séparément.`);
    return { externalCampaignId: campagneId, externalAdSetId: null, externalStatusRaw: "PAUSED" };
  }

  async recupererStatut(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatutExterne> {
    const resultat = await appelGoogleAds(
      `/customers/${connexion.compteExterneId}/googleAds:search`,
      "POST",
      app,
      connexion.accessToken,
      { query: `SELECT campaign.status FROM campaign WHERE campaign.id = ${externalCampaignId}` },
    );
    const statusRaw = (resultat.results ?? [])[0]?.campaign?.status ?? "PENDING";
    return { statutMappe: mapperStatutGoogle(statusRaw), statusRaw };
  }

  async recupererStatistiques(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatistiquesExterne> {
    const resultat = await appelGoogleAds(
      `/customers/${connexion.compteExterneId}/googleAds:search`,
      "POST",
      app,
      connexion.accessToken,
      {
        query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE campaign.id = ${externalCampaignId} DURING ALL_TIME`,
      },
    );
    const ligne = (resultat.results ?? [])[0]?.metrics ?? {};
    return {
      impressions: Number(ligne.impressions ?? 0),
      clics: Number(ligne.clicks ?? 0),
      portee: 0, // Google Ads ne rapporte pas de "portée" distincte par défaut sur Display — nécessiterait un segment dédié
      depenseUSD: Number(ligne.costMicros ?? 0) / 1_000_000,
    };
  }

  async mettreEnPause(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    await appelGoogleAds(`/customers/${connexion.compteExterneId}/campaigns:mutate`, "POST", app, connexion.accessToken, {
      operations: [{ update: { resourceName: `customers/${connexion.compteExterneId}/campaigns/${externalCampaignId}`, status: "PAUSED" }, updateMask: "status" }],
    });
  }

  async reprendre(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void> {
    await appelGoogleAds(`/customers/${connexion.compteExterneId}/campaigns:mutate`, "POST", app, connexion.accessToken, {
      operations: [{ update: { resourceName: `customers/${connexion.compteExterneId}/campaigns/${externalCampaignId}`, status: "ENABLED" }, updateMask: "status" }],
    });
  }
}
