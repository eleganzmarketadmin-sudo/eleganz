const {
  run, h0, h1, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  coverPage, writeDocx, PageBreak, Paragraph,
} = require("./helpers");

const children = [];

// ---- Couverture ----
children.push(...coverPage({
  kicker: "MODÈLE — À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE AVANT USAGE",
  title: "CONTRAT D'ADHÉSION VENDEUR",
  subtitle1: "ELEGANZ Market — Conditions applicables à chaque boutique",
  subtitle2: "Entre ELEGANZ et le Vendeur titulaire d'une boutique sur la Plateforme",
}));

children.push(calloutBox("Note méthodologique — à lire avant toute utilisation", [
  "Ce document est un modèle prêt à être complété et relu par un conseil juridique, et non un contrat finalisé opposable en l'état.",
  "Aucune donnée réelle concernant ELEGANZ (dénomination exacte, forme juridique, capital, siège, numéro RCCM/identification) n'a été présumée ou inventée : chaque champ de ce type apparaît en rouge italique, entre crochets, avec la mention « à compléter ».",
  "Les clauses reflètent le fonctionnement réel de la Plateforme à la date de rédaction (règlement à la livraison, absence d'intégration de paiement en ligne, livreurs créés et gérés par chaque boutique, facture normalisée auto-déclarée ou homologuée DGI) — à mettre à jour si ces mécanismes évoluent.",
  "La clause de droit applicable et de règlement des litiges (article 20) doit impérativement être validée avec un avocat inscrit en République démocratique du Congo avant toute signature.",
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Sommaire ----
children.push(h0("Sommaire"));
[
  "Préambule — Parties et objet",
  "Article 1 — Définitions",
  "Article 2 — Inscription, vérification et activation de la boutique",
  "Article 3 — Obligations du Vendeur relatives aux produits",
  "Article 4 — Traitement des commandes",
  "Article 5 — Livraison et responsabilité sur les livreurs de la boutique",
  "Article 6 — Règlement des commandes et absence d'intermédiation financière",
  "Article 7 — Retours, remboursements et garanties envers l'acheteur",
  "Article 8 — Facturation et conformité fiscale",
  "Article 9 — Abonnement, commission et frais de la Plateforme",
  "Article 10 — Propriété intellectuelle",
  "Article 11 — Données personnelles des acheteurs",
  "Article 12 — Confidentialité",
  "Article 13 — Avis, réputation et litiges avec les acheteurs",
  "Article 14 — Manquements et sanctions",
  "Article 15 — Suspension de la boutique",
  "Article 16 — Suppression de la boutique par ELEGANZ",
  "Article 17 — Fermeture de la boutique par le Vendeur",
  "Article 18 — Durée et renouvellement",
  "Article 19 — Limitation de responsabilité d'ELEGANZ",
  "Article 20 — Droit applicable et règlement des différends",
  "Article 21 — Dispositions diverses",
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

children.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [run("ET LE VENDEUR", { bold: true })] }));
[
  ["Nom de la boutique", "nom commercial de la boutique sur la Plateforme"],
  ["Dénomination/forme juridique du Vendeur (ou nom et pièce d'identité si personne physique)", "selon le statut déclaré par le Vendeur lors de son inscription"],
  ["Adresse", "adresse déclarée par le Vendeur"],
  ["Représentant", "nom complet de la personne agissant pour la boutique"],
].forEach(([label, ph]) => children.push(mixedP([run(label + " : "), phRun(ph)])));
children.push(note("ci-après « le Vendeur » ou « la Boutique »,"));

children.push(p("ci-après désignés ensemble « les Parties »,"));
children.push(p("Il est préalablement exposé que :"));
children.push(bullet("ELEGANZ exploite une plateforme numérique multi-modules (ci-après « la Plateforme »), comprenant notamment un espace de gestion commerciale pour les boutiques (« ELEGANZ Gestion »), une place de marché en ligne ouverte au public (« ELEGANZ Market » ou « le Marketplace »), un module de gestion des livraisons, un module de comptabilité et un module d'accès pour des experts externes ;"));
children.push(bullet("le Vendeur souhaite créer et exploiter une boutique sur la Plateforme afin d'y proposer la vente de ses produits, dans les conditions décrites au présent contrat ;"));
children.push(bullet("le présent contrat a pour objet de définir les droits et obligations réciproques des Parties à ce titre."));
children.push(p("En conséquence, il a été convenu ce qui suit :"));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- Articles ----

children.push(h1("Définitions", 1));
[
  ["Boutique", "l'espace commercial créé par le Vendeur sur la Plateforme, à travers lequel il gère son catalogue, ses commandes, sa caisse et ses documents de vente."],
  ["Marketplace", "la vitrine publique de la Plateforme sur laquelle les produits actifs de la Boutique sont visibles par les acheteurs."],
  ["Acheteur", "toute personne physique ou morale qui commande un produit auprès de la Boutique via le Marketplace."],
  ["Livreur", "toute personne que le Vendeur crée, enregistre ou habilite sur la Plateforme pour effectuer, pour son compte, la livraison des commandes de sa Boutique."],
  ["Bouquet", "la formule d'abonnement souscrite par le Vendeur, déterminant les fonctionnalités disponibles et les conditions tarifaires applicables à sa Boutique."],
  ["Document de vente", "tout ticket, reçu, bon de livraison ou facture émis depuis la Boutique à l'occasion d'une vente."],
  ["Facture normalisée", "le document de vente répondant au format réglementaire congolais applicable aux factures certifiées par la Direction Générale des Impôts (DGI), tel que décrit à l'article 8."],
].forEach(([t, d]) => children.push(mixedP([run(t + " : ", { bold: true }), run(d)])));

children.push(h1("Inscription, vérification et activation de la boutique", 2));
children.push(p("Le Vendeur s'engage à fournir, lors de la création de sa Boutique et tout au long de la relation contractuelle, des informations exactes, complètes et à jour, notamment son identité, ses coordonnées, et — dans les conditions de l'article 8 — son identité fiscale et juridique."));
children.push(p("ELEGANZ peut, à tout moment, demander au Vendeur de justifier des informations déclarées et suspendre l'activation ou la visibilité de la Boutique sur le Marketplace jusqu'à régularisation, sans que cela constitue une résiliation du présent contrat."));
children.push(p("L'accès aux fonctionnalités de la Boutique dépend du Bouquet souscrit par le Vendeur, dont le contenu et les conditions tarifaires sont communiqués séparément et peuvent évoluer dans les conditions prévues à l'article 21."));

children.push(h1("Obligations du Vendeur relatives aux produits", 3));
children.push(p("Le Vendeur est seul responsable des produits qu'il propose à la vente sur sa Boutique. Il garantit notamment que :"));
children.push(bullet("les produits proposés sont licites, ne portent atteinte à aucune réglementation applicable et ne font l'objet d'aucune interdiction de commercialisation ;"));
children.push(bullet("les descriptions, photographies, prix et quantités disponibles affichés sont exacts, à jour et ne sont pas trompeurs ;"));
children.push(bullet("les produits livrés sont conformes à leur description et répondent aux normes de qualité et de sécurité applicables à leur catégorie ;"));
children.push(bullet("il détient tous les droits nécessaires sur les visuels, marques et contenus qu'il publie sur sa Boutique (voir également l'article 10)."));
children.push(p("ELEGANZ ne vérifie pas systématiquement la conformité de chaque produit ou annonce publiée par le Vendeur et n'est jamais partie à la vente conclue entre le Vendeur et l'Acheteur. Le Vendeur garantit ELEGANZ contre toute conséquence d'une non-conformité de ses produits ou de ses annonces."));

children.push(h1("Traitement des commandes", 4));
children.push(p("Le Vendeur s'engage à prendre en charge, confirmer et préparer les commandes reçues via sa Boutique dans des délais raisonnables et conformes à ce qu'il a lui-même indiqué à l'Acheteur, et à informer l'Acheteur de toute indisponibilité ou retard affectant sa commande."));

children.push(h1("Livraison et responsabilité sur les livreurs de la boutique", 5));
children.push(p("La Plateforme met à la disposition du Vendeur un module lui permettant de créer, d'enregistrer et de gérer ses propres Livreurs pour assurer la livraison des commandes de sa Boutique."));
children.push(p("Le Vendeur reconnaît et accepte que :"));
children.push(bullet("il choisit, habilite et, le cas échéant, rémunère lui-même ses Livreurs ; ELEGANZ n'est ni l'employeur, ni le mandant, ni le garant de ces Livreurs, et n'intervient pas dans la relation contractuelle, quelle qu'en soit la nature, entre le Vendeur et ses Livreurs ;"));
children.push(bullet("il est seul responsable du comportement de ses Livreurs dans l'exécution des livraisons, et notamment des retards, pertes, dommages aux produits livrés, ou de tout préjudice causé à un Acheteur ou à un tiers par un Livreur agissant pour le compte de sa Boutique ;"));
children.push(bullet("ELEGANZ fournit uniquement l'outil technique de création, d'affectation et de suivi des Livreurs, sans contrôle sur leur recrutement, leur formation ou l'exécution matérielle des livraisons."));
children.push(p("Le Vendeur garantit ELEGANZ contre toute réclamation d'un Acheteur, d'un tiers ou d'une autorité publique résultant d'un fait imputable à l'un de ses Livreurs."));

children.push(h1("Règlement des commandes et absence d'intermédiation financière", 6));
children.push(p("À la date du présent contrat, le règlement des commandes passées via le Marketplace s'effectue directement entre l'Acheteur et le Vendeur au moment de la livraison (espèces ou mobile money), sauf indication contraire communiquée par ELEGANZ. ELEGANZ ne collecte, ne détient et ne séquestre à aucun moment les fonds relatifs à une vente entre le Vendeur et un Acheteur."));
children.push(p("Si ELEGANZ met en place, à l'avenir, une solution de paiement en ligne intégrée à la Plateforme, les conditions applicables à cette solution feront l'objet d'une information et, le cas échéant, d'un avenant au présent contrat."));

children.push(h1("Retours, remboursements et garanties envers l'acheteur", 7));
children.push(p("Le Vendeur définit et affiche sa propre politique de retour, d'échange et de remboursement à l'égard de ses Acheteurs, qu'il s'engage à respecter. ELEGANZ n'est ni partie à cette politique, ni garant financier des remboursements dus par le Vendeur à un Acheteur."));
children.push(p("ELEGANZ peut, par l'intermédiaire de son module de gestion des litiges, faciliter l'échange d'informations entre le Vendeur et l'Acheteur en cas de désaccord, sans que cela constitue une obligation de résultat ni un engagement de prise en charge financière de la part d'ELEGANZ."));

children.push(h1("Facturation et conformité fiscale", 8));
children.push(p("Le Vendeur est seul responsable du respect de ses obligations fiscales, comptables et déclaratives à l'égard des autorités compétentes, y compris pour les ventes réalisées via la Plateforme."));
children.push(p("Par défaut, les documents de vente émis depuis la Boutique sont des documents internes, non homologués par la Direction Générale des Impôts (DGI)."));
children.push(p("Le Vendeur peut, depuis les Paramètres de sa Boutique, renseigner son identité fiscale et juridique et activer une présentation normalisée auto-déclarée de ses documents de vente, dans l'attente de la connexion effective de sa Boutique aux dispositifs de la DGI. Cette activation reste sous l'entière responsabilité du Vendeur quant à l'exactitude des informations déclarées ; elle ne constitue en aucun cas une homologation DGI, laquelle ne peut être confirmée que par ELEGANZ après mise en place effective de la connexion correspondante."));
children.push(p("Le Vendeur s'engage à ne jamais présenter ses documents de vente comme des factures fiscales homologuées tant que cette homologation n'a pas été confirmée par ELEGANZ."));

children.push(h1("Abonnement, commission et frais de la Plateforme", 9));
children.push(p("L'accès à la Boutique est soumis à la souscription d'un Bouquet, dont le prix, les modalités de facturation et les conditions de résiliation ou de changement sont précisés dans la grille tarifaire en vigueur, communiquée séparément et consultable depuis l'espace de gestion de la Boutique."));
children.push(mixedP([
  run("ELEGANZ peut percevoir une commission sur les ventes réalisées via le Marketplace, dont le taux, les conditions d'application et les éventuelles périodes d'exonération sont précisés dans la grille tarifaire en vigueur : "), phRun("renvoi exact à la grille tarifaire applicable à la date de signature"),
  run("."),
]));
children.push(p("Le défaut de règlement des sommes dues à ELEGANZ au titre du Bouquet ou de la commission peut entraîner la suspension de la Boutique dans les conditions de l'article 15, et conditionne sa réactivation au règlement intégral des sommes dues."));

children.push(h1("Propriété intellectuelle", 10));
children.push(p("Le Vendeur garantit détenir ou disposer des droits nécessaires sur les éléments (textes, photographies, visuels, marques, logo) qu'il publie sur sa Boutique, et concède à ELEGANZ, pour la durée du présent contrat, une licence non exclusive d'affichage, de reproduction et d'adaptation technique de ces éléments, dans la seule mesure nécessaire à l'exploitation de la Boutique sur la Plateforme."));
children.push(p("ELEGANZ demeure seule titulaire de ses propres marques, logos et éléments de la Plateforme, dont aucune licence n'est consentie au Vendeur au-delà de l'usage normal de la Boutique."));

children.push(h1("Données personnelles des acheteurs", 11));
children.push(p("Le Vendeur ne peut utiliser les données personnelles des Acheteurs auxquelles il a accès via sa Boutique qu'aux fins strictement nécessaires au traitement des commandes et à la relation commerciale correspondante. Toute réutilisation à d'autres fins, notamment de démarchage non sollicité, est interdite."));

children.push(h1("Confidentialité", 12));
children.push(p("Chaque Partie s'engage à conserver confidentielles les informations non publiques de l'autre Partie dont elle aurait connaissance dans le cadre de l'exécution du présent contrat, et à ne les utiliser qu'aux fins de celui-ci."));

children.push(h1("Avis, réputation et litiges avec les acheteurs", 13));
children.push(p("Le Vendeur reconnaît que les Acheteurs peuvent laisser des avis et commentaires publics sur sa Boutique. ELEGANZ ne garantit ni ne s'engage à retirer un avis au seul motif qu'il serait défavorable au Vendeur, sous réserve des règles de modération générales de la Plateforme."));

children.push(h1("Manquements et sanctions", 14));
children.push(p("Constitue notamment un manquement au présent contrat, pouvant donner lieu aux mesures prévues aux articles 15 et 16 :"));
children.push(bullet("la vente de produits illicites, contrefaits, dangereux ou interdits ;"));
children.push(bullet("des informations ou documents de vente sciemment inexacts, notamment une présentation frauduleuse d'un document comme facture fiscale homologuée ;"));
children.push(bullet("des manquements répétés ou graves dans le traitement des commandes ou des livraisons, y compris ceux résultant du fait d'un Livreur de la Boutique ;"));
children.push(bullet("le non-respect des politiques générales d'ELEGANZ et du règlement d'utilisation applicable à l'ensemble de la Plateforme ;"));
children.push(bullet("le non-paiement des sommes dues à ELEGANZ au titre du Bouquet ou de la commission."));

children.push(h1("Suspension de la boutique", 15));
children.push(p("En cas de manquement visé à l'article 14, ou en cas d'impayé, ELEGANZ peut suspendre temporairement la visibilité de la Boutique sur le Marketplace et/ou l'accès à certaines fonctionnalités de gestion, après notification au Vendeur précisant le motif de la suspension, sauf urgence justifiée par un risque pour les Acheteurs ou pour la Plateforme."));
children.push(p("La réactivation de la Boutique est subordonnée à la régularisation de la situation ayant motivé la suspension, et notamment, en cas d'impayé, au règlement intégral des sommes dues."));

children.push(h1("Suppression de la boutique par ELEGANZ", 16));
children.push(p("En cas de manquement grave ou de manquement non régularisé après mise en demeure, ELEGANZ peut procéder à la fermeture définitive de la Boutique, après notification au Vendeur précisant le motif de la décision. Cette fermeture est sans préjudice de toute somme déjà due par le Vendeur à ELEGANZ ou à des tiers, et sans préjudice du droit de chaque Partie de demander réparation d'un préjudice subi."));

children.push(h1("Fermeture de la boutique par le vendeur", 17));
children.push(p("Le Vendeur peut, à tout moment, fermer lui-même sa Boutique depuis les Paramètres de son espace de gestion. Cette fermeture emporte les mêmes conséquences pratiques qu'une fermeture décidée par ELEGANZ, sans préjuger du motif, et sans préjudice des sommes déjà dues à la date de la fermeture."));

children.push(h1("Durée et renouvellement", 18));
children.push(mixedP([
  run("Le présent contrat prend effet à la date de création de la Boutique et demeure en vigueur pour la durée du Bouquet souscrit, renouvelable selon les mêmes modalités, sauf résiliation par l'une des Parties dans les conditions prévues aux articles 15 à 17, avec un préavis de "), phRun("durée du préavis, le cas échéant"),
  run(" en cas de résiliation pour simple convenance."),
]));

children.push(h1("Limitation de responsabilité d'ELEGANZ", 19));
children.push(p("ELEGANZ agit en qualité de fournisseur de l'outil technique permettant au Vendeur d'exploiter sa Boutique et de la mettre en relation avec des Acheteurs. Sauf disposition contraire du présent contrat, ELEGANZ n'est pas partie à la vente conclue entre le Vendeur et l'Acheteur et n'est pas responsable de l'exécution de cette vente, de la qualité des produits, ni des actes du Vendeur, de ses employés ou de ses Livreurs."));
children.push(mixedP([
  run("La responsabilité d'ELEGANZ au titre du présent contrat, si elle est retenue, est limitée dans les conditions suivantes : "), phRun("plafond et modalités de limitation de responsabilité à définir avec un conseil juridique"),
  run("."),
]));

children.push(h1("Droit applicable et règlement des différends", 20));
children.push(mixedP([
  run("Le présent contrat est soumis au droit "), phRun("droit applicable — à confirmer, en principe le droit de la République démocratique du Congo"),
  run(". Tout différend relatif à sa formation, son exécution ou son interprétation sera soumis, à défaut de résolution amiable, à "), phRun("juridiction ou mode de règlement des litiges compétent"),
  run("."),
]));

children.push(h1("Dispositions diverses", 21));
children.push(p("Le présent contrat, ses annexes et la grille tarifaire en vigueur, ainsi que les politiques générales et le règlement d'utilisation de la Plateforme, forment l'intégralité de l'accord entre les Parties relatif à l'exploitation de la Boutique."));
children.push(p("ELEGANZ peut faire évoluer les politiques générales, le règlement d'utilisation et la grille tarifaire de la Plateforme ; toute modification substantielle est portée à la connaissance du Vendeur avant son entrée en vigueur, dans un délai raisonnable lui permettant, s'il le souhaite, de fermer sa Boutique dans les conditions de l'article 17 avant que la modification ne lui devienne applicable."));
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
signatureBlock("Pour le Vendeur").forEach((x) => children.push(x));

children.push(calloutBox("Rappel", [
  "Ce document ne devient opposable qu'après relecture complète, complétion de l'ensemble des champs signalés et validation par un conseil juridique, en particulier pour la clause de droit applicable et de règlement des différends (article 20) et pour le plafond de responsabilité (article 19).",
]));

writeDocx(children, __dirname + "/ELEGANZ-Contrat-Vendeur-Modele.docx");
