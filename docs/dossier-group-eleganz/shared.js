// Composants partagés par les 15 documents du dossier GROUP ELEGANZ SARL
// (constitution + contrats numériques) — complète helpers.js avec les
// éléments propres à ce dossier : en-tête compact (ces documents sont des
// formulaires/actes courts, pas des contrats longs avec sommaire), encart
// de mise en garde répété sur chaque document, et bloc d'identification/
// signature de pied de page repris de l'original.
const {
  run, h1, h2, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  writeDocx, PageBreak, Paragraph, COBALT, INK, GRIS, FONT_HEAD, FONT_BODY,
} = require("./helpers");
const { TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType } = require("docx");

const NOM_SOCIETE = "GROUP ELEGANZ SARL";
const RESERVE_NOM = "(dénomination proposée, sous réserve de disponibilité et d'acceptation au RCCM)";

function enTete(kicker, titre, sousTitre) {
  const out = [
    new Paragraph({ spacing: { after: 40 }, children: [run(NOM_SOCIETE, { bold: true, font: FONT_HEAD, size: 18, color: GRIS })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: kicker, bold: true, color: "B23A48", font: FONT_BODY, size: 16 })] }),
    new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: titre, font: FONT_HEAD, bold: true, size: 32, color: INK })],
    }),
  ];
  if (sousTitre) {
    out.push(new Paragraph({ spacing: { after: 160 }, children: [run(sousTitre, { italics: true, size: 19, color: GRIS })] }));
  }
  out.push(calloutBox("Modèle de travail — à compléter, faire vérifier et signer avant dépôt", [
    "Les champs [ ... — à compléter ] ne doivent jamais être déposés ou signés en l'état.",
    "Cette clause est un modèle rédactionnel, non un formulaire officiel du Guichet Unique de Création d'Entreprise (GUCE), de l'ARPTC ou de toute autre administration. Un contrôle juridique OHADA/RDC est requis avant tout usage.",
  ]));
  return out;
}

function piedIdentification({ siegePh = true } = {}) {
  const out = [
    new Paragraph({ spacing: { before: 260, after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 8 } }, children: [] }),
    new Paragraph({ spacing: { before: 160, after: 40 }, children: [run("Identification", { bold: true, size: 18 })] }),
    mixedP([run("Société : "), run(NOM_SOCIETE, { bold: true }), run(" "), run(RESERVE_NOM, { italics: true, size: 18, color: GRIS })]),
  ];
  if (siegePh) out.push(mixedP([run("Siège social : "), phRun("adresse complète, commune, Kinshasa, RDC")]));
  out.push(mixedP([run("Date et lieu : "), phRun("date"), run(", "), phRun("lieu — en principe Kinshasa")]));
  return out;
}

// Un document complet (hors statuts, bâtis à part vu leur longueur) :
// en-tête + corps fourni par l'appelant + pied d'identification + bloc de
// signature(s) + rappel final.
function construireDocument({ kicker, titre, sousTitre, corps, signataires, rappel, outFile }) {
  const children = [];
  children.push(...enTete(kicker, titre, sousTitre));
  children.push(...corps);
  children.push(...piedIdentification());
  (signataires || []).forEach((label) => signatureBlock(label).forEach((x) => children.push(x)));
  if (rappel) children.push(calloutBox("Rappel", Array.isArray(rappel) ? rappel : [rappel]));
  return writeDocx(children, outFile);
}

function champ(label, ph) {
  return mixedP([run(label + " : "), phRun(ph)]);
}

function simpleTable(headers, rows) {
  const widthEach = Math.floor(9638 / headers.length);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((hTxt) => new TableCell({
      width: { size: widthEach, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "17408A" },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: hTxt, bold: true, color: "FFFFFF", font: FONT_BODY, size: 18 })] })],
    })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((cellText) => new TableCell({
      width: { size: widthEach, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [run(cellText, { size: 19 })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: headers.map(() => widthEach),
    rows: [headerRow, ...bodyRows],
  });
}

module.exports = {
  run, h1, h2, p, mixedP, bullet, note, phRun, calloutBox, signatureBlock,
  writeDocx, PageBreak, Paragraph, NOM_SOCIETE, RESERVE_NOM,
  enTete, piedIdentification, construireDocument, champ, simpleTable,
};
