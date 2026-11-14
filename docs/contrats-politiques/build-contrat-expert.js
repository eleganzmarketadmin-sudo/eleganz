const {
  run, h0, h1, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  coverPage, writeDocx, PageBreak, Paragraph,
} = require("./helpers");

const children = [];

// ---- Couverture ----
children.push(...coverPage({
  kicker: "MODÈLE — À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE AVANT USAGE",
  title: "CONTRAT D'ACCÈS EXPERT",
  subtitle1: "ELEGANZ — Confidentialité et responsabilité professionnelle",
  subtitle2: "Entre ELEGANZ et l'Expert accédant, sur invitation, aux données d'une ou plusieurs boutiques",
}));

children.push(calloutBox("Note méthodologique — à lire avant toute utilisation", [
  "Ce document est un modèle prêt à être complété et relu par un conseil juridique, et non un contrat finalisé opposable en l'état.",
  "Aucune donnée réelle concernant ELEGANZ (dénomination exacte, forme juridique, capital, siège, numéro RCCM/identification) n'a été présumée ou inventée : chaque champ de ce type apparaît en rouge italique, entre crochets, avec la mention « à compléter ».",
  "« Expert » désigne ici tout comptable, fiscaliste, juriste ou consultant externe qu'une boutique invite à accéder à son module Finance & Comptabilité et/ou à son dossier de crédit sur la Plateforme. Ce contrat-cadre est conclu entre ELEGANZ et l'Expert lors de son inscription ; il s'applique à chaque invitation reçue d'une boutique, sans qu'un nouveau contrat soit nécessaire à chaque fois.",
  "La clause de droit applicable et de règlement des litiges (article 13) et la durée de l'obligation de confidentialité après la fin de la relation (article 5) doivent impérativement être validées avec un avocat inscrit en République démocratique du Congo avant toute signature.",
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Sommaire ----
children.push(h0("Sommaire"));
[
  "Préambule — Parties et objet",
  "Article 1 — Définitions",
  "Article 2 — Inscription et vérification du profil Expert",
  "Article 3 — Nature et portée de l'accès",
  "Article 4 — Absence de lien de subordination et indépendance professionnelle",
  "Article 5 — Obligation de confidentialité",
  "Article 6 — Protection des données personnelles",
  "Article 7 — Responsabilité professionnelle de l'Expert",
  "Article 8 — Conflits d'intérêts",
  "Article 9 — Usage de la Plateforme",
  "Article 10 — Manquements, suspension et révocation de l'accès",
  "Article 11 — Durée",
  "Article 12 — Limitation de responsabilité d'ELEGANZ",
  "Article 13 — Droit applicable et règlement des différends",
  "Article 14 — Dispositions diverses",
  "Signatures",
].forEach((t) => children.push(bullet(t)));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Préambule ----
children.push(h0("Préambule"));
children.push(p([run("Entre les soussignés :")]));

children.push(new Paragraph({ spacing: { before: 100, after: 60 }, children: [run("ELEGANZ", { bold: true })] }));
[
  ["Dénomination sociale", "dénomination sociale exacte"],
  ["Forme juridique", "forme juridique exacte — SARL, SA, etc."],
  ["Siège social", "adresse complète du siège social"],
  ["Numéro d'identification / RCCM", "numéro RCCM ou équivalent"],
  ["Représentant légal", "nom complet et qualité du représentant"],
].forEach(([label, ph]) => children.push(mixedP([run(label + " : "), phRun(ph)])));
children.push(note("ci-après « ELEGANZ » ou « la Plateforme »,"));

children.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [run("ET L'EXPERT", { bold: true })] }));
[
  ["Nom et prénoms (ou dénomination si cabinet/société)", "identité déclarée par l'Expert lors de son inscription"],
  ["Profession / domaine de compétence", "ex. expert-comptable, fiscaliste, juriste, consultant en gestion"],
  ["Numéro d'inscription à un ordre ou une association professionnelle, s'il y a lieu", "le cas échéant"],
  ["Adresse", "adresse déclarée par l'Expert"],
].forEach(([label, ph]) => children.push(mixedP([run(label + " : "), phRun(ph)])));
children.push(note("ci-après « l'Expert »,"));

