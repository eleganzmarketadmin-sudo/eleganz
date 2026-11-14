const {
  run, h0, h1, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  coverPage, writeDocx, PageBreak, Paragraph,
} = require("./helpers");

const children = [];

// ---- Couverture ----
children.push(...coverPage({
  kicker: "MODÈLE — À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE AVANT PUBLICATION",
  title: "POLITIQUES GÉNÉRALES ET RÈGLEMENT D'UTILISATION",
  subtitle1: "ELEGANZ — Conditions générales d'utilisation de la Plateforme",
  subtitle2: "Applicables à tout utilisateur de l'un des modules ELEGANZ",
}));

children.push(calloutBox("Note méthodologique — à lire avant toute utilisation", [
  "Ce document est un modèle prêt à être complété et relu par un conseil juridique avant publication, et non un texte finalisé opposable en l'état.",
  "Aucune donnée réelle concernant ELEGANZ (dénomination exacte, forme juridique, capital, siège, numéro RCCM/identification, coordonnées de contact) n'a été présumée ou inventée : chaque champ de ce type apparaît en rouge italique, entre crochets, avec la mention « à compléter ». Les coordonnées de contact effectives doivent être reprises des Paramètres plateforme déjà renseignés par l'administration ELEGANZ, et non réinventées ici.",
  "Ce règlement s'applique à l'ensemble des modules de la Plateforme (Marketplace, Gestion boutique, Livreur, Mon Assistant/comptabilité, Experts, Institutions partenaires, Centre de pilotage). Il complète, sans s'y substituer, le Contrat d'adhésion Vendeur, le Contrat d'accès Expert, et tout autre contrat spécifique applicable à un module donné.",
  "La clause de droit applicable et de règlement des différends (article 15) doit impérativement être validée avec un avocat inscrit en République démocratique du Congo avant toute publication.",
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Sommaire ----
children.push(h0("Sommaire"));
[
  "Préambule — Présentation d'ELEGANZ",
  "Article 1 — Définitions",
  "Article 2 — Acceptation du règlement",
  "Article 3 — Comptes utilisateurs",
  "Article 4 — Règles de conduite générales",
  "Article 5 — Rôle et responsabilités propres à chaque module",
  "Article 6 — Contenu et propriété intellectuelle",
  "Article 7 — Données personnelles",
  "Article 8 — Paiements et facturation",
  "Article 9 — Disponibilité et évolution du service",
  "Article 10 — Limitation de responsabilité générale",
  "Article 11 — Sanctions, suspension et suppression de compte",
  "Article 12 — Réclamations et médiation",
  "Article 13 — Modification du présent règlement",
  "Article 14 — Durée et résiliation",
  "Article 15 — Droit applicable et règlement des différends",
  "Article 16 — Contact",
].forEach((t) => children.push(bullet(t)));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Préambule ----
children.push(h0("Préambule — Présentation d'ELEGANZ"));
[
  ["Dénomination sociale", "dénomination sociale exacte"],
  ["Forme juridique", "forme juridique exacte — SARL, SA, etc."],
  ["Siège social", "adresse complète du siège social"],
  ["Numéro d'identification / RCCM", "numéro RCCM ou équivalent"],
].forEach(([label, ph]) => children.push(mixedP([run(label + " : "), phRun(ph)])));
children.push(note("ci-après « ELEGANZ » ou « la Plateforme »,"));
children.push(p("ELEGANZ exploite une plateforme numérique multi-modules destinée au commerce et aux services associés, comprenant notamment :"));
children.push(bullet([run("ELEGANZ Market : ", { bold: true }), run("une place de marché publique permettant à des Acheteurs de commander les produits des boutiques inscrites ;")]));
children.push(bullet([run("ELEGANZ Gestion : ", { bold: true }), run("un espace de gestion commerciale destiné aux boutiques (caisse, catalogue, commandes, facturation, équipe) ;")]));
children.push(bullet([run("ELEGANZ Livreur : ", { bold: true }), run("un espace destiné aux livreurs créés et affectés par les boutiques ;")]));
children.push(bullet([run("ELEGANZ Mon Assistant : ", { bold: true }), run("un module de comptabilité et de gestion financière destiné aux boutiques ;")]));
children.push(bullet([run("l'espace Experts : ", { bold: true }), run("un accès destiné aux experts externes invités par une boutique à consulter certaines de ses données ;")]));
children.push(bullet([run("l'espace Institutions : ", { bold: true }), run("un accès destiné aux institutions financières partenaires dans le cadre de dossiers de crédit ;")]));
children.push(bullet([run("le Centre de pilotage : ", { bold: true }), run("l'espace d'administration réservé à ELEGANZ.")]));
children.push(p("Le présent règlement a pour objet de définir les conditions générales d'utilisation de la Plateforme, applicables à toute personne créant ou utilisant un compte sur l'un quelconque de ses modules (ci-après « l'Utilisateur »)."));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Articles ----

children.push(h1("Définitions", 1));
[
  ["Plateforme", "l'ensemble des modules numériques exploités par ELEGANZ décrits au préambule."],
  ["Utilisateur", "toute personne physique ou morale disposant d'un compte sur l'un des modules de la Plateforme, quel que soit son rôle (Acheteur, Vendeur, Livreur, Expert, Institution partenaire, membre d'équipe)."],
  ["Compte", "l'accès nominatif ou associé à une boutique permettant à un Utilisateur de se connecter à un ou plusieurs modules de la Plateforme."],
  ["Contenu", "toute information, donnée, image, texte ou fichier publié ou transmis par un Utilisateur sur la Plateforme."],
].forEach(([t, d]) => children.push(mixedP([run(t + " : ", { bold: true }), run(d)])));

children.push(h1("Acceptation du règlement", 2));
children.push(p("La création d'un Compte sur l'un quelconque des modules de la Plateforme emporte acceptation pleine et entière du présent règlement, ainsi que, selon le rôle de l'Utilisateur, du Contrat d'adhésion Vendeur, du Contrat d'accès Expert, ou de tout autre contrat spécifique applicable à ce rôle."));
children.push(p("Si l'Utilisateur n'accepte pas le présent règlement, il ne doit pas créer de Compte ni utiliser la Plateforme."));

children.push(h1("Comptes utilisateurs", 3));
children.push(p("Chaque Utilisateur s'engage à :"));
children.push(bullet("fournir des informations exactes, complètes et à jour lors de la création de son Compte et tout au long de son utilisation de la Plateforme ;"));
children.push(bullet("conserver confidentiels ses identifiants de connexion et à ne pas les partager avec un tiers ;"));
children.push(bullet("informer ELEGANZ sans délai de toute utilisation non autorisée de son Compte dont il aurait connaissance ;"));
children.push(bullet("ne détenir qu'un seul Compte par rôle, sauf autorisation expresse d'ELEGANZ ou nécessité propre à l'organisation d'une boutique (ex. plusieurs membres d'équipe)."));
children.push(mixedP([
  run("L'utilisation de la Plateforme est réservée aux personnes majeures ou, pour les personnes morales, à leurs représentants habilités. "), phRun("âge minimum applicable, si différent de la majorité légale"),
]));

children.push(h1("Règles de conduite générales", 4));
children.push(p("Il est interdit à tout Utilisateur, sur quelque module que ce soit de la Plateforme :"));
children.push(bullet("de publier un Contenu illicite, frauduleux, trompeur, injurieux, discriminatoire ou portant atteinte aux droits d'un tiers ;"));
children.push(bullet("d'usurper l'identité d'une autre personne ou de se faire passer pour un représentant d'ELEGANZ ;"));
children.push(bullet("de contourner, altérer ou tenter de contourner les mesures de sécurité, de limitation d'accès ou de facturation de la Plateforme ;"));
children.push(bullet("d'extraire, copier ou réutiliser de façon automatisée des données de la Plateforme sans autorisation expresse d'ELEGANZ ;"));
children.push(bullet("de harceler, menacer ou porter atteinte à un autre Utilisateur."));

children.push(h1("Rôle et responsabilités propres à chaque module", 5));
children.push(p("Sans préjudice des dispositions générales du présent règlement :"));
children.push(bullet([run("l'Acheteur ", { bold: true }), run("est responsable de l'exactitude des informations qu'il fournit pour ses commandes, et de ses échanges avec les boutiques ;")]));
children.push(bullet([run("le Vendeur ", { bold: true }), run("est responsable de sa boutique, de ses produits, de ses livreurs et de ses documents de vente, dans les conditions précisées par le Contrat d'adhésion Vendeur ;")]));
children.push(bullet([run("le Livreur ", { bold: true }), run("est créé et habilité par une boutique, pour le compte de laquelle il agit ; sa relation avec cette boutique est régie par les termes convenus entre eux, hors du champ du présent règlement ;")]));
children.push(bullet([run("l'Expert ", { bold: true }), run("accède aux données d'une boutique sur invitation de celle-ci, dans les conditions précisées par le Contrat d'accès Expert ;")]));
children.push(bullet([run("l'Institution partenaire ", { bold: true }), run("accède aux dossiers de crédit dans les conditions d'un accord spécifique conclu avec ELEGANZ.")]));

children.push(h1("Contenu et propriété intellectuelle", 6));
children.push(p("Chaque Utilisateur demeure titulaire des droits sur le Contenu qu'il publie, et garantit disposer de tous les droits nécessaires à sa publication. Il concède à ELEGANZ une licence non exclusive d'affichage et de reproduction technique de ce Contenu, dans la seule mesure nécessaire au fonctionnement de la Plateforme."));
children.push(p("La marque ELEGANZ, les logos, l'interface, le code source et les autres éléments de la Plateforme demeurent la propriété exclusive d'ELEGANZ ou de ses concédants, et ne peuvent être reproduits ou réutilisés sans autorisation préalable."));

children.push(h1("Données personnelles", 7));
children.push(p("ELEGANZ collecte et traite les données personnelles des Utilisateurs dans la mesure nécessaire au fonctionnement de la Plateforme (création et gestion des Comptes, traitement des commandes, facturation, sécurité), selon les principes de minimisation des données, de limitation de la finalité, et de sécurisation des données."));
children.push(mixedP([
  run("Les modalités détaillées de ce traitement, ainsi que les droits de l'Utilisateur sur ses données personnelles, sont précisés dans "), phRun("renvoi à une politique de confidentialité dédiée, à rédiger séparément si nécessaire"),
  run("."),
]));

children.push(h1("Paiements et facturation", 8));
children.push(p("L'accès à certaines fonctionnalités de la Plateforme, notamment pour les boutiques, est soumis à la souscription d'un abonnement (« Bouquet ») dont le prix et les modalités sont précisés dans la grille tarifaire en vigueur."));
children.push(p("À la date du présent règlement, le règlement des commandes passées sur le Marketplace s'effectue directement entre l'Acheteur et la boutique au moment de la livraison ; ELEGANZ ne collecte ni ne détient les fonds relatifs à ces commandes."));

children.push(h1("Disponibilité et évolution du service", 9));
children.push(p("ELEGANZ s'efforce d'assurer un accès continu à la Plateforme, sans toutefois garantir une disponibilité ininterrompue. ELEGANZ peut interrompre temporairement l'accès à tout ou partie de la Plateforme pour des raisons de maintenance, de sécurité ou d'évolution technique, et s'efforce d'en informer les Utilisateurs lorsque cela est raisonnablement possible."));
children.push(p("ELEGANZ peut faire évoluer les fonctionnalités de la Plateforme, notamment pour se conformer à une évolution réglementaire ou pour améliorer le service rendu aux Utilisateurs."));

children.push(h1("Limitation de responsabilité générale", 10));
children.push(p("ELEGANZ agit en qualité de fournisseur de l'outil technique de la Plateforme. Sauf disposition contraire d'un contrat spécifique applicable à un module donné, ELEGANZ n'est pas partie aux transactions, échanges ou relations qui s'établissent entre Utilisateurs par l'intermédiaire de la Plateforme, et n'est pas responsable des actes de ces Utilisateurs."));
children.push(mixedP([
  run("La responsabilité d'ELEGANZ au titre du présent règlement, si elle est retenue, est limitée dans les conditions suivantes : "), phRun("plafond et modalités de limitation de responsabilité à définir avec un conseil juridique"),
  run("."),
]));

children.push(h1("Sanctions, suspension et suppression de compte", 11));
children.push(p("En cas de manquement au présent règlement ou à tout contrat spécifique applicable, ELEGANZ peut, selon la gravité du manquement et après notification à l'Utilisateur lorsque les circonstances le permettent, avertir l'Utilisateur, suspendre temporairement son Compte, ou le supprimer définitivement, sans préjudice du droit de demander réparation du préjudice éventuellement subi."));

children.push(h1("Réclamations et médiation", 12));
children.push(mixedP([
  run("Tout Utilisateur peut adresser une réclamation à ELEGANZ selon les modalités de contact précisées à l'article 16. ELEGANZ s'efforce d'apporter une réponse dans un délai raisonnable. "), phRun("mécanisme de médiation complémentaire, si ELEGANZ souhaite en instaurer un"),
]));

children.push(h1("Modification du présent règlement", 13));
children.push(p("ELEGANZ peut modifier le présent règlement à tout moment, notamment pour tenir compte d'une évolution réglementaire, technique ou commerciale. Toute modification substantielle est portée à la connaissance des Utilisateurs avant son entrée en vigueur, par un moyen raisonnable (notification sur la Plateforme, message, ou autre). La poursuite de l'utilisation de la Plateforme après l'entrée en vigueur d'une modification vaut acceptation de celle-ci."));

children.push(h1("Durée et résiliation", 14));
children.push(p("Le présent règlement s'applique pendant toute la durée d'utilisation de la Plateforme par l'Utilisateur. Chaque Utilisateur peut, selon les modalités propres à son module, fermer son Compte à tout moment ; cette fermeture est sans préjudice des sommes déjà dues à la date de la fermeture et des obligations qui, par leur nature, survivent à la fin de la relation (notamment la confidentialité)."));

children.push(h1("Droit applicable et règlement des différends", 15));
children.push(mixedP([
  run("Le présent règlement est soumis au droit "), phRun("droit applicable — à confirmer, en principe le droit de la République démocratique du Congo"),
  run(". Tout différend relatif à sa formation, son exécution ou son interprétation sera soumis, à défaut de résolution amiable, à "), phRun("juridiction ou mode de règlement des litiges compétent"),
  run("."),
]));

children.push(h1("Contact", 16));
children.push(mixedP([
  run("Toute question relative au présent règlement peut être adressée à ELEGANZ aux coordonnées publiées dans les Paramètres plateforme et le pied de page du site : "), phRun("reprendre les coordonnées officielles réellement publiées, sans en inventer de nouvelles"),
  run("."),
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

children.push(h0("Version"));
children.push(mixedP([
  run("Version : "), phRun("numéro de version"),
  run(" — Entrée en vigueur le "), phRun("date d'entrée en vigueur"),
  run("."),
]));

children.push(calloutBox("Rappel", [
  "Ce document ne devient opposable qu'après relecture complète, complétion de l'ensemble des champs signalés et validation par un conseil juridique, en particulier pour la clause de droit applicable (article 15) et pour toute politique de confidentialité séparée à laquelle l'article 7 renvoie.",
]));

writeDocx(children, __dirname + "/ELEGANZ-Politiques-Generales-CGU-Modele.docx");
