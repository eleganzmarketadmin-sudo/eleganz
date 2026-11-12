import type { Prisma } from "@eleganz/database";

/**
 * Contenu de départ du Centre d'aide interne (10 nov. 2026, demande du
 * propriétaire : remplir le menu pour que les agents ELEGANZ aient tout de
 * suite de quoi chercher). Inséré automatiquement au démarrage de l'API —
 * voir GuidesService.onModuleInit — via `createMany({ skipDuplicates: true
 * })`, qui s'appuie sur l'unicité de `slug` : ce fichier ne crée chaque
 * fiche qu'une seule fois, jamais en double à chaque redémarrage, et un
 * agent qui modifie ensuite une fiche depuis l'écran ne la voit jamais
 * écrasée par un redéploiement (le slug existe déjà, la ligne est ignorée).
 *
 * Chaque fiche sépare volontairement contenuAgent (explication interne,
 * jamais exposée publiquement) et contenuClient (étapes à suivre/transmettre
 * — seule partie qu'un lien public peut un jour révéler). contenuClient est
 * omis quand le sujet ne concerne que l'agent lui-même (ex. écrans réservés
 * à l'administration ELEGANZ), jamais un client.
 *
 * `visibleFaq: true` (11 nov. 2026 — FAQ publique sur /aide) : posé ici sur
 * toutes les fiches qui ont un contenuClient, pour que la FAQ publique ne
 * démarre jamais vide — ce sont bien les « questions préconçues » demandées,
 * pas de nouveau contenu. GuidesService.onModuleInit applique ce drapeau en
 * rattrapage une seule fois sur les fiches déjà présentes en base (celles
 * créées par un déploiement précédent de ce fichier, avant l'existence du
 * champ) via un correctif ponctuel — voir le commentaire associé là-bas pour
 * la garantie qu'un agent qui désactive ensuite une fiche depuis l'écran ne
 * la voit jamais réactivée au redéploiement suivant.
 */
