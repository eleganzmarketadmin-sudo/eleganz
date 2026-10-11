# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

1. **Rechercher la procédure d'homologation DGI/e-DEF** (décision #9) et documenter ce qui est requis pour passer de `INVOICE_INTERNAL` à `INVOICE_FISCAL` — avant d'écrire l'écran de facturation.
2. **Initialiser réellement les projets** `apps/api` (NestJS) et `apps/web` (Next.js) — pour l'instant seuls les dossiers et le schéma Prisma existent, aucune dépendance npm n'a été installée.
3. **Construire le module ELEGANZ Gestion socle** : authentification + rôles boutique, catalogue, caisse (POS), stock transactionnel, documents commerciaux non homologués, tableau de bord chiffre d'affaires journalier.
4. **Concevoir l'identité visuelle ELEGANZ** (palette, typographie, composants) avant de construire les écrans, pour éviter de refaire l'UI plus tard.
5. **Spécifier le mode hors-ligne de la caisse** en détail (file d'opérations, résolution de conflits) avant de l'implémenter — c'est un point d'architecture, pas un détail d'UI (décision #8).
6. Une fois Gestion stable : écrans ELEGANZ Marketplace (catalogue public, panier, commande, paiement Moneroo).

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
