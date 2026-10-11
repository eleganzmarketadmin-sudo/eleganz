# État du projet

Dernière mise à jour : 11 octobre 2026.

## Fait

- Cadrage complet : matrice des fonctionnalités, comparaison d'architectures, coûts estimés, 10 décisions validées par le propriétaire (`DECISIONS.md`).
- Squelette du monorepo (`apps/api`, `apps/web`, `packages/database`), workspace pnpm fonctionnel (`pnpm install` validé, 395 paquets).
- Schéma de données unifié Gestion + Marketplace (`packages/database/prisma/schema.prisma`), couvrant : identité/rôles, boutiques à 3 modes, catalogue/stock transactionnel, caisse/documents commerciaux, commandes multivendeurs, livraison, abonnements/facturation/crédits IA, audit.
- Premier code applicatif réel dans `apps/api` : module `auth` (inscription, connexion, JWT, rôles acheteur/vendeur) et module `shops` (création de boutique en mode privé ou hybride, période gratuite par défaut 3 mois, publication volontaire d'une sélection vers la Marketplace).
- Module `catalog` (produits, variantes, stock initial tracé) et module `pos` (vente de caisse transactionnelle avec décompte de stock, annulation avec retour en stock, tableau de bord CA journalier distinguant chiffre d'affaires / encaissements confirmés / marge).
- Squelette Next.js minimal (`apps/web`) — compile sans erreur (`tsc --noEmit` validé).
- Recherche de la procédure d'homologation DGI/e-DEF menée (décision #9) — voir `COMPLIANCE_FACTURE_NORMALISEE.md`.
- Documentation permanente amorcée (`README.md`, `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DECISIONS.md`, `MAINTENANCE.md`).
- **Dépôt poussé sur GitHub** : `github.com/eleganzmarketadmin-sudo/eleganz`, branche `main`, à jour.

## Limite connue de cet environnement (pas un défaut du code)

`pnpm db:generate` (génération du client Prisma) échoue dans ce bac à sable car `binaries.prisma.sh` n'est pas sur la liste des domaines autorisés en sortie. Fonctionnera normalement sur un poste de dev ou un CI avec accès réseau complet — détails dans `MAINTENANCE.md`. Tant que ce n'est pas généré ici, `apps/api` ne peut pas être compilé/testé dans cette session (il dépend des types générés par Prisma).

## Pas encore commencé

- Guard JWT réel sur les routes `shops` (actuellement `ownerId` passé en paramètre d'URL, marqué `TODO` explicite dans `shops.controller.ts`).
- Module caisse/POS, documents commerciaux, mode hors-ligne.
- Aucun compte (hébergement, domaine, Moneroo, stockage objet) n'a été créé.
- Dépôt pas encore poussé sur GitHub — en attente que le propriétaire crée le dépôt sous `eleganzmarket.admin@gmail.com` et connecte GitHub à la session.
- Identité visuelle ELEGANZ pas encore conçue.
- Aucun déploiement, même en préproduction.

## Prochaine étape concrète

Voir `NEXT_ACTIONS.md`.
