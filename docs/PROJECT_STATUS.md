# État du projet

Dernière mise à jour : 11 octobre 2026.

## Fait

- **Identité visuelle ELEGANZ conçue** (`docs/DESIGN_SYSTEM.md`) : palette (Encre, Toile, Cobalt, Flamme, Magenta Sape, Or), typographie (Fraunces pour les titres Marketplace, IBM Plex Sans pour l'interface, IBM Plex Mono pour l'argent), mise en page registre/ticket de caisse côté Gestion et bloc de couleur éditorial côté Marketplace — relue et corrigée pour éviter les travers génériques (crème+terracotta, cartes SaaS, chrome de majuscules).
- **Premiers écrans Next.js réels** (`apps/web`), branchés sur l'API, pas des maquettes statiques :
  - Page d'accueil de la maison ELEGANZ (choix Gestion / Marketplace).
  - Connexion (email ou téléphone + mot de passe, jeton JWT conservé côté client).
  - Caisse : recherche d'article, ticket avec quantités modifiables, choix du moyen de paiement, enregistrement réel de la vente (`POST /shops/:id/pos/sales`).
  - Tableau de bord du jour : chiffre d'affaires, encaissements confirmés, marge brute (avec avertissement si incomplète), par date choisie.
  - Catalogue : création d'article, ajout de variante (référence, taille, couleur, prix d'achat/vente, stock initial).
  - Vitrine Marketplace publique : recherche texte, grille de produits publiés avec prix le plus bas disponible.
  - `tsc --noEmit` validé sur tout `apps/web` sans erreur.
- **Correction** : `ShopsService.findMine` ne renvoyait que les boutiques possédées par l'utilisateur — un caissier ou gérant (staff, pas propriétaire) ne voyait donc jamais la boutique où il travaille. Corrigé pour inclure aussi les boutiques où l'utilisateur est membre actif de l'équipe.
- **Écrans Gestion complétés** : inscription, création de boutique, invitation/retrait d'un collaborateur (`/equipe`). Au passage, `InviteStaffDto` a été changé pour accepter un email/téléphone plutôt qu'un id technique que le propriétaire ne peut pas connaître — `ShopsService.inviteStaff` résout maintenant lui-même l'utilisateur, et réactive un membre désactivé au lieu de refuser silencieusement.
- **Écrans Marketplace complétés** : fiche produit (choix de variante, ajout au panier), panier (persistant dans le navigateur de l'acheteur), compte acheteur (connexion/inscription séparée du compte propriétaire — un compte est soit vendeur, soit acheteur, jamais les deux, conformément au modèle de données), tunnel de commande (crée une vraie commande multivendeurs via `POST /marketplace/orders`), suivi des commandes (`/marketplace/commandes`). Le paiement en ligne n'étant pas encore branché (décision #2 : Moneroo + opérateurs plus tard), l'écran de commande informe clairement que le règlement se fait à la livraison, en espèces ou en mobile money — rien n'est présenté comme payé en ligne alors qu'il ne l'est pas.

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

- Mode hors-ligne de la caisse (spécification détaillée requise avant le code, décision #8).
- Écrans Marketplace restants : fiche produit, panier, tunnel de commande, suivi de commande, espace vendeur.
- Écrans d'inscription et de création de boutique (l'API existe, pas encore d'écran).
- Rendu PDF des documents commerciaux.
- Aucun compte (hébergement, domaine, Moneroo, stockage objet, fournisseur IA) n'a été créé — voir la section blocages ci-dessus.
- Aucun déploiement, même en préproduction.

## Prochaine étape concrète

Voir `NEXT_ACTIONS.md`.
