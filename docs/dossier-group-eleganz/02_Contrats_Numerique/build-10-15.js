// 10 à 15 — les 6 documents numériques du dossier, réécrits pour refléter
// la plateforme réelle (pas de prestataire de paiement intégré — règlement
// à la livraison ; livreurs créés et gérés par chaque boutique ; modules
// Experts et Institutions ; présentation normalisée auto-déclarée distincte
// de l'homologation fiscale réelle) et pour intégrer les éléments
// réglementaires vérifiés sur le régime d'autorisation numérique RDC
// (arrêtés n°004 et n°005 du 11 mars 2026, arrêté de redevances du 20
// juillet 2026), avec mention explicite de ce qui reste non confirmé de
// façon indépendante (registre BCC).
const path = require("path");
const {
  run, h1, h2, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  construireDocument, champ, simpleTable, NOM_SOCIETE, RESERVE_NOM,
} = require("../shared.js");

const DIR = __dirname;

async function main() {
  // ---------------------------------------------------------------
  // 10 — Contrat d'adhésion Vendeur (ELEGANZ Market)
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 10 du dossier des contrats numériques",
    titre: "Contrat d'adhésion Vendeur",
    sousTitre: "Conclu entre " + NOM_SOCIETE + " et chaque boutique inscrite sur ELEGANZ Market",
    corps: [
      p("Le présent contrat régit l'adhésion de toute boutique (ci-après le « Vendeur ») à ELEGANZ Market, la place de marché électronique exploitée par la société, et s'applique à chaque commande passée par un acheteur auprès du Vendeur par ce biais."),

      h1("Objet", 1),
      p("La société met à la disposition du Vendeur un espace de présentation et de vente de ses produits sur ELEGANZ Market, ainsi que les outils logiciels associés (gestion de catalogue, de commandes, et, le cas échéant, de l'offre ELEGANZ Gestion et du module ELEGANZ Livreur)."),

      h1("Inscription et compte boutique", 2),
      p("Le Vendeur fournit des informations exactes et à jour sur son identité, son activité commerciale et, le cas échéant, son identification fiscale. Il est seul responsable de la mise à jour de ces informations et de la confidentialité de ses identifiants de connexion."),

      h1("Obligations du Vendeur sur ses produits", 3),
      bullet("décrire fidèlement les produits proposés (nature, état, caractéristiques, prix, disponibilité) ;"),
      bullet("garantir la conformité des produits aux normes applicables et leur qualité marchande ;"),
      bullet("maintenir à jour les niveaux de stock affichés sur la plateforme ;"),
      bullet("respecter les prix affichés au moment de la commande, sauf erreur manifeste signalée sans délai à l'acheteur."),

      h1("Traitement des commandes", 4),
      p("Le Vendeur accuse réception de chaque commande dans un délai raisonnable, prépare les produits commandés et les tient prêts pour l'enlèvement ou la livraison selon les modalités choisies par l'acheteur. Tout refus ou empêchement d'honorer une commande acceptée doit être signalé sans délai à l'acheteur et, le cas échéant, donner lieu à annulation."),

      h1("Livraison et livreurs", 5),
      p([
        run("Lorsque le Vendeur propose la livraison, il crée et gère son propre réseau de livreurs au moyen du module ELEGANZ Livreur. Le Vendeur est "), run("seul responsable", { bold: true }),
        run(", vis-à-vis de l'acheteur comme des tiers, des livreurs qu'il recrute, forme, rémunère et affecte à ses commandes — notamment de leur comportement, du respect des délais annoncés, de la manutention des produits et de tout dommage ou perte survenant pendant le transport."),
      ]),
      p("La société fournit le seul outil logiciel de gestion des livreurs (affectation des courses, suivi) et n'est ni l'employeur, ni le donneur d'ordre, ni le garant des livreurs ainsi créés par le Vendeur."),

      h1("Règlement des commandes", 6),
      p([
        run("Le règlement de chaque commande s'effectue "), run("directement entre l'acheteur et le Vendeur", { bold: true }),
        run(", en espèces ou par voie de paiement mobile, lors de la livraison ou du retrait des produits. La société n'intervient à aucun stade de ce règlement : elle n'encaisse, ne détient ni ne reverse aucun fonds appartenant à l'acheteur ou au Vendeur au titre d'une commande."),
      ]),
      note("Cette architecture (règlement à la livraison, sans intermédiation financière d'ELEGANZ) est déterminante pour la qualification de la plateforme au regard du régime d'autorisation numérique applicable — voir le document 15 du présent dossier."),

      h1("Retours, remboursements et garanties", 7),
      p("Sauf disposition légale impérative contraire, le traitement des retours, échanges et remboursements relève de la seule responsabilité du Vendeur, selon sa propre politique affichée sur sa boutique, laquelle doit rester conforme aux droits des consommateurs applicables."),

      h1("Facturation et conformité fiscale", 8),
      p([
        run("La facture émise au titre d'une commande est, par défaut, un document interne ("), run("INVOICE_INTERNAL", { italics: true }),
        run(") qui ne vaut pas facture normalisée homologuée par l'administration fiscale. Le Vendeur peut activer, sous sa seule responsabilité et sur déclaration de sa part, une présentation enrichie auto-déclarée de ses documents de vente ; cette activation ne change à aucun moment la nature du document, qui demeure "), run("INVOICE_INTERNAL", { italics: true }),
        run(" et ne devient jamais une facture fiscalement homologuée ("), run("INVOICE_FISCAL", { italics: true }), run("), celle-ci ne pouvant résulter que d'une confirmation d'homologation par l'administrateur de la plateforme, sur la base de justificatifs produits par le Vendeur."),
      ]),
      p("Le Vendeur demeure seul responsable du respect de ses obligations fiscales et comptables propres, indépendamment de la présentation choisie sur la plateforme."),

      h1("Abonnement et commission", 9),
      mixedP([run("L'accès à ELEGANZ Market et aux modules associés est soumis à "), phRun("grille tarifaire applicable — abonnement et/ou commission, selon l'offre commerciale en vigueur"), run(", précisée séparément et pouvant évoluer selon les conditions prévues à l'article 16.")]),

      h1("Conformité réglementaire numérique", 10),
      p("Le Vendeur reconnaît qu'ELEGANZ Market, en tant que place de marché électronique, est susceptible de relever du régime d'autorisation ou de déclaration applicable aux plateformes numériques en République démocratique du Congo (voir document 15). Il s'engage à fournir à la société, sur demande raisonnable, toute information nécessaire à l'instruction ou au maintien de cette autorisation, dans la mesure où elle le concerne."),

      h1("Manquements et conséquences", 11),
      p("Tout manquement du Vendeur à l'une de ses obligations (produit non conforme, défaut répété de traitement des commandes, comportement d'un livreur créé par ses soins, non-respect de ses obligations fiscales propres) peut donner lieu, selon sa gravité, à un avertissement, une suspension temporaire ou une résiliation de l'accès à la plateforme dans les conditions de l'article 12."),

      h1("Suspension et suppression de la boutique par ELEGANZ", 12),
      p("La société peut suspendre ou supprimer, à tout moment et sans préavis en cas de manquement grave ou répété, l'accès du Vendeur à la plateforme, notamment en cas de non-conformité des produits, de fraude, de manquement aux obligations de l'article 5 relatives aux livreurs, ou de non-respect des présentes conditions. Hors cas d'urgence ou de manquement grave, un préavis raisonnable est adressé au Vendeur avant suspension."),

      h1("Résiliation à l'initiative du Vendeur", 13),
      p("Le Vendeur peut à tout moment cesser d'utiliser la plateforme et demander la clôture de sa boutique, sous réserve du traitement des commandes déjà engagées."),

      h1("Limitation de responsabilité d'ELEGANZ", 14),
      mixedP([run("La responsabilité de la société, en sa seule qualité d'éditeur de la plateforme technique d'intermédiation, est limitée à "), phRun("plafond de responsabilité à déterminer avec un conseil juridique"), run(". Elle n'est en particulier pas responsable de la qualité des produits, du comportement des livreurs créés par le Vendeur, ni des défauts de règlement entre acheteur et Vendeur.")]),

      h1("Protection des données", 15),
      p("Le traitement des données personnelles des utilisateurs (Vendeur, acheteurs, livreurs) est décrit dans la politique de confidentialité d'ELEGANZ (document 12 du présent dossier), que le Vendeur reconnaît avoir lue et acceptée."),

      h1("Durée et modification du contrat", 16),
      p("Le présent contrat est conclu pour une durée indéterminée à compter de l'activation de la boutique. La société peut en modifier les termes moyennant notification préalable au Vendeur ; la poursuite de l'utilisation de la plateforme après notification vaut acceptation des nouvelles conditions."),

      h1("Droit applicable et règlement des différends", 17),
      mixedP([run("Le présent contrat est soumis au droit "), phRun("droit applicable — à déterminer"), run(". Tout différend relatif à sa formation, son exécution ou sa résiliation sera soumis à "), phRun("juridiction ou mode de règlement des différends compétent — à déterminer"), run(".")]),
    ],
    signataires: ["Pour " + NOM_SOCIETE, "Pour le Vendeur (boutique)"],
    rappel: "Ce modèle complète, sans le remplacer, le Contrat d'adhésion Vendeur déjà produit pour ce projet (docs/contrats-politiques/build-contrat-vendeur.js) ; en cas de divergence entre les deux, la version la plus récente doit être retenue comme référence après harmonisation par un conseil juridique.",
    outFile: path.join(DIR, "10_Contrat_vendeur_marketplace.docx"),
  });

  // ---------------------------------------------------------------
  // 11 — Conditions d'utilisation ELEGANZ Gestion (SaaS)
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 11 du dossier des contrats numériques",
    titre: "Conditions d'utilisation ELEGANZ Gestion",
    sousTitre: "Offre logicielle SaaS de gestion commerciale, caisse, stocks et facturation",
    corps: [
      h1("Objet", 1),
      p("Les présentes conditions régissent l'utilisation, par un client professionnel (ci-après le « Client »), du module ELEGANZ Gestion : caisse, gestion des stocks, facturation, gestion d'équipe, et suivi financier, en mode logiciel-service (SaaS), fourni avec ou sans adhésion simultanée à ELEGANZ Market."),

      h1("Accès et compte", 2),
      p("Le Client accède au service au moyen d'un compte principal et, le cas échéant, de comptes secondaires attribués à ses collaborateurs, avec des droits d'accès qu'il configure lui-même. Le Client est responsable de la bonne gestion de ces droits d'accès et de la confidentialité des identifiants."),

      h1("Propriété et usage des données du Client", 3),
      p("Les données saisies ou générées par le Client dans ELEGANZ Gestion (catalogue, stocks, écritures de caisse, factures, données financières) demeurent sa propriété exclusive. La société agit, pour ces données, en qualité d'hébergeur et de prestataire technique, et ne les utilise que dans la mesure nécessaire à la fourniture, à la maintenance et à l'amélioration du service, ainsi que, de façon agrégée et anonymisée, à des fins statistiques internes."),

      h1("Disponibilité du service", 4),
      p("La société met en œuvre des moyens raisonnables pour assurer la disponibilité et la continuité du service, sans toutefois garantir une disponibilité ininterrompue. Des opérations de maintenance programmée peuvent entraîner des interruptions temporaires, annoncées dans la mesure du possible."),

      h1("Abonnement et facturation du service", 5),
      mixedP([run("L'accès à ELEGANZ Gestion est soumis à "), phRun("grille tarifaire applicable, selon l'offre commerciale en vigueur"), run(".")]),

      h1("Export et restitution des données à la résiliation", 6),
      p("À la résiliation du service, pour quelque cause que ce soit, le Client peut obtenir, pendant une période raisonnable suivant la résiliation, l'export de ses données dans un format exploitable. Passé ce délai, la société peut procéder à leur suppression, sous réserve des obligations légales de conservation qui lui seraient applicables."),

      h1("Assistance", 7),
      p("Le Client bénéficie, pour l'utilisation du service, de l'assistance intégrée ELEGANZ Mon assistant ainsi que, le cas échéant, d'un support complémentaire selon les modalités de son offre."),

      h1("Sécurité et confidentialité", 8),
      p("Le traitement des données à caractère personnel associées au compte du Client (lui-même, ses collaborateurs) est décrit dans la politique de confidentialité d'ELEGANZ (document 12 du présent dossier)."),

      h1("Responsabilité et limitation", 9),
      mixedP([run("La responsabilité de la société au titre du présent service est limitée à "), phRun("plafond de responsabilité à déterminer avec un conseil juridique"), run(". Le Client demeure seul responsable de l'exactitude des données qu'il saisit et des décisions de gestion prises sur leur fondement.")]),

      h1("Suspension et résiliation", 10),
      p("La société peut suspendre l'accès au service en cas de manquement du Client à ses obligations (notamment défaut de paiement ou usage frauduleux), après mise en demeure restée infructueuse, sauf urgence. Le Client peut résilier à tout moment, sous réserve du respect des engagements de durée éventuellement souscrits."),

      h1("Modification des conditions", 11),
      p("La société peut modifier les présentes conditions moyennant notification préalable raisonnable au Client."),

      h1("Droit applicable", 12),
      mixedP([run("Les présentes conditions sont soumises au droit "), phRun("droit applicable — à déterminer"), run(".")]),
    ],
    signataires: ["Pour " + NOM_SOCIETE, "Pour le Client"],
    outFile: path.join(DIR, "11_Conditions_SaaS_Gestion.docx"),
  });

  // ---------------------------------------------------------------
  // 12 — Politique de confidentialité
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 12 du dossier des contrats numériques",
    titre: "Politique de confidentialité",
    sousTitre: "Applicable à l'ensemble des modules de la plateforme ELEGANZ",
    corps: [
      h1("Préambule", 1),
      p("La présente politique décrit la manière dont " + NOM_SOCIETE + " collecte, utilise, partage et protège les données à caractère personnel des utilisateurs de la plateforme ELEGANZ, dans l'ensemble de ses modules : ELEGANZ Market, ELEGANZ Gestion, ELEGANZ Livreur, ELEGANZ Mon assistant, l'espace Experts, l'espace Institutions et le Centre de pilotage."),

      h1("Responsable du traitement", 2),
      mixedP([run("Le responsable du traitement est "), run(NOM_SOCIETE, { bold: true }), run(", dont le siège social est situé "), phRun("adresse du siège social"), run(". Toute demande relative à la présente politique peut être adressée à : "), phRun("adresse de contact dédiée à la protection des données")]),

      h1("Données collectées", 3),
      bullet("données d'identification et de compte (nom, contact, identifiants) de l'ensemble des utilisateurs ;"),
      bullet("données commerciales et financières saisies dans ELEGANZ Gestion (catalogue, stocks, caisse, facturation) par les boutiques ;"),
      bullet("données de commande et, le cas échéant, de localisation nécessaires à l'exécution des livraisons via ELEGANZ Livreur ;"),
      bullet("données d'usage et d'interaction avec ELEGANZ Mon assistant ;"),
      bullet("données consultées par un Expert dans la limite de l'invitation reçue d'une boutique ;"),
      bullet("données transmises à une Institution partenaire dans le cadre d'un dossier de crédit, uniquement avec l'accord de la boutique concernée ;"),
      bullet("données techniques de connexion (journal d'activité, adresse IP, identifiants d'appareil) à des fins de sécurité."),

      h1("Finalités du traitement", 4),
      bullet("fournir, exploiter et améliorer les différents modules de la plateforme ;"),
      bullet("permettre la mise en relation entre acheteurs, boutiques, livreurs, experts et institutions partenaires ;"),
      bullet("assurer la sécurité de la plateforme et prévenir la fraude ;"),
      bullet("satisfaire aux obligations légales et réglementaires applicables à la société."),

      h1("Partage des données", 5),
      p("Les données sont partagées entre utilisateurs uniquement dans la mesure nécessaire au fonctionnement du module concerné : avec les livreurs créés et gérés par une boutique, pour l'exécution des livraisons de cette boutique ; avec un Expert, dans la stricte limite de l'invitation reçue et pour la durée de celle-ci ; avec une Institution partenaire, uniquement sur décision et avec l'accord explicite de la boutique concernée, dans le cadre d'un dossier de crédit. La société ne vend ni ne loue les données personnelles des utilisateurs à des tiers."),

      h1("Durée de conservation", 6),
      mixedP([run("Les données sont conservées pendant la durée d'utilisation de la plateforme par l'utilisateur concerné, puis pendant "), phRun("durée de conservation après clôture du compte — à déterminer selon les obligations légales applicables"), run(", sauf obligation légale de conservation plus longue.")]),

      h1("Sécurité des données", 7),
      p("La société met en œuvre des mesures techniques et organisationnelles raisonnables pour protéger les données contre tout accès non autorisé, perte ou altération, proportionnées à la nature des données traitées."),

      h1("Droits des personnes concernées", 8),
      p("Toute personne concernée peut demander l'accès à ses données, leur rectification, ou leur suppression dans les limites compatibles avec les obligations légales de la société, en s'adressant au contact mentionné à l'article 2."),

      h1("Violation de données", 9),
      p("En cas de violation de données susceptible d'engendrer un risque pour les droits des personnes concernées, la société en informe les personnes affectées et, le cas échéant, l'autorité compétente, dans les meilleurs délais."),

      h1("Modification de la présente politique", 10),
      p("La société peut modifier la présente politique à tout moment ; toute modification substantielle fait l'objet d'une notification aux utilisateurs."),
    ],
    signataires: [],
    rappel: "Le cadre congolais de protection des données personnelles applicable aux plateformes numériques, en particulier dans le contexte du Code du numérique et des arrêtés n°004/005 du 11 mars 2026, doit être vérifié avec un conseil juridique pour s'assurer que les engagements pris ici (durées de conservation, droits des personnes, notification des violations) sont conformes aux exigences locales en vigueur à la date de publication.",
    outFile: path.join(DIR, "12_Politique_confidentialite.docx"),
  });

  // ---------------------------------------------------------------
  // 13 — Acte de cession de propriété intellectuelle
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 13 du dossier des contrats numériques",
    titre: "Acte de cession de propriété intellectuelle",
    sousTitre: "Du ou des développeurs fondateurs au profit de " + NOM_SOCIETE,
    corps: [
      mixedP([
        run("Entre le soussigné "), phRun("nom complet du cédant"),
        run(" (ci-après le « Cédant »), auteur et développeur de la plateforme ELEGANZ antérieurement à la constitution de "),
        run(NOM_SOCIETE, { bold: true }), run(", et la société elle-même, représentée par son gérant (ci-après la « Société »), il est convenu ce qui suit :"),
      ]),

      h1("Objet", 1),
      p("Le Cédant cède à la Société, qui accepte, l'intégralité des droits de propriété intellectuelle qu'il détient sur les éléments constitutifs de la plateforme ELEGANZ développés antérieurement à la constitution de la Société."),

      h1("Éléments cédés", 2),
      bullet("les codes sources de l'ensemble des modules de la plateforme (ELEGANZ Market, ELEGANZ Gestion, ELEGANZ Livreur, ELEGANZ Mon assistant, espace Experts, espace Institutions, Centre de pilotage) ;"),
      bullet("les bases de données, schémas et structures de données associés ;"),
      bullet("la documentation technique et fonctionnelle afférente ;"),
      bullet(phRun("dénominations, marques, logos et éléments graphiques, le cas échéant distincts de la dénomination sociale visée à l'article 3 des statuts")),

      h1("Étendue des droits cédés", 3),
      p("La présente cession porte sur l'intégralité des droits patrimoniaux attachés aux éléments visés à l'article 2, pour le monde entier, pour toute la durée de protection légale, et pour tout mode d'exploitation connu ou inconnu à ce jour (reproduction, représentation, adaptation, mise à disposition en ligne, commercialisation sous toute forme)."),

      h1("Garanties du Cédant", 4),
      p("Le Cédant garantit être l'auteur original des éléments cédés, ou disposer des droits nécessaires pour en céder la propriété, et qu'ils ne portent atteinte à aucun droit de propriété intellectuelle de tiers à sa connaissance. Il garantit n'avoir consenti, à la date des présentes, aucune autre cession ou licence incompatible avec le présent acte."),

      h1("Contrepartie", 5),
      mixedP([run("La présente cession est consentie "), phRun("à titre gratuit, ou moyennant la contrepartie suivante — ex. apport en nature valorisé à l'article 6 des statuts, ou somme déterminée"), run(".")]),

      h1("Droit moral", 6),
      p("Dans la mesure où le droit applicable reconnaît au Cédant un droit moral sur les éléments cédés, celui-ci conserve ce droit mais s'engage à ne pas l'exercer d'une manière qui entraverait l'exploitation normale de la plateforme par la Société, ni ne porterait atteinte aux intérêts légitimes de celle-ci."),

      h1("Développements postérieurs", 7),
      p("Les développements réalisés par le Cédant après la date des présentes, dans le cadre de ses fonctions de dirigeant, salarié ou prestataire de la Société, sont régis par les termes de son mandat social, de son contrat de travail ou de son contrat de prestation, et non par le présent acte, et appartiennent à la Société dans les conditions prévues par ces documents."),

      h1("Entrée en vigueur", 8),
      mixedP([run("Le présent acte prend effet "), phRun("à la date de signature, ou sous condition suspensive de l'immatriculation de la Société au RCCM — à préciser"), run(".")]),
    ],
    signataires: ["Le Cédant", "Pour " + NOM_SOCIETE + " (le gérant)"],
    rappel: "Cet acte est à articuler avec l'article 6 (Apports) et l'article 15 (Propriété intellectuelle) des statuts (pièce 01) si la valorisation des développements existants est traitée comme un apport en nature ; un commissaire aux apports peut alors être requis selon les seuils applicables.",
    outFile: path.join(DIR, "13_Cession_propriete_intellectuelle.docx"),
  });

  // ---------------------------------------------------------------
  // 14 — CGU Marketplace
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 14 du dossier des contrats numériques",
    titre: "Conditions générales d'utilisation — ELEGANZ Market",
    sousTitre: "Applicables aux acheteurs et aux boutiques utilisant la place de marché",
    corps: [
      h1("Objet et champ d'application", 1),
      p("Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation d'ELEGANZ Market par tout acheteur ou toute boutique. Elles complètent, pour les boutiques, le contrat d'adhésion Vendeur (document 10 du présent dossier)."),

      h1("Comptes utilisateurs", 2),
      p("L'inscription requiert la fourniture d'informations exactes. Chaque utilisateur est responsable de la confidentialité de ses identifiants et des actions effectuées depuis son compte."),

      h1("Règles de conduite", 3),
      p("Chaque utilisateur s'engage à utiliser la plateforme de bonne foi, à ne publier aucun contenu illicite, trompeur ou portant atteinte aux droits de tiers, et à ne pas détourner la plateforme de sa finalité de mise en relation commerciale."),

      h1("Annonces et commandes", 4),
      p("Les annonces publiées par les boutiques engagent leur seule responsabilité quant à l'exactitude de leur contenu. La commande passée par l'acheteur forme un contrat de vente directement entre lui et la boutique concernée."),

      h1("Règlement et livraison", 5),
      p("Le règlement de toute commande s'effectue directement entre l'acheteur et la boutique, en espèces ou par paiement mobile, lors de la livraison ou du retrait. Lorsque la livraison est assurée par un livreur, celui-ci est créé et géré par la boutique elle-même via le module ELEGANZ Livreur, sous sa seule responsabilité (voir article 5 du document 10)."),

      h1("Rôle d'ELEGANZ Market", 6),
      p("ELEGANZ Market est une plateforme technique d'intermédiation qui met en relation acheteurs et boutiques. La société n'est partie à aucun contrat de vente conclu entre un acheteur et une boutique, et n'intervient ni dans la fixation des prix, ni dans le règlement des commandes, ni dans l'exécution des livraisons."),

      h1("Réclamations et litiges entre utilisateurs", 7),
      p("Tout litige relatif à une commande (non-conformité, retard, absence de livraison, défaut de paiement) doit être réglé en priorité entre l'acheteur et la boutique concernée. La société peut, à sa discrétion et sans y être tenue, faciliter la mise en relation des parties en vue d'une résolution amiable."),

      h1("Propriété intellectuelle de la plateforme", 8),
      p("L'ensemble des éléments de la plateforme (logiciels, bases de données, marques, interfaces) demeure la propriété exclusive de la société ou de ses concédants, conformément au document 13 du présent dossier."),

      h1("Données personnelles", 9),
      p("Le traitement des données personnelles des utilisateurs est décrit dans la politique de confidentialité (document 12 du présent dossier)."),

      h1("Limitation de responsabilité", 10),
      p("La responsabilité de la société ne saurait être engagée au titre de la qualité des produits vendus, du comportement d'un livreur créé par une boutique, ou d'un défaut de règlement entre utilisateurs, ces éléments relevant de la seule responsabilité des utilisateurs concernés."),

      h1("Suspension et suppression de compte", 11),
      p("La société peut suspendre ou supprimer tout compte en cas de manquement aux présentes CGU, de fraude ou d'usage contraire à la finalité de la plateforme."),

      h1("Modification des CGU", 12),
      p("La société peut modifier les présentes CGU à tout moment ; les utilisateurs en sont informés par tout moyen approprié, et la poursuite de l'utilisation de la plateforme vaut acceptation des CGU modifiées."),

      h1("Droit applicable", 13),
      mixedP([run("Les présentes CGU sont soumises au droit "), phRun("droit applicable — à déterminer"), run(".")]),
    ],
    signataires: [],
    rappel: "Ce document complète, pour la seule composante Marketplace, les Politiques générales / Règlement d'utilisation transversal déjà produit pour ce projet (docs/contrats-politiques/build-cgu.js), lequel couvre également ELEGANZ Gestion, Livreur, Mon assistant, Experts, Institutions et le Centre de pilotage.",
    outFile: path.join(DIR, "14_CGU_Marketplace.docx"),
  });

  // ---------------------------------------------------------------
  // 15 — Dossier de demande d'autorisation numérique
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 15 du dossier des contrats numériques — document prioritaire",
    titre: "Dossier de demande d'autorisation numérique",
    sousTitre: "Régime applicable aux plateformes numériques en République démocratique du Congo",
    corps: [
      calloutBox("Alerte calendrier — à traiter en priorité", [
        "La période transitoire fixée par les arrêtés ministériels n°004 et n°005 du 11 mars 2026 (RDC, ministère ayant l'économie numérique dans ses attributions), pris en application du Code du numérique, a pris fin le 30 juin 2026. À la date de rédaction du présent document (14 novembre 2026), ce délai est dépassé de plusieurs mois.",
        "Depuis le 1er juillet 2026, l'exploitation d'une activité numérique couverte par ce régime sans autorisation ou déclaration est traitée comme une activité illégale, exposant à des sanctions financières significatives (voir article 7 ci-dessous).",
        "Ce point doit être soumis sans délai à un conseil juridique inscrit en République démocratique du Congo, en vue d'un dépôt de régularisation auprès de l'Autorité de Régulation de la Poste et des Télécommunications du Congo (ARPTC), régulateur par intérim de ce régime.",
      ]),

      h1("Objet du dossier", 1),
      p("Le présent dossier a pour objet de documenter la situation de " + NOM_SOCIETE + " au regard du régime d'autorisation ou de déclaration applicable aux activités numériques en République démocratique du Congo, et de préparer les démarches nécessaires à sa mise en conformité."),

      h1("Présentation de la plateforme", 2),
      p("ELEGANZ est une plateforme numérique composée des modules suivants : ELEGANZ Market (place de marché électronique), ELEGANZ Gestion (logiciel de gestion commerciale en mode SaaS), ELEGANZ Livreur (gestion par chaque boutique de son propre réseau de livreurs), ELEGANZ Mon assistant (assistant numérique), l'espace Experts (accès limité et révocable de consultants externes invités par une boutique), l'espace Institutions (mise en relation avec des institutions financières partenaires) et le Centre de pilotage (administration de la plateforme)."),
      p("La société ne propose, à la date du présent document, aucun service de paiement en ligne intégré : le règlement des commandes conclues sur ELEGANZ Market s'effectue directement entre l'acheteur et la boutique, en espèces ou par paiement mobile, lors de la livraison."),

      h1("Cadre réglementaire applicable", 3),
      p("Le Code du numérique congolais et ses arrêtés d'application soumettent certaines activités numériques à un régime d'autorisation préalable délivrée par le ministère compétent, après instruction par l'ARPTC, et d'autres à un régime de simple déclaration."),
      p("Relèvent notamment du régime d'autorisation préalable, selon l'arrêté n°004 du 11 mars 2026 : les centres de données et services d'informatique en nuage (cloud) ; les services de confiance qualifiés (signature électronique, horodatage, archivage électronique, cryptologie) ; l'hébergement ; et les plateformes numériques réputées « dominantes » dans leur secteur — catégorie dans laquelle entrent explicitement les réseaux sociaux et les boutiques d'applications, et notamment :"),
      bullet("les places de marché de commerce électronique (marketplaces), catégorie dont relève directement ELEGANZ Market ;"),
      bullet("les services financiers numériques (fintechs) et les services de banque en ligne ;"),
      bullet("les moteurs de recherche et les services de mise en relation dans les secteurs du commerce électronique, du transport ou du logement."),
      note("La notion de plateforme « dominante » déclenchant le régime d'autorisation (plutôt que celui, plus léger, de déclaration prévu par l'arrêté n°005) n'est pas définie de façon chiffrée dans les sources consultées à ce jour ; ce point doit être clarifié directement auprès de l'ARPTC avant le dépôt du dossier."),

      h1("Qualification de l'activité d'ELEGANZ", 4),
      mixedP([
        run("Au vu de son stade de développement à la date du présent document, ELEGANZ Market pourrait relever soit du régime d'autorisation (si elle est qualifiée de plateforme « dominante »), soit du régime de déclaration, moins contraignant, applicable aux plateformes d'intermédiation non dominantes. Cette qualification doit être arrêtée avec l'ARPTC avant le dépôt du dossier : "), phRun("qualification retenue — dominante / non dominante — à confirmer avec l'ARPTC"),
      ]),

      h1("Pièces constitutives du dossier", 5),
      bullet("les statuts de la société et son certificat d'immatriculation au RCCM (pièces 01 et suivantes du présent dossier) ;"),
      bullet("une description technique et fonctionnelle de la plateforme et de ses modules ;"),
      bullet("une description des mesures de sécurité et de protection des données mises en œuvre (voir document 12) ;"),
      bullet(phRun("tout formulaire propre à l'ARPTC en vigueur à la date du dépôt, non reproduit dans ce modèle faute de source officielle consultée à ce jour")),

      h1("Redevances applicables", 6),
      p("L'arrêté interministériel du 20 juillet 2026 fixant les redevances dues au titre des différentes activités numériques couvertes prévoit, pour les places de marché de commerce électronique, le barème suivant :"),
      simpleTable(
        ["Catégorie", "Redevance (locale)", "Redevance (étrangère)"],
        [
          ["Plateforme dominante", "3 000 USD", "10 000 USD"],
          ["Plateforme d'intermédiation non dominante", "2 000 USD", "7 000 USD"],
        ],
      ),
      note("Montants exprimés en dollars américains, payables en francs congolais au taux de change officiel en vigueur à la date du paiement. Les start-up de droit congolais bénéficient d'une exemption selon les sources consultées — à confirmer pour le cas précis d'ELEGANZ au regard des critères retenus par les autorités."),

      h1("Procédure et délais", 7),
      bullet("instruction du dossier par l'ARPTC dans un délai de 30 jours ;"),
      bullet("décision du ministre compétent dans un délai de 15 jours ouvrables suivant l'avis de l'ARPTC ;"),
      bullet("après deux refus, toute nouvelle soumission du dossier devient payante ;"),
      bullet("l'autorisation, une fois délivrée, est valable 5 ans, renouvelable, et doit être révisée en cas de fusion, de changement de dénomination ou de changement de majorité du contrôle de la société."),

      h1("Sanctions en cas de non-conformité", 8),
      bullet("exploitation d'une activité numérique soumise à autorisation sans l'avoir obtenue : amende de 100 % à 200 % de la valeur du titre d'autorisation ;"),
      bullet("déclaration tardive ou incomplète : pénalité de 25 % ;"),
      bullet("absence de déclaration : pénalité de 50 % ;"),
      bullet("fausse déclaration : pénalité de 75 % ;"),
      bullet("récidive : pénalité pouvant atteindre 100 % ;"),
      bullet("renouvellement d'un titre : 100 % du coût du titre ; modification d'un titre existant : 25 %."),

      h1("Point de vigilance complémentaire — non confirmé", 9),
      p("Certaines sources évoquent l'existence, auprès de la Banque Centrale du Congo (BCC), d'un registre des « prestataires de services connexes » pouvant potentiellement inclure les gestionnaires de plateformes de commerce électronique. Cette information n'a pas pu être confirmée de façon indépendante à la date du présent document et doit être vérifiée directement auprès de la BCC ou d'un conseil juridique avant toute conclusion sur une éventuelle obligation supplémentaire d'enregistrement."),

      h1("Calendrier et prochaines étapes", 10),
      bullet(phRun("prise de contact avec un conseil juridique inscrit en RDC spécialisé en droit du numérique — à planifier sans délai compte tenu du dépassement du délai transitoire")),
      bullet(phRun("confirmation de la qualification dominante / non dominante auprès de l'ARPTC")),
      bullet(phRun("constitution et dépôt du dossier complet, règlement de la redevance applicable")),
    ],
    signataires: ["Le gérant"],
    rappel: "Ce document rassemble des informations vérifiées par recherche indépendante à la date du 14 novembre 2026 (arrêtés n°004 et n°005 du 11 mars 2026, arrêté de redevances du 20 juillet 2026) ; il ne constitue pas un avis juridique et doit être validé, complété et déposé avec l'assistance d'un conseil juridique inscrit en République démocratique du Congo, au vu des textes officiels en vigueur à la date du dépôt effectif.",
    outFile: path.join(DIR, "15_Dossier_demande_autorisation_numerique.docx"),
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
