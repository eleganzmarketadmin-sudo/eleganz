# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations`/`marketplace`/`orders`/`delivery`/`disputes`/`billing`/`admin-cockpit`, authentification JWT + guard d'appartenance boutique **et de rôle de staff** branchés sur toutes les routes, identité visuelle ELEGANZ (`docs/DESIGN_SYSTEM.md`), écrans Next.js réels côté Gestion (inscription, connexion, création de boutique, caisse avec impression de ticket PDF, tableau de bord, catalogue avec publication/dépublication, commandes, litiges, équipe), côté Marketplace (vitrine publique, fiche produit, panier, compte acheteur, tunnel de commande, suivi de commande) et côté administration (`/admin/*` : tableau de bord exécutif, résolution des litiges), avec le script de création du compte administrateur.

1. **Rendu PDF des commandes Marketplace** : le rendu PDF ne couvre pour l'instant que les documents liés à une vente de caisse (`posSaleId`) — pas encore aux sous-commandes Marketplace (`shopOrderId`), qui ont une structure différente (plusieurs lignes de variante sans `label`/`PosSaleLine`).
2. **Ouverture d'un litige côté boutique** : `DisputesService.open` accepte déjà un initiateur générique, mais aucun endpoint/écran ne permet à une boutique d'ouvrir elle-même un litige (seul l'acheteur le peut aujourd'hui) — prompt §47 prévoit les deux sens.
3. **Upload réel d'images produits** : aujourd'hui il faut déjà avoir l'image hébergée ailleurs et en coller l'URL — un vrai upload (compte de stockage objet) remplacera ça une fois ce compte créé, sans changer la forme de la donnée (`Product.images: string[]`).
4. **Phase 2 du mode hors-ligne** : app shell installable (PWA/service worker + manifest), pour que l'écran caisse s'ouvre même sans réseau depuis le démarrage de l'appareil (voir `docs/ARCHITECTURE_HORS_LIGNE.md`). La phase 1 (file d'opérations + synchronisation) est faite.
5. **Branchement des paiements réels, de l'IA et de l'hébergement** — voir `PROJECT_STATUS.md`, section « Ce qui bloque » : attend les comptes/clés du propriétaire du projet.

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
