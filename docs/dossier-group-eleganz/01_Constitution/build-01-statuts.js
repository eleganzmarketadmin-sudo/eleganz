// 01 — Statuts de GROUP ELEGANZ SARL — version améliorée.
// Reprend la structure du modèle de statuts déjà produit pour ce projet
// (docs/statuts/build.js, 24 articles) et l'enrichit avec :
//  - un objet social spécifique et à jour, listant les modules réels de la
//    plateforme (Market, Gestion, Livreur, Mon assistant, Experts,
//    Institutions, Centre de pilotage) au lieu d'une description générique ;
//  - deux articles supplémentaires repris du dossier source de l'utilisateur
//    (Propriété intellectuelle, Confidentialité et sécurité des données),
//    absents du modèle initial ;
//  - une note de conformité sur le régime d'autorisation numérique RDC
//    (arrêtés n°004 et n°005 du 11 mars 2026), développé en détail dans le
//    document 15 du dossier.
// Toute donnée réelle (associés, capital, siège, dates) reste un placeholder
// rouge italique — rien n'est inventé.
const {
  run, h0, h1, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  writeDocx, PageBreak, Paragraph, logoParagraph,
} = require("../helpers.js");
const { NOM_SOCIETE, RESERVE_NOM } = require("../shared.js");

const children = [];

// ---- Couverture ----
children.push(
  logoParagraph(64, { spacing: { after: 160 } }),
  new Paragraph({ spacing: { after: 80 }, children: [run("MODÈLE DE TRAVAIL — À FINALISER AVEC UN NOTAIRE", { bold: true, color: "B23A48", size: 18 })] }),
  new Paragraph({ spacing: { before: 120, after: 80 }, children: [run("STATUTS DE LA SOCIÉTÉ", { font: "Cambria", bold: true, size: 40 })] }),
  new Paragraph({ spacing: { after: 40 }, children: [run(NOM_SOCIETE, { bold: true, size: 28, color: "17408A" })] }),
  new Paragraph({ spacing: { after: 200 }, children: [run(RESERVE_NOM, { italics: true, size: 19, color: "565A65" })] }),
  new Paragraph({ spacing: { after: 40 }, children: [run("Société à responsabilité limitée (SARL) de droit congolais", { bold: true, size: 24, color: "17408A" })] }),
  new Paragraph({ spacing: { after: 300 }, children: [run("soumise à l'Acte uniforme OHADA relatif au droit des sociétés commerciales et du groupement d'intérêt économique (AUSCGIE)", { italics: true, size: 20, color: "565A65" })] }),
);