children.push(p("ci-après désignés ensemble « les Parties »,"));
children.push(p("Il est préalablement exposé que :"));
children.push(bullet("ELEGANZ exploite une plateforme numérique multi-modules destinée notamment aux boutiques commerçantes, comprenant un module de gestion financière et comptable ainsi qu'un dossier regroupant les informations fiscales et financières de chaque boutique ;"));
children.push(bullet("certaines boutiques souhaitent faire appel à des experts externes — comptables, fiscalistes, juristes ou consultants — pour les accompagner dans l'analyse de leur situation financière, fiscale ou dans la constitution d'un dossier de crédit, et peuvent, à cette fin, les inviter à accéder à leurs données via la Plateforme ;"));
children.push(bullet("l'Expert souhaite s'inscrire sur la Plateforme afin de pouvoir recevoir de telles invitations et y accéder dans les conditions décrites au présent contrat ;"));
children.push(bullet("le présent contrat a pour objet de définir les droits et obligations réciproques des Parties à ce titre, notamment en matière de confidentialité et de responsabilité."));
children.push(p("En conséquence, il a été convenu ce qui suit :"));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Articles ----

children.push(h1("Définitions", 1));
[
  ["Boutique cliente", "toute boutique exploitée sur la Plateforme qui invite l'Expert à accéder à tout ou partie de ses données financières, fiscales ou de son dossier de crédit."],
  ["Invitation", "l'autorisation d'accès accordée par une Boutique cliente à l'Expert depuis son espace de gestion, précisant la portée et pouvant être révoquée à tout moment par la Boutique cliente."],
  ["Données", "l'ensemble des informations financières, fiscales, comptables et commerciales d'une Boutique cliente, ainsi que les données personnelles de ses clients ou employés, auxquelles l'Expert peut avoir accès du fait d'une Invitation."],
  ["Mandat", "la mission de conseil, d'audit ou d'accompagnement confiée par une Boutique cliente à l'Expert, dont les termes sont convenus directement entre l'Expert et la Boutique cliente, indépendamment du présent contrat."],
].forEach(([t, d]) => children.push(mixedP([run(t + " : ", { bold: true }), run(d)])));

children.push(h1("Inscription et vérification du profil expert", 2));
children.push(p("L'Expert s'engage à fournir, lors de son inscription et tout au long de la relation contractuelle, des informations exactes et à jour sur son identité, sa profession et, le cas échéant, son inscription à un ordre ou une association professionnelle."));
children.push(p("ELEGANZ peut demander à l'Expert de justifier des informations déclarées et suspendre ou refuser son inscription en cas de doute sérieux sur leur exactitude, sans que cette vérification n'engage la responsabilité d'ELEGANZ quant à la compétence professionnelle réelle de l'Expert."));

children.push(h1("Nature et portée de l'accès", 3));
children.push(p("L'Expert ne peut accéder aux Données d'une Boutique cliente que dans la mesure et pour la durée définies par l'Invitation correspondante. Une Boutique cliente peut, à tout moment, restreindre ou révoquer l'accès qu'elle a accordé à l'Expert, sans préavis ni justification envers ELEGANZ."));
children.push(p("L'Expert ne doit utiliser les Données auxquelles il accède que dans le cadre du Mandat confié par la Boutique cliente concernée, et pour aucune autre finalité."));

children.push(h1("Absence de lien de subordination et indépendance professionnelle", 4));
children.push(p("L'Expert agit en toute indépendance professionnelle. Il n'est ni salarié, ni mandataire, ni représentant d'ELEGANZ, et le présent contrat ne crée entre les Parties aucun lien de subordination, de société ou de coentreprise."));

children.push(h1("Obligation de confidentialité", 5));
children.push(p("L'Expert s'engage à garder strictement confidentielles l'ensemble des Données auxquelles il accède via la Plateforme, qu'elles concernent la Boutique cliente elle-même, ses dirigeants, ses employés ou ses propres clients, et à ne les divulguer, copier, transmettre ou réutiliser, sous quelque forme que ce soit, en dehors du Mandat qui lui a été confié."));
children.push(mixedP([
  run("Cette obligation de confidentialité demeure applicable après la fin de l'accès accordé par une Invitation ou après la fin du présent contrat, pour une durée de "), phRun("durée de l'obligation post-contractuelle — ex. 5 ans, ou durée indéterminée pour les informations constitutives de secrets d'affaires"),
  run("."),
]));
children.push(p("L'Expert répond de tout manquement à cette obligation commis par ses employés, associés ou sous-traitants auxquels il aurait, le cas échéant et avec l'accord préalable de la Boutique cliente concernée, donné accès aux Données."));

children.push(h1("Protection des données personnelles", 6));
children.push(p("L'Expert ne traite les données personnelles contenues dans les Données que dans la mesure strictement nécessaire à l'exécution du Mandat, et s'engage à mettre en œuvre des mesures de sécurité raisonnables pour en préserver la confidentialité et l'intégrité, et à ne les transmettre à aucun tiers non autorisé par la Boutique cliente concernée."));

