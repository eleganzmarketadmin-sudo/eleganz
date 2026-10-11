# Décisions validées par le propriétaire du projet

Ce fichier est la source de vérité. Une future session ne doit pas re-proposer ces choix sans raison nouvelle. Document complet de cadrage : voir le doc ELEGANZ — Synthèse stratégique (lié depuis la conversation d'origine).

Date de validation : 11 octobre 2026.

| # | Sujet | Décision |
| --- | --- | --- |
| 1 | Architecture | Next.js (frontend) + NestJS (API) + PostgreSQL auto-hébergé. Pas de Supabase. |
| 2 | Paiements | Démarrage avec l'agrégateur Moneroo (mobile money RDC) + paiement à la livraison / cash. Les contrats directs avec les opérateurs (Orange, Airtel, Vodacom M-Pesa) sont préparés en parallèle pour bascule future, sans bloquer le lancement. |
| 3 | Période gratuite | Durée configurable depuis l'admin (`Shop.freeTrialDurationDays`), valeur par défaut 3 mois (90 jours) à partir de l'entrée en relation (`Shop.freeTrialStartedAt`). |
| 4 | Ordre de construction | ELEGANZ Gestion d'abord, ELEGANZ Marketplace ensuite. Pas de précipitation — priorité à la qualité du socle commun. |
| 5 | Comptes de référence | `eleganzmarket.admin@gmail.com` pour les comptes techniques et commerciaux à créer (hébergement, domaine, paiement, etc.), sous propriété du client. |
| 6 | Validation juridique (fiscalité, protection des données, droits des consommateurs) | Portée conjointement : le propriétaire du projet + Claude (recherche de toute la documentation officielle nécessaire avant d'activer les obligations concernées). |
| 7 | Budget plafond | Le budget de la phase de lancement estimé dans la synthèse (~30–100 USD/mois hors services IA) sert de plafond de référence tant qu'il n'est pas remplacé par un chiffre explicite. |
| 8 | Mode hors-ligne (caisse) | Inclus dès la V1, et non reporté à une phase ultérieure. |
| 9 | Facture normalisée / e-DEF (RDC) | Rechercher la procédure officielle (DGI, plateforme e-DEF, Module de Contrôle de Facturation) avant le développement des factures fiscales. En attendant l'homologation, rendre disponibles au choix : un document commercial non homologué (`CommercialDocument.type = INVOICE_INTERNAL`) et, une fois validée, la facture homologuée (`INVOICE_FISCAL`, `isFiscallyHomologated = true`). Ne jamais présenter l'un pour l'autre. |
| 10 | Périmètre V1 | ELEGANZ Gestion développée en premier (ordre de construction), mais les deux produits (Gestion et Marketplace) doivent être disponibles ensemble au lancement V1. |

## Conséquences techniques directes

- Le schéma de données (`packages/database/prisma/schema.prisma`) est unifié dès le départ — un `Shop` peut être `PRIVATE`, `MARKETPLACE` ou `HYBRID`, et le stock (`StockMovement`) est une table transactionnelle commune aux ventes de caisse et aux commandes en ligne, pour empêcher la double vente (décision implicite du cahier des charges, §5 du complément).
- Aucun tarif n'est codé en dur : `SubscriptionPlan`, `Invoice`, `DeliveryZone` sont administrables.
- `CommercialDocument.isFiscallyHomologated` reste `false` tant que l'homologation DGI n'est pas confirmée — ne jamais le forcer à `true` sans validation explicite (décision #9).