children.push(calloutBox("Note méthodologique — à lire avant toute utilisation", [
  "Ce document est une version révisée du modèle de statuts déjà produit pour ce projet, adaptée par le développeur et co-concepteur de la plateforme ELEGANZ pour refléter fidèlement les modules réellement exploités (marketplace, gestion commerciale, livraison, assistant, experts, institutions financières partenaires, administration) et non plus une description générique d'activité numérique.",
  "Aucune donnée réelle de l'entreprise (dénomination définitive, capital, apports, identité des associés, adresse du siège, répartition des parts) n'a été présumée ou inventée : chaque champ de ce type apparaît en rouge italique, entre crochets, avec la mention « à compléter ». La dénomination « GROUP ELEGANZ SARL » reprise dans ce document est une proposition de travail, à confirmer par une recherche de disponibilité au Guichet Unique de Création d'Entreprise (GUCE).",
  "La rédaction définitive, la vérification de la conformité à l'AUSCGIE et aux textes nationaux en vigueur, ainsi que les formalités de signature, d'enregistrement et de publicité (RCCM, greffe, journal officiel) doivent impérativement être réalisées avec un notaire inscrit en République démocratique du Congo.",
]));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Sommaire ----
children.push(h0("Sommaire"));
[
  "Préambule — Identification des associés fondateurs",
  "Article 1 — Forme",
  "Article 2 — Objet social",
  "Article 3 — Dénomination sociale",
  "Article 4 — Siège social",
  "Article 5 — Durée",
  "Article 6 — Apports",
  "Article 7 — Capital social",
  "Article 8 — Parts sociales",
  "Article 9 — Droits et obligations attachés aux parts sociales",
  "Article 10 — Cession et transmission des parts sociales",
  "Article 11 — Décès, incapacité, interdiction ou faillite d'un associé",
  "Article 12 — Gérance",
  "Article 13 — Pouvoirs du ou des gérants",
  "Article 14 — Conventions entre la société et un gérant ou un associé",
  "Article 15 — Propriété intellectuelle",
  "Article 16 — Confidentialité et sécurité des données",
  "Article 17 — Décisions collectives des associés",
  "Article 18 — Décisions collectives ordinaires",
  "Article 19 — Décisions collectives extraordinaires",
  "Article 20 — Exercice social et comptes annuels",
  "Article 21 — Affectation et répartition des résultats",
  "Article 22 — Capitaux propres inférieurs à la moitié du capital social",
  "Article 23 — Transformation de la société",
  "Article 24 — Dissolution et liquidation",
  "Article 25 — Contestations",
  "Article 26 — Formalités et pouvoirs",
  "Signatures des associés fondateurs",
].forEach((t) => children.push(bullet(t)));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Préambule ----
children.push(h0("Préambule"));
children.push(p([run("Les soussignés :")]));
["Associé 1", "Associé 2"].forEach((label) => {
  children.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: [run(label, { bold: true })] }));
  ["Nom et prénoms (ou dénomination sociale si l'associé est une personne morale)", "Nationalité", "Date et lieu de naissance (ou numéro RCCM si personne morale)", "Profession", "Domicile ou siège social", "Pièce d'identité (type et numéro)"].forEach((f) => {
    children.push(mixedP([run(f + " : "), phRun(f.split(" (")[0].toLowerCase())]));
  });
});
children.push(note("Dupliquer le bloc « Associé » ci-dessus autant de fois que nécessaire si la société compte plus de deux associés fondateurs. Une SARL de droit OHADA peut être unipersonnelle (un seul associé) ou pluripersonnelle."));
children.push(p([
  run("ont établi ainsi qu'il suit les statuts d'une société à responsabilité limitée devant exister entre eux (ou, le cas échéant, entre l'associé unique désigné ci-dessus), et "),
  run("entre toute personne qui viendrait ultérieurement à détenir des parts sociales créées ci-après.", { italics: true }),
]));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Articles ----
children.push(h1("Forme", 1));
children.push(p("Il est formé entre les propriétaires des parts sociales ci-après créées et de celles qui pourraient l'être ultérieurement, une société à responsabilité limitée régie par l'Acte uniforme de l'OHADA relatif au droit des sociétés commerciales et du groupement d'intérêt économique (AUSCGIE), par les lois en vigueur en République démocratique du Congo relatives aux sociétés commerciales, et par les présents statuts."));

children.push(h1("Objet social", 2));
children.push(p("La société a pour objet, tant en République démocratique du Congo qu'à l'étranger, la conception, l'édition, l'acquisition, l'hébergement, la maintenance et la commercialisation de logiciels, plateformes et applications numériques, et notamment l'exploitation de la plateforme ELEGANZ, composée à la date des présentes des modules suivants :"));
children.push(bullet([run("ELEGANZ Market — ", { bold: true }), run("une place de marché électronique (marketplace) permettant à des boutiques (vendeurs) de présenter et vendre leurs produits à des acheteurs, le règlement des commandes s'effectuant directement entre l'acheteur et le vendeur, en espèces ou par voie de paiement mobile, lors de la livraison ou du retrait, sans encaissement ni détention de fonds par la société ;")]));
children.push(bullet([run("ELEGANZ Gestion — ", { bold: true }), run("une offre logicielle en mode SaaS (Software as a Service) destinée aux commerçants pour la gestion de caisse, des stocks, de la facturation, des équipes et des données financières de leur activité ;")]));
children.push(bullet([run("ELEGANZ Livreur — ", { bold: true }), run("un module permettant à chaque boutique de créer, organiser et gérer son propre réseau de livreurs pour l'exécution des livraisons de ses commandes, sous sa seule responsabilité ;")]));
children.push(bullet([run("ELEGANZ Mon assistant — ", { bold: true }), run("un assistant numérique d'aide à l'utilisation de la plateforme et à la gestion courante de l'activité des utilisateurs ;")]));
children.push(bullet([run("Espace Experts — ", { bold: true }), run("un module permettant à des boutiques d'inviter des consultants ou prestataires externes (experts) à accéder, de façon limitée et révocable, à certaines données de leur activité ;")]));
children.push(bullet([run("Espace Institutions — ", { bold: true }), run("un module de mise en relation avec des institutions financières partenaires, notamment dans le cadre de demandes de financement ou de dossiers de crédit ;")]));
children.push(bullet([run("Centre de pilotage — ", { bold: true }), run("les outils d'administration et de supervision de la plateforme par la société.")]));
children.push(p("ainsi que, plus généralement, toute activité numérique connexe ou complémentaire à celles qui précèdent, et toutes opérations commerciales, financières, mobilières ou immobilières se rattachant directement ou indirectement à cet objet ou susceptibles d'en favoriser le développement."));
children.push(note("Certaines des activités ci-dessus, notamment l'exploitation d'une place de marché électronique, sont susceptibles de relever du régime d'autorisation préalable ou de déclaration applicable aux services numériques en République démocratique du Congo (arrêtés ministériels n°004 et n°005 du 11 mars 2026 pris en application du Code du numérique, et leur arrêté d'application du 20 juillet 2026 fixant les redevances). Ce point, développé au document 15 du présent dossier, doit être traité sans délai : la période transitoire fixée par ces textes a pris fin le 30 juin 2026."));

