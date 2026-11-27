import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  BoostCanal,
  BoostCible,
  NotificationType,
  StatutApprobationCampagneExterne,
  StatutConnexionAdAccount,
} from "@eleganz/database";
import { NotificationsService } from "../notifications/notifications.service";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";
import { enregistrerAuditLog } from "../audit/audit-log.util";
import { CreateCampagneExterneDto } from "./dto/create-campagne-externe.dto";
import { ReseauPubAdapterFactory } from "./reseaux/reseau-pub-adapter.factory";
import { signerEtatOAuth, verifierEtatOAuth } from "./oauth-state.util";
import { AppConfigReseau, ObjetCampagneExterne } from "./reseaux/reseau-pub-adapter.interface";

// Mêmes valeurs de secours que main.ts (origine CORS)/sitemap.ts (SITE_URL)
// — pas de nouvel env var strictement nécessaire, mais surchargeable si la
// plateforme change un jour de domaine.
const SITE_PUBLIC_BASE_URL = process.env.SITE_PUBLIC_BASE_URL || "https://www.eleganzmarket.com";
const API_PUBLIC_BASE_URL = process.env.API_PUBLIC_BASE_URL || "https://eleganz-api-production.up.railway.app";
const DELAI_REGLEMENT_FRAIS_JOURS = 3;

function arrondi2(montant: number): number {
  return Math.round(montant * 100) / 100;
}

/**
 * ELEGANZ BOOST 360° (27 nov. 2026, demande propriétaire après présentation
 * d'une maquette d'interface) — permet à une boutique de lancer une vraie
 * publicité sur Facebook/Instagram/TikTok/Google/X SANS quitter ELEGANZ ni
 * maîtriser l'outil publicitaire du réseau. Décision de cadrage :
 * - Chaque boutique connecte et paie directement SON PROPRE compte
 *   publicitaire (OAuth) — ELEGANZ ne gère ni ne débite jamais le budget
 *   publicitaire (voir ShopAdAccountConnexion dans schema.prisma).
 * - ELEGANZ facture uniquement ses frais de service (kind="boost_externe"),
 *   réutilisant le même mécanisme de facture que le Boost interne
 *   (BoostService) — réglé hors ligne, confirmé par un admin qui marque la
 *   facture payée (BillingController.markPaid), ce qui déclenche la
 *   TRANSMISSION RÉELLE de chaque campagne au(x) réseau(x) choisi(s).
 * - Distinct du Boost interne (famille SOCIAL_360, catalogue de tarifs
 *   ELEGANZ) : ce module ne touche jamais BoostTarif/Boost.
 */
@Injectable()
export class BoostExterneService {
  private readonly logger = new Logger(BoostExterneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly adapters: ReseauPubAdapterFactory,
  ) {}

