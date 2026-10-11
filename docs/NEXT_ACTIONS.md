# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations`/`marketplace`/`orders`/`delivery`/`disputes`/`billing`/`admin-cockpit`, authentification JWT + guard d'appartenance boutique **et de rôle de staff** branchés sur toutes les routes, identité visuelle ELEGANZ (`docs/DESIGN_SYSTEM.md`) et écrans Next.js réels côté Gestion (inscription, connexion, création de boutique, caisse, tableau de bord, catalogue, équipe) **et** côté Marketplace (vitrine publique, fiche produit, panier, compte acheteur, tunnel de commande, suivi de commande).

1. **Rendu PDF des documents commerciaux** (tickets/reçus/factures internes) — `DocumentsService` génère pour l'instant l'enregistrement et la numérotation, pas encore le fichier PDF lui-même ni le format adapté imprimante de caisse (prompt §6).
2. **Espace vendeur marketplace** : écran pour qu'une boutique voie et fasse avancer ses sous-commandes (`GET /shops/:shopId/orders` à créer côté API — `OrdersService.listForShop` existe déjà côté service mais n'est pas encore exposé par un contrôleur), et gère les litiges ouverts contre elle.
3. **Publication d'une sélection vers la Marketplace — écran** : l'endpoint existe (`POST /shops/:shopId/publish`) mais aucun écran catalogue ne permet encore de cocher des articles et de les publier.
4. **Spécifier le mode hors-ligne de la caisse** en détail (file d'opérations, résolution de conflits) avant de l'implémenter — c'est un point d'architecture, pas un détail d'UI (décision #8).
5. **Branchement des paiements réels, de l'IA et de l'hébergement** — voir `PROJECT_STATUS.md`, section « Ce qui bloque » : attend les comptes/clés du propriétaire du projet.

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