children.push(h1("Dénomination sociale", 3));
children.push(mixedP([run("La société a pour dénomination sociale : "), run(NOM_SOCIETE, { bold: true }), run(" "), run(RESERVE_NOM, { italics: true, size: 18, color: "565A65" }), run(".")]));
children.push(p("Dans tous les actes, factures, annonces, correspondances et autres documents émanant de la société, la dénomination sociale doit toujours être précédée ou suivie immédiatement des mots « Société à responsabilité limitée » ou du sigle « SARL », ainsi que de l'énonciation du montant du capital social, de l'adresse du siège social et du numéro d'immatriculation au registre du commerce et du crédit mobilier (RCCM)."));

children.push(h1("Siège social", 4));
children.push(mixedP([run("Le siège social est fixé à : "), phRun("adresse complète du siège social — ville, commune, avenue, numéro")]));
children.push(p("Il peut être transféré en tout autre lieu par décision collective extraordinaire des associés, dans les conditions prévues à l'article 19 des présents statuts, et, à l'intérieur de la même ville, par simple décision du ou des gérants, sous réserve de ratification par la plus prochaine décision collective ordinaire."));

children.push(h1("Durée", 5));
children.push(mixedP([run("La durée de la société est fixée à "), phRun("durée — ex. 99 ans"), run(" années à compter de son immatriculation au registre du commerce et du crédit mobilier, sauf les cas de dissolution anticipée ou de prorogation prévus aux présents statuts.")]));

children.push(h1("Apports", 6));
children.push(p("Les associés fondateurs désignés au préambule font à la société les apports suivants :"));
["Associé 1", "Associé 2"].forEach((label) => {
  children.push(new Paragraph({ spacing: { before: 80, after: 60 }, children: [run(label + " :", { bold: true })] }));
  children.push(mixedP([run("Nature de l'apport (numéraire / nature / industrie) : "), phRun("nature de l'apport")]));
  children.push(mixedP([run("Valeur de l'apport : "), phRun("montant en CDF et/ou USD")]));
});
children.push(note("Un apport en nature doit faire l'objet d'une évaluation conforme à l'AUSCGIE (le cas échéant, intervention d'un commissaire aux apports selon les seuils en vigueur) ; un apport en numéraire doit être intégralement libéré ou, à défaut, l'échéancier de libération précisé — point à valider avec le notaire. Un apport en nature peut inclure, le cas échéant, les développements logiciels existants de la plateforme : voir à ce sujet le document 13 (Cession de propriété intellectuelle) du dossier des contrats numériques."));

children.push(h1("Capital social", 7));
children.push(mixedP([
  run("Le capital social est fixé à la somme de "), phRun("montant total du capital social"),
  run(", divisé en "), phRun("nombre total de parts sociales"),
  run(" parts sociales de "), phRun("valeur nominale d'une part sociale"),
  run(" chacune, numérotées de 1 à "), phRun("nombre total de parts sociales"),
  run(", intégralement souscrites et réparties entre les associés en proportion de leurs apports respectifs tels que décrits à l'article 6, savoir :"),
]));
children.push(bullet([run("Associé 1 : "), phRun("nombre de parts attribuées"), run(" parts")]));
children.push(bullet([run("Associé 2 : "), phRun("nombre de parts attribuées"), run(" parts")]));
children.push(note("Le capital social minimum et les modalités de libération applicables à la SARL relèvent de l'AUSCGIE et des textes nationaux en vigueur à la date de constitution — montant à confirmer avec le notaire. Ce montant est distinct des redevances d'autorisation numérique mentionnées à l'article 2."));