  private async idsAdmins(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [...ROLES_ADMIN] } },
      select: { id: true },
    });
    return admins.map((a: { id: string }) => a.id);
  }

  private async destinatairesBoutique(shopId: string): Promise<string[]> {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { ownerId: true, staff: { where: { active: true }, select: { userId: true } } },
    });
    return [shop.ownerId, ...shop.staff.map((s: { userId: string }) => s.userId)];
  }

  private async construireAppConfig(canal: BoostCanal): Promise<AppConfigReseau> {
    const config = await this.prisma.boostCanalConfig.findUnique({ where: { canal } });
    if (!config || !config.connecte || !config.apiKey || !config.apiSecret) {
      throw new BadRequestException(
        `L'intégration ELEGANZ pour ${canal} n'est pas encore configurée côté plateforme — contactez l'équipe ELEGANZ.`,
      );
    }
    const redirectUri = config.redirectUriOverride || `${API_PUBLIC_BASE_URL}/boost-externe/oauth/callback/${canal}`;
    return {
      clientId: config.apiKey,
      clientSecret: config.apiSecret,
      redirectUri,
      scopes: config.scopesConfigures || "",
      accountIdPartenaire: config.accountId ?? null,
    };
  }

  // --- Connexion OAuth boutique ---

  async demarrerConnexion(shopId: string, canal: BoostCanal): Promise<{ url: string }> {
    const app = await this.construireAppConfig(canal);
    const adapter = this.adapters.pour(canal);
    const state = signerEtatOAuth(shopId, canal);
    return { url: adapter.genererUrlAutorisation(app, state) };
  }

  async traiterCallbackOAuth(canal: BoostCanal, code: string, state: string): Promise<{ shopId: string }> {
    let etat: { shopId: string; canal: string };
    try {
      etat = verifierEtatOAuth(state);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : "État OAuth invalide.");
    }
    if (etat.canal !== canal) {
      throw new BadRequestException("Le réseau de retour ne correspond pas à la connexion initiée.");
    }

    const app = await this.construireAppConfig(canal);
    const adapter = this.adapters.pour(canal);

    try {
      const resultat = await adapter.echangerCodeContreToken(app, code);
      await this.prisma.shopAdAccountConnexion.upsert({
        where: { shopId_canal: { shopId: etat.shopId, canal } },
        update: {
          statut: StatutConnexionAdAccount.CONNECTE,
          accessToken: resultat.accessToken,
          refreshToken: resultat.refreshToken ?? null,
          expiresAt: resultat.expiresAt ?? null,
          compteExterneId: resultat.compteExterneId,
          compteExterneNom: resultat.compteExterneNom ?? null,
          scopesAccordes: resultat.scopesAccordes ?? null,
          connectedAt: new Date(),
          lastSyncAt: new Date(),
          derniereErreur: null,
        },
        create: {
          shopId: etat.shopId,
          canal,
          statut: StatutConnexionAdAccount.CONNECTE,
          accessToken: resultat.accessToken,
          refreshToken: resultat.refreshToken ?? null,
          expiresAt: resultat.expiresAt ?? null,
          compteExterneId: resultat.compteExterneId,
          compteExterneNom: resultat.compteExterneNom ?? null,
          scopesAccordes: resultat.scopesAccordes ?? null,
          connectedAt: new Date(),
          lastSyncAt: new Date(),
        },
      });
      return { shopId: etat.shopId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de connexion au réseau publicitaire.";
      this.logger.error(`Échec de connexion OAuth ${canal} pour la boutique ${etat.shopId} : ${message}`);
      await this.prisma.shopAdAccountConnexion
        .upsert({
          where: { shopId_canal: { shopId: etat.shopId, canal } },
          update: { statut: StatutConnexionAdAccount.ERREUR, derniereErreur: message },
          create: { shopId: etat.shopId, canal, statut: StatutConnexionAdAccount.ERREUR, derniereErreur: message },
        })
        .catch(() => undefined);
      throw new BadRequestException(message);
    }
  }

  deconnecter(shopId: string, canal: BoostCanal) {
    return this.prisma.shopAdAccountConnexion.update({
      where: { shopId_canal: { shopId, canal } },
      data: { statut: StatutConnexionAdAccount.REVOQUE, accessToken: null, refreshToken: null },
    });
  }

  mesConnexions(shopId: string) {
    return this.prisma.shopAdAccountConnexion.findMany({ where: { shopId }, orderBy: { canal: "asc" } });
  }

  // --- Groupe de campagnes (assistant "ELEGANZ BOOST 360°") ---

  private readonly inclusionGroupe = {
    product: { select: { id: true, name: true, images: true } },
    boostExterneProduits: { include: { product: { select: { id: true, name: true, images: true } } } },
    invoice: { select: { id: true, status: true, dueAt: true, paidAt: true } },
    campagnes: { include: { connexion: { select: { canal: true, statut: true, compteExterneNom: true } } } },
  } as const;

  mesGroupes(shopId: string) {
    return this.prisma.boostCampagneExterneGroupe.findMany({
      where: { shopId },
      include: this.inclusionGroupe,
      orderBy: { createdAt: "desc" },
    });
  }

  async creerGroupe(shopId: string, userId: string, dto: CreateCampagneExterneDto) {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: {
        boostExterneActif: true,
        boostExterneFraisPct: true,
        boostExterneFraisMinimumUSD: true,
        boostExterneAudienceGeoParDefaut: true,
      },
    });
    if (!settings?.boostExterneActif) {
      throw new BadRequestException("ELEGANZ BOOST 360° n'est pas encore activé sur la plateforme.");
    }

    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    if (!(dateFin.getTime() > dateDebut.getTime())) {
      throw new BadRequestException("La date de fin doit être postérieure à la date de début.");
    }

    const canaux = Array.from(new Set(dto.canaux));
    if (canaux.length === 0) {
      throw new BadRequestException("Choisissez au moins un réseau publicitaire.");
    }

    // Chaque canal choisi doit déjà être connecté par la boutique — le
    // règlement des frais ELEGANZ déclenche la TRANSMISSION réelle (voir
    // activerDepuisFacture), jamais la connexion elle-même.
    type ConnexionLite = { id: string; canal: BoostCanal; statut: StatutConnexionAdAccount };
    const connexions: ConnexionLite[] = await this.prisma.shopAdAccountConnexion.findMany({
      where: { shopId, canal: { in: canaux } },
    });
    for (const canal of canaux) {
      const connexion = connexions.find((c: ConnexionLite) => c.canal === canal);
      if (!connexion || connexion.statut !== StatutConnexionAdAccount.CONNECTE) {
        throw new BadRequestException(
          `Connectez d'abord votre compte publicitaire ${canal} avant de l'inclure dans cette campagne.`,
        );
      }
    }

    let productIdUnique: string | undefined;
    let productIdsCollection: string[] = [];

    if (dto.cible === BoostCible.PRODUIT) {
      if (!dto.productId) throw new BadRequestException("Choisissez un article à promouvoir.");
      const produit = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { shopId: true, isPublished: true },
      });
      if (!produit || produit.shopId !== shopId) throw new BadRequestException("Cet article n'appartient pas à cette boutique.");
      if (!produit.isPublished) throw new BadRequestException("Seul un article publié sur ELEGANZ peut être promu.");
      productIdUnique = dto.productId;
    }

    if (dto.cible === BoostCible.COLLECTION) {
      const ids = Array.from(new Set(dto.productIds ?? []));
      if (ids.length === 0) throw new BadRequestException("Choisissez au moins un article pour cette campagne.");
      const produits = await this.prisma.product.findMany({
        where: { id: { in: ids }, shopId, isPublished: true },
        select: { id: true },
      });
      if (produits.length !== ids.length) {
        throw new BadRequestException(
          "Un ou plusieurs articles choisis n'appartiennent pas à cette boutique ou ne sont pas publiés sur ELEGANZ.",
        );
      }
      productIdsCollection = ids;
    }

    const audienceGeo = (dto.audienceGeo || settings.boostExterneAudienceGeoParDefaut).toUpperCase();
    const budgetTotalUSD = arrondi2(dto.budgetTotalUSD);
    const budgetParCanal = arrondi2(budgetTotalUSD / canaux.length);

    const fraisPct = settings.boostExterneFraisPct;
    const fraisCalcules = arrondi2((budgetTotalUSD * fraisPct) / 100);
    const fraisMinimum = Number(settings.boostExterneFraisMinimumUSD);
    const fraisEleganzUSD = Math.max(fraisCalcules, fraisMinimum);

    const maintenant = new Date();
    const dueAt = new Date(maintenant.getTime() + DELAI_REGLEMENT_FRAIS_JOURS * 24 * 60 * 60 * 1000);

    const invoice = await this.prisma.invoice.create({
      data: { shopId, amount: fraisEleganzUSD, dueAt, status: "PENDING", kind: "boost_externe" },
    });

    const groupe = await this.prisma.boostCampagneExterneGroupe.create({
      data: {
        shopId,
        cible: dto.cible,
        productId: productIdUnique ?? null,
        dateDebut,
        dateFin,
        budgetTotalUSD,
        audienceGeo,
        fraisEleganzPct: fraisPct,
        fraisEleganzUSD,
        invoiceId: invoice.id,
        requestedByUserId: userId,
        ...(productIdsCollection.length > 0
          ? { boostExterneProduits: { create: productIdsCollection.map((productId) => ({ productId })) } }
          : {}),
        campagnes: {
          create: canaux.map((canal) => ({
            canal,
            connexionId: connexions.find((c) => c.canal === canal)!.id,
            budgetAlloueUSD: budgetParCanal,
            statut: StatutApprobationCampagneExterne.EN_ATTENTE_ENVOI,
          })),
        },
      },
      include: this.inclusionGroupe,
    });

    await this.notifications
      .notifierMulticanal(await this.idsAdmins(), {
        type: NotificationType.BOOST_EXTERNE_FRAIS_PAYES,
        title: "Nouvelle campagne Boost 360° en attente de règlement",
        body: `Une boutique a lancé une campagne Boost 360° (${canaux.join(", ")}) — frais ELEGANZ de ${fraisEleganzUSD.toFixed(2)} $ en attente de paiement.`,
        link: "/admin/factures?kind=boost_externe",
      })
      .catch((err) => this.logger.error("Échec de la notification admin BOOST_EXTERNE_FRAIS_PAYES", err));

    await enregistrerAuditLog(this.prisma, {
      actorId: userId,
      shopId,
      action: "BOOST_EXTERNE_GROUPE_CREE",
      details: { groupeId: groupe.id, cible: dto.cible, canaux, budgetTotalUSD, fraisEleganzUSD },
    });

    return groupe;
  }

  async annulerGroupe(shopId: string, groupeId: string) {
    const groupe = await this.prisma.boostCampagneExterneGroupe.findUniqueOrThrow({ where: { id: groupeId } });
    if (groupe.shopId !== shopId) throw new BadRequestException("Cette campagne n'appartient pas à cette boutique.");
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: groupe.invoiceId } });
    if (invoice.status !== "PENDING") {
      throw new BadRequestException("Seule une campagne dont les frais ne sont pas encore payés peut être annulée.");
    }
    await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: groupe.invoiceId }, data: { status: "WAIVED" } }),
      this.prisma.boostCampagneExterne.updateMany({
        where: { groupeId },
        data: { statut: StatutApprobationCampagneExterne.TERMINEE },
      }),
    ]);
    return { annule: true };
  }

  /**
   * Activation — appelée par BillingController une fois la facture de frais
   * ELEGANZ marquée payée par un admin (même mécanisme que
   * BoostService.activerDepuisFacture). Transmet RÉELLEMENT chaque campagne
   * du groupe au réseau concerné ; idempotente (ne retransmet jamais une
   * campagne déjà traitée) ; une erreur sur un canal n'empêche jamais la
   * transmission des autres, indépendants les uns des autres.
   */
  async activerDepuisFacture(invoiceId: string) {
    const groupe = await this.prisma.boostCampagneExterneGroupe.findUnique({
      where: { invoiceId },
      include: {
        campagnes: { include: { connexion: true } },
        product: true,
        shop: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!groupe) return null;

    const lienPromu =
      groupe.cible === BoostCible.PRODUIT && groupe.product
        ? `${SITE_PUBLIC_BASE_URL}/marketplace/produit/${groupe.product.id}`
        : `${SITE_PUBLIC_BASE_URL}/marketplace/boutique/${groupe.shop.slug}`;

    const nomCampagneBase =
      groupe.cible === BoostCible.PRODUIT && groupe.product
        ? `ELEGANZ — ${groupe.product.name}`
        : groupe.cible === BoostCible.COLLECTION
          ? `ELEGANZ — ${groupe.shop.name} (collection)`
          : `ELEGANZ — ${groupe.shop.name}`;

    for (const campagne of groupe.campagnes) {
      if (campagne.statut !== StatutApprobationCampagneExterne.EN_ATTENTE_ENVOI) continue;
      if (!campagne.connexion || campagne.connexion.statut !== StatutConnexionAdAccount.CONNECTE) {
        await this.prisma.boostCampagneExterne.update({
          where: { id: campagne.id },
          data: { statut: StatutApprobationCampagneExterne.EN_ATTENTE_CONNEXION },
        });
        continue;
      }
      try {
        const app = await this.construireAppConfig(campagne.canal);
        const adapter = this.adapters.pour(campagne.canal);
        const resultat = await adapter.creerCampagne(
          app,
          {
            accessToken: campagne.connexion.accessToken!,
            refreshToken: campagne.connexion.refreshToken ?? null,
            compteExterneId: campagne.connexion.compteExterneId!,
          },
          {
            nomCampagne: nomCampagneBase,
            objet: groupe.cible as ObjetCampagneExterne,
            lienPromu,
            dateDebut: groupe.dateDebut,
            dateFin: groupe.dateFin,
            budgetUSD: Number(campagne.budgetAlloueUSD),
            audienceGeoISO2: groupe.audienceGeo,
          },
        );
        await this.prisma.boostCampagneExterne.update({
          where: { id: campagne.id },
          data: {
            externalCampaignId: resultat.externalCampaignId,
            externalAdSetId: resultat.externalAdSetId ?? null,
            externalStatusRaw: resultat.externalStatusRaw,
            statut: StatutApprobationCampagneExterne.EN_ATTENTE_APPROBATION,
            derniereErreur: null,
            lastSyncAt: new Date(),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Échec de transmission au réseau publicitaire.";
        this.logger.error(`Échec de transmission Boost 360° (campagne ${campagne.id}, canal ${campagne.canal}) : ${message}`);
        await this.prisma.boostCampagneExterne.update({
          where: { id: campagne.id },
          data: { statut: StatutApprobationCampagneExterne.ERREUR, derniereErreur: message },
        });
      }
    }

    const destinataires = await this.destinatairesBoutique(groupe.shopId).catch(() => [] as string[]);
    await this.notifications
      .notifierMulticanal(destinataires, {
        type: NotificationType.BOOST_EXTERNE_CAMPAGNE_TRANSMISE,
        title: "Campagne Boost 360° transmise",
        body: "Votre/vos campagne(s) publicitaire(s) ont été transmises aux réseaux choisis et sont en cours d'examen.",
        link: "/boost-360",
      })
      .catch((err) => this.logger.error("Échec de la notification boutique BOOST_EXTERNE_CAMPAGNE_TRANSMISE", err));

    return this.prisma.boostCampagneExterneGroupe.findUnique({ where: { id: groupe.id }, include: this.inclusionGroupe });
  }

  private async campagneAppartenant(shopId: string, campagneId: string) {
    const campagne = await this.prisma.boostCampagneExterne.findUniqueOrThrow({
      where: { id: campagneId },
      include: { connexion: true, groupe: { select: { shopId: true } } },
    });
    if (campagne.groupe.shopId !== shopId) {
      throw new BadRequestException("Cette campagne n'appartient pas à cette boutique.");
    }
    return campagne;
  }

  async mettreEnPause(shopId: string, campagneId: string) {
    const campagne = await this.campagneAppartenant(shopId, campagneId);
    if (!campagne.externalCampaignId || !campagne.connexion) {
      throw new BadRequestException("Cette campagne n'a pas encore été transmise au réseau.");
    }
    const app = await this.construireAppConfig(campagne.canal);
    await this.adapters
      .pour(campagne.canal)
      .mettreEnPause(
        app,
        { accessToken: campagne.connexion.accessToken!, compteExterneId: campagne.connexion.compteExterneId! },
        campagne.externalCampaignId,
      );
    return this.prisma.boostCampagneExterne.update({
      where: { id: campagneId },
      data: { statut: StatutApprobationCampagneExterne.EN_PAUSE },
    });
  }

  async reprendre(shopId: string, campagneId: string) {
    const campagne = await this.campagneAppartenant(shopId, campagneId);
    if (!campagne.externalCampaignId || !campagne.connexion) {
      throw new BadRequestException("Cette campagne n'a pas encore été transmise au réseau.");
    }
    const app = await this.construireAppConfig(campagne.canal);
    await this.adapters
      .pour(campagne.canal)
      .reprendre(
        app,
        { accessToken: campagne.connexion.accessToken!, compteExterneId: campagne.connexion.compteExterneId! },
        campagne.externalCampaignId,
      );
    return this.prisma.boostCampagneExterne.update({
      where: { id: campagneId },
      data: { statut: StatutApprobationCampagneExterne.DIFFUSION_EN_COURS },
    });
  }

  // --- Synchronisation périodique (cron, voir CronJobsService) ---

  async synchroniserStatutsEtStatistiques() {
    const campagnes = await this.prisma.boostCampagneExterne.findMany({
      where: {
        externalCampaignId: { not: null },
        statut: {
          in: [
            StatutApprobationCampagneExterne.EN_ATTENTE_APPROBATION,
            StatutApprobationCampagneExterne.APPROUVEE,
            StatutApprobationCampagneExterne.DIFFUSION_EN_COURS,
            StatutApprobationCampagneExterne.EN_PAUSE,
          ],
        },
      },
      include: { connexion: true, groupe: { select: { shopId: true } } },
    });

    let synchronisees = 0;
    for (const campagne of campagnes) {
      if (!campagne.connexion || !campagne.externalCampaignId) continue;
      try {
        const app = await this.construireAppConfig(campagne.canal);
        const connexionReseau = {
          accessToken: campagne.connexion.accessToken!,
          compteExterneId: campagne.connexion.compteExterneId!,
        };
        const adapter = this.adapters.pour(campagne.canal);
        const [statut, stats] = await Promise.all([
          adapter.recupererStatut(app, connexionReseau, campagne.externalCampaignId),
          adapter.recupererStatistiques(app, connexionReseau, campagne.externalCampaignId),
        ]);

        const statutPrecedent = campagne.statut;
        const statutMappe = statut.statutMappe as StatutApprobationCampagneExterne;
        await this.prisma.boostCampagneExterne.update({
          where: { id: campagne.id },
          data: {
            statut: statutMappe,
            externalStatusRaw: statut.statusRaw,
            statsImpressions: stats.impressions,
            statsClics: stats.clics,
            statsPortee: stats.portee,
            statsDepenseUSD: stats.depenseUSD,
            lastSyncAt: new Date(),
            derniereErreur: null,
          },
        });
        synchronisees++;

        if (
          statutPrecedent !== statutMappe &&
          (statutMappe === StatutApprobationCampagneExterne.APPROUVEE ||
            statutMappe === StatutApprobationCampagneExterne.DIFFUSION_EN_COURS ||
            statutMappe === StatutApprobationCampagneExterne.REJETEE)
        ) {
          const destinataires = await this.destinatairesBoutique(campagne.groupe.shopId).catch(() => [] as string[]);
          const estRejetee = statutMappe === StatutApprobationCampagneExterne.REJETEE;
          await this.notifications
            .notifierMulticanal(destinataires, {
              type: estRejetee
                ? NotificationType.BOOST_EXTERNE_CAMPAGNE_REJETEE
                : NotificationType.BOOST_EXTERNE_CAMPAGNE_APPROUVEE,
              title: estRejetee ? "Campagne Boost 360° rejetée" : "Campagne Boost 360° approuvée",
              body: estRejetee
                ? `Votre campagne sur ${campagne.canal} a été rejetée par le réseau — vérifiez les motifs depuis votre tableau de bord.`
                : `Votre campagne sur ${campagne.canal} est approuvée et diffuse.`,
              link: "/boost-360",
            })
            .catch((err) => this.logger.error("Échec de notification de changement de statut Boost 360°", err));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Échec de synchronisation.";
        this.logger.warn(`Synchronisation Boost 360° échouée (campagne ${campagne.id}, canal ${campagne.canal}) : ${message}`);
        await this.prisma.boostCampagneExterne
          .update({ where: { id: campagne.id }, data: { derniereErreur: message, lastSyncAt: new Date() } })
          .catch(() => undefined);
      }
    }

    const expirees = await this.prisma.shopAdAccountConnexion.updateMany({
      where: { statut: StatutConnexionAdAccount.CONNECTE, expiresAt: { lt: new Date() } },
      data: { statut: StatutConnexionAdAccount.EXPIRE },
    });
    if (expirees.count > 0) {
      this.logger.log(`${expirees.count} connexion(s) Boost 360° expirée(s), reconnexion requise.`);
    }

    return { synchronisees, connexionsExpirees: expirees.count };
  }

  // --- Vue admin (Centre de pilotage) ---

  listerToutesLesCampagnes() {
    return this.prisma.boostCampagneExterneGroupe.findMany({
      include: {
        shop: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        invoice: { select: { id: true, status: true, dueAt: true, paidAt: true } },
        campagnes: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
