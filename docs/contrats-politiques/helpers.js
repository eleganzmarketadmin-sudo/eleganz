// Helpers partagés par les 3 modèles (contrat vendeur, contrat expert, CGU) —
// repris de docs/statuts/build.js (même palette, même convention de
// placeholder visuel rouge italique) pour une présentation cohérente entre
// tous les documents juridiques livrés dans ce projet.
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak,
} = require("docx");

const INK = "15171C";
const COBALT = "17408A";
const GRIS = "565A65";
const ROUGEPH = "B23A48"; // placeholder marker colour
const FONT_HEAD = "Cambria";
const FONT_BODY = "Calibri";

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT_BODY, size: 21, color: INK, ...opts });
}

function titleRun(text, opts = {}) {
  return new TextRun({ text, font: FONT_HEAD, bold: true, color: INK, ...opts });
}

function h0(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    keepNext: true,
    children: [new TextRun({ text, font: FONT_HEAD, bold: true, size: 30, color: INK })],
  });
}

function h1(text, articleNo) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COBALT, space: 4 } },
    children: [
      new TextRun({
        text: articleNo ? `Article ${articleNo} — ${text}` : text,
        font: FONT_HEAD, bold: true, size: 26, color: COBALT,
      }),
    ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 100 },
    keepNext: true,
    children: [new TextRun({ text, font: FONT_HEAD, bold: true, size: 22, color: INK })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 140, line: 300 },
    alignment: AlignmentType.JUSTIFIED,
    children: Array.isArray(text) ? text : [new TextRun({ text, font: FONT_BODY, size: 21, color: INK, ...opts })],
  });
}

function mixedP(parts) {
  return new Paragraph({ spacing: { after: 140, line: 300 }, alignment: AlignmentType.JUSTIFIED, children: parts });
}

function bullet(text) {
  let kids;
  if (Array.isArray(text)) kids = text;
  else if (text instanceof TextRun) kids = [text];
  else kids = [new TextRun({ text, font: FONT_BODY, size: 21, color: INK })];
  return new Paragraph({
    spacing: { after: 90, line: 290 },
    alignment: AlignmentType.JUSTIFIED,
    bullet: { level: 0 },
    children: kids,
  });
}

function note(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: true, size: 18, color: GRIS, font: FONT_BODY })],
  });
}

// Placeholder marker — jamais une donnée réelle, toujours visuellement
// distinct (rouge italique) pour qu'un relecteur voie immédiatement ce qui
// reste à compléter / valider juridiquement.
function phRun(label) {
  return new TextRun({ text: `[ ${label} — à compléter ]`, italics: true, color: ROUGEPH, font: FONT_BODY, size: 21 });
}

function calloutBox(titleText, lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [9638],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "FBEAEA" },
            margins: { top: 200, bottom: 200, left: 220, right: 220 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: ROUGEPH },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: ROUGEPH },
              left: { style: BorderStyle.SINGLE, size: 24, color: ROUGEPH },
              right: { style: BorderStyle.SINGLE, size: 4, color: ROUGEPH },
            },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: titleText, bold: true, color: ROUGEPH, font: FONT_HEAD, size: 22 })],
              }),
              ...lines.map((l) => new Paragraph({
                spacing: { after: 60 },
                alignment: AlignmentType.JUSTIFIED,
                children: [new TextRun({ text: l, size: 20, color: INK, font: FONT_BODY })],
              })),
            ],
          }),
        ],
      }),
    ],
  });
}

function signatureBlock(roleLabel, extraLines = []) {
  const out = [
    new Paragraph({ spacing: { before: 300, after: 40 }, children: [run(roleLabel, { bold: true })] }),
  ];
  extraLines.forEach((line) => out.push(new Paragraph({ spacing: { after: 40 }, children: line })));
  out.push(new Paragraph({ spacing: { after: 40 }, children: [run("Nom : "), phRun("nom complet")] }));
  out.push(new Paragraph({ spacing: { after: 300 }, children: [run("Signature : ___________________________    Date : "), phRun("date")] }));
  return out;
}

function coverPage({ kicker, title, subtitle1, subtitle2 }) {
  const out = [
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: kicker, bold: true, color: ROUGEPH, font: FONT_BODY, size: 18 })] }),
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [new TextRun({ text: title, font: FONT_HEAD, bold: true, size: 40, color: INK })],
    }),
  ];
  if (subtitle1) {
    out.push(new Paragraph({
      spacing: { after: 40 },
      children: [run(subtitle1, { bold: true, size: 24, color: COBALT })],
    }));
  }
  if (subtitle2) {
    out.push(new Paragraph({
      spacing: { after: 300 },
      children: [run(subtitle2, { italics: true, size: 20, color: GRIS })],
    }));
  }
  return out;
}

function buildDocument(children) {
  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT_BODY, size: 21, color: INK } },
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT_HEAD, bold: true, size: 26, color: COBALT },
          paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT_HEAD, bold: true, size: 22, color: INK },
          paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children,
      },
    ],
  });
}

async function writeDocx(children, outPath) {
  const fs = require("fs");
  const doc = buildDocument(children);
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  console.log("Written:", outPath);
}

module.exports = {
  run, titleRun, h0, h1, h2, p, mixedP, bullet, note, phRun, calloutBox,
  signatureBlock, coverPage, buildDocument, writeDocx, PageBreak, Paragraph,
  INK, COBALT, GRIS, ROUGEPH, FONT_HEAD, FONT_BODY,
};
