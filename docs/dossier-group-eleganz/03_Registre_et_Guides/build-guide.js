// Guide_et_mode_emploi_GROUP_ELEGANZ.docx — version améliorée.
// Reprend la structure à 8 sections du guide source de l'utilisateur, en :
//  - mettant à jour la présentation de la plateforme aux 7 modules réels
//    (Market, Gestion, Livreur, Mon assistant, Experts, Institutions,
//    Centre de pilotage) ;
//  - indiquant le statut interne réel de chaque pièce (modèles rédigés
//    cette session vs. démarches restant à mener avec des données réelles) ;
//  - développant, avec un ton d'urgence approprié, la section sur le
//    régime d'autorisation numérique (délai transitoire dépassé depuis le
//    30 juin 2026) et en clarifiant l'absence d'intermédiation financière
//    (paiement à la livraison) ;
//  - citant les sources réglementaires vérifiées de façon indépendante.
const {
  run, h0, h1, h2, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  coverPage, writeDocx, PageBreak, Paragraph, letterheadHeader,
} = require("../helpers.js");
const { NOM_SOCIETE, RESERVE_NOM } = require("../shared.js");

const children = [];

children.push(...coverPage({
  kicker: "PIÈCE DE RÉFÉRENCE — DOSSIER GROUP ELEGANZ SARL",
  title: "Guide et mode d'emploi du dossier",
  subtitle1: "Constitution de la société et mise en conformité numérique de la plateforme ELEGANZ",
  subtitle2: "Document de référence transversal, à lire en premier et à tenir à jour au fil de l'avancement des démarches",
}));
children.push(calloutBox("À lire avant toute utilisation du dossier", [
  "Ce guide a été entièrement révisé par le développeur et co-concepteur de la plateforme ELEGANZ pour refléter fidèlement les modules réellement exploités à ce jour, et pour intégrer une recherche réglementaire indépendante sur le régime d'autorisation numérique en République démocratique du Congo, non disponible dans la version initiale de ce dossier.",
  "Il ne remplace ni un avis juridique, ni les formalités officielles auprès du GUCE, de l'ARPTC, de la DGI ou de toute banque : il organise et explique les 15 pièces du dossier, et signale ce qui reste à faire.",
]));
children.push(new Paragraph({ children: [new PageBreak()] }));

children.push(h0("Sommaire"));
[
  "1. Objet de ce guide et contenu du dossier",
  "2. La société et la plateforme ELEGANZ",
  "3. Le dossier de constitution (pièces 01 à 09)",
  "4. Le dossier des contrats numériques (pièces 10 à 15)",
  "5. Le régime d'autorisation numérique — synthèse et calendrier",
  "6. Modèle de règlement des commandes : l'absence d'intermédiation financière d'ELEGANZ",
  "7. Comment utiliser, mettre à jour et faire évoluer ce dossier",
  "8. Sources et références réglementaires",
].forEach((t) => children.push(bullet(t)));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1
children.push(h1("1. Objet de ce guide et contenu du dossier"));
children.push(p("Le présent dossier rassemble, en 15 documents répartis en deux sous-dossiers (constitution et contrats numériques) et un registre de suivi, l'ensemble des pièces nécessaires à la création de la société " + NOM_SOCIETE + " et à la mise en conformité de sa plateforme ELEGANZ au regard du droit congolais applicable aux activités numériques."));
children.push(p("Il se compose de :"));
children.push(bullet("9 pièces de constitution de la société (statuts, lettre au GUCE, déclaration de capital, procès-verbal constitutif, spécimen de signature, mandat de dépôt, attestation de siège, registre des associés et bénéficiaires effectifs, décision d'ouverture de compte bancaire) ;"));
children.push(bullet("6 pièces relatives aux contrats numériques et à la conformité réglementaire de la plateforme (contrat vendeur, conditions SaaS, politique de confidentialité, cession de propriété intellectuelle, CGU Marketplace, dossier de demande d'autorisation numérique) ;"));
children.push(bullet("le présent guide et un registre de suivi des formalités (classeur Excel), réunis dans ce même sous-dossier « Registre et guides »."));
children.push(note("Toutes les pièces sont des modèles de travail : chaque donnée réelle concernant l'entreprise (identité des associés, capital, siège, dates) y apparaît en rouge italique, entre crochets, avec la mention « à compléter », et doit être validée par un notaire ou un avocat inscrit en République démocratique du Congo avant tout dépôt ou toute signature."));

