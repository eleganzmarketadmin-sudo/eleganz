import { SetMetadata } from "@nestjs/common";

export const GESTION_FEATURE_KEY = "gestionFeature";

// Restreint une route à une fonctionnalité du bouquet ELEGANZ Gestion de la
// boutique (14 oct. 2026, plan commercial) — ex. "immobilisations",
// "cloture", "tresorerie", "financeAvancee", "comptableExterne". La clé
// doit exister dans `SubscriptionPlan.featuresJson` avec la valeur `true`
// pour que ShopMembershipGuard laisse passer la requête ; absente ou
// `false` → 403 avec un message qui nomme la fonctionnalité, jamais un
// 404 muet. À utiliser avec ShopMembershipGuard, comme @ShopRoles.
export const RequiresGestionFeature = (feature: string) => SetMetadata(GESTION_FEATURE_KEY, feature);
