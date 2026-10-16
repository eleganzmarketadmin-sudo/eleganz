import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  PageBreak,
  Packer,
} from "docx";
import type { RapportAnnuelDonnees } from "./rapport-annuel.service";
import { formaterMontant, formaterDateHeure } from "./dossier-credit-pdf-shared";

function formaterPct(valeur: number | null): string {
  return valeur === null ? "—" : `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

const COULEUR_ACCENT = "9333EA";
const COULEUR_SECONDAIRE = "F59E0B";

function titre(texte: string, niveau: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({ text: texte, heading: niveau, spacing: { before: 300, after: 150 } });
}

function ligneTexte(texte: string, gras = false) {
  return new Paragraph({ children: [new TextRun({ text: texte, bold: gras })], spacing: { after: 60 } });
}

/**
 * Barre horizontale approximée par une cellule de tableau ombrée dont la
 * largeur (en pourcentage) reflète la proportion de la valeur — technique
 * retenue le 16 oct. 2026 car `docx` n'offre pas d'intégration native de
 * graphique SVG/raster fiable ; c'est la même donnée que le graphique
 * pdfkit/pptxgenjs, juste un rendu différent adapté au format Word.
 */
function barreTableau(label: string, valeur: number, maxValeur: number): Table {
  const pourcentage = maxValeur > 0 ? Math.max(2, Math.round((valeur / maxValeur) * 100)) : 2;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: label, size: 18 })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: pourcentage, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: COULEUR_ACCENT },
                        children: [new Paragraph({ children: [new TextRun({ text: " ", size: 18 })] })],
                      }),
                      new TableCell({
                        width: { size: 100 - pourcentage, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: formaterMontant(valeur), size: 18 })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function tableauLignes(entetes: string[], lignes: string[][]): Table {
  function ligne(cellules: string[], gras: boolean) {
    return new TableRow({
      children: cellules.map(
        (texte, i) =>
          new TableCell({
            shading: gras ? { type: ShadingType.CLEAR, fill: "EEEEEE" } : undefined,
            children: [
              new Paragraph({
                alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                children: [new TextRun({ text: texte, bold: gras, size: 18 })],
              }),
            ],
          }),
      ),
    });
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [ligne(entetes, true), ...lignes.map((l) => ligne(l, false))],
  });
}

/**
 * Rapport annuel — Word (demande du 16 oct. 2026, point 3). Même contenu
 * que le PDF, structuré en sections Word plutôt qu'en pages dessinées.
 */
export async function renderRapportAnnuelDocx(rapport: RapportAnnuelDonnees): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Rapport annuel", bold: true, size: 48 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: String(rapport.annee), bold: true, size: 64, color: COULEUR_ACCENT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: rapport.entiteNom, bold: true, size: 28 })],
    }),
  );
  if (rapport.identiteFiscale.fiscalLegalName) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: rapport.identiteFiscale.fiscalLegalName, size: 18, color: "555555" })] }));
  }
  if (rapport.identiteFiscale.fiscalAddress) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: rapport.identiteFiscale.fiscalAddress, size: 18, color: "555555" })] }));
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300 },
      children: [new TextRun({ text: `Généré le ${formaterDateHeure(rapport.genereLe)}`, size: 16, color: "888888" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Préparé selon les normes comptables SYSCOHADA/OHADA — non audité par un expert-comptable externe.",
          size: 16,
          color: "888888",
        }),
        new PageBreak(),
      ],
    }),
  );

  // Chiffres clés.
  children.push(titre("Chiffres clés de l'exercice"));
  children.push(
    tableauLignes(
      ["Indicateur", "Valeur"],
      [
        ["Chiffre d'affaires", formaterMontant(rapport.chiffresCles.chiffreAffaires)],
        ["Charges", formaterMontant(rapport.chiffresCles.charges)],
        ["Résultat net (avant impôt)", formaterMontant(rapport.chiffresCles.resultatNet)],
        ["Marge nette", formaterPct(rapport.chiffresCles.margeNette)],
        ["Croissance du CA vs année précédente", formaterPct(rapport.chiffresCles.croissanceCA)],
      ],
    ),
  );

  // Évolution mensuelle.
  children.push(titre("Évolution mensuelle"));
  children.push(
    tableauLignes(
      ["Mois", "Chiffre d'affaires", "Charges", "Résultat net"],
      rapport.evolutionMensuelle.map((m) => [m.mois, formaterMontant(m.chiffreAffaires), formaterMontant(m.charges), formaterMontant(m.resultatNet)]),
    ),
  );

  // Compte de résultat.
  children.push(titre("Compte de résultat (normalisé SYSCOHADA)"));
  children.push(ligneTexte(rapport.compteDeResultat.statut));
  function sectionCR(nomSection: string, produits: { label: string; montant: number }[], charges: { label: string; montant: number }[], resultat: number) {
    children.push(titre(nomSection, HeadingLevel.HEADING_2));
    for (const p of produits) children.push(ligneTexte(`${p.label} : ${formaterMontant(p.montant)}`));
    for (const c of charges) children.push(ligneTexte(`${c.label} : (${formaterMontant(c.montant)})`));
    children.push(ligneTexte(`Résultat : ${formaterMontant(resultat)}`, true));
  }
  sectionCR("Exploitation", rapport.compteDeResultat.exploitation.produits, rapport.compteDeResultat.exploitation.charges, rapport.compteDeResultat.exploitation.resultat);
  sectionCR("Financier", rapport.compteDeResultat.financier.produits, rapport.compteDeResultat.financier.charges, rapport.compteDeResultat.financier.resultat);
  children.push(ligneTexte(`Résultat des activités ordinaires : ${formaterMontant(rapport.compteDeResultat.resultatActivitesOrdinaires)}`, true));
  sectionCR("Hors activités ordinaires (HAO)", rapport.compteDeResultat.hao.produits, rapport.compteDeResultat.hao.charges, rapport.compteDeResultat.hao.resultat);
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Résultat net avant impôt : ${formaterMontant(rapport.compteDeResultat.resultatNetAvantImpot)}`, bold: true, size: 24, color: COULEUR_ACCENT })],
      spacing: { before: 150, after: 150 },
    }),
  );

  // Bilan.
  children.push(titre("Bilan (normalisé SYSCOHADA)"));
  children.push(ligneTexte(`Au ${rapport.bilan.asOf.slice(0, 10)}`));
  function listeBilan(nomSection: string, lignes: { label: string; montant: number }[]) {
    children.push(titre(nomSection, HeadingLevel.HEADING_2));
    for (const l of lignes) children.push(ligneTexte(`${l.label} : ${formaterMontant(l.montant)}`));
  }
  children.push(titre("Actif", HeadingLevel.HEADING_2));
  listeBilan("Immobilisé", rapport.bilan.actif.immobilise);
  listeBilan("Circulant", rapport.bilan.actif.circulant);
  listeBilan("Trésorerie", rapport.bilan.actif.tresorerie);
  children.push(ligneTexte(`Total actif : ${formaterMontant(rapport.bilan.totalActif)}`, true));
  children.push(titre("Passif", HeadingLevel.HEADING_2));
  listeBilan("Capitaux propres", rapport.bilan.passif.capitauxPropres);
  listeBilan("Dettes financières", rapport.bilan.passif.dettesFinancieres);
  listeBilan("Circulant", rapport.bilan.passif.circulant);
  children.push(ligneTexte(`Total passif : ${formaterMontant(rapport.bilan.totalPassif)}`, true));
  if (!rapport.bilan.equilibre) {
    children.push(ligneTexte("Attention : le bilan n'est pas équilibré à cette date."));
  }

  // Répartition.
  if (rapport.repartitionProduits.length > 0) {
    const titreRepartition = rapport.scope === "PLATFORM" ? "Répartition des revenus par source" : "Principales charges de l'exercice";
    children.push(titre(titreRepartition));
    const maxRepartition = Math.max(...rapport.repartitionProduits.map((r) => r.montant), 1);
    for (const r of rapport.repartitionProduits) {
      children.push(barreTableau(r.label, r.montant, maxRepartition));
      children.push(new Paragraph({ spacing: { after: 100 } }));
    }
  }

  children.push(
    new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: `Généré le ${formaterDateHeure(rapport.genereLe)} à partir des écritures comptables réelles.`, size: 15, color: "888888" })],
    }),
    new Paragraph({ children: [new TextRun({ text: `Code de vérification : ${rapport.codeVerification}`, size: 15, color: "888888" })] }),
    new Paragraph({
      children: [new TextRun({ text: "Rappel : ce rapport ne remplace pas un état financier certifié ni un audit comptable externe.", size: 15, color: "888888" })],
    }),
  );

  const document = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(document);
}
