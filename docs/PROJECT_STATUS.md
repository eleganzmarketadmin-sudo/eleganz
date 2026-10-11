# État du projet

Dernière mise à jour : 11 octobre 2026.

## Fait

- Cadrage complet : matrice des fonctionnalités, comparaison d'architectures, coûts estimés, 10 décisions validées par le propriétaire (`DECISIONS.md`).
- Squelette du monorepo (`apps/api`, `apps/web`, `packages/database`), workspace pnpm fonctionnel (`pnpm install` validé, 395 paquets).
- Schéma de données unifié Gestion + Marketplace (`packages/database/prisma/schema.prisma`), couvrant : identité/rôles, boutiques à 3 modes, catalogue/stock transactionnel, caisse/documents commerciaux, commandes multivendeurs, livraison, abonnements/facturation/crédits IA, audit.
- Premier code applicatif réel dans `apps/api` : module `auth` (inscription, connexion, JWT, rôles acheteur/vendeur) et module `shops` (création de boutique en mode privé ou hybride, période gratuite par défaut 3 mois, publication volontaire d'une sélection vers la Marketplace).
- Module `catalog` (produits, variantes, stock initial tracé) et module `pos` (vente de caisse transactionnelle avec décompte de stock, annulation avec retour en stock, tableau de bord CA journalier distinguant chiffre d'affaires / encaissements confirmés / marge).
- **Authentification réelle branchée** : `JwtAuthGuard` (vérifie le token sur toutes les routes `shops/*`) + `ShopMembershipGuard` (empêche un vendeur d'accéder aux données d'une autre boutique). Les ids ne sont plus pris en confiance depuis l'URL ou le corps de la requête — toujours l'utilisateur authentifié.
- Modules `suppliers` (achats fournisseurs, dettes), `expenses` (dépenses catégorisées), `customers` (ventes à crédit, créances séparées des encaissements — branché directement dans la transaction de vente POS pour le paiement STORE_CREDIT).
- Squelette Next.js minimal (`apps/web`) — compile sans erreur (`tsc --noEmit` validé).
- Recherche de la procédure d'homologation DGI/e-DEF menée (décision #9) — voir `COMPLIANCE_FACTURE_NORMALISEE.md`.
- Documentation permanente amorcée (`README.md`, `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DECISIONS.md`, `MAINTENANCE.md`).
- **Dépôt poussé sur GitHub** : `github.com/eleganzmarketadmin-sudo/eleganz`, branche `main`, à jour.
- Permissions fines par rôle de staff (`@ShopRoles`), invitation de collaborateurs dans une boutique.
- **Marketplace** : catalogue public (recherche structurée par catégorie/taille/couleur/prix/texte — pas encore de compréhension en langage naturel ni de recherche par photo, phase 8), commandes multivendeurs (panier réparti en sous-commandes par boutique, stock réservé transactionnellement, machine à états des statuts de commande conforme au prompt §42, confirmation de réception distincte de la déclaration du livreur).
- **Livraison** : zones, inscription livreur (non vérifié par défaut), affectation à une sous-commande, confirmations d'enlèvement/livraison réservées au livreur assigné.
- **Litiges** : ouverture côté acheteur, liste et résolution côté administration.
- **Facturation** : bouquets d'abonnement administrables (Gestion et Marketplace séparés), expiration de période gratuite → facture + statut PAYMENT_DUE, suspension après impayé (délai configurable, 7 jours par défaut), réactivation après paiement. Déclenchement manuel par un admin tant qu'aucun planificateur n'est câblé (voir ci-dessous).
- **Centre de pilotage (version de base)** : tableau de bord exécutif agrégeant boutiques par statut, commandes par statut, valeur brute des commandes vs revenus réellement acquis par la plateforme (jamais confondus), factures impayées, litiges ouverts.

## Ce qui bloque sur une décision ou une ressource externe (pas du code)

- **Paiements réels (Moneroo, Orange/Airtel/Vodacom)** : aucune intégration de paiement n'est branchée. Il faut un compte marchand Moneroo (et, plus tard, les contrats opérateurs) avec de vraies clés API avant de pouvoir coder l'appel réel — je ne peux pas créer ce compte ni obtenir ces clés moi-même.
- **Planificateur de tâches** (expiration d'essai, suspensions, relances) : fonctionne aujourd'hui par déclenchement manuel admin. Passer à un vrai cron nécessite de décider où le processus tournera (même serveur que l'API, ou un worker séparé) — lié au choix d'hébergement, pas encore fait.
- **Services IA** (recherche par photo, studio publicitaire, assistant marketing) : nécessitent de choisir et de payer un fournisseur (OpenAI, Google Vision, Replicate, etc.) — aucun n'est engagé.
- **Hébergement/déploiement** : aucun compte VPS, domaine ou stockage objet n'a été créé.

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
