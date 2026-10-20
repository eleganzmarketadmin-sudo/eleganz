import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { SHOP_ROLES_KEY } from "./roles.decorator";
import { GESTION_FEATURE_KEY } from "./gestion-feature.decorator";
import { StaffRole, ShopExpertScope, ShopStatus } from "@eleganz/database";

// Préfixes de routes Finance & Comptabilité — seuls accessibles, et
// seulement en lecture (GET), à un StaffRole.EXTERNAL_ACCOUNTANT (voir
// docs/ARCHITECTURE_FINANCE.md §8sexies). Basé sur le chemin réel de la
// requête (pas le gabarit de route Express), donc insensible à l'ajout
// futur de nouvelles routes dans ces contrôleurs : tout ce qui vit sous
// ces préfixes est automatiquement couvert, sans liste à maintenir route
// par route.
const PREFIXES_COMPTABLE_EXTERNE = [/^\/shops\/[^/]+\/finance(\/|$)/, /^\/shops\/[^/]+\/assets(\/|$)/, /^\/shops\/[^/]+\/expenses(\/|$)/];

// Préfixes par périmètre pour le module Experts (16 oct. 2026, point 2) — une
// boutique choisit, par expert engagé, lequel de ces périmètres lui ouvrir
// (jamais un accès identique pour tous : voir ShopExpertEngagement.scopes).
// Comme pour le comptable externe, l'accès accordé est en lecture seule : un
// expert consulte pour conseiller, il n'agit pas à la place de la boutique.
const PREFIXES_PAR_SCOPE_EXPERT: Record<ShopExpertScope, RegExp[]> = {
  [ShopExpertScope.FINANCE]: [
    /^\/shops\/[^/]+\/finance(\/|$)/,
    /^\/shops\/[^/]+\/assets(\/|$)/,
    /^\/shops\/[^/]+\/expenses(\/|$)/,
    /^\/shops\/[^/]+\/suppliers(\/|$)/,
    /^\/shops\/[^/]+\/relances(\/|$)/,
    /^\/shops\/[^/]+\/tresorerie(\/|$)/,
    /^\/shops\/[^/]+\/stock(\/|$)/,
    /^\/shops\/[^/]+\/reports(\/|$)/,
  ],
  [ShopExpertScope.COMMANDES]: [/^\/shops\/[^/]+\/orders(\/|$)/, /^\/shops\/[^/]+\/customers(\/|$)/],
  [ShopExpertScope.CATALOGUE]: [/^\/shops\/[^/]+\/products(\/|$)/, /^\/shops\/[^/]+\/variant-options(\/|$)/],
};

