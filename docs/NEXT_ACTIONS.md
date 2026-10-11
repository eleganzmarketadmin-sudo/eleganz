# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations`/`marketplace`/`orders`/`delivery`/`disputes`/`billing`/`admin-cockpit`, authentification JWT + guard d'appartenance boutique **et de rôle de staff** branchés sur toutes les routes, identité visuelle ELEGANZ (`docs/DESIGN_SYSTEM.md`) et écrans Next.js réels (inscription, connexion, création de boutique, caisse, tableau de bord, catalogue côté Gestion ; vitrine publique côté Marketplace).

1. **Rendu PDF des documents commerciaux** (tickets/reçus/factures internes) — `DocumentsService` génère pour l'instant l'enregistrement et la numérotation, pas encore le fichier PDF lui-même ni le format adapté imprimante de caisse (prompt §6).
2. **Multi-utilisateurs côté invitation — écran** : l'endpoint existe (`POST /shops/:shopId/staff`) mais aucun écran ne permet encore à un propriétaire d'inviter un gérant/caissier/magasinier depuis l'interface.
3. **Écrans Marketplace restants** : fiche produit, panier, tunnel de commande, suivi de commande acheteur, espace vendeur marketplace (gestion des commandes multivendeurs, litiges) — la vitrine publique (page `/marketplace`) est posée, le reste suit le même système de design.
4. **Spécifier le mode hors-ligne de la caisse** en détail (file d'opérations, résolution de conflits) avant de l'implémenter — c'est un point d'architecture, pas un détail d'UI (décision #8).
5. **Branchement des paiements réels, de l'IA et de l'hébergement** — voir `PROJECT_STATUS.md`, section « Ce qui bloque » : attend les comptes/clés du propriétaire du projet.

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