children.push(h1("Responsabilité professionnelle de l'expert", 7));
children.push(p("L'Expert est seul responsable, envers la Boutique cliente, de la qualité, de l'exactitude et de la conformité professionnelle des analyses, conseils, déclarations ou documents qu'il produit dans le cadre du Mandat."));
children.push(p("ELEGANZ n'intervient dans la relation entre l'Expert et la Boutique cliente qu'en qualité de fournisseur de l'outil technique permettant l'accès aux Données sur Invitation, et n'endosse à ce titre aucune responsabilité quant au contenu, à la qualité ou aux conséquences des prestations fournies par l'Expert."));

children.push(h1("Conflits d'intérêts", 8));
children.push(p("L'Expert s'engage à informer sans délai une Boutique cliente de toute situation de conflit d'intérêts, réel ou potentiel, qui affecterait son indépendance ou son objectivité dans l'exécution du Mandat qui lui est confié par cette Boutique cliente."));

children.push(h1("Usage de la plateforme", 9));
children.push(p("L'Expert s'engage à utiliser les fonctionnalités de la Plateforme conformément à leur destination, à ne pas tenter de contourner les mesures de sécurité ou les limitations d'accès définies par une Invitation, et à ne pas extraire ou exploiter les Données au-delà de ce qui est nécessaire à l'exécution du Mandat."));

children.push(h1("Manquements, suspension et révocation de l'accès", 10));
children.push(p("En cas de manquement à l'une des obligations du présent contrat — notamment en cas d'atteinte à la confidentialité, d'usage frauduleux de la Plateforme, ou de réclamation fondée d'une Boutique cliente — ELEGANZ peut, après notification à l'Expert précisant le motif, suspendre ou révoquer son accès à tout ou partie des Boutiques clientes, voire supprimer son inscription sur la Plateforme en cas de manquement grave."));
children.push(p("Cette mesure est sans préjudice du droit de la Boutique cliente concernée, ou d'ELEGANZ, de demander réparation du préjudice résultant du manquement."));

children.push(h1("Durée", 11));
children.push(p("Le présent contrat-cadre prend effet à la date d'inscription de l'Expert sur la Plateforme et demeure en vigueur, pour l'ensemble des Invitations reçues ou à recevoir, jusqu'à sa résiliation par l'une des Parties ou jusqu'à la suppression de l'inscription de l'Expert dans les conditions de l'article 10."));
children.push(p("La résiliation du présent contrat n'affecte pas les obligations de confidentialité souscrites à l'article 5, qui demeurent applicables pour la durée y précisée."));

children.push(h1("Limitation de responsabilité d'ELEGANZ", 12));
children.push(mixedP([
  run("La responsabilité d'ELEGANZ au titre du présent contrat, si elle est retenue, est limitée dans les conditions suivantes : "), phRun("plafond et modalités de limitation de responsabilité à définir avec un conseil juridique"),
  run("."),
]));

children.push(h1("Droit applicable et règlement des différends", 13));
children.push(mixedP([
  run("Le présent contrat est soumis au droit "), phRun("droit applicable — à confirmer, en principe le droit de la République démocratique du Congo"),
  run(". Tout différend relatif à sa formation, son exécution ou son interprétation sera soumis, à défaut de résolution amiable, à "), phRun("juridiction ou mode de règlement des litiges compétent"),
  run("."),
]));

children.push(h1("Dispositions diverses", 14));
children.push(p("Le présent contrat et les politiques générales et le règlement d'utilisation de la Plateforme forment l'intégralité de l'accord entre les Parties relatif à l'inscription et à l'accès de l'Expert, à l'exclusion des termes du Mandat convenu séparément entre l'Expert et chaque Boutique cliente."));
children.push(p("Si une clause du présent contrat est jugée invalide, les autres clauses demeurent applicables."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Signatures ----
children.push(h0("Fait et signé"));
children.push(mixedP([
  run("Fait à "), phRun("lieu de signature"),
  run(", le "), phRun("date de signature"),
  run(", en deux exemplaires originaux."),
]));

signatureBlock("Pour ELEGANZ").forEach((x) => children.push(x));
signatureBlock("Pour l'Expert").forEach((x) => children.push(x));

children.push(calloutBox("Rappel", [
  "Ce document ne devient opposable qu'après relecture complète, complétion de l'ensemble des champs signalés et validation par un conseil juridique, en particulier pour la durée de l'obligation de confidentialité post-contractuelle (article 5) et pour la clause de droit applicable (article 13).",
]));

writeDocx(children, __dirname + "/ELEGANZ-Contrat-Expert-Modele.docx");
