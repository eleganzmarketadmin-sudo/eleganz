# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations`/`marketplace`/`orders`/`delivery`/`disputes`/`billing`/`admin-cockpit`, authentification JWT + guard d'appartenance boutique **et de rôle de staff** branchés sur toutes les routes, identité visuelle ELEGANZ (`docs/DESIGN_SYSTEM.md`), écrans Next.js réels côté Gestion (inscription, connexion, création de boutique, caisse avec impression de ticket PDF, tableau de bord, catalogue avec publication/dépublication, commandes avec impression de bon de livraison et ouverture de litige, litiges, équipe), côté Marketplace (vitrine publique, fiche produit, panier, compte acheteur, tunnel de commande, suivi de commande) et côté administration (`/admin/*` : tableau de bord exécutif, résolution des litiges), avec le script de création du compte administrateur, mode hors-ligne complet (phase 1 : file d'opérations + synchronisation ; phase 2 : app shell installable/PWA), litiges dans les deux sens (acheteur et boutique), et rendu PDF couvrant à la fois les ventes de caisse et les commandes Marketplace.

Ce qui reste, en l'état, ne peut plus avancer sans une décision ou une ressource externe du propriétaire du projet :

1. **Upload réel d'images produits** : aujourd'hui il faut déjà avoir l'image hébergée ailleurs et en coller l'URL — un vrai upload (compte de stockage objet) remplacera ça une fois ce compte créé, sans changer la forme de la donnée (`Product.images: string[]`).
2. **Branchement des paiements réels, de l'IA et de l'hébergement** — voir `PROJECT_STATUS.md`, section « Ce qui bloque » : attend les comptes/clés du propriétaire du projet.

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
