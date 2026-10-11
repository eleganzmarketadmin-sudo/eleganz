# ELEGANZ — vue d'ensemble

## Ce que c'est

ELEGANZ est un projet à deux produits, un seul socle technique :

1. **ELEGANZ Gestion** : un logiciel de caisse et de gestion commerciale (ventes physiques, stock, achats, dépenses, clients/crédit, documents commerciaux) pour les commerçants congolais, utilisable **sans jamais vendre en ligne**.
2. **ELEGANZ Marketplace** : une place de marché multivendeurs (mode, vêtements, accessoires haut de gamme), inspirée fonctionnellement de fashionnova.com sans copie de son identité, avec recherche intelligente, recherche par photo, studio publicitaire IA et Centre de pilotage commercial pour l'administration.

Un commerçant choisit un mode de boutique (`PRIVATE`, `MARKETPLACE`, `HYBRID`) et peut en changer sans reconstruire son catalogue. Les données de gestion privée (fournisseurs, prix d'achat, marges, clients physiques) ne sont jamais exposées aux autres vendeurs ni à la Marketplace du seul fait qu'une boutique utilise ELEGANZ Gestion.

## Marché cible

République démocratique du Congo, lancement prioritaire à Kinshasa. Contraintes prises en compte dès la conception : connexions limitées (mode hors-ligne caisse), paiements mobile money (Orange/Airtel/Vodacom via agrégateur Moneroo + cash), devises CDF/USD, réforme de la facture normalisée (DGI, dispositifs électroniques fiscaux).

## Pourquoi ce découpage

Le propriétaire du projet a demandé (décision #4 et #10, `DECISIONS.md`) qu'ELEGANZ Gestion soit construit en premier — il touche un marché plus large (tout commerçant, pas seulement ceux qui veulent vendre en ligne) et valide le socle technique (catalogue, stock, documents, multi-utilisateurs) avant d'y ajouter la complexité multivendeurs de la Marketplace. Les deux doivent néanmoins être disponibles ensemble au lancement V1.

## Documents de référence

- Cahier des charges original (ancienne application React/Supabase) : référence fonctionnelle uniquement, pas de reprise de code.
- Prompt maître du propriétaire du projet : exigences fonctionnelles complètes (Marketplace, IA, monétisation, Centre de pilotage).
- Complément stratégique ELEGANZ Gestion : exigences du module de gestion commerciale.
- Doc de synthèse stratégique (Claude Docs, créé le 11 octobre 2026) : comparaison d'architectures, coûts estimés, décisions tranchées — `DECISIONS.md` en est l'extrait qui fait foi pour le code.
