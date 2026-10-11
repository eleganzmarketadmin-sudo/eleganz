# Facture normalisée RDC — ce qui est confirmé, ce qui reste à faire

Recherché le 11 octobre 2026, suite à la décision #9 (`DECISIONS.md`). À vérifier et compléter avant d'implémenter `CommercialDocument.type = INVOICE_FISCAL`.

## Cadre réglementaire

- Décret n°23/10 du 3 mars 2023 : encadre la facture normalisée et les Dispositifs Électroniques Fiscaux (DEF) en RDC.
- Généralisation annoncée par le ministère des Finances à partir du 1er août 2025 : toute entreprise assujettie à la TVA doit émettre ses factures via ces dispositifs. [Source](https://actualite.cd/2025/07/29/rdc-debut-officiel-de-la-generalisation-de-la-facture-normalisee-des-ce-1er-aout)
- Communiqué DGI n°01/040/DGI/DG/FACNOTVA/MKD/TTO/2025 du 1er août 2025 : régit l'homologation des systèmes de facturation d'entreprise (ne nomme pas explicitement le « MCF », terme que nous avions repris du vocabulaire général de ce type de réforme — à confirmer que la RDC utilise bien cette terminologie précise ou une autre).
- Au 24 décembre 2025, 54 207 factures normalisées avaient été émises par 3 289 entités, signe que le dispositif est opérationnel en pratique. [Source](https://actualite.cd/2025/12/27/rdc-jusquau-24-decembre-54-207-factures-normalisees-ont-ete-emises-par-3-289)

## Procédure d'homologation (pour une entreprise avec son propre logiciel, cas d'ELEGANZ)

D'après le tableau de préoccupations techniques publié par la Fédération des Entreprises du Congo (FEC) en août 2025 : [Source (PDF)](https://fec-rdc.com/wp-content/uploads/2025/08/TABLEAU-RENCONTRANT-LES-PREOCCUPATIONS-TECHNIQUES-ET-OPERATIONNELLES-DES-ENTREPRISES-PAR-RAPPORT-A-LA-MISE-EN-OEUVRE-DE-LA-REFORME-SUR-LA-FACTURE-NORMALISE-1.pdf)

1. Créer un compte sur le portail développeur de la DGI : `developper.dgirdc.cd`, pour soumettre la demande et récupérer les spécifications techniques.
2. Préparer la documentation technique du logiciel (énumération des opérations / schéma fonctionnel plutôt que les fichiers d'installation complets) — le détail exact se fixe lors d'une réunion technique avec la cellule DGI en charge de la réforme.
3. Obtenir le quitus fiscal de l'éditeur (ELEGANZ / l'entité qui exploite la plateforme), ou à défaut une lettre attestant du dépôt de la demande restée sans réponse pendant 10 jours.
4. Signer l'acte d'engagement prévu par le communiqué DGI (le document prévoit que l'entreprise utilisatrice, pas seulement l'éditeur, puisse le signer).
5. En cas de blocage, la FEC sert de relais vers la cellule DGI (contacts disponibles dans le document source : CD exploitation DGI Mimy Kiwobo, Directeur Coco Moanda).

**Aucun délai de traitement n'est publiquement documenté.** La phase de conformité (avant l'obligation stricte) ne semble pas encore accompagnée d'un processus d'homologation permanent et stabilisé à la date de cette recherche — à reconfirmer avant d'engager la démarche, la réglementation RDC évoluant vite sur ce sujet.

## Conséquence pour ELEGANZ

- V1 : tous les documents de vente d'ELEGANZ Gestion sont émis comme `INVOICE_INTERNAL` (documents commerciaux ordinaires, non homologués), jamais présentés comme factures fiscales.
- En parallèle de la V1, engager la démarche d'homologation ci-dessus (nécessite un compte développeur DGI et l'implication du propriétaire du projet pour le quitus fiscal — ce n'est pas une démarche que Claude peut mener seul).
- Une fois homologué, basculer `CommercialDocument.type = INVOICE_FISCAL` et `isFiscallyHomologated = true` pour les boutiques concernées, sans jamais le faire par défaut.

## Ce qui reste à vérifier (pas trouvé dans les sources consultées)

- Terminologie exacte RDC pour l'équivalent du MCF/UF employé dans d'autres pays (à confirmer directement via le portail `developper.dgirdc.cd`).
- Spécifications techniques précises (format de QR code, API d'intégration) — disponibles seulement après création d'un compte sur le portail développeur.
- Coût éventuel de l'homologation.
