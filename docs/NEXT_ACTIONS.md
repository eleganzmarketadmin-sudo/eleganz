# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations` (fournisseurs/dépenses/clients), authentification JWT + guard d'appartenance boutique branchés sur toutes les routes.

1. **Rendu PDF des documents commerciaux** (tickets/reçus/factures internes) — `DocumentsService` génère pour l'instant l'enregistrement et la numérotation, pas encore le fichier PDF lui-même ni le format adapté imprimante de caisse (prompt §6).
2. **Permissions fines par rôle de staff** (`ShopStaff.role` existe dans le schéma — `OWNER`/`MANAGER`/`CASHIER`/etc. — mais `ShopMembershipGuard` ne vérifie encore que l'appartenance, pas le rôle précis). Ex. : un caissier ne devrait pas pouvoir créer des fournisseurs ni consulter les marges.
3. **Multi-utilisateurs côté invitation** : pas encore d'endpoint pour qu'un propriétaire invite un gérant/caissier/magasinier dans sa boutique (`ShopStaff` ne se peuple aujourd'hui qu'à la création de la boutique, pour le propriétaire).
4. **Concevoir l'identité visuelle ELEGANZ** (palette, typographie, composants) avant de construire les écrans, pour éviter de refaire l'UI plus tard.
5. **Spécifier le mode hors-ligne de la caisse** en détail (file d'opérations, résolution de conflits) avant de l'implémenter — c'est un point d'architecture, pas un détail d'UI (décision #8).
6. Une fois Gestion stable : écrans ELEGANZ Marketplace (catalogue public, panier, commande, paiement Moneroo) — y compris le contrôleur public sans guard pour les produits publiés, noté en TODO dans `catalog.controller.ts`.

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
