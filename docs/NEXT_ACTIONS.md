# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations`/`marketplace`/`orders`/`delivery`/`disputes`/`billing`/`admin-cockpit`, authentification JWT + guard d'appartenance boutique **et de rôle de staff** branchés sur toutes les routes, identité visuelle ELEGANZ (`docs/DESIGN_SYSTEM.md`) et écrans Next.js réels côté Gestion (inscription, connexion, création de boutique, caisse, tableau de bord, catalogue, équipe) **et** côté Marketplace (vitrine publique, fiche produit, panier, compte acheteur, tunnel de commande, suivi de commande).

1. **Rendu PDF des commandes Marketplace** : le rendu PDF ne couvre pour l'instant que les documents liés à une vente de caisse (`posSaleId`) — pas encore aux sous-commandes Marketplace (`shopOrderId`), qui ont une structure différente (plusieurs lignes de variante sans `label`/`PosSaleLine`).
2. **Dépublication d'un article** : aujourd'hui on ne peut que publier (`isPublished: true`), pas retirer un article de la Marketplace — ni l'API ni l'écran ne le permettent.
3. **Gestion des litiges côté boutique** : `DisputesService`/`DisputesController` couvrent l'ouverture par l'acheteur et la résolution par l'administration, mais une boutique n'a aucun écran (ni endpoint dédié) pour voir les litiges ouverts contre elle.
4. **Dépannage images produits** : `Product.images` existe dans le schéma mais aucun upload n'est branché — le catalogue et la vitrine affichent un nom de produit à la place d'une photo.
5. **Spécifier le mode hors-ligne de la caisse** en détail (file d'opérations, résolution de conflits) avant de l'implémenter — c'est un point d'architecture, pas un détail d'UI (décision #8).
6. **Branchement des paiements réels, de l'IA et de l'hébergement** — voir `PROJECT_STATUS.md`, section « Ce qui bloque » : attend les comptes/clés du propriétaire du projet.

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
