# Prochaines actions

Dans l'ordre, conformément à la décision #4 (Gestion d'abord) :

Fait : recherche d'homologation (#9), squelette npm, modules `auth`/`shops`/`catalog`/`pos`/`documents`/`operations`/`marketplace`/`orders`/`delivery`/`disputes`/`billing`/`admin-cockpit`, authentification JWT + guard d'appartenance boutique **et de rôle de staff** branchés sur toutes les routes, identité visuelle ELEGANZ (`docs/DESIGN_SYSTEM.md`), écrans Next.js réels côté Gestion (inscription, connexion, création de boutique, caisse avec impression de ticket PDF, tableau de bord, catalogue avec publication/dépublication, commandes avec impression de bon de livraison et ouverture de litige, litiges, équipe), côté Marketplace (vitrine publique, fiche produit, panier, compte acheteur, tunnel de commande, suivi de commande) et côté administration (`/admin/*` : tableau de bord exécutif, résolution des litiges), avec le script de création du compte administrateur, mode hors-ligne complet (phase 1 : file d'opérations + synchronisation ; phase 2 : app shell installable/PWA), litiges dans les deux sens (acheteur et boutique), et rendu PDF couvrant à la fois les ventes de caisse et les commandes Marketplace.

Depuis, le projet est en production sur Railway (`docs/PROJECT_STATUS.md`). Ce qui reste, en l'état, ne peut plus avancer sans une décision ou une ressource externe du propriétaire du projet :

1. **IA (API Anthropic)** : clé à créer sur platform.claude.com et à me communiquer, pour brancher l'assistant de description produit/marketing — en cours, le propriétaire a été guidé étape par étape (12 oct. 2026).
2. **Recherche par photo et studio publicitaire IA** : préparés dans l'écran mais désactivés (12 oct. 2026, voir PROJECT_STATUS.md) — demandent chacun un fournisseur distinct (embeddings d'image / génération d'image-vidéo), pas l'API Anthropic. Reporté en fonction des recettes et de la croissance, pas de compte à créer pour l'instant.
3. **Nom de domaine propre** : explicitement pas prioritaire pour l'instant (12 oct. 2026) — le site reste sur les sous-domaines Railway par défaut.
4. **Paiements réels (Moneroo/opérateurs)** : explicitement en dernier, faute de contrat pour l'instant (12 oct. 2026).

Ne pas commencer la facturation réelle (abonnements, frais d'ouverture) tant que les comptes de paiement (décision #5, #7) ne sont pas créés par le propriétaire du projet.