children.push(h1("Parts sociales", 8));
children.push(p("Les parts sociales ne peuvent être représentées par des titres négociables. Les droits de chaque associé dans la société résultent seulement des présents statuts, des actes ultérieurs qui pourraient modifier le capital social, et des cessions ou mutations qui viendraient à être régulièrement consenties ou constatées."));
children.push(p("Un registre des mouvements de titres ainsi qu'un registre des associés et des bénéficiaires effectifs sont tenus au siège social dans les conditions prévues par l'AUSCGIE (voir également le document 08 du présent dossier)."));

children.push(h1("Droits et obligations attachés aux parts sociales", 9));
children.push(p("Chaque part sociale donne droit à une fraction proportionnelle au nombre de parts existantes de la propriété de l'actif social, des bénéfices et du boni de liquidation. Elle donne également droit de participer aux décisions collectives des associés et d'y voter, dans les conditions fixées par les présents statuts et par l'AUSCGIE."));
children.push(p("Les associés ne supportent les pertes qu'à concurrence de leurs apports ; au-delà, tout appel de fonds est interdit."));

children.push(h1("Cession et transmission des parts sociales", 10));
children.push(p("Les parts sociales sont librement cessibles entre associés. Elles ne peuvent être cédées à des tiers étrangers à la société qu'avec le consentement de la majorité des associés représentant au moins les trois quarts des parts sociales, selon la procédure d'agrément prévue par l'AUSCGIE."));
children.push(p("Toute cession doit être constatée par écrit. Elle n'est opposable à la société qu'après signification à celle-ci, ou acceptation par elle dans un acte authentique, et n'est opposable aux tiers qu'après accomplissement, en outre, des formalités de dépôt au greffe et de publicité au registre du commerce et du crédit mobilier."));
children.push(note("Dans la mesure où les autorisations administratives visées à l'article 2 sont personnelles et doivent être révisées en cas de changement de majorité du capital ou de contrôle de la société, toute cession significative de parts doit être anticipée avec le conseil juridique de la société au regard de ces autorisations."));

children.push(h1("Décès, incapacité, interdiction ou faillite d'un associé", 11));
children.push(p("La société n'est pas dissoute par le décès, l'interdiction, la faillite personnelle ou l'incapacité de l'un quelconque des associés. En cas de décès d'un associé, la société continue entre les associés survivants et les héritiers ou ayants droit de l'associé décédé, sous réserve, le cas échéant, de la procédure d'agrément prévue à l'article 10 lorsque celle-ci est applicable aux transmissions par décès selon les présents statuts."));

children.push(h1("Gérance", 12));
children.push(mixedP([
  run("La société est gérée et administrée par un ou plusieurs gérants, personnes physiques, associés ou non, nommés par décision collective ordinaire des associés pour une durée de "), phRun("durée du mandat"),
  run(", renouvelable."),
]));
children.push(mixedP([run("Est nommé premier gérant de la société : "), phRun("nom complet et identité du premier gérant")]));
children.push(p("Le ou les gérants sont révocables par décision collective ordinaire des associés, dans les conditions prévues par l'AUSCGIE."));

children.push(h1("Pouvoirs du ou des gérants", 13));
children.push(p("Dans les rapports avec les tiers, le gérant est investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société, sous réserve des pouvoirs que l'AUSCGIE attribue expressément aux associés."));
children.push(p("Dans les rapports entre associés, le gérant peut accomplir tous les actes de gestion que commande l'intérêt de la société, sous réserve des limitations suivantes, qui ne sont pas opposables aux tiers :"));
children.push(bullet(phRun("liste des actes soumis à autorisation préalable des associés — ex. emprunts au-delà d'un certain montant, cautions, acquisitions ou cessions d'actifs significatifs, dépôt de toute demande d'autorisation ou de déclaration auprès de l'ARPTC ou du ministère compétent")));

children.push(h1("Conventions entre la société et un gérant ou un associé", 14));
children.push(p("Toute convention intervenant directement ou par personne interposée entre la société et l'un de ses gérants ou associés doit être soumise au contrôle des associés dans les conditions prévues par l'AUSCGIE relatives aux conventions réglementées. Les conventions portant sur des opérations courantes conclues à des conditions normales sont dispensées de cette procédure."));

