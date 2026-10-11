# Identité visuelle ELEGANZ

Ce document fixe les choix de design avant le code : palette, typographie, mise
en page, principes. Il sert de référence pour tout écran futur, Gestion ou
Marketplace.

## Le sujet

ELEGANZ est une seule maison avec deux pièces très différentes :

- **ELEGANZ Gestion** — l'arrière-boutique. Un commerçant à Kinshasa, debout à
  son comptoir, souvent sur un téléphone Android d'entrée de gamme, parfois
  sans réseau fiable. Il doit lire un montant en une seconde, en plein soleil,
  et ne jamais douter de ce qui a été encaissé.
- **ELEGANZ Marketplace** — la vitrine. Un acheteur qui parcourt de la mode
  congolaise sur son téléphone, dans l'esprit de la Sape : costumes taillés,
  blocs de couleur francs, mise en scène assumée du vêtement.

Le même nom de maison, deux registres : l'un est un outil de comptoir, l'autre
une vitrine éditoriale. Le système ci-dessous les relie sans les confondre.

## Première passe — plan de design

### Couleur (palette de base, 6 teintes nommées)

| Nom | Hex | Rôle |
|---|---|---|
| Encre | `#15171C` | Texte, fond sombre du comptoir Gestion |
| Toile | `#F3F3EE` | Fond clair neutre (gris-blanc chaud, pas crème) |
| Cobalt | `#17408A` | Couleur principale Gestion — action, confiance, fleuve Congo |
| Flamme | `#C83E1F` | Alerte / accent partagé — rouge-orange de wax, jamais dominant |
| Magenta Sape | `#A62368` | Couleur principale Marketplace — mode, aplat franc |
| Or | `#D9A61A` | Succès, crédit, abonnement — utilisé avec parcimonie |

Pas de fond crème, pas de dégradé, pas d'ombre grise diffuse. La hiérarchie se
fait par aplats de couleur pleine (à la manière du tissu wax ou du costume du
sapeur), jamais par un halo.

### Typographie

- **Titres Marketplace** : Fraunces (serif à empattements taillés, du
  caractère, pas Playfair). Grande taille, graisse soutenue, pas d'accent sur
  un seul mot.
- **Interface et texte courant (les deux produits)** : IBM Plex Sans —
  humaniste, lisible petit, utilisé en minuscules normales (pas de majuscules
  de repérage).
- **Chiffres et argent** : IBM Plex Mono, toujours en chiffres tabulaires,
  alignés à droite. L'argent se lit comme sur un ticket de caisse, jamais en
  sans-serif proportionnelle qui glisse d'une ligne à l'autre.

### Mise en page

**Gestion — métaphore du registre/ticket de caisse.**
```
┌──────────────────────────────┐
│ ELEGANZ GESTION    Kadiata Shop│
├──────────────────────────────┤
│ Article            Qté   Prix │
│ Robe wax bleue       1  45 000│
│ Sandales cuir         2  30 000│
├──────────────────────────────┤
│ TOTAL                  75 000 │
├──────────────────────────────┤
│ [ Espèces ]  [ Mobile money ] │ ← barre d'action collée en bas,
└──────────────────────────────┘   gros boutons pour le pouce
```
Filets pleins de 2px (pas de hairline 1px façon broadsheet), angles droits,
aucune ombre. Les statuts sont des rectangles pleins de couleur avec un mot
simple ("Payé", "En attente"), jamais une pastille arrondie ni une majuscule
de repérage. Alignement : libellés à gauche, chiffres à droite.

**Marketplace — bloc de couleur éditorial.**
```
┌───────────────┬────────────────────┐
│               │  Porter la couleur  │ ← titre serif, chevauche
│   [ photo ]   │                     │   légèrement le bloc
│               ├─────────────────────┤
│  (aplat       │  grille produits,   │
│   Magenta)    │  pas d'arrondi,     │
│               │  filet fin sous     │
│               │  l'image, prix en   │
│               │  mono               │
└───────────────┴────────────────────┘
```
Héros asymétrique en deux blocs inégaux (photo pleine page + bloc de couleur),
dans l'esprit d'une veste et d'un pantalon de couleurs contrastées. Alignement
sobre à gauche, pas de centrage systématique.

### Principes directeurs

1. L'argent se typographie comme de l'argent : chiffres tabulaires, alignés à
   droite, jamais ambigus.
2. La hiérarchie vient des aplats de couleur, pas des ombres — le tissu wax et
   le costume du sapeur, pas le dégradé SaaS.
3. Gestion se lit en une seconde au comptoir en plein soleil ; Marketplace se
   regarde en flânant.
4. Le français est direct et concret — aucun jargon système, aucun anglicisme
   d'interface, aucune flèche décorative en fin de bouton.

## Deuxième passe — relecture face au brief

- **Évité le réflexe crème + serif + terracotta** : le fond clair (`Toile`)
  est gris-blanc froid, pas crème ; la teinte chaude (`Flamme`) est plus
  rouge que l'argile et reste un accent mineur, jamais associée à un fond
  crème avec titre serif — le serif n'apparaît que côté Marketplace, sur fond
  de blocs de couleur francs, pas sur fond crème.
- **Évité noir quasi-total + accent néon** : pas de vert acide ni de vermillon
  fluo ; `Encre` est un noir chaud discret, jamais seul porteur d'identité.
- **Risque identifié — filets façon broadsheet** : le registre Gestion
  pouvait glisser vers le journal à hairlines. Corrigé en épaississant les
  filets (2px pleins), en utilisant des étiquettes de statut pleines et
  colorées plutôt que des colonnes denses, et en réservant les gros chiffres
  mono à l'argent, pas à toute l'interface.
- **Évité le kit de cartes SaaS** : aucun angle arrondi, aucune ombre grise
  douce, aucun lavis de dégradé décoratif nulle part dans le système.
- **Évité le chrome générique** : pas d'eyebrow en majuscules au-dessus des
  titres, pas de libellé « Mot — fragment » à tiret cadratin, pas de flèche
  « → » en fin de bouton ou de lien, les boutons nomment l'action exacte
  ("Enregistrer la vente", pas "Vente →").

Ce plan, une fois relu, est celui qui est implémenté dans `apps/web`.
