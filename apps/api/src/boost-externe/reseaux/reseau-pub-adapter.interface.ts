import { BoostCanal } from "@eleganz/database";

/**
 * Interface commune aux 5 réseaux publicitaires externes (ELEGANZ BOOST
 * 360°, 27 nov. 2026). Chaque réseau a son propre adaptateur
 * (meta-ads.adapter.ts, tiktok-ads.adapter.ts, google-ads.adapter.ts,
 * x-ads.adapter.ts) qui implémente cette interface en appelant les vraies
 * API documentées de ce réseau — aucune simulation : tant qu'aucune
 * configuration d'app ELEGANZ valide (BoostCanalConfig) ni connexion OAuth
 * de boutique (ShopAdAccountConnexion) n'existent pour ce canal, les appels
 * échoueront simplement avec l'erreur renvoyée par le réseau (identifiants
 * manquants/invalides) — comportement normal et attendu tant que
 * l'enregistrement réel de l'app ELEGANZ auprès de chaque réseau n'est pas
 * terminé (démarche administrative hors de cet environnement, voir le
 * guide fourni séparément).
 *
 * Décision de cadrage (27 nov. 2026, réponse du propriétaire) : chaque
 * boutique connecte et paie directement SON PROPRE compte publicitaire —
 * ELEGANZ n'est jamais débité et ne débite jamais le budget publicitaire,
 * seulement ses frais de service (voir boost-externe.service.ts).
 *
 * Les versions d'API ci-dessous (Meta v21.0, TikTok v1.3...) reflètent les
 * versions documentées au moment de l'écriture ; à reconfirmer auprès de
 * chaque réseau au moment de l'activation réelle, les régies publicitaires
 * dépréciant régulièrement d'anciennes versions.
 */

export interface AppConfigReseau {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string; // séparés par des espaces
  accountIdPartenaire?: string | null; // ex. Business Manager ID (Meta), facultatif selon le réseau
}

export interface ConnexionReseau {
  accessToken: string;
  refreshToken?: string | null;
  compteExterneId: string; // ex. "act_1234567890" (Meta), advertiser_id (TikTok), customer_id (Google), account_id (X)
}

export type ObjetCampagneExterne = "BOUTIQUE" | "PRODUIT" | "COLLECTION";

export interface DemandeCampagneExterne {
  nomCampagne: string;
  objet: ObjetCampagneExterne;
  lienPromu: string; // URL publique Marketplace (boutique, produit, ou page de la collection) vers laquelle pointe la publicité
  dateDebut: Date;
  dateFin: Date;
  budgetUSD: number; // budget alloué à CE canal pour toute la durée de la campagne — payé par la boutique directement au réseau
  audienceGeoISO2: string; // ex. "CD" pour la RDC
}

export interface ResultatEchangeToken {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  compteExterneId: string;
  compteExterneNom?: string | null;
  scopesAccordes?: string | null;
}

export interface ResultatCreationCampagne {
  externalCampaignId: string;
  externalAdSetId?: string | null;
  externalStatusRaw: string;
}

export type StatutMappe =
  | "EN_ATTENTE_APPROBATION"
  | "APPROUVEE"
  | "REJETEE"
  | "DIFFUSION_EN_COURS"
  | "EN_PAUSE"
  | "TERMINEE"
  | "ERREUR";

export interface StatutExterne {
  statutMappe: StatutMappe;
  statusRaw: string;
  raison?: string | null;
}

export interface StatistiquesExterne {
  impressions: number;
  clics: number;
  portee: number;
  depenseUSD: number;
}

export interface ReseauPubAdapter {
  readonly canal: BoostCanal;

  /** URL vers laquelle rediriger le navigateur de la boutique pour le consentement OAuth. */
  genererUrlAutorisation(app: AppConfigReseau, state: string): string;

  /** Échange le `code` reçu sur l'URI de redirection contre un jeton d'accès. */
  echangerCodeContreToken(app: AppConfigReseau, code: string): Promise<ResultatEchangeToken>;

  /** Absent pour les réseaux sans rafraîchissement de jeton distinct (le jeton reste valide jusqu'à expiration/révocation). */
  rafraichirToken?(app: AppConfigReseau, refreshToken: string): Promise<ResultatEchangeToken>;

  creerCampagne(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    demande: DemandeCampagneExterne,
  ): Promise<ResultatCreationCampagne>;

  recupererStatut(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatutExterne>;

  recupererStatistiques(
    app: AppConfigReseau,
    connexion: ConnexionReseau,
    externalCampaignId: string,
  ): Promise<StatistiquesExterne>;

  mettreEnPause(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void>;

  reprendre(app: AppConfigReseau, connexion: ConnexionReseau, externalCampaignId: string): Promise<void>;
}