export const SEED_ARTICLES: Prisma.GuideArticleCreateManyInput[] = [
  // ───────────────────────── Documentation ─────────────────────────
  {
    slug: "seed-documentation-pdf",
    titre: "Documentation PDF de la plateforme",
    categorie: "Documentation",
    motsCles: ["documentation", "pdf", "cahier des charges", "tarifs", "spécifications", "bouquets"],
    contenuAgent:
      "Deux documents de référence sont hébergés directement sur le site (fichiers statiques Next.js, aucune " +
      "authentification requise pour les ouvrir — à transmettre tel quel) :\n\n" +
      "• Cahier des charges complet de la plateforme : https://www.eleganzmarket.com/documentation/cahier-des-charges.pdf\n" +
      "  Le document de spécifications d'origine (converti en PDF depuis le Word original) — fonctionnement " +
      "d'ensemble, rôles, modules, décisions prises à chaque étape du projet.\n\n" +
      "• Tarifs et conditions (capture des écrans Centre de pilotage → Tarifs) : https://www.eleganzmarket.com/documentation/tarifs-ecrans.pdf\n" +
      "  Référence visuelle des bouquets ELEGANZ Gestion/Marketplace, des tarifs livreurs, de l'abonnement Mon " +
      "Comptable et du taux de change système (CDF/USD) — pratique pour répondre vite à une question de " +
      "tarification sans rouvrir l'écran Tarifs soi-même.\n\n" +
      "D'autres documents internes existent dans le dépôt de code (architecture technique, conformité facture " +
      "normalisée, plan commercial...) mais restent volontairement hors du Centre d'aide : destinés aux " +
      "développeurs, pas aux agents en contact avec la clientèle. Si un document PDF supplémentaire doit être " +
      "ajouté ici, il suffit de le transmettre pour qu'il soit déposé au même endroit et lié depuis cette fiche.",
  },

  // ───────────────────────── Catalogue ─────────────────────────
  {
    slug: "seed-catalogue-ajouter-produit",
    titre: "Ajouter et gérer un produit au catalogue",
    categorie: "Catalogue",
    motsCles: ["produit", "catalogue", "variante", "photo", "stock", "gestion"],
    contenuAgent:
      "Depuis Gestion → Catalogue, une boutique crée un produit avec un nom, une catégorie et au moins une variante " +
      "(taille/couleur), chacune avec son propre prix d'achat, prix de vente et stock. Les photos sont envoyées " +
      "directement vers le stockage Cloudflare R2 via une URL signée (le fichier ne transite jamais par notre " +
      "serveur) — le client glisse ou sélectionne l'image, elle apparaît dès que l'envoi est terminé. Un produit " +
      "n'est visible sur le marketplace public que s'il est publié (bascule « publié/brouillon ») ET que la boutique " +
      "elle-même est active. Si un client dit que son produit n'apparaît pas côté acheteurs, vérifiez dans cet ordre : " +
      "le produit est-il publié ? a-t-il au moins une variante avec du stock ? la boutique est-elle active (pas " +
      "suspendue, abonnement à jour) ?",
    contenuClient:
      "1. Dans Gestion, ouvrez Catalogue → « Ajouter un produit ».\n" +
      "2. Donnez un nom clair et choisissez une catégorie.\n" +
      "3. Ajoutez au moins une variante (par exemple une taille ou une couleur) avec son prix et sa quantité en " +
      "stock.\n" +
      "4. Ajoutez une ou plusieurs photos en cliquant sur la zone d'image — elles s'envoient automatiquement.\n" +
      "5. Activez « Publié » pour que le produit apparaisse immédiatement sur votre boutique en ligne.",
    visibleFaq: true,
  },
  {
    slug: "seed-catalogue-prix-gros",
    titre: "Configurer des prix de gros par palier de quantité",
    categorie: "Catalogue",
    motsCles: ["prix de gros", "palier", "quantité", "gros", "wholesale", "remise"],
    contenuAgent:
      "Fonctionnalité ajoutée le 3 nov. 2026 : chaque variante peut avoir des paliers de prix dégressifs (« à " +
      "partir de 10 pièces, X FC l'unité »). C'est une option facultative, gérée produit par produit depuis " +
      "Catalogue → la ligne de la variante → « Prix de gros ». Un palier doit toujours être strictement moins cher " +
      "que le prix de vente normal — l'API refuse un palier plus cher ou égal. Le prix appliqué à la commande est " +
      "TOUJOURS recalculé côté serveur au moment de la commande, jamais fait confiance au navigateur du client : " +
      "si un acheteur commande 12 pièces et qu'un palier existe à partir de 10, le prix du palier s'applique " +
      "automatiquement, sans action de la boutique. Si un client boutique dit que « le prix de gros ne s'applique " +
      "pas », vérifiez que la quantité commandée atteint bien le seuil minimal du palier et que le palier a été " +
      "enregistré sur la bonne variante (pas sur le produit en général — les paliers sont par variante).",
    contenuClient:
      "1. Dans Catalogue, ouvrez la fiche du produit concerné.\n" +
      "2. Sur la variante voulue, cliquez sur « Prix de gros » puis « Ajouter un palier ».\n" +
      "3. Indiquez la quantité minimale (ex. 10 pièces) et le prix unitaire à partir de cette quantité — il doit " +
      "être inférieur au prix de vente normal.\n" +
      "4. C'est automatique ensuite : dès qu'un acheteur commande au moins cette quantité, le prix réduit " +
      "s'applique tout seul, sans rien à faire de plus.",
    visibleFaq: true,
  },
  {
    slug: "seed-catalogue-nouvel-arrivage",
    titre: "Marquer un produit comme nouvel arrivage",
    categorie: "Catalogue",
    motsCles: ["nouveau", "nouvel arrivage", "badge", "étiquette", "new"],
    contenuAgent:
      "Un simple interrupteur manuel (`Product.isNewArrival`, activé par défaut à la création) affiche un badge " +
      "« NOUVEAU » bleu sur la vignette produit, sur le marketplace et dans la boutique. Ce n'est PAS calculé " +
      "automatiquement selon la date d'ajout — la boutique garde la main pour l'activer ou le désactiver à tout " +
      "moment depuis Catalogue, par exemple pour remettre en avant un produit relancé. Pas de limite de durée : " +
      "le badge reste tant que personne ne le désactive.",
    contenuClient:
      "Dans Catalogue, sur la ligne du produit, cliquez sur le bouton 🆕 pour activer ou désactiver le badge " +
      "« Nouveau ». Il apparaît immédiatement sur votre boutique en ligne et sur le marketplace. Vous pouvez le " +
      "laisser actif aussi longtemps que vous voulez, ou le désactiver dès que le produit n'est plus une nouveauté.",
    visibleFaq: true,
  },
  {
    slug: "seed-catalogue-ajuster-stock",
    titre: "Ajuster le stock d'une variante",
    categorie: "Catalogue",
    motsCles: ["stock", "inventaire", "ajustement", "écart", "quantité"],
    contenuAgent:
      "Le stock se corrige directement sur la fiche produit (Catalogue), variante par variante — utile après un " +
      "inventaire physique, une casse, ou une erreur de saisie. Chaque ajustement est historisé et remonte dans le " +
      "Tableau de bord (section « Écarts de stock ») pour que la boutique garde une trace de pourquoi le chiffre a " +
      "changé sans passer par une vente. Un stock à 0 ne bloque pas la fiche produit mais la variante apparaît " +
      "« Épuisé » côté acheteur et ne peut plus être ajoutée au panier.",
    contenuClient:
      "Dans Catalogue, ouvrez le produit, trouvez la variante concernée et modifiez directement la quantité en " +
      "stock. Le changement est immédiat et se reflète tout de suite sur votre boutique en ligne.",
    visibleFaq: true,
  },

  // ───────────────────────── Caisse (POS) ─────────────────────────
  {
    slug: "seed-caisse-enregistrer-vente",
    titre: "Enregistrer une vente en caisse (point de vente physique)",
    categorie: "Caisse",
    motsCles: ["caisse", "pos", "vente", "ticket", "encaissement"],
    contenuAgent:
      "La Caisse sert aux ventes en magasin physique, séparées des commandes en ligne (PosSale, pas Order). Le " +
      "caissier recherche un article déjà au catalogue (même stock que Catalogue — une vente en caisse décrémente " +
      "le même stock qu'une vente en ligne), ajoute au ticket, encaisse, puis peut imprimer le ticket. Le montant " +
      "encaissé remonte dans le Tableau de bord du jour (chiffre d'affaires, marge) et dans Finance.",
    contenuClient:
      "1. Ouvrez Caisse et recherchez l'article vendu.\n" +
      "2. Ajoutez-le au ticket (répétez pour chaque article).\n" +
      "3. Cliquez sur « Encaisser la vente ».\n" +
      "4. Imprimez le ticket si le client en a besoin.\n" +
      "Le stock et votre chiffre d'affaires du jour se mettent à jour automatiquement.",
    visibleFaq: true,
  },
  {
    slug: "seed-caisse-mode-hors-ligne",
    titre: "Utiliser la caisse sans connexion internet",
    categorie: "Caisse",
    motsCles: ["hors ligne", "offline", "connexion", "synchronisation", "caisse"],
    contenuAgent:
      "La Caisse fonctionne même sans connexion : les ventes sont mises en file d'attente localement (file hors " +
      "ligne applicative, voir offline-queue.ts/offline-sync.tsx) puis synchronisées automatiquement dès que la " +
      "connexion revient — rien n'est perdu. Un service worker garde aussi l'écran caisse déjà ouvert disponible " +
      "hors ligne (pas besoin de recharger la page). Si un client dit qu'une vente « a disparu » après une coupure " +
      "réseau, elle est presque toujours encore dans la file en attente de synchronisation sur CET appareil précis " +
      "— elle n'est pas perdue, mais elle ne remonte dans Finance/Tableau de bord qu'une fois synchronisée.",
    contenuClient:
      "Vous pouvez continuer à vendre même sans internet : la caisse enregistre la vente localement et l'envoie " +
      "automatiquement dès que la connexion revient. Ne fermez pas l'onglet et ne videz pas le cache du navigateur " +
      "tant que vous n'avez pas retrouvé une connexion — c'est ce qui permet l'envoi différé.",
    visibleFaq: true,
  },

  // ───────────────────────── Commandes ─────────────────────────
  {
    slug: "seed-commandes-cycle-de-vie",
    titre: "Suivre le cycle de vie d'une commande",
    categorie: "Commandes",
    motsCles: ["commande", "statut", "suivi", "cycle de vie"],
    contenuAgent:
      "Une commande marketplace passe par des statuts successifs (reçue, confirmée, en préparation, en livraison, " +
      "livrée — plus DISPUTED en cas de litige ouvert). Chaque changement de statut est déclenché depuis Gestion → " +
      "Commandes par la boutique ou le livreur affecté, jamais directement par l'acheteur. L'export Excel (bouton " +
      "« Exporter Excel ») sert surtout à la comptabilité ou à un rapprochement en fin de journée/semaine. Si un " +
      "client dit qu'une commande « reste bloquée » à un statut, vérifiez d'abord si elle n'est pas en litige " +
      "(DISPUTED) — dans ce cas, c'est l'issue du litige qui débloquera le statut, pas une action normale sur la " +
      "commande.",
    contenuClient:
      "Dans Gestion → Commandes, vous voyez toutes vos commandes et leur statut actuel. Faites avancer une " +
      "commande en changeant son statut au fur et à mesure (confirmée → en préparation → en livraison → livrée). " +
      "L'acheteur voit cette progression de son côté.",
    visibleFaq: true,
  },
  {
    slug: "seed-commandes-affecter-livreur",
    titre: "Affecter ou changer le livreur d'une commande",
    categorie: "Commandes",
    motsCles: ["livreur", "livraison", "affecter", "code de livraison"],
    contenuAgent:
      "Depuis Commandes, la boutique choisit un livreur parmi ceux rattachés à la boutique (voir fiche " +
      "« Ajouter un livreur ») et peut en changer à tout moment avant la livraison effective. Un code de livraison " +
      "peut être demandé/généré pour confirmer la remise au bon destinataire. S'il n'y a aucun livreur disponible " +
      "dans la liste, orientez le client vers l'écran Livreurs pour en ajouter un avant de pouvoir affecter une " +
      "commande.",
    contenuClient:
      "Dans Commandes, ouvrez la commande à livrer, cliquez sur « Changer le livreur » et choisissez dans la " +
      "liste de vos livreurs. Vous pouvez changer de livreur à tout moment tant que la commande n'est pas encore " +
      "livrée.",
    visibleFaq: true,
  },
  {
    slug: "seed-commandes-litige",
    titre: "Un client conteste sa commande (ouvrir un litige)",
    categorie: "Commandes",
    motsCles: ["litige", "contestation", "réclamation", "remboursement", "dispute"],
    contenuAgent:
      "Un litige peut être ouvert soit par l'acheteur, soit par la boutique, sur une commande précise — elle passe " +
      "alors au statut DISPUTED et reste bloquée tant que le litige n'est pas tranché. Une fois ouvert, c'est " +
      "l'administration ELEGANZ (écran admin Litiges, voir la fiche dédiée aux agents) qui rend la décision finale " +
      "(responsabilité + issue), pas la boutique elle-même. Expliquez toujours au client que la commande restera " +
      "bloquée pendant l'instruction — ce n'est pas un bug.",
    contenuClient:
      "Si un client (acheteur ou boutique) veut contester une commande, un litige peut être ouvert directement " +
      "depuis la commande concernée. Une fois ouvert, la commande est transmise à l'équipe ELEGANZ pour " +
      "instruction — expliquez-lui que ça peut prendre un peu de temps et que la commande restera en attente " +
      "jusqu'à la décision finale.",
    visibleFaq: true,
  },

  // ───────────────────────── Finance & Facturation ─────────────────────────
  {
    slug: "seed-factures-retrouver",
    titre: "Retrouver et réimprimer une facture",
    categorie: "Facturation",
    motsCles: ["facture", "réimprimer", "recherche", "export"],
    contenuAgent:
      "L'écran Factures liste toutes les factures (vente en ligne ou en caisse), cherchables par numéro, date ou " +
      "montant, avec export Excel et réimpression directe. Une facture n'est jamais supprimable depuis cet écran — " +
      "seulement consultable et réimprimable, pour garder une piste comptable fiable.",
    contenuClient:
      "Dans Gestion → Factures, utilisez la recherche pour retrouver la facture par numéro, date ou montant, puis " +
      "cliquez sur « Réimprimer ». Pour un lot de factures (comptabilité, fin de mois), utilisez « Exporter Excel ».",
    visibleFaq: true,
  },
  {
    slug: "seed-releves-generer",
    titre: "Générer un relevé certifié",
    categorie: "Facturation",
    motsCles: ["relevé", "certifié", "pdf", "code de vérification", "comptable"],
    contenuAgent:
      "Un relevé regroupe les ventes sur une période choisie (fréquence configurable) et génère un PDF certifié " +
      "avec un code de vérification unique — utile pour un comptable externe ou une démarche administrative. La " +
      "génération peut prendre quelques instants (calcul sur toute la période demandée) ; c'est normal, pas un " +
      "blocage.",
    contenuClient:
      "Dans Gestion → Relevés, choisissez la période et le regroupement souhaités, puis cliquez sur « Exporter " +
      "PDF ». Le document généré porte un code de vérification que vous pouvez transmettre à votre comptable.",
    visibleFaq: true,
  },
  {
    slug: "seed-finance-tableau",
    titre: "Comprendre le tableau Finance (marge, charges, commission)",
    categorie: "Facturation",
    motsCles: ["finance", "marge", "charges", "commission", "amortissement", "crédit client"],
    contenuAgent:
      "L'écran Finance réunit chiffre d'affaires, achats, charges, amortissements, commission marketplace prélevée " +
      "par ELEGANZ, crédit client accordé et dettes fournisseurs — une vue comptable complète de la boutique, pas " +
      "seulement les ventes du jour (ça, c'est le Tableau de bord). Si un chiffre semble manquant ou incomplet, " +
      "l'écran l'indique lui-même (« marge incomplète ») plutôt que d'afficher un faux zéro — c'est volontaire, " +
      "pas un bug d'affichage.",
    contenuClient:
      "Dans Gestion → Finance, vous avez une vue d'ensemble de la santé financière de votre boutique sur la " +
      "période choisie : ventes, achats, charges et la commission prélevée par ELEGANZ sur les ventes marketplace.",
    visibleFaq: true,
  },

  // ───────────────────────── Équipe & Livreurs ─────────────────────────
  {
    slug: "seed-equipe-inviter",
    titre: "Inviter un membre de l'équipe boutique",
    categorie: "Équipe",
    motsCles: ["équipe", "inviter", "rôle", "gérant", "caissier", "comptable", "magasinier"],
    contenuAgent:
      "Depuis Gestion → Équipe, le propriétaire (OWNER) invite un collaborateur avec un rôle précis (MANAGER, " +
      "CASHIER, STOCK_KEEPER, SALES_LEAD, ACCOUNTANT) qui détermine les écrans visibles par défaut — chaque rôle " +
      "peut aussi être ajusté écran par écran si besoin (colonne « Écrans » de la liste équipe). Un comptable " +
      "externe peut aussi être invité avec un accès volontairement limité. Désactiver un collaborateur (plutôt que " +
      "le supprimer) coupe son accès immédiatement sans perdre l'historique de ses actions passées.",
    contenuClient:
      "Dans Gestion → Équipe, cliquez sur « Ajouter un collaborateur », indiquez son nom et son contact, et " +
      "choisissez son rôle. Vous pouvez affiner les écrans auxquels il a accès après l'avoir ajouté.",
    visibleFaq: true,
  },
  {
    slug: "seed-livreurs-ajouter",
    titre: "Ajouter un livreur à la boutique",
    categorie: "Équipe",
    motsCles: ["livreur", "ajouter", "véhicule", "actif"],
    contenuAgent:
      "Un livreur est rattaché à une boutique précise depuis Gestion → Livreurs (nom, téléphone, véhicule). Il " +
      "apparaît ensuite dans la liste disponible lors de l'affectation d'une commande (voir fiche « Affecter un " +
      "livreur »). Désactiver un livreur l'empêche d'être affecté à de nouvelles commandes, sans toucher à celles " +
      "déjà en cours.",
    contenuClient:
      "Dans Gestion → Livreurs, cliquez sur « Ajouter un livreur » et renseignez son nom, son téléphone et son " +
      "véhicule. Il devient immédiatement disponible pour être affecté à une commande.",
    visibleFaq: true,
  },

  // ───────────────────────── Abonnement ─────────────────────────
  {
    slug: "seed-parametres-bouquet",
    titre: "Changer de bouquet d'abonnement",
    categorie: "Paramètres",
    motsCles: ["abonnement", "bouquet", "plan", "tarif", "produits max"],
    contenuAgent:
      "Chaque boutique est sur un bouquet d'abonnement qui plafonne entre autres le nombre de produits publiables " +
      "et certaines fonctionnalités. Le changement se fait depuis Gestion → Paramètres → Abonnement, avec un " +
      "cycle de facturation et un renouvellement automatique affichés clairement avant confirmation. Si un client " +
      "ne peut plus ajouter de produit, vérifiez en premier s'il n'a pas atteint le plafond de son bouquet actuel.",
    contenuClient:
      "Dans Gestion → Paramètres, section Abonnement, vous voyez votre bouquet actuel et son plafond de produits. " +
      "Cliquez sur « Choisir un bouquet » pour voir les options disponibles et changer si besoin.",
    visibleFaq: true,
  },

  // ───────────────────────── Messagerie ─────────────────────────
  {
    slug: "seed-messagerie-interne",
    titre: "Utiliser la messagerie interne",
    categorie: "Messagerie",
    motsCles: ["messagerie", "message", "conversation", "notification"],
    contenuAgent:
      "La messagerie interne permet un échange en fil de discussion, éventuellement rattaché à une boutique " +
      "précise (support ELEGANZ ↔ boutique). Une pastille de notification indique les messages non lus, calculée " +
      "par la dernière lecture de chaque participant — pas de statut « lu/non lu » par message individuel.",
    contenuClient:
      "La messagerie se trouve dans le menu principal (icône de notifications/messages). Les nouveaux messages " +
      "apparaissent avec une pastille ; ouvrez la conversation pour les marquer comme lus.",
    visibleFaq: true,
  },

  // ───────────────────────── Marketplace (acheteur) ─────────────────────────
  {
    slug: "seed-compte-acheteur-creer",
    titre: "Créer un compte acheteur et se connecter",
    categorie: "Marketplace",
    motsCles: ["compte", "inscription", "connexion", "acheteur", "mot de passe"],
    contenuAgent:
      "Un compte acheteur se crée avec un email OU un téléphone (pas besoin des deux) plus un mot de passe de 8 " +
      "caractères minimum. Pas de validation préalable requise pour un acheteur (contrairement à un livreur, qui " +
      "lui reste non vérifié jusqu'à validation admin). « Mot de passe oublié » déclenche une réinitialisation par " +
      "email/téléphone.",
    contenuClient:
      "Sur la page d'accueil du marketplace, cliquez sur « Se connecter » puis « Créer mon compte ». Indiquez " +
      "votre email ou votre téléphone, choisissez un mot de passe (8 caractères minimum), et c'est prêt — vous " +
      "pouvez commander tout de suite.",
    visibleFaq: true,
  },
  {
    slug: "seed-marketplace-passer-commande",
    titre: "Passer une commande sur le marketplace",
    categorie: "Marketplace",
    motsCles: ["commande", "panier", "quantité", "acheteur", "passer commande"],
    contenuAgent:
      "Sur la fiche produit, l'acheteur choisit une variante, une quantité, et voit le prix unitaire se mettre à " +
      "jour automatiquement si des paliers de prix de gros existent pour cette quantité — avant même d'ajouter au " +
      "panier. Le panier recalcule aussi le prix à chaque changement de quantité, jamais figé au moment de " +
      "l'ajout. Le prix final payé est toujours celui recalculé côté serveur à la validation de commande, jamais " +
      "ce qu'affichait le navigateur.",
    contenuClient:
      "Sur la fiche du produit, choisissez la variante et la quantité souhaitées, puis cliquez sur « Ajouter au " +
      "panier ». Si la boutique propose un tarif dégressif à partir d'une certaine quantité, le prix unitaire " +
      "baisse automatiquement dès que vous atteignez ce seuil. Une fois votre panier prêt, validez la commande " +
      "depuis l'icône panier.",
    visibleFaq: true,
  },
  {
    slug: "seed-marketplace-avis",
    titre: "Laisser un avis sur une boutique",
    categorie: "Marketplace",
    motsCles: ["avis", "note", "étoiles", "review", "boutique"],
    contenuAgent:
      "Un acheteur peut laisser un avis noté (étoiles) sur la page publique d'une boutique. Les avis sont publics " +
      "et visibles par tous les visiteurs de la boutique, pas seulement les futurs acheteurs connectés.",
    contenuClient:
      "Sur la page de la boutique, faites défiler jusqu'à la section « Avis », choisissez une note en étoiles et " +
      "ajoutez un commentaire si vous le souhaitez, puis validez.",
    visibleFaq: true,
  },

  // ───────────────────────── Experts ─────────────────────────
  {
    slug: "seed-experts-devenir",
    titre: "Devenir expert et être validé",
    categorie: "Experts",
    motsCles: ["expert", "candidature", "validation", "annuaire", "cv", "diplôme"],
    contenuAgent:
      "Un utilisateur candidate comme expert avec un résumé (headline), une bio, ses domaines, éventuellement des " +
      "documents (CV, diplômes, certifications) et des références. La candidature n'apparaît dans l'annuaire " +
      "public qu'après validation par un administrateur ELEGANZ (écran admin Experts) — jamais automatique. Un " +
      "rejet n'efface jamais le profil : l'expert peut corriger et resoumettre à tout moment.",
    contenuClient:
      "Depuis le marketplace, rendez-vous sur Experts → « Devenir expert », remplissez votre profil (présentation, " +
      "domaines, documents si vous en avez) et soumettez. Un administrateur ELEGANZ examine votre candidature ; " +
      "vous pourrez la corriger et la resoumettre si elle n'est pas validée du premier coup.",
    visibleFaq: true,
  },

  // ───────────────────────── Mon assistant ─────────────────────────
  // Ajouté le 12 nov. 2026 (retour client) — jusqu'ici, aucune fiche ne
  // couvrait ELEGANZ Secourable ("Mon assistant"), seul module sans aucune
  // entrée dans le Centre d'aide / FAQ publique.
  {
    slug: "seed-comptable-presentation",
    titre: "Qu'est-ce que Mon assistant (ELEGANZ Secourable) ?",
    categorie: "Mon assistant",
    motsCles: ["mon assistant", "comptable", "secourable", "activité", "carnet", "indépendant"],
    contenuAgent:
      "Mon assistant (nom interne « ELEGANZ Secourable ») est un module de suivi financier simple, détaché du " +
      "catalogue et des boutiques : n'importe quel compte ELEGANZ peut l'utiliser pour suivre une ou plusieurs " +
      "« activités » (un commerce, une location, un petit business informel) sans avoir besoin d'ouvrir une " +
      "boutique Gestion. Il a sa propre reconnexion dédiée (/comptable/connexion, depuis le 11 nov. 2026) : un " +
      "compte déjà connecté côté Gestion ou Marketplace doit tout de même se reconnecter pour accéder à Mon " +
      "assistant. Chaque activité suit des entrées de caisse rapides, des dettes/créances/emprunts, des loyers " +
      "attendus (si l'activité inclut de la location) et des versements de travailleurs.",
    contenuClient:
      "Mon assistant vous aide à garder une trace simple de vos entrées et sorties d'argent, de vos dettes et " +
      "créances, et de vos échéances à venir — pour une ou plusieurs activités, sans avoir besoin d'une boutique " +
      "en ligne. Connectez-vous depuis /comptable/connexion avec votre compte ELEGANZ habituel.",
    visibleFaq: true,
  },
  {
    slug: "seed-comptable-saisie-rapide",
    titre: "Enregistrer une entrée dans le carnet (Journal rapide)",
    categorie: "Mon assistant",
    motsCles: ["mon assistant", "carnet", "saisie", "entrée", "sortie", "hors ligne"],
    contenuAgent:
      "Le Journal rapide (Carnet) de chaque activité permet de saisir en quelques secondes une entrée ou une " +
      "sortie d'argent avec un montant, une catégorie et une note facultative. La saisie fonctionne même hors " +
      "connexion (OfflineSyncProvider) : les entrées saisies sans réseau sont mises en file d'attente et se " +
      "synchronisent automatiquement au retour de la connexion (ou via le bouton « X en attente » visible dans " +
      "l'en-tête). Si un client dit qu'une saisie « a disparu », vérifiez d'abord si elle est toujours listée " +
      "comme en attente de synchronisation plutôt que perdue.",
    contenuClient:
      "1. Ouvrez votre activité, puis « Journal rapide ».\n" +
      "2. Indiquez le montant, choisissez entrée ou sortie, et une catégorie.\n" +
      "3. Ajoutez une note si besoin, puis validez.\n" +
      "4. Sans connexion, la saisie reste enregistrée sur votre appareil et s'envoie automatiquement dès que " +
      "vous retrouvez du réseau.",
    visibleFaq: true,
  },
  {
    slug: "seed-comptable-dettes-creances",
    titre: "Suivre une dette, une créance ou un emprunt",
    categorie: "Mon assistant",
    motsCles: ["mon assistant", "dette", "créance", "emprunt", "échéance", "rappel"],
    contenuAgent:
      "Une « dette » Mon assistant couvre trois cas (champ type : DETTE, CREANCE, EMPRUNT) selon qui doit à qui. " +
      "Chacune a une date d'échéance facultative ; si elle est renseignée, l'échéance apparaît automatiquement " +
      "dans les rappels de la page d'accueil (toujours visibles, même sans le bouquet Agenda) et dans la vue " +
      "Agenda complète (fonctionnalité de bouquet). Une dette/créance se marque « réglée » une fois le paiement " +
      "fait — elle reste consultable dans l'historique mais sort des rappels actifs.",
    contenuClient:
      "1. Depuis votre activité, ouvrez « Dettes & créances » puis « Ajouter ».\n" +
      "2. Choisissez le type (vous devez à quelqu'un, quelqu'un vous doit, ou un emprunt), indiquez le montant, " +
      "le nom de la contrepartie et une date d'échéance si vous la connaissez.\n" +
      "3. Dès l'échéance approche, un rappel apparaît automatiquement sur votre page d'accueil.\n" +
      "4. Une fois payée, marquez-la « réglée » — elle reste visible dans l'historique.",
    visibleFaq: true,
  },
  {
    slug: "seed-comptable-loyers-versements",
    titre: "Suivre des loyers attendus et des versements de travailleurs",
    categorie: "Mon assistant",
    motsCles: ["mon assistant", "loyer", "location", "versement", "travailleur", "salaire"],
    contenuAgent:
      "Pour une activité de location, chaque unité (ComptableRentalUnit) génère ses échéances de loyer attendues " +
      "(ComptableRentPayment) ; pour une activité avec des employés ou journaliers, chaque versement attendu se " +
      "suit via ComptableWorkerRemittance. Les deux alimentent les mêmes rappels (page d'accueil) et la même vue " +
      "Agenda que les dettes/créances — voir fiche « Suivre une dette, une créance ou un emprunt ».",
    contenuClient:
      "1. Pour un loyer : ouvrez « Unités locatives », ajoutez l'unité puis enregistrez chaque paiement de loyer " +
      "reçu — les échéances non encore payées apparaissent dans vos rappels.\n" +
      "2. Pour un versement à un travailleur : ouvrez « Versements », ajoutez le travailleur et la date attendue " +
      "du versement, puis marquez-le réglé une fois le paiement fait.",
    visibleFaq: true,
  },
  {
    slug: "seed-comptable-bouquets",
    titre: "Choisir un bouquet Mon assistant (Essentiel, Pro, Premium)",
    categorie: "Mon assistant",
    motsCles: ["mon assistant", "bouquet", "essentiel", "pro", "premium", "abonnement", "agenda", "dossier de financement"],
    contenuAgent:
      "Depuis le 14 oct. 2026, Mon assistant a trois bouquets payants (ComptablePlan, modifiables sans " +
      "redéploiement depuis /admin/tarifs) : Essentiel (offre historique, 1 activité, aucune fonctionnalité " +
      "premium), Pro (jusqu'à 5 activités, historique illimité, comparaison entre activités, vue Agenda " +
      "complète) et Premium (activités illimitées, toutes les fonctionnalités Pro + export du dossier de " +
      "financement bancaire). Le sélecteur de bouquet est sur /comptable/abonnement (ajouté le 12 nov. 2026 — " +
      "auparavant l'écran ne gérait que la fréquence de facturation mensuelle/annuelle, sans aucun moyen de " +
      "changer de bouquet). Les abonnés déjà actifs avant l'introduction des bouquets ont été rattachés une " +
      "fois pour toutes au bouquet Pro (jamais Essentiel, pour ne perdre aucun accès déjà utilisé). Un changement " +
      "de bouquet prend effet immédiatement, la facturation suit au prochain cycle.",
    contenuClient:
      "1. Ouvrez « Abonnement » dans Mon assistant.\n" +
      "2. Comparez les trois bouquets (Essentiel, Pro, Premium) et leurs fonctionnalités, puis cliquez sur celui " +
      "que vous voulez.\n" +
      "3. Le changement est immédiat ; votre facturation suit au prochain cycle.\n" +
      "4. Un lien de menu verrouillé (🔒) signifie une fonctionnalité non incluse dans votre bouquet actuel — " +
      "passez à un bouquet supérieur pour y accéder.",
    visibleFaq: true,
  },
  {
    slug: "seed-comptable-export-synthese-dossier",
    titre: "Exporter une synthèse ou un dossier de financement",
    categorie: "Mon assistant",
    motsCles: ["mon assistant", "export", "synthèse", "pdf", "excel", "dossier de financement", "banque"],
    contenuAgent:
      "La page Chiffres propose une synthèse périodique exportable en PDF ou Excel (tous bouquets). Le dossier " +
      "de financement bancaire (PDF avec bandeau d'avertissement intégré, jamais présenté comme un état financier " +
      "certifié) n'est lui disponible que pour le bouquet Premium — un appel direct à l'export sans ce bouquet " +
      "renvoie une erreur explicite nommant le bouquet actuel. Si un client Pro ou Essentiel demande ce dossier, " +
      "proposez un passage au bouquet Premium depuis /comptable/abonnement.",
    contenuClient:
      "1. Pour une synthèse : ouvrez « Chiffres », choisissez une période puis « Exporter » (PDF ou Excel).\n" +
      "2. Pour le dossier de financement bancaire (réservé au bouquet Premium) : ouvrez « Dossier de " +
      "financement » dans le menu. S'il est verrouillé, passez au bouquet Premium depuis « Abonnement ».",
    visibleFaq: true,
  },

  // ─────────────── Pour les agents ELEGANZ (Centre de pilotage) ───────────────
  {
    slug: "seed-admin-trancher-litige",
    titre: "Trancher un litige depuis le Centre de pilotage",
    categorie: "Administration ELEGANZ",
    motsCles: ["admin", "litige", "trancher", "décision", "responsabilité"],
    contenuAgent:
      "Dans le Centre de pilotage (écran Litiges, réservé aux rôles admin ayant ce menu), chaque litige ouvert " +
      "liste la commande concernée. Trancher demande une issue ET une note de résolution expliquant la " +
      "responsabilité retenue — soyez factuel et bref, cette note reste tracée. Une fois tranché, la commande " +
      "sort du statut DISPUTED et reprend son cycle normal selon l'issue retenue.",
  },
  {
    slug: "seed-admin-gerer-utilisateur",
    titre: "Gérer un compte utilisateur depuis l'administration",
    categorie: "Administration ELEGANZ",
    motsCles: ["admin", "utilisateur", "compte", "suspendre", "support"],
    contenuAgent:
      "L'écran Utilisateurs (Centre de pilotage) permet de retrouver un compte (acheteur, boutique, livreur) et " +
      "d'agir dessus (consultation, support, mesures en cas d'abus). Réservé par défaut à ADMIN_SUPER et " +
      "ADMIN_SUPPORT — si un autre rôle admin en a besoin ponctuellement, c'est un ADMIN_SUPER qui ajuste ses " +
      "écrans accordés depuis Équipe admin (voir fiche sur les rôles admin).",
  },
  {
    slug: "seed-admin-roles-menus",
    titre: "Comprendre les écrans accordés par rôle admin",
    categorie: "Administration ELEGANZ",
    motsCles: ["admin", "rôle", "menu", "accès", "équipe admin", "super admin"],
    contenuAgent:
      "Chaque compte ADMIN_* a une liste d'écrans accordés par défaut selon son rôle (Ventes, Finance, Opérations, " +
      "Logistique, Marketing, Support, Audit, Super admin voit tout). Un ADMIN_SUPER peut, depuis Équipe admin, " +
      "cocher manuellement des écrans différents pour un compte précis — ce choix explicite remplace alors la " +
      "liste par défaut du rôle. C'est la même restriction côté API que côté écran : un rôle qui ne voit pas un " +
      "menu ne peut pas non plus appeler ses routes directement. Si un collègue dit « je ne vois pas tel menu », " +
      "vérifiez d'abord son rôle, puis si un ADMIN_SUPER lui a déjà fait un choix explicite différent de son rôle.",
  },
];
