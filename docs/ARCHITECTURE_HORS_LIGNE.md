# Mode hors-ligne — spécification et état d'implémentation

Décision #8 : le mode hors-ligne fait partie du V1, mais doit être spécifié
avant d'être codé — c'est un point d'architecture (ordre des opérations,
résolution de conflits), pas un détail d'écran. Ce document fixe la
conception.

**État** : la phase 1 (file d'opérations + synchronisation idempotente) est
implémentée pour **deux** types d'opération :

- `POS_SALE` (vente Caisse) — voir `apps/api/src/pos/pos.service.ts`
  (`syncOfflineSale`/`listStockDiscrepancies`), intégration dans l'écran
  caisse et le tableau de bord.
- `COMPTABLE_QUICK_ENTRY` (saisie rapide Mon Comptable, ajouté le 13 oct.
  2026 en réponse au point 2 du prompt de ce jour — « saisie différée
  synchronisée au retour du réseau ») — voir
  `apps/api/src/comptable/comptable.service.ts` (`syncQuickEntry`),
  intégration dans `apps/web/app/comptable/activites/[id]/page.tsx`.

Les deux types partagent la même file locale (`apps/web/app/lib/offline-queue.ts`,
généralisée via `TypeOperationEnAttente`) et le même moteur de
synchronisation (`apps/web/app/lib/offline-sync.tsx`, qui route chaque
opération vers son endpoint via `cheminSynchronisation()`). Ajouter un
troisième type = ajouter une entrée dans cette fonction de routage, rien
d'autre à changer dans la boucle.

**Portée actuelle de `COMPTABLE_QUICK_ENTRY`** : uniquement le formulaire de
« saisie rapide » du Carnet (onglet principal d'une activité). Les formulaires
Locatif/Travailleurs (saisis via `window.prompt`) et le point d'entrée
`createEntry` non-rapide restent en ligne uniquement pour l'instant — limite
connue, pas un oubli.

La phase 2 (app shell installable/PWA) n'est pas commencée, pour aucun des
deux types d'opération.

## Le problème réel

À Kinshasa, les coupures de courant et les coupures de données mobiles sont
fréquentes. Un commerçant qui encaisse une vente ne peut pas dire à son
client « revenez quand le réseau sera rétabli » — la vente doit s'enregistrer
localement, immédiatement, et se synchroniser avec le serveur dès que
possible, sans jamais perdre une transaction ni facturer deux fois le même
article en stock.

Deux besoins distincts, qu'il ne faut pas confondre :

1. **La page doit pouvoir s'ouvrir sans réseau** (l'app elle-même, pas
   seulement ses données) — ça demande un *service worker* qui mette en
   cache l'app shell Next.js. Sans lui, une coupure avant que la page ait
   chargé une première fois laisse un écran blanc, quel que soit le soin mis
   dans la synchronisation des données.
2. **Les opérations faites pendant la coupure doivent survivre et se
   synchroniser** — ça demande une file locale durable et une API de
   synchronisation idempotente côté serveur.

Les deux sont nécessaires pour un mode hors-ligne complet ; elles sont
indépendantes et peuvent se construire en deux phases.

## Phase 1 — file d'opérations + synchronisation idempotente

C'est la phase qui protège l'argent et le stock. Elle suppose que la page
est déjà chargée (réseau présent au démarrage, perdu ensuite) — le cas le
plus fréquent en pratique (coupure en cours de journée, pas au démarrage du
téléphone).

### Identifiant d'opération, pas d'identifiant de vente

Chaque action de caisse (`créer une vente`, plus tard `annuler une vente`)
génère côté client un `clientOperationId` (UUID v4), **avant** tout appel
réseau. Cet identifiant, pas l'identifiant de la vente créée, est la clé
d'idempotence : si la même opération est envoyée deux fois (coupure pendant
la réponse, nouvelle tentative), le serveur reconnaît le doublon et renvoie
le résultat déjà enregistré au lieu de créer une deuxième vente.

Implication côté base de données : `PosSale` gagne une colonne
`clientOperationId String? @unique`. Le point d'entrée de synchronisation
fait un `upsert` logique : si une vente avec cet id existe déjà, on la
retourne ; sinon on exécute `PosService.createSale` normalement.

### File locale (IndexedDB, pas localStorage)

`localStorage` est utilisé ailleurs dans `apps/web` pour du confort (jeton,
panier) — pas adapté ici : taille limitée, synchrone (bloque le thread sur
gros volumes), et pas de transactions. La file d'opérations hors-ligne vit
dans IndexedDB (via une petite couche, ex. `idb`), avec un store
`pending_operations` :

```
{ clientOperationId, type: "POS_SALE", payload, createdAtClient, tentatives, dernierEchec }
```

Flux côté caisse :

1. L'utilisateur encaisse → l'opération est écrite dans IndexedDB
   **immédiatement**, avant tout appel réseau — l'écran de caisse ne doit
   jamais attendre une réponse serveur pour confirmer l'encaissement à
   l'utilisateur.