// À utiliser APRÈS JwtAuthGuard. Vérifie que l'utilisateur authentifié est
// bien staff de la boutique ciblée par :shopId dans l'URL — c'est ce qui
// empêche un vendeur de lire ou modifier les données d'une autre boutique
// (séparation des données de gestion privées, complément stratégique §14).
// Si la route porte @ShopRoles(...), vérifie en plus que le rôle du staff y
// figure (ex. un caissier ne peut pas créer de fournisseurs — prompt §10 :
// « un caissier peut enregistrer des ventes sans pouvoir modifier... »).
@Injectable()
export class ShopMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    // @types/express@5 type les paramètres de route en `string | string[]`
    // (pour les segments répétés) — ":shopId" est toujours un seul segment ici.
    const shopId = request.params.shopId as string;
    if (!shopId) return true; // route sans :shopId, rien à vérifier ici

    // Les rôles admin globaux passent — leur accès est filtré ailleurs
    // (Centre de pilotage), pas au niveau de l'appartenance à une boutique.
    if (request.user.role.startsWith("ADMIN_")) return true;

    // Corrigé le 20 oct. 2026 (audit de lancement) : le statut `SUSPENDED`/
    // `CLOSED` d'une boutique ne bloquait jusqu'ici rien côté API — seule la
    // valeur changeait en base (billing.service.ts::suspendOverdueShops),
    // mais la boutique gardait un accès complet à la caisse, au catalogue et
    // aux commandes malgré l'impayé. `PAYMENT_DUE` reste volontairement
    // autorisé : c'est la période de grâce documentée avant suspension
    // effective, pas un blocage. Seule la consultation de Facturation reste
    // ouverte en lecture pendant une suspension, pour que le propriétaire
    // puisse voir et régler ce qu'il doit.
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { status: true } });
    if (shop?.status === ShopStatus.SUSPENDED || shop?.status === ShopStatus.CLOSED) {
      const consultationFacturationAutorisee =
        request.method === "GET" &&
        (/^\/shops\/[^/]+\/invoices(\/|$)/.test(request.path) ||
          /^\/shops\/[^/]+\/subscription(\/|$)/.test(request.path));
      if (!consultationFacturationAutorisee) {
        throw new ForbiddenException(
          shop.status === ShopStatus.CLOSED
            ? "Cette boutique est fermée."
            : "Cette boutique est suspendue pour facture(s) impayée(s). Réglez vos factures en attente depuis Facturation pour réactiver l'accès.",
        );
      }
    }

    const membership = await this.prisma.shopStaff.findUnique({
      where: { shopId_userId: { shopId, userId: request.user.id } },
    });

    if (!membership?.active) {
      // Pas membre du staff : peut-être un expert engagé par cette boutique
      // (module Experts, 16 oct. 2026) — accès en lecture seule, limité aux
      // périmètres (scopes) que la boutique lui a explicitement accordés.
      const engagement = await this.prisma.shopExpertEngagement.findFirst({
        where: { shopId, expertProfile: { userId: request.user.id }, status: "ACTIVE" },
      });
      if (!engagement) {
        throw new ForbiddenException("Vous n'avez pas accès à cette boutique.");
      }
      const chemin = request.path;
      const autorise =
        request.method === "GET" &&
        engagement.scopes.some((scope) => PREFIXES_PAR_SCOPE_EXPERT[scope].some((p) => p.test(chemin)));
      if (!autorise) {
        throw new ForbiddenException(
          "Votre accès expert à cette boutique est en lecture seule et limité aux périmètres qui vous ont été accordés.",
        );
      }
      return true;
    }

    if (membership.role === StaffRole.EXTERNAL_ACCOUNTANT) {
      const chemin = request.path;
      const estLectureFinance = request.method === "GET" && PREFIXES_COMPTABLE_EXTERNE.some((p) => p.test(chemin));
      if (!estLectureFinance) {
        throw new ForbiddenException(
          "Un comptable externe n'a accès qu'en lecture seule à Finance & Comptabilité.",
        );
      }
      return true;
    }

    // getAllAndOverride : un décorateur posé sur la méthode l'emporte sur celui
    // posé sur la classe (ex. SuppliersController restreint toute la classe,
    // mais une méthode pourrait l'élargir si besoin un jour).
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(SHOP_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Cette action est réservée à : ${requiredRoles.join(", ")}.`,
      );
    }

    // Fonctionnalité réservée à certains bouquets Gestion (14 oct. 2026,
    // plan commercial) — ex. @RequiresGestionFeature("immobilisations").
    // Une seule requête supplémentaire, et seulement sur les routes qui
    // portent le décorateur (jamais sur les routes déjà vérifiées par rôle
    // seul, pour ne pas alourdir le reste de l'API).
    const requiredFeature = this.reflector.getAllAndOverride<string | undefined>(GESTION_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredFeature) {
      const shop = await this.prisma.shop.findUnique({
        where: { id: shopId },
        select: { gestionBouquet: { select: { name: true, featuresJson: true } } },
      });
      const features = (shop?.gestionBouquet?.featuresJson as unknown as Record<string, unknown> | undefined) ?? {};
      if (features[requiredFeature] !== true) {
        throw new ForbiddenException(
          `Cette fonctionnalité n'est pas incluse dans le bouquet ${shop?.gestionBouquet?.name ?? "actuel"} de cette boutique. Passez à un bouquet supérieur depuis le Centre de pilotage pour y accéder.`,
        );
      }
    }

    return true;
  }
}