// 2
children.push(h1("2. La société et la plateforme ELEGANZ"));
children.push(p("À la date du présent guide, la plateforme ELEGANZ se compose de sept modules :"));
[
  ["ELEGANZ Market", "la place de marché électronique (marketplace) mettant en relation des boutiques et des acheteurs."],
  ["ELEGANZ Gestion", "le logiciel SaaS de gestion commerciale (caisse, stocks, facturation, équipes, finance) destiné aux boutiques."],
  ["ELEGANZ Livreur", "le module permettant à chaque boutique de créer et gérer son propre réseau de livreurs."],
  ["ELEGANZ Mon assistant", "l'assistant numérique d'aide à l'utilisation de la plateforme."],
  ["Espace Experts", "l'accès, limité et révocable, de consultants externes invités par une boutique."],
  ["Espace Institutions", "la mise en relation avec des institutions financières partenaires, notamment pour des dossiers de crédit."],
  ["Centre de pilotage", "les outils d'administration et de supervision de la plateforme par la société."],
].forEach(([name, desc]) => {
  children.push(bullet([run(name + " — ", { bold: true }), run(desc)]));
});
children.push(note("Cette liste met à jour celle de la version initiale de ce dossier, qui ne mentionnait pas les modules Livreur, Experts et Institutions, et faisait par ailleurs référence à un « prestataire de paiement autorisé » qui n'est, à ce jour, pas intégré à la plateforme (voir section 6)."));

// 3
children.push(h1("3. Le dossier de constitution (pièces 01 à 09)"));
children.push(p("Ces neuf pièces documentent la création de la société elle-même, sous forme de société à responsabilité limitée (SARL) de droit congolais, conformément à l'AUSCGIE, et sont destinées à être déposées, pour l'essentiel, auprès du Guichet Unique de Création d'Entreprise (GUCE)."));
children.push(bullet("01 — Statuts : document central, 26 articles, incluant un objet social détaillé reprenant les 7 modules et deux articles sur la propriété intellectuelle et la confidentialité."));
children.push(bullet("02 — Lettre de demande d'immatriculation au GUCE."));
children.push(bullet("03 — Déclaration de souscription et de versement du capital social."));
children.push(bullet("04 — Procès-verbal de l'assemblée générale constitutive (nomination du gérant)."));
children.push(bullet("05 — Spécimen de signature du gérant."));
children.push(bullet("06 — Mandat spécial de dépôt et de retrait de dossier (si un tiers dépose le dossier)."));
children.push(bullet("07 — Attestation de mise à disposition du siège social."));
children.push(bullet("08 — Registre des associés et des bénéficiaires effectifs."));
children.push(bullet("09 — Décision relative à l'ouverture des comptes bancaires."));
children.push(note("Statut interne : les 9 modèles sont rédigés et prêts à être complétés avec les données réelles de l'entreprise (voir le registre de suivi, feuille « Registre formalités », lignes 1 à 9). Le dépôt effectif au GUCE et l'obtention du RCCM (lignes 10 à 13 du registre) restent à accomplir une fois ces données réunies."));

// 4
children.push(h1("4. Le dossier des contrats numériques (pièces 10 à 15)"));
children.push(p("Ces six pièces couvrent les relations contractuelles de la plateforme avec ses utilisateurs, la protection des données, la propriété intellectuelle, et surtout la conformité de la plateforme au régime d'autorisation numérique congolais."));
children.push(bullet("10 — Contrat d'adhésion Vendeur : obligations du Vendeur, responsabilité du Vendeur sur ses propres livreurs, absence d'intermédiation financière d'ELEGANZ, conformité fiscale, suspension/suppression de la boutique."));
children.push(bullet("11 — Conditions d'utilisation ELEGANZ Gestion (SaaS) : propriété des données du client, disponibilité du service, export des données à la résiliation."));
children.push(bullet("12 — Politique de confidentialité : couvre l'ensemble des 7 modules et le partage de données avec livreurs, experts et institutions."));
children.push(bullet("13 — Acte de cession de propriété intellectuelle : sécurise la titularité de la société sur les développements antérieurs à sa constitution."));
children.push(bullet("14 — CGU ELEGANZ Market : conditions d'utilisation de la place de marché pour acheteurs et boutiques."));
children.push(bullet([run("15 — Dossier de demande d'autorisation numérique : ", { bold: true }), run("document prioritaire, détaillé à la section suivante.")]));
children.push(note("Statut interne : les 6 modèles sont rédigés. Les pièces 10 et 14 complètent, pour la seule composante Marketplace, les modèles « Contrat d'adhésion Vendeur » et « Politiques générales / CGU » déjà produits et livrés séparément le 14 novembre 2026 ; les deux ensembles doivent être harmonisés par un conseil juridique avant publication définitive."));

