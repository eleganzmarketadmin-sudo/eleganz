// 02 à 09 — les 8 documents courts de constitution (dossier GUCE), réécrits
// en version plus professionnelle que le dossier source de l'utilisateur,
// tout en conservant sa structure documentaire (même liste de 9 pièces) et
// la convention de placeholder rouge italique pour toute donnée réelle.
const path = require("path");
const {
  run, h1, h2, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  construireDocument, champ, simpleTable, NOM_SOCIETE, RESERVE_NOM,
} = require("../shared.js");

const DIR = __dirname;

async function main() {
  // ---------------------------------------------------------------
  // 02 — Lettre de demande d'immatriculation au GUCE
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 02 du dossier de constitution",
    titre: "Lettre de demande d'immatriculation",
    sousTitre: "Adressée au Guichet Unique de Création d'Entreprise (GUCE)",
    corps: [
      mixedP([run("À l'attention de Monsieur/Madame le Directeur général du Guichet Unique de Création d'Entreprise (GUCE)")]),
      mixedP([run("Objet : "), run("demande d'immatriculation au registre du commerce et du crédit mobilier (RCCM) et accomplissement des formalités de création de l'entreprise " + NOM_SOCIETE, { bold: true })]),
      p("Monsieur le Directeur général,"),
      p([
        run("Nous avons l'honneur de solliciter, par la présente, l'immatriculation au registre du commerce et du crédit mobilier de la société "),
        run(NOM_SOCIETE, { bold: true }), run(" "), run(RESERVE_NOM, { italics: true, size: 18 }),
        run(", société à responsabilité limitée de droit congolais en cours de constitution, ainsi que l'accomplissement, par votre intermédiaire en tant que guichet unique, de l'ensemble des formalités administratives, fiscales, sociales et statistiques liées à sa création."),
      ]),
      p("À cet effet, nous joignons à la présente demande le dossier complet constitué des pièces suivantes :"),
      bullet("les statuts de la société, signés par les associés fondateurs (pièce 01) ;"),
      bullet("la déclaration de souscription et de versement du capital social (pièce 03) ;"),
      bullet("le procès-verbal de l'assemblée générale constitutive portant nomination du premier gérant (pièce 04) ;"),
      bullet("le spécimen de signature du gérant (pièce 05) ;"),
      bullet("le mandat spécial de dépôt et de retrait de dossier, le cas échéant (pièce 06) ;"),
      bullet("l'attestation de mise à disposition du siège social (pièce 07) ;"),
      bullet("les pièces d'identité des associés fondateurs et du gérant ;"),
      bullet(phRun("toute autre pièce requise par le GUCE à la date du dépôt — formulaires types, justificatifs de résidence, photographies d'identité, preuve de paiement des frais de dossier, etc.")),
      p("Nous vous prions de bien vouloir nous faire connaître, le cas échéant, toute pièce complémentaire qui s'avérerait nécessaire à l'instruction de ce dossier, ainsi que le montant et les modalités de règlement des frais afférents à l'immatriculation."),
      p("Dans l'attente de votre retour et de la délivrance du certificat d'immatriculation au RCCM, nous vous prions d'agréer, Monsieur le Directeur général, l'expression de notre considération distinguée."),
    ],
    signataires: ["Le gérant (ou le mandataire désigné à la pièce 06)"],
    rappel: "Les pièces, formulaires et frais exigés par le GUCE peuvent évoluer ; il convient de vérifier la liste à jour directement auprès du guichet (voir aussi les références ANAPI citées dans le guide, pièce 03 du dossier « Registre et guides »), avant tout dépôt.",
    outFile: path.join(DIR, "02_Lettre_demande_GUCE.docx"),
  });

  // ---------------------------------------------------------------
  // 03 — Déclaration de souscription et de versement du capital
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 03 du dossier de constitution",
    titre: "Déclaration de souscription et de versement du capital social",
    sousTitre: "Établie par le gérant, conformément à l'AUSCGIE",
    corps: [
      p([
        run("Le soussigné, "), phRun("nom complet du gérant"),
        run(", agissant en qualité de gérant de la société "),
        run(NOM_SOCIETE, { bold: true }), run(" en cours de constitution, déclare et atteste ce qui suit :"),
      ]),
      h2("1. Montant du capital social"),
      mixedP([
        run("Le capital social de la société est fixé, conformément à l'article 7 des statuts (pièce 01), à la somme de "),
        phRun("montant total du capital social"), run(", divisé en "), phRun("nombre total de parts sociales"),
        run(" parts sociales de "), phRun("valeur nominale d'une part sociale"), run(" chacune.")
      ]),
      h2("2. Souscription et répartition entre les associés"),
      simpleTable(
        ["Associé", "Nature de l'apport", "Montant souscrit", "Parts attribuées"],
        [
          ["Associé 1 — [à compléter]", "[numéraire / nature — à compléter]", "[montant — à compléter]", "[nombre — à compléter]"],
          ["Associé 2 — [à compléter]", "[numéraire / nature — à compléter]", "[montant — à compléter]", "[nombre — à compléter]"],
        ],
      ),
      h2("3. Versement et mise à disposition des fonds"),
      mixedP([
        run("Les apports en numéraire ci-dessus ont été intégralement libérés et déposés "),
        phRun("auprès de l'établissement bancaire ou du notaire dépositaire, avec référence du compte bloqué le cas échéant"),
        run(", qui en délivrera, sur présentation de la présente déclaration et des statuts, une attestation de dépôt des fonds destinée au dossier d'immatriculation."),
      ]),
      note("Conformément à l'AUSCGIE, les fonds provenant de la libération des apports en numéraire sont déposés, avant signature définitive des statuts ou immédiatement après selon la forme retenue, en banque ou chez un notaire, et ne peuvent être retirés par un mandataire de la société qu'après justification de l'immatriculation de celle-ci au RCCM."),
      h2("4. Apports en nature, le cas échéant"),
      p([
        run("Tout apport en nature est décrit et évalué conformément à l'article 6 des statuts ; le cas échéant, le rapport du commissaire aux apports est annexé à la présente déclaration : "), phRun("référence du rapport du commissaire aux apports, si applicable"),
      ]),
      h2("5. Déclaration sur l'honneur"),
      p("Le gérant soussigné déclare sur l'honneur l'exactitude des informations qui précèdent et s'engage à produire, à première demande du GUCE ou de toute autorité compétente, tout justificatif complémentaire."),
    ],
    signataires: ["Le gérant déclarant"],
    rappel: "Les seuils de capital social minimum, les modalités de libération (intégrale ou partielle à la constitution) et les justificatifs bancaires exigés relèvent de l'AUSCGIE et des pratiques en vigueur auprès des banques de la place ; à confirmer avec le notaire et la banque avant dépôt.",
    outFile: path.join(DIR, "03_Declaration_capital.docx"),
  });

  // ---------------------------------------------------------------
  // 04 — Procès-verbal de l'assemblée générale constitutive
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 04 du dossier de constitution",
    titre: "Procès-verbal de l'assemblée générale constitutive",
    sousTitre: "Nomination du premier gérant et pouvoirs de constitution",
    corps: [
      mixedP([run("L'an "), phRun("année"), run(", le "), phRun("date"), run(", à "), phRun("heure"), run(", les associés fondateurs de la société "), run(NOM_SOCIETE, { bold: true }), run(" désignés au préambule des statuts (pièce 01) se sont réunis "), phRun("lieu de la réunion"), run(" en assemblée générale constitutive.")]),
      p("L'assemblée, après avoir constaté que tous les associés fondateurs étaient présents ou représentés et qu'elle pouvait valablement délibérer, a adopté, à l'unanimité, les résolutions suivantes :"),
      h2("Première résolution — Approbation des statuts"),
      p("L'assemblée approuve, dans toutes leurs dispositions, les statuts de la société tels qu'ils ont été établis et signés par les associés fondateurs (pièce 01 du présent dossier)."),
      h2("Deuxième résolution — Nomination du premier gérant"),
      mixedP([
        run("L'assemblée nomme en qualité de premier gérant de la société, pour la durée fixée à l'article 12 des statuts : "), phRun("nom complet, date et lieu de naissance, domicile et pièce d'identité du gérant"),
        run(", qui accepte expressément ce mandat et déclare n'être frappé d'aucune incapacité ou interdiction d'exercer le commerce ou une fonction de gérant de société commerciale."),
      ]),
      h2("Troisième résolution — Siège social"),
      mixedP([run("L'assemblée confirme la fixation du siège social de la société à l'adresse mentionnée à l'article 4 des statuts, soit : "), phRun("adresse complète du siège social")]),
      h2("Quatrième résolution — Pouvoirs pour les formalités"),
      p("L'assemblée donne tous pouvoirs au gérant nommé ci-dessus, avec faculté de substitution, à l'effet d'accomplir toutes les formalités de constitution de la société, et notamment de déposer le dossier de création auprès du Guichet Unique de Création d'Entreprise (GUCE), de signer tout document y afférent, et de procéder à l'ouverture d'un ou plusieurs comptes bancaires au nom de la société en formation."),
      h2("Cinquième résolution — Frais de constitution"),
      p("L'assemblée décide que les frais, droits et honoraires résultant de la constitution de la société seront supportés par celle-ci, dès son immatriculation, et portés en charges ou en frais d'établissement selon les règles comptables applicables."),
      p("L'ordre du jour étant épuisé, la séance est levée."),
    ],
    signataires: ["Associé 1", "Associé 2", "Gérant nommé (acceptation du mandat)"],
    rappel: "Ce procès-verbal modèle suppose une décision unanime des associés fondateurs ; en cas de désaccord ou de pluralité de candidats à la gérance, les règles de majorité et la procédure de convocation prévues par l'AUSCGIE et par les statuts doivent être respectées et documentées.",
    outFile: path.join(DIR, "04_PV_constitution_gerant.docx"),
  });

  // ---------------------------------------------------------------
  // 05 — Spécimen de signature du gérant
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 05 du dossier de constitution",
    titre: "Spécimen de signature du gérant",
    sousTitre: "Destiné au RCCM, à la banque et aux tiers habilités à vérifier l'identité du signataire",
    corps: [
      p("Le soussigné, agissant en qualité de gérant de la société désignée ci-dessous, reconnaît que la signature apposée au bas du présent document constitue son spécimen officiel de signature, destiné à être produit auprès du Guichet Unique de Création d'Entreprise (GUCE), de l'établissement bancaire teneur du ou des comptes de la société, et de tout tiers habilité à en vérifier l'authenticité."),
      h2("Identité du gérant"),
      champ("Nom et prénoms", "nom complet du gérant"),
      champ("Date et lieu de naissance", "date et lieu de naissance"),
      champ("Nationalité", "nationalité"),
      champ("Domicile", "adresse complète du domicile"),
      champ("Pièce d'identité (type, numéro, date et lieu de délivrance)", "référence complète de la pièce d'identité"),
      champ("Fonction", "gérant"),
      h2("Spécimens de signature"),
      note("Reproduire ci-dessous, en original, trois spécimens identiques de la signature habituelle du gérant, dans l'espace prévu à cet effet sur le document final (zones blanches ci-dessous) :"),
      new (require("docx").Paragraph)({ spacing: { before: 400, after: 400 }, border: { bottom: { style: require("docx").BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } }, children: [run("Spécimen 1 : ", { bold: true })] }),
      new (require("docx").Paragraph)({ spacing: { before: 400, after: 400 }, border: { bottom: { style: require("docx").BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } }, children: [run("Spécimen 2 : ", { bold: true })] }),
      new (require("docx").Paragraph)({ spacing: { before: 400, after: 400 }, border: { bottom: { style: require("docx").BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } }, children: [run("Spécimen 3 : ", { bold: true })] }),
    ],
    signataires: [],
    rappel: "Un spécimen de signature est généralement légalisé par une autorité compétente (notaire, autorité communale) avant son dépôt au GUCE ou à la banque — modalité à confirmer selon les exigences en vigueur au moment du dépôt.",
    outFile: path.join(DIR, "05_Specimen_signature_gerant.docx"),
  });

  // ---------------------------------------------------------------
  // 06 — Mandat spécial de dépôt et de retrait de dossier
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 06 du dossier de constitution",
    titre: "Mandat spécial de dépôt et de retrait de dossier",
    sousTitre: "Habilitant un mandataire à agir auprès du GUCE au nom de la société en formation",
    corps: [
      mixedP([
        run("Le soussigné, "), phRun("nom complet du gérant ou de l'associé mandant"),
        run(", agissant en qualité de gérant (ou d'associé fondateur dûment habilité) de la société "),
        run(NOM_SOCIETE, { bold: true }), run(" en cours de constitution, donne par les présentes mandat spécial à :"),
      ]),
      champ("Nom et prénoms du mandataire", "nom complet du mandataire"),
      champ("Pièce d'identité", "référence complète de la pièce d'identité du mandataire"),
      champ("Domicile", "adresse du mandataire"),
      p("à l'effet de, au nom et pour le compte de la société en formation :"),
      bullet("déposer auprès du Guichet Unique de Création d'Entreprise (GUCE) le dossier complet de demande d'immatriculation de la société, tel que décrit à la pièce 02 du présent dossier ;"),
      bullet("signer, le cas échéant, tout formulaire administratif requis par le GUCE pour l'instruction du dossier ;"),
      bullet("régler, pour le compte de la société, les frais et droits afférents à l'immatriculation ;"),
      bullet("retirer, une fois l'instruction achevée, le certificat d'immatriculation au RCCM, le numéro d'identification nationale et tout autre document délivré par le GUCE au nom de la société ;"),
      bullet(phRun("toute autre formalité spécifiquement autorisée par le mandant — à préciser le cas échéant")),
      mixedP([run("Le présent mandat est consenti à titre gratuit (ou moyennant la rémunération suivante : "), phRun("montant et modalités, le cas échéant"), run(") et prend fin de plein droit à l'achèvement des formalités ci-dessus décrites, ou sur révocation écrite notifiée par le mandant.")]),
    ],
    signataires: ["Le mandant (gérant ou associé habilité)", "Le mandataire (pour acceptation)"],
    rappel: "Ce mandat n'est pas nécessaire si le gérant accomplit lui-même les formalités de dépôt ; il est utile lorsque le dossier est déposé par un tiers (collaborateur, conseil juridique, agent habilité).",
    outFile: path.join(DIR, "06_Mandat_depot.docx"),
  });

  // ---------------------------------------------------------------
  // 07 — Attestation de mise à disposition du siège social
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 07 du dossier de constitution",
    titre: "Attestation de mise à disposition du siège social",
    sousTitre: "Justificatif de jouissance des locaux désignés comme siège social",
    corps: [
      mixedP([
        run("Le soussigné, "), phRun("nom complet du titulaire des droits sur le local — propriétaire ou locataire principal"),
        run(", agissant en qualité de "), phRun("propriétaire / locataire principal / autre qualité à préciser"),
        run(" des locaux sis "), phRun("adresse complète des locaux — identique à l'article 4 des statuts"),
        run(", atteste par la présente mettre ces locaux à la disposition de la société "),
        run(NOM_SOCIETE, { bold: true }), run(" "), run(RESERVE_NOM, { italics: true, size: 18 }),
        run(" en cours de constitution, à titre de siège social."),
      ]),
      h2("Nature du titre d'occupation"),
      mixedP([run("Cette mise à disposition s'effectue au titre de : "), phRun("bail commercial, convention de domiciliation, mise à disposition gratuite entre associés, ou autre — référence et date de l'acte, si distinct de la présente attestation")]),
      h2("Durée"),
      mixedP([run("Cette mise à disposition est consentie pour une durée de "), phRun("durée — alignée, le cas échéant, sur la durée du bail ou de la convention sous-jacente"), run(", renouvelable dans les mêmes conditions sauf dénonciation par l'une des parties.")]),
      h2("Déclaration"),
      p("Le soussigné déclare que les locaux désignés ci-dessus sont libres de toute occupation incompatible avec leur affectation en tant que siège social de la société, et autorise l'usage de son adresse à cette fin dans tous les actes, documents et formalités de constitution et d'immatriculation de la société."),
    ],
    signataires: ["Le titulaire des droits sur le local (attestant)", "Le gérant de la société (pour acceptation)"],
    rappel: "Lorsque le siège social est domicilié chez un tiers (société de domiciliation, cabinet comptable) plutôt que dans des locaux loués ou détenus par la société elle-même, un contrat de domiciliation spécifique, conforme aux exigences du GUCE, doit être produit en lieu et place ou en complément de la présente attestation.",
    outFile: path.join(DIR, "07_Attestation_siege.docx"),
  });

  // ---------------------------------------------------------------
  // 08 — Registre des associés et des bénéficiaires effectifs
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 08 du dossier de constitution",
    titre: "Registre des associés et des bénéficiaires effectifs",
    sousTitre: "Tenu au siège social, conformément à l'AUSCGIE et aux obligations de transparence applicables",
    corps: [
      p("Conformément à l'article 8 des statuts et aux dispositions de l'AUSCGIE relatives à la tenue des registres sociaux, ainsi qu'aux obligations de déclaration des bénéficiaires effectifs applicables en République démocratique du Congo, la société tient le présent registre, mis à jour à chaque mouvement de parts sociales ou changement de contrôle."),
      h2("1. Registre des associés"),
      simpleTable(
        ["Nom / dénomination de l'associé", "Nationalité", "Nombre de parts détenues", "Date d'acquisition"],
        [
          ["[à compléter]", "[à compléter]", "[à compléter]", "[à compléter]"],
          ["[à compléter]", "[à compléter]", "[à compléter]", "[à compléter]"],
        ],
      ),
      note("Une ligne est ajoutée à chaque cession, souscription nouvelle ou autre mouvement affectant la répartition du capital, avec indication de la date et de la référence de l'acte correspondant (cession, augmentation de capital, succession, etc.)."),
      h2("2. Registre des bénéficiaires effectifs"),
      p([
        run("Est réputée bénéficiaire effectif toute personne physique qui, en dernier ressort, possède ou contrôle, directement ou indirectement, la société — notamment par la détention d'une fraction du capital ou des droits de vote dépassant le seuil retenu par la réglementation applicable "),
        phRun("seuil applicable — à vérifier dans la réglementation RDC en vigueur à la date de constitution"),
        run(", ou qui exerce par tout autre moyen un pouvoir de contrôle sur la société ou sur sa direction."),
      ]),
      simpleTable(
        ["Nom et prénoms", "Date et lieu de naissance", "Nationalité", "Nature et étendue du contrôle"],
        [
          ["[à compléter]", "[à compléter]", "[à compléter]", "[ex. : détention directe de X % des parts]"],
        ],
      ),
      h2("3. Mise à jour et conservation"),
      p("Le présent registre est mis à jour par le gérant sans délai après tout événement affectant son contenu, conservé au siège social, et tenu à la disposition des autorités habilitées à le consulter (notamment dans le cadre de la lutte contre le blanchiment de capitaux et le financement du terrorisme), ainsi que des associés, dans les conditions prévues par la loi."),
    ],
    signataires: ["Le gérant (tenue et certification du registre à la date ci-dessous)"],
    rappel: "Le régime précis de déclaration des bénéficiaires effectifs (autorité destinataire, seuils, périodicité) relève de la réglementation congolaise relative à la lutte contre le blanchiment de capitaux ; à vérifier auprès du conseil juridique de la société au moment de la constitution, notamment l'articulation éventuelle avec un registre tenu par la Banque Centrale du Congo pour certains prestataires de services numériques — point non confirmé de manière indépendante à ce jour et à clarifier avant le dépôt du dossier.",
    outFile: path.join(DIR, "08_Registre_associes_beneficiaires.docx"),
  });

  // ---------------------------------------------------------------
  // 09 — Décision relative à l'ouverture des comptes bancaires
  // ---------------------------------------------------------------
  await construireDocument({
    kicker: "Pièce 09 du dossier de constitution",
    titre: "Décision relative à l'ouverture des comptes bancaires",
    sousTitre: "Prise par le gérant au nom de la société",
    corps: [
      mixedP([run("Le gérant de la société "), run(NOM_SOCIETE, { bold: true }), run(", agissant dans le cadre des pouvoirs qui lui sont conférés par l'article 13 des statuts, décide ce qui suit :")]),
      h2("Première décision — Choix de l'établissement bancaire"),
      mixedP([run("Il sera procédé à l'ouverture d'un compte courant au nom de la société auprès de l'établissement bancaire suivant : "), phRun("dénomination de la banque")]),
      note("La société n'intégrant à la date des présentes aucun prestataire de paiement en ligne — le règlement des commandes conclues sur ELEGANZ Market s'effectuant directement entre l'acheteur et le vendeur, en espèces ou par voie de paiement mobile, lors de la livraison — ce compte a vocation à recevoir les seuls flux propres de la société (abonnements, commissions, charges d'exploitation), à l'exclusion de tout fonds appartenant aux boutiques utilisatrices de la plateforme."),
      h2("Deuxième décision — Personnes habilitées à faire fonctionner le compte"),
      mixedP([run("Sont habilités à faire fonctionner seul(s) (ou conjointement, selon le cas) le ou les comptes bancaires de la société : "), phRun("nom(s) et qualité(s) des signataires autorisés")]),
      h2("Troisième décision — Opérations autorisées"),
      bullet("l'encaissement de toute somme due à la société, notamment au titre des abonnements et commissions perçus auprès des boutiques utilisatrices de la plateforme ;"),
      bullet("le règlement des charges d'exploitation, salaires, taxes et impôts, et autres dépenses courantes de la société ;"),
      bullet(phRun("toute autre opération spécifiquement autorisée — à préciser le cas échéant, notamment plafonds ou double signature pour les opérations au-delà d'un certain montant")),
      h2("Quatrième décision — Formalités"),
      p("Tous pouvoirs sont donnés au gérant pour signer la convention d'ouverture de compte, fournir à la banque toute pièce justificative relative à la société (statuts, certificat d'immatriculation au RCCM, numéro d'identification nationale, spécimen de signature) et accomplir toute formalité consécutive à la présente décision."),
    ],
    signataires: ["Le gérant"],
    rappel: "Cette décision est à mettre à jour si la société met en place, à l'avenir, un service de paiement en ligne intégré à la plateforme (nécessitant alors l'intervention d'un prestataire de services de paiement agréé et un compte dédié aux fonds de tiers) — situation qui n'est, à la date du présent document, pas celle de la plateforme ELEGANZ.",
    outFile: path.join(DIR, "09_Decision_ouverture_banque.docx"),
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
