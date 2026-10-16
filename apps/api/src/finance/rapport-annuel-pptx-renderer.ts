import pptxgen from "pptxgenjs";
import type { RapportAnnuelDonnees } from "./rapport-annuel.service";
import { formaterMontant, formaterDateHeure } from "./dossier-credit-pdf-shared";

function formaterPct(valeur: number | null): string {
  return valeur === null ? "—" : `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

const COULEUR_ACCENT = "9333EA";
const COULEUR_SECONDAIRE = "F59E0B";

/**
 * Rapport annuel — PowerPoint (demande du 16 oct. 2026, point 3). Seul des
 * trois formats à utiliser des objets graphiques natifs (pptxgenjs
 * `addChart`), jugé le format offrant le meilleur rendu de graphique des
 * trois (décision du 16 oct. 2026) — contrairement au PDF (barres
 * vectorielles dessinées à la main) et au Word (approximation par cellules
 * ombrées).
 */
export async function renderRapportAnnuelPptx(rapport: RapportAnnuelDonnees): Promise<Buffer> {
  const pres = new pptxgen();
  pres.defineLayout({ name: "ELEGANZ_16x9", width: 13.33, height: 7.5 });
  pres.layout = "ELEGANZ_16x9";

  // Diapositive de couverture.
  const couverture = pres.addSlide();
  couverture.background = { color: "FFFFFF" };
  couverture.addText("Rapport annuel", { x: 0.5, y: 2.0, w: 12.33, h: 1, align: "center", fontSize: 32, bold: true, color: "1A1A1A" });
  couverture.addText(String(rapport.annee), { x: 0.5, y: 2.9, w: 12.33, h: 1.2, align: "center", fontSize: 54, bold: true, color: COULEUR_ACCENT });
  couverture.addText(rapport.entiteNom, { x: 0.5, y: 4.3, w: 12.33, h: 0.6, align: "center", fontSize: 22, bold: true, color: "1A1A1A" });
  const sousLignes = [rapport.identiteFiscale.fiscalLegalName, rapport.identiteFiscale.fiscalAddress].filter(Boolean).join("  —  ");
  if (sousLignes) {
    couverture.addText(sousLignes, { x: 0.5, y: 4.9, w: 12.33, h: 0.5, align: "center", fontSize: 13, color: "555555" });
  }
  couverture.addText(
    `Généré le ${formaterDateHeure(rapport.genereLe)}  —  Préparé selon les normes comptables SYSCOHADA/OHADA, non audité`,
    { x: 0.5, y: 6.6, w: 12.33, h: 0.4, align: "center", fontSize: 10, color: "888888" },
  );

  // Chiffres clés.
  const slideChiffres = pres.addSlide();
  slideChiffres.addText("Chiffres clés de l'exercice", { x: 0.5, y: 0.3, w: 12.33, h: 0.6, fontSize: 24, bold: true });
  const tuiles: [string, string][] = [
    ["Chiffre d'affaires", formaterMontant(rapport.chiffresCles.chiffreAffaires)],
    ["Charges", formaterMontant(rapport.chiffresCles.charges)],
    ["Résultat net (avant impôt)", formaterMontant(rapport.chiffresCles.resultatNet)],
    ["Marge nette", formaterPct(rapport.chiffresCles.margeNette)],
    ["Croissance du CA", formaterPct(rapport.chiffresCles.croissanceCA)],
  ];
  tuiles.forEach(([label, valeur], i) => {
    const col = i % 3;
    const ligne = Math.floor(i / 3);
    const x = 0.5 + col * 4.2;
    const y = 1.2 + ligne * 2.0;
    slideChiffres.addShape(pres.ShapeType.rect, { x, y, w: 4.0, h: 1.7, fill: { color: "F5F3FF" }, line: { color: COULEUR_ACCENT, width: 1 } });
    slideChiffres.addText(label, { x: x + 0.2, y: y + 0.15, w: 3.6, h: 0.6, fontSize: 12, color: "555555" });
    slideChiffres.addText(valeur, { x: x + 0.2, y: y + 0.75, w: 3.6, h: 0.7, fontSize: 20, bold: true, color: "1A1A1A" });
  });

  // Évolution mensuelle — graphique natif en barres + ligne.
  const slideEvolution = pres.addSlide();
  slideEvolution.addText("Évolution mensuelle", { x: 0.5, y: 0.3, w: 12.33, h: 0.6, fontSize: 24, bold: true });
  const mois = rapport.evolutionMensuelle.map((m) => m.mois.slice(5));
  slideEvolution.addChart(
    pres.ChartType.bar,
    [
      { name: "Chiffre d'affaires", labels: mois, values: rapport.evolutionMensuelle.map((m) => m.chiffreAffaires) },
      { name: "Charges", labels: mois, values: rapport.evolutionMensuelle.map((m) => m.charges) },
    ],
    { x: 0.5, y: 1.1, w: 12.33, h: 5.8, barGrouping: "clustered", chartColors: [COULEUR_ACCENT, COULEUR_SECONDAIRE], showLegend: true, legendPos: "b", showValAxisTitle: false, catAxisLabelFontSize: 9 },
  );

  // Compte de résultat — tableau.
  const slideCR = pres.addSlide();
  slideCR.addText("Compte de résultat (normalisé SYSCOHADA)", { x: 0.5, y: 0.3, w: 12.33, h: 0.6, fontSize: 22, bold: true });
  const lignesCR: pptxgen.TableRow[] = [
    [{ text: "Rubrique", options: { bold: true, fill: { color: "EEEEEE" } } }, { text: "Montant", options: { bold: true, fill: { color: "EEEEEE" }, align: "right" } }],
  ];
  function ajouterSectionCR(nom: string, produits: { label: string; montant: number }[], charges: { label: string; montant: number }[], resultat: number) {
    lignesCR.push([{ text: nom, options: { bold: true } }, { text: "", options: {} }]);
    for (const p of produits) lignesCR.push([{ text: `  ${p.label}` }, { text: formaterMontant(p.montant), options: { align: "right" } }]);
    for (const c of charges) lignesCR.push([{ text: `  ${c.label}` }, { text: `(${formaterMontant(c.montant)})`, options: { align: "right" } }]);
    lignesCR.push([{ text: `  Résultat`, options: { bold: true } }, { text: formaterMontant(resultat), options: { align: "right", bold: true } }]);
  }
  ajouterSectionCR("Exploitation", rapport.compteDeResultat.exploitation.produits, rapport.compteDeResultat.exploitation.charges, rapport.compteDeResultat.exploitation.resultat);
  ajouterSectionCR("Financier", rapport.compteDeResultat.financier.produits, rapport.compteDeResultat.financier.charges, rapport.compteDeResultat.financier.resultat);
  ajouterSectionCR("Hors activités ordinaires (HAO)", rapport.compteDeResultat.hao.produits, rapport.compteDeResultat.hao.charges, rapport.compteDeResultat.hao.resultat);
  lignesCR.push([
    { text: "Résultat net avant impôt", options: { bold: true, color: COULEUR_ACCENT } },
    { text: formaterMontant(rapport.compteDeResultat.resultatNetAvantImpot), options: { align: "right", bold: true, color: COULEUR_ACCENT } },
  ]);
  slideCR.addTable(lignesCR, { x: 0.5, y: 1.1, w: 12.33, fontSize: 10, autoPage: true });

  // Bilan — tableau.
  const slideBilan = pres.addSlide();
  slideBilan.addText(`Bilan (normalisé SYSCOHADA) — au ${rapport.bilan.asOf.slice(0, 10)}`, { x: 0.5, y: 0.3, w: 12.33, h: 0.6, fontSize: 22, bold: true });
  const lignesBilan: pptxgen.TableRow[] = [
    [{ text: "Poste", options: { bold: true, fill: { color: "EEEEEE" } } }, { text: "Montant", options: { bold: true, fill: { color: "EEEEEE" }, align: "right" } }],
  ];
  function ajouterListeBilan(nom: string, lignes: { label: string; montant: number }[]) {
    lignesBilan.push([{ text: nom, options: { bold: true } }, { text: "", options: {} }]);
    for (const l of lignes) lignesBilan.push([{ text: `  ${l.label}` }, { text: formaterMontant(l.montant), options: { align: "right" } }]);
  }
  ajouterListeBilan("Actif immobilisé", rapport.bilan.actif.immobilise);
  ajouterListeBilan("Actif circulant", rapport.bilan.actif.circulant);
  ajouterListeBilan("Trésorerie", rapport.bilan.actif.tresorerie);
  lignesBilan.push([{ text: "Total actif", options: { bold: true } }, { text: formaterMontant(rapport.bilan.totalActif), options: { align: "right", bold: true } }]);
  ajouterListeBilan("Capitaux propres", rapport.bilan.passif.capitauxPropres);
  ajouterListeBilan("Dettes financières", rapport.bilan.passif.dettesFinancieres);
  ajouterListeBilan("Passif circulant", rapport.bilan.passif.circulant);
  lignesBilan.push([{ text: "Total passif", options: { bold: true } }, { text: formaterMontant(rapport.bilan.totalPassif), options: { align: "right", bold: true } }]);
  slideBilan.addTable(lignesBilan, { x: 0.5, y: 1.1, w: 12.33, fontSize: 9, autoPage: true });

  // Répartition — graphique natif en barres.
  if (rapport.repartitionProduits.length > 0) {
    const slideRepartition = pres.addSlide();
    const titreRepartition = rapport.scope === "PLATFORM" ? "Répartition des revenus par source" : "Principales charges de l'exercice";
    slideRepartition.addText(titreRepartition, { x: 0.5, y: 0.3, w: 12.33, h: 0.6, fontSize: 24, bold: true });
    slideRepartition.addChart(
      pres.ChartType.bar,
      [
        {
          name: titreRepartition,
          labels: rapport.repartitionProduits.map((r) => r.label),
          values: rapport.repartitionProduits.map((r) => r.montant),
        },
      ],
      { x: 0.5, y: 1.1, w: 12.33, h: 5.8, barDir: "bar", chartColors: [COULEUR_ACCENT], showLegend: false, dataLabelPosition: "outEnd", showValue: true, catAxisLabelFontSize: 10 },
    );
  }

  const buffer = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return buffer;
}
