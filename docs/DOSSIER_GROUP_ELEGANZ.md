# Dossier GROUP ELEGANZ SARL — constitution et conformité numérique

Demande du 14 novembre 2026 : l'utilisateur a transmis un dossier complet
(« GROUP_ELEGANZ_SARL_Dossier_Complet.zip », 18 fichiers) préparé en dehors
de ce projet — statuts, pièces de dépôt GUCE, contrats numériques, guide et
registre Excel — en demandant, en tant que développeur et co-concepteur de
la plateforme, de **refaire ces documents et de les adapter au format et à
l'évolution actuelle de la plateforme**, en les améliorant.

Les 15 documents Word/Excel du dossier ont été réécrits et livrés à
l'utilisateur sous forme d'archive. Leurs scripts générateurs sont conservés
dans ce dépôt sous `docs/dossier-group-eleganz/`, selon le même principe que
`docs/contrats-politiques/` (voir `docs/CONTRATS_ET_POLITIQUES.md`) : une
future session peut les relire, les modifier et les régénérer sans repartir
de zéro.

## Ce qui a changé par rapport au dossier source de l'utilisateur

- **Modules de la plateforme** : le dossier source ne mentionnait pas les
  modules ELEGANZ Livreur, Experts et Institutions, et décrivait l'activité
  numérique de façon générique. La réécriture liste les 7 modules réels
  (Market, Gestion, Livreur, Mon assistant, Experts, Institutions, Centre de
  pilotage), confirmés par grep sur `apps/web/app/lib/i18n/translations.ts`.
- **Modèle de paiement** : le dossier source supposait l'intégration d'un
  « prestataire de paiement autorisé ». La plateforme n'a, à ce jour, aucune
  intégration de paiement en ligne : le règlement s'effectue directement
  entre l'acheteur et la boutique (espèces / paiement mobile) à la livraison,
  sans intermédiation financière d'ELEGANZ. Tous les documents concernés (09,
  10, 11, 14, 15) ont été corrigés en conséquence.
- **Statuts enrichis** : deux articles supplémentaires (Propriété
  intellectuelle, Confidentialité et sécurité des données) ont été ajoutés,
  repris du dossier source mais absents du modèle de statuts produit plus tôt
  pour ce projet.
- **Conformité numérique RDC — recherche vérifiée** : le document 15
  (dossier de demande d'autorisation numérique) a été développé à partir
  d'une recherche web indépendante, non disponible dans le dossier source,
  confirmant :
  - les arrêtés ministériels n°004 et n°005 du 11 mars 2026 (régime
    d'autorisation préalable / déclaration pour les plateformes numériques,
    dont les marketplaces) ;
  - l'arrêté interministériel du 20 juillet 2026 fixant les redevances
    (2 000 à 10 000 USD selon que la plateforme est qualifiée « dominante »
    et selon l'origine du capital) ;
  - **le dépassement, au 14 novembre 2026, du délai transitoire fixé au 30
    juin 2026** — point d'alerte central, signalé dans le document 15, le
    guide et le registre Excel.
  - un point non confirmé de façon indépendante (registre BCC des
    « prestataires de services connexes ») est signalé comme tel plutôt que
    présenté comme un fait établi.
- **Prose professionnelle** : chaque document a été étoffé au même niveau de
  détail que les modèles de contrats déjà livrés séparément pour ce projet
  (`docs/contrats-politiques/`), au lieu du style très schématique du dossier
  source.

## Contenu livré à l'utilisateur

Archive `GROUP_ELEGANZ_SARL_Dossier_Ameliore.zip`, reprenant la structure du
dossier source :

| Dossier | Pièces |
| --- | --- |
| `01_Constitution/` | 01 Statuts (26 articles) · 02 Lettre GUCE · 03 Déclaration de capital · 04 PV constitutif · 05 Spécimen de signature · 06 Mandat de dépôt · 07 Attestation de siège · 08 Registre associés/bénéficiaires effectifs · 09 Décision d'ouverture bancaire |
| `02_Contrats_Numerique/` | 10 Contrat vendeur marketplace · 11 Conditions SaaS Gestion · 12 Politique de confidentialité · 13 Cession de propriété intellectuelle · 14 CGU Marketplace · 15 Dossier de demande d'autorisation numérique |
| `03_Registre_et_Guides/` | Guide et mode d'emploi (8 sections) · Registre Excel (24 formalités suivies + feuille Priorités + Mode d'emploi) |

Chaque champ de donnée réelle (identité des associés et du gérant, capital,
siège, dates) reste un placeholder rouge italique `[ ... — à compléter ]` —
rien n'a été inventé, conformément à la règle du projet.

## Scripts générateurs conservés dans ce dépôt

```
docs/dossier-group-eleganz/
  helpers.js                                   # repris de docs/contrats-politiques/helpers.js
  shared.js                                    # en-tête compact, pied d'identification, tableaux — propres à ce dossier
  01_Constitution/build-01-statuts.js          -> 01_Statuts_GROUP_ELEGANZ_SARL.docx
  01_Constitution/build-02-09.js               -> les 8 autres pièces de constitution (02 à 09)
  02_Contrats_Numerique/build-10-15.js         -> les 6 pièces de contrats numériques (10 à 15)
  03_Registre_et_Guides/build-guide.js         -> Guide_et_mode_emploi_GROUP_ELEGANZ.docx
  03_Registre_et_Guides/build-registre.py      -> Registre_formalites_autorisations_GROUP_ELEGANZ.xlsx
```

Pour régénérer : lancer chaque script depuis son propre dossier (`node
build-01-statuts.js`, etc. ; `python3 build-registre.py` pour le registre).
Les `.docx`/`.xlsx` générés ne sont pas conservés dans le dépôt — seuls les
scripts le sont, comme pour `docs/contrats-politiques/`.

## Statut : modèles de travail, pas des documents opposables

Comme les modèles transversaux déjà livrés (`docs/CONTRATS_ET_POLITIQUES.md`),
ce dossier doit être complété avec les données réelles de l'entreprise puis
validé par un notaire et/ou un avocat inscrit en République démocratique du
Congo avant tout dépôt ou toute signature — en priorité le point de
conformité numérique (pièce 15), dont le délai transitoire légal est déjà
dépassé à la date de cette révision.

## Documents liés

- `docs/contrats-politiques/` et `docs/CONTRATS_ET_POLITIQUES.md` — modèles
  transversaux de contrat vendeur, contrat expert et politiques générales
  déjà livrés séparément le 14 novembre 2026 ; les pièces 10 et 14 du présent
  dossier les complètent pour la seule composante Marketplace et doivent être
  harmonisées avec eux par un conseil juridique.
- `docs/COMPLIANCE_FACTURE_NORMALISEE.md` — cadre de la facture normalisée
  RDC, repris dans la pièce 10 (article 8).
