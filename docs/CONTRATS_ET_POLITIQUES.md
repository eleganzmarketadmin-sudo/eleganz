# Modèles de contrats et politiques ELEGANZ

Demande du 14 novembre 2026 : « générer les documents (que vous devez ajouter à la
documentation même pour les futures demandes) : le modèle de contrat vendeur [...],
le modèle de contrat pour les experts [...], les politiques générales d'ELEGANZ et
règlement utilisateur ».

Trois modèles ont été rédigés en Word (`.docx`) et livrés à l'utilisateur. Leurs
scripts générateurs sont conservés dans ce dépôt sous `docs/contrats-politiques/`
pour qu'une **future session puisse les relire, les modifier et les
régénérer** sans repartir de zéro — contrairement aux autres documents Word
produits pour ce projet (business plan, statuts), dont seuls les fichiers livrés
existent, sans script conservé dans le dépôt.

## Ce qui a été livré

| Document | Script générateur | Contenu |
| --- | --- | --- |
| Contrat d'adhésion Vendeur | `docs/contrats-politiques/build-contrat-vendeur.js` | Obligations du Vendeur sur ses produits, traitement des commandes, **responsabilité du Vendeur sur les livreurs qu'il crée et utilise** (art. 5), absence d'intermédiation financière d'ELEGANZ (règlement à la livraison), retours/remboursements à la charge du Vendeur, facturation et conformité fiscale (renvoi à la présentation normalisée auto-déclarée vs. homologation DGI réelle), abonnement/commission, manquements, **suspension et suppression de la boutique par ELEGANZ pour non-conformité**, fermeture par le Vendeur, limitation de responsabilité, droit applicable (placeholder). |
| Contrat d'accès Expert | `docs/contrats-politiques/build-contrat-expert.js` | Contrat-cadre signé à l'inscription de l'Expert, applicable à chaque invitation reçue d'une boutique. Portée de l'accès (limité à l'invitation, révocable par la boutique), **obligation de confidentialité** sur les données consultées (durée post-contractuelle à préciser), absence de lien de subordination, responsabilité professionnelle propre de l'Expert, conflits d'intérêts, révocation de l'accès par ELEGANZ en cas de manquement. |
| Politiques générales / Règlement d'utilisation (CGU) | `docs/contrats-politiques/build-cgu.js` | Conditions générales transversales à tous les modules (Marketplace, Gestion, Livreur, Mon Assistant, Experts, Institutions, Centre de pilotage) : comptes, règles de conduite, rôle de chaque type d'utilisateur, propriété intellectuelle, données personnelles, paiements, disponibilité du service, limitation de responsabilité, sanctions/suspension/suppression de compte, modification du règlement, droit applicable (placeholder). |

Les trois scripts réutilisent `docs/contrats-politiques/helpers.js` (mêmes
helpers que `docs/statuts/` : `h0`/`h1`/`p`/`bullet`/`phRun`/`calloutBox`/
`signatureBlock`, même palette, même convention de placeholder rouge italique
`[ ... — à compléter ]`).

## Statut : modèles, pas des documents opposables

**Aucune donnée réelle concernant ELEGANZ n'a été inventée** (dénomination
exacte, forme juridique, capital, siège, numéro RCCM, coordonnées de contact) :
chaque champ de ce type est un placeholder rouge italique dans les trois
documents. Avant toute utilisation opérationnelle (signature par un vendeur ou
un expert, publication des CGU), il reste à faire valider par un conseil
juridique inscrit en République démocratique du Congo, au minimum :

- la clause de droit applicable et de règlement des différends (présente dans
  les trois documents) ;
- le plafond de limitation de responsabilité d'ELEGANZ ;
- la durée de l'obligation de confidentialité post-contractuelle de l'Expert ;
- l'identité juridique complète d'ELEGANZ (cohérente avec le modèle de
  statuts produit séparément, voir ci-dessous).

## Pour régénérer ou modifier un document

```bash
cd docs/contrats-politiques
node build-contrat-vendeur.js   # -> ELEGANZ-Contrat-Vendeur-Modele.docx
node build-contrat-expert.js    # -> ELEGANZ-Contrat-Expert-Modele.docx
node build-cgu.js               # -> ELEGANZ-Politiques-Generales-CGU-Modele.docx
```

Les `.docx` générés ne sont pas conservés dans le dépôt (comme les autres
livrables Word du projet) — seuls les scripts le sont. Pour ajouter ou modifier
une clause : éditer le tableau d'articles dans le script concerné, relancer la
génération, puis faire une vérification visuelle (conversion PDF + relecture
des pages clés) avant de relivrer le fichier à l'utilisateur.

## Documents liés

- `docs/COMPLIANCE_FACTURE_NORMALISEE.md` — cadre de la facture normalisée RDC,
  repris dans le Contrat Vendeur (article 8).
- `docs/DOSSIER_GROUP_ELEGANZ.md` — dossier complet de constitution et de
  conformité numérique de GROUP ELEGANZ SARL (statuts à 26 articles, pièces
  GUCE, contrats numériques, guide, registre Excel), produit le 14 novembre
  2026 à partir d'un dossier fourni par l'utilisateur. Les pièces 10 (contrat
  vendeur marketplace) et 14 (CGU Marketplace) de ce dossier complètent, pour
  la seule composante Marketplace, les deux premiers documents du tableau
  ci-dessus ; les trois ensembles doivent être harmonisés par un conseil
  juridique avant publication définitive. Ce dossier contient également le
  modèle de statuts de constitution à jour (remplace la version mentionnée
  ci-dessous, non conservée dans ce dépôt).