2. Le ticket imprimé indique son statut : « Synchronisé » ou « En attente de
   synchronisation » (jamais caché — le commerçant doit savoir qu'une vente
   n'est pas encore confirmée côté serveur).
3. Un indicateur permanent dans l'en-tête Gestion affiche le nombre
   d'opérations en attente (`0` = tout synchronisé).
4. Un module de synchronisation tente d'envoyer les opérations en attente :
   au retour de l'évènement `online`, et en secours par un intervalle
   (ex. 30 s) tant qu'il reste des opérations en attente — jamais seulement
   sur l'évènement `online`, qui ne se déclenche pas toujours de façon
   fiable sur mobile.
5. Les opérations se synchronisent **dans leur ordre de création** (FIFO
   par boutique) — important pour le stock : vendre l'article A puis
   l'article B dans cet ordre doit rester vrai côté serveur même si la
   synchronisation groupe plusieurs opérations.

### Point d'entrée serveur dédié

`POST /shops/:shopId/pos/sales/sync` (nouveau, à côté de
`POST /shops/:shopId/pos/sales` qui reste le chemin direct en ligne) :

- Body : `CreateSaleDto` + `clientOperationId` obligatoire.
- Si une vente avec ce `clientOperationId` existe déjà pour cette boutique →
  la renvoie telle quelle (200), ne touche pas au stock une seconde fois.
- Sinon → exécute `PosService.createSale`, avec la politique de stock
  négatif décrite ci-dessous, puis enregistre `clientOperationId` sur la
  vente créée.

### Variante d'idempotence pour une opération multi-lignes

`POS_SALE` stocke directement `clientOperationId` en colonne unique sur
`PosSale`, parce qu'une vente crée une seule ligne. La saisie rapide Mon
Comptable est différente : une seule soumission peut créer 1 à 4 lignes
`ComptableEntry` d'un coup (vente CDF, vente USD, dépense CDF, dépense USD).
Une colonne unique sur `ComptableEntry` ne suffirait pas à garantir
l'exactly-once sur l'ensemble des lignes créées par une soumission.

Solution retenue : une table de marqueurs séparée, `ComptableSyncMarker`
(`clientOperationId String @unique`), écrite une fois que toutes les lignes
de la soumission sont créées avec succès. `syncQuickEntry` vérifie d'abord
ce marqueur ; s'il existe déjà, la soumission est considérée comme déjà
synchronisée et n'est pas rejouée. C'est le patron à réutiliser pour toute
future opération hors-ligne qui touche plusieurs lignes en une fois — une
table de marqueur plutôt qu'une colonne unique sur la table de destination.

### Politique de stock négatif en synchronisation différée — validée par le propriétaire

En vente au comptoir en direct, un stock insuffisant bloque la vente
(`BadRequestException` actuelle de `PosService.createSale`) — logique : la
caissière peut regarder l'étagère. En synchronisation différée, ce n'est
plus vrai : l'argent a déjà été remis au client, physiquement, pendant la
coupure. Refuser la vente a posteriori ne défait pas la transaction réelle,
et créerait un chiffre d'affaires fantôme (de l'argent encaissé pour une
vente qui « n'existe pas » dans le système).

Politique validée par le propriétaire (11 octobre 2026) : en synchronisation, le
stock peut descendre sous zéro plutôt que de rejeter la vente, et la ligne
concernée est marquée `stockDiscrepancy: true`. Le tableau de bord du jour
et un nouvel indicateur « Écarts de stock à vérifier » signalent ces lignes
pour une vérification manuelle (comptage physique), jamais pour un rejet
automatique.

### Conflit de double-vente du même article

Scénario concret : deux caissiers de la même boutique vendent tous les deux
le dernier exemplaire d'un article pendant la même coupure réseau, chacun
sur son téléphone. Les deux opérations se synchronisent l'une après l'autre.
Avec la politique ci-dessus, les deux ventes sont acceptées, le stock
devient négatif, et l'écart est signalé — c'est la boutique qui décide
ensuite (rembourser un client, commander en urgence, etc.), pas le système.
C'est un choix délibéré : un système qui inventerait une règle d'arbitrage
automatique (« la première vente synchronisée gagne ») déciderait d'une
question commerciale (quel client privilégier) à la place du commerçant.

## Phase 2 — app shell installable (PWA)

Une fois la phase 1 posée, rendre `apps/web` installable comme application
(manifest + service worker Next.js, ex. `next-pwa` ou un service worker
écrit à la main) pour que l'écran de caisse s'ouvre même si l'appareil n'a
eu aucun réseau depuis son démarrage. Le service worker met en cache :

- l'app shell (JS/CSS de l'écran caisse et de ses dépendances directes) ;
- le dernier catalogue connu de la boutique active (pour que la grille
  d'articles reste utilisable hors-ligne — sans ça, la phase 1 ne sert à
  rien si l'écran ne peut même pas afficher les articles à vendre).

Cette phase est explicitement postérieure à la phase 1 dans ce plan : la
file d'opérations protège l'argent et le stock, ce qui est le risque le
plus grave ; l'app shell installable améliore l'expérience mais ne protège
rien de nouveau par elle-même.

## Ce que ce document ne couvre pas encore

- Synchronisation hors-ligne pour les documents commerciaux (ticket PDF) —
  le PDF peut être généré localement une fois l'app shell en cache (phase 2),
  pas avant.
- Hors-ligne côté Marketplace (acheteur) — explicitement hors scope : un
  acheteur qui commande en ligne a, par définition, une connexion au moment
  de la commande.