// 5
children.push(h1("5. Le régime d'autorisation numérique — synthèse et calendrier"));
children.push(calloutBox("Urgence — délai transitoire déjà dépassé", [
  "Les arrêtés ministériels n°004 et n°005 du 11 mars 2026, pris en application du Code du numérique congolais, soumettent certaines activités numériques — dont les places de marché de commerce électronique comme ELEGANZ Market — à un régime d'autorisation préalable ou de déclaration.",
  "La période transitoire accordée pour se mettre en conformité a pris fin le 30 juin 2026. Depuis le 1er juillet 2026, opérer sans autorisation ni déclaration expose à une amende de 100 % à 200 % de la valeur du titre. Au 14 novembre 2026, ce délai est dépassé de plus de quatre mois.",
  "Ce point est développé intégralement, avec le barème des redevances (2 000 à 10 000 USD selon la qualification de la plateforme) et la procédure applicable, dans le document 15 du présent dossier. Il doit être traité en priorité absolue, avant même l'achèvement des formalités de constitution proprement dites.",
]));
children.push(p("Un point distinct, non confirmé de façon indépendante à ce jour, concerne l'existence possible d'un registre tenu par la Banque Centrale du Congo (BCC) pour certains « prestataires de services connexes », qui pourrait concerner les gestionnaires de plateformes de commerce électronique. Il doit être vérifié directement auprès de la BCC."));

// 6
children.push(h1("6. Modèle de règlement des commandes : l'absence d'intermédiation financière d'ELEGANZ"));
children.push(p([
  run("Contrairement à ce que supposait la version initiale de ce dossier, la plateforme ELEGANZ "), run("n'intègre, à ce jour, aucun prestataire de paiement en ligne.", { bold: true }),
  run(" Le règlement de chaque commande conclue sur ELEGANZ Market s'effectue directement entre l'acheteur et la boutique, en espèces ou par paiement mobile, lors de la livraison ou du retrait des produits. La société n'encaisse, ne détient ni ne reverse aucun fonds appartenant à un tiers."),
]));
children.push(p("Cette architecture a une double conséquence pratique : elle simplifie la décision d'ouverture de compte bancaire (pièce 09, qui ne nécessite pas de compte de fonds de tiers), et elle est déterminante pour la qualification de la plateforme au regard du régime d'autorisation numérique (voir section 5 et document 15), dans la mesure où elle écarte, en l'état, toute qualification de service financier numérique (fintech) ou de service de banque en ligne."));
children.push(note("Si la société intègre à l'avenir un service de paiement en ligne, l'ensemble des pièces concernées (09, 10, 11, 15) devra être révisé en conséquence, notamment pour prévoir l'intervention d'un prestataire de services de paiement agréé."));

// 7
children.push(h1("7. Comment utiliser, mettre à jour et faire évoluer ce dossier"));
children.push(bullet("Suivre l'avancement de chaque formalité dans le classeur Excel « Registre_formalites_autorisations_GROUP_ELEGANZ », feuille « Registre formalités », en mettant à jour la colonne « Statut interne » au fil de l'avancement réel."));
children.push(bullet("Consulter la feuille « Priorités » du même classeur pour un ordre de traitement recommandé des actions les plus importantes."));
children.push(bullet("Ne jamais déposer ou signer un document comportant encore un champ « [ ... — à compléter ] »."));
children.push(bullet("Faire valider l'ensemble du dossier, avant tout dépôt officiel, par un notaire et/ou un avocat inscrit en République démocratique du Congo, en particulier pour la qualification au regard du régime d'autorisation numérique (section 5)."));
children.push(bullet("Régénérer un document modifié à partir de son script source (voir le fichier CONTRATS_ET_POLITIQUES.md du dépôt du projet pour les modèles transversaux déjà livrés séparément) plutôt que d'éditer le fichier Word final à la main, pour garder une trace des modifications."));

// 8
children.push(h1("8. Sources et références réglementaires"));
children.push(p("Les éléments réglementaires cités dans ce guide et dans le document 15 ont été vérifiés par recherche indépendante à la date du 14 novembre 2026, à partir de plusieurs sources concordantes relatives aux arrêtés ministériels n°004 et n°005 du 11 mars 2026 et à leur arrêté d'application du 20 juillet 2026 fixant les redevances. Une source relève une date de « 11 février 2026 » pour un texte apparenté — divergence mineure, à vérifier sur le texte officiel avant toute démarche."));
children.push(note("Il appartient à la société, avec son conseil juridique, de se procurer le texte officiel et à jour de ces arrêtés, ainsi que des formulaires et procédures en vigueur auprès du GUCE (https://anapi.cd/en/procedures pour les procédures de référence ANAPI) et de l'ARPTC, à la date effective du dépôt de ses démarches."));

children.push(calloutBox("Rappel final", [
  "Ce guide et l'ensemble du dossier constituent des modèles de travail destinés à accélérer la préparation des démarches de " + NOM_SOCIETE + ", et non des actes ou avis juridiques définitifs.",
]));

writeDocx(children, __dirname + "/Guide_et_mode_emploi_GROUP_ELEGANZ.docx", { header: letterheadHeader(NOM_SOCIETE) });
