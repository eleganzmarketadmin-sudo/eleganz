# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9 ci-dessous), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`.

1. **Rendu PDF des documents commerciaux** (tickets/reçus/factures internes) — `DocumentsService` génère pour l'instant l'enregistrement et la numérotation, pas encore le fichier PDF lui-même ni le format adapté imprimante de caisse (prompt §6).
2. **Guard JWT réel** sur toutes les routes `shops/:shopId/*` — actuellement les ids sont passés en paramètre d'URL sans vérification d'appartenance (TODO explicite dans chaque contrôleur).
3. **Modules restants du socle Gestion** : achats/fournisseurs, dépenses, clients et ventes à crédit, multi-utilisateurs avec permissions par rôle (`ShopStaff.role` existe déjà dans le schéma, pas encore exploité dans l'API).
4. **Concevoir l'identité visuelle ELEGANZ** (palette, typographie, composants) avant de construire les écrans, pour éviter de refaire l'UI plus tard.
5. **Spécifier le mode hors-ligne de la caisse** en détail (file d'opérations, résolution de conflits) avant de l'implémenter — c'est un point d'architecture, pas un détail d'UI (décision #8).
6. Une fois Gestion stable : écrans ELEGANZ Marketplace (catalogue public, panier, commande, paiement Moneroo).

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