children.push(h1("Propriété intellectuelle", 15));
children.push(p("La société est seule titulaire, ou dispose des droits d'usage nécessaires, sur l'ensemble des éléments constitutifs de la plateforme ELEGANZ et de ses différents modules (codes sources, bases de données, interfaces, marques, dénominations commerciales, documentation technique et contractuelle, et tout développement futur), qu'ils aient été créés par ses dirigeants, ses salariés, des prestataires ou des experts tiers dans l'exercice de leurs fonctions ou missions pour la société."));
children.push(p("Tout apport de développements logiciels préexistants par un associé fondateur fait l'objet d'un acte de cession de propriété intellectuelle distinct, conforme au document 13 du dossier des contrats numériques, précisant l'étendue des droits cédés et leur valorisation éventuelle au titre des apports visés à l'article 6."));
children.push(p("Les associés s'engagent à ne faire aucun usage personnel des éléments de propriété intellectuelle de la société, et à ne divulguer à aucun tiers, pendant la durée de leur qualité d'associé et après la cessation de celle-ci, les codes sources, méthodes, savoir-faire technique ou commercial de la société, sauf accord écrit préalable de la gérance."));

children.push(h1("Confidentialité et sécurité des données", 16));
children.push(p("La société collecte et traite, dans le cadre de l'exploitation de la plateforme ELEGANZ, des données à caractère personnel et des données commerciales relatives à ses utilisateurs (boutiques, acheteurs, livreurs, experts, institutions partenaires). Les gérants et associés veillent à ce que ce traitement soit entouré des garanties de confidentialité et de sécurité appropriées, conformément à la politique de confidentialité de la société (document 12 du dossier des contrats numériques) et aux textes applicables en République démocratique du Congo."));
children.push(p("Les associés et le ou les gérants s'engagent à préserver la confidentialité des informations sensibles de la société (données financières, technologiques, commerciales et relatives aux utilisateurs) dont ils auraient connaissance du fait de leurs fonctions, pendant la durée de la société et après leur sortie."));

children.push(h1("Décisions collectives des associés", 17));
children.push(p("Les décisions collectives sont prises, au choix de la gérance, en assemblée ou par consultation écrite des associés, sauf dans les cas où la loi impose la tenue d'une assemblée. Chaque associé a le droit de participer aux décisions et dispose d'un nombre de voix égal au nombre de parts sociales qu'il possède."));
children.push(p("L'assemblée est convoquée par le gérant ou, à défaut, par le commissaire aux comptes s'il en existe un, ou par un mandataire désigné par la juridiction compétente à la demande de tout associé."));

children.push(h1("Décisions collectives ordinaires", 18));
children.push(p("L'assemblée générale ordinaire est appelée à prendre toutes les décisions qui ne modifient pas les statuts, et notamment à statuer chaque année sur les comptes de l'exercice écoulé, à nommer et révoquer le ou les gérants, et à statuer sur toute question qui n'entraîne pas modification des statuts."));
children.push(mixedP([run("Les décisions collectives ordinaires ne sont valablement prises que si elles sont adoptées par un ou plusieurs associés représentant plus de la moitié du capital social, ou, le cas échéant, toute majorité différente conforme à l'AUSCGIE et retenue par les associés : "), phRun("majorité retenue, si différente du droit commun")]));

children.push(h1("Décisions collectives extraordinaires", 19));
children.push(p("L'assemblée générale extraordinaire est seule habilitée à modifier les statuts dans toutes leurs dispositions ; elle ne peut toutefois augmenter les engagements des associés, sous réserve des opérations résultant d'un regroupement de parts sociales régulièrement décidé et exécuté."));
children.push(mixedP([run("Les décisions collectives extraordinaires ne sont valablement prises que si elles sont adoptées par des associés représentant au moins les trois quarts du capital social, ou toute majorité différente conforme à l'AUSCGIE et retenue par les associés : "), phRun("majorité retenue, si différente du droit commun")]));

children.push(h1("Exercice social et comptes annuels", 20));
children.push(mixedP([run("L'exercice social commence le "), phRun("date d'ouverture — ex. 1er janvier"), run(" et se termine le "), phRun("date de clôture — ex. 31 décembre"), run(" de chaque année.")]));
children.push(p("À la clôture de chaque exercice, la gérance dresse l'inventaire, les états financiers de synthèse et établit un rapport de gestion écrit sur la situation de la société durant l'exercice écoulé, conformément à l'AUSCGIE et au système comptable OHADA (SYSCOHADA)."));

children.push(h1("Affectation et répartition des résultats", 21));
children.push(p("Sur le bénéfice de l'exercice diminué, le cas échéant, des pertes antérieures, il est prélevé cinq pour cent (5 %) au moins pour constituer le fonds de réserve légale, jusqu'à ce que celle-ci atteigne le dixième du capital social, conformément à l'AUSCGIE."));
children.push(p("Le bénéfice distribuable est constitué par le bénéfice de l'exercice diminué des pertes antérieures et des sommes portées en réserve en application de la loi ou des statuts, et augmenté du report bénéficiaire. Il est réparti entre tous les associés proportionnellement au nombre de parts sociales appartenant à chacun d'eux, sauf décision contraire des associés statuant en assemblée générale ordinaire."));

children.push(h1("Capitaux propres inférieurs à la moitié du capital social", 22));
children.push(p("Si, du fait de pertes constatées dans les états financiers de synthèse, les capitaux propres de la société deviennent inférieurs à la moitié du capital social, la gérance doit, dans les conditions et délais fixés par l'AUSCGIE, consulter les associés sur l'opportunité de prononcer la dissolution anticipée de la société."));

children.push(h1("Transformation de la société", 23));
children.push(p("La société peut se transformer en société d'une autre forme si, au moment de la transformation, elle a au moins deux ans d'existence et si elle a établi et fait approuver par les associés les états financiers de synthèse de ses deux premiers exercices, et sous réserve de la réunion des conditions propres à la forme nouvelle adoptée. La décision de transformation est prise dans les conditions prévues pour les décisions collectives extraordinaires."));

children.push(h1("Dissolution et liquidation", 24));
children.push(p("Hors les cas de dissolution judiciaire prévus par l'AUSCGIE, la dissolution anticipée de la société peut être décidée par les associés statuant en décision collective extraordinaire."));
children.push(p("La société est en liquidation dès l'instant de sa dissolution, pour quelque cause que ce soit. Sa dénomination sociale doit alors être suivie de la mention « société en liquidation ». Un ou plusieurs liquidateurs sont alors nommés par décision collective des associés, conformément à l'AUSCGIE."));

children.push(h1("Contestations", 25));
children.push(p("Toutes les contestations qui pourraient s'élever pendant la durée de la société, ou après sa dissolution pendant le cours des opérations de liquidation, soit entre les associés et la société, soit entre les associés eux-mêmes, relativement aux affaires sociales, seront soumises à la juridiction compétente du siège social, conformément aux règles de droit commun applicables en République démocratique du Congo."));

children.push(h1("Formalités et pouvoirs", 26));
children.push(p("Tous pouvoirs sont donnés au porteur d'un original, d'une copie ou d'un extrait des présentes, pour accomplir toutes les formalités de dépôt, d'immatriculation, d'enregistrement et de publicité légale prévues par l'AUSCGIE et par les textes en vigueur en République démocratique du Congo, en ce compris les démarches auprès du Guichet Unique de Création d'Entreprise (GUCE) et, le cas échéant, auprès de l'ARPTC et du ministère ayant l'économie numérique dans ses attributions."));

children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h0("Fait et signé"));
children.push(mixedP([
  run("Fait à "), phRun("lieu de signature"),
  run(", le "), phRun("date de signature"),
  run(", en "), phRun("nombre d'exemplaires originaux"),
  run(" exemplaires originaux."),
]));
children.push(note("Le nombre d'exemplaires originaux et la nature de l'acte (acte notarié, ou acte sous seing privé avec légalisation des signatures) sont déterminés avec le notaire en fonction des exigences applicables à la société et des formalités de dépôt requises."));
signatureBlock("Associé 1").forEach((x) => children.push(x));
signatureBlock("Associé 2").forEach((x) => children.push(x));
signatureBlock("Gérant (si distinct des associés ci-dessus)").forEach((x) => children.push(x));

children.push(calloutBox("Rappel", [
  "Ce document ne devient un acte juridique opposable qu'après relecture, complétion de l'ensemble des champs signalés, et validation par un notaire ou un avocat inscrit en République démocratique du Congo, suivie des formalités légales de dépôt et de publicité (RCCM, greffe).",
]));

writeDocx(children, __dirname + "/01_Statuts_GROUP_ELEGANZ_SARL.docx");
