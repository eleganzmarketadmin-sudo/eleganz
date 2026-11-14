#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Registre_formalites_autorisations_GROUP_ELEGANZ.xlsx — version améliorée.
Reprend la structure à 3 feuilles du registre source de l'utilisateur
(Registre formalités / Priorités / Mode emploi), avec :
 - les 7 modules réels de la plateforme et les 15 pièces de ce dossier ;
 - une colonne "Statut interne" reflétant ce qui a déjà été préparé cette
   session (modèles rédigés) par opposition à ce qui reste à faire avec des
   données réelles (dépôt GUCE, immatriculation, autorisation numérique) ;
 - une urgence clairement marquée (rouge) sur les lignes relatives au
   régime d'autorisation numérique, dont le délai transitoire est dépassé
   depuis le 30 juin 2026 (situation constatée au 14 novembre 2026).
Aucune donnée réelle de l'entreprise n'est renseignée : les colonnes
"Responsable" / dates restent vides, à compléter par l'équipe GROUP ELEGANZ.
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins


def setup_print(ws, landscape=True):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.5, bottom=0.5)

FONT_NAME = "Calibri"
INK = "15171C"
COBALT = "17408A"
WHITE = "FFFFFF"
GRIS_CLAIR = "F3F3F3"
ROUGE = "B23A48"
ROUGE_CLAIR = "FBEAEA"
AMBRE = "B8860B"
AMBRE_CLAIR = "FFF6E0"
VERT = "2E7D32"
VERT_CLAIR = "EAF5EA"

thin = Side(style="thin", color="D9D9D9")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def header_cell(ws, row, col, text):
    c = ws.cell(row=row, column=col, value=text)
    c.font = Font(name=FONT_NAME, bold=True, color=WHITE, size=11)
    c.fill = PatternFill("solid", fgColor=COBALT)
    c.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    c.border = BORDER
    return c


def body_cell(ws, row, col, text, bold=False, color=INK, fill=None, wrap=True, align="left"):
    c = ws.cell(row=row, column=col, value=text)
    c.font = Font(name=FONT_NAME, bold=bold, color=color, size=10.5)
    if fill:
        c.fill = PatternFill("solid", fgColor=fill)
    c.alignment = Alignment(horizontal=align, vertical="top", wrap_text=wrap)
    c.border = BORDER
    return c


URGENCE_STYLE = {
    "Normale": (INK, None),
    "Élevée": (AMBRE, AMBRE_CLAIR),
    "CRITIQUE": (WHITE, ROUGE),
}
STATUT_STYLE = {
    "Préparé (modèle rédigé)": (VERT, VERT_CLAIR),
    "Déjà livré": (VERT, VERT_CLAIR),
    "À faire (données réelles)": (AMBRE, AMBRE_CLAIR),
    "À faire": (AMBRE, AMBRE_CLAIR),
    "À vérifier": (ROUGE, ROUGE_CLAIR),
}

wb = Workbook()

# =====================================================================
# Feuille 1 — Registre formalités
# =====================================================================
ws1 = wb.active
ws1.title = "Registre formalités"
cols1 = ["N°", "Domaine", "Formalité / pièce", "Pièce(s) du dossier",
         "Autorité / organisme compétent", "Statut interne", "Urgence", "Observations"]
widths1 = [5, 14, 34, 16, 28, 24, 12, 46]
for i, (h, w) in enumerate(zip(cols1, widths1), start=1):
    header_cell(ws1, 1, i, h)
    ws1.column_dimensions[get_column_letter(i)].width = w
ws1.row_dimensions[1].height = 32
ws1.freeze_panes = "A2"

rows1 = [
    (1, "Constitution", "Rédaction des statuts", "01", "Notaire / GUCE", "Préparé (modèle rédigé)", "Normale",
     "Dénomination « GROUP ELEGANZ SARL » à confirmer au GUCE ; capital, apports et identité des associés à compléter."),
    (2, "Constitution", "Lettre de demande d'immatriculation", "02", "GUCE", "Préparé (modèle rédigé)", "Normale", ""),
    (3, "Constitution", "Déclaration de souscription et de versement du capital", "03", "GUCE / banque", "Préparé (modèle rédigé)", "Normale",
     "Nécessite le dépôt bancaire préalable des fonds."),
    (4, "Constitution", "Procès-verbal de l'assemblée constitutive", "04", "GUCE", "Préparé (modèle rédigé)", "Normale", "Nomination du premier gérant."),
    (5, "Constitution", "Spécimen de signature du gérant", "05", "GUCE / banque", "Préparé (modèle rédigé)", "Normale", "Légalisation éventuelle à prévoir."),
    (6, "Constitution", "Mandat spécial de dépôt et de retrait", "06", "GUCE", "Préparé (modèle rédigé)", "Normale", "Optionnel si le gérant dépose lui-même le dossier."),
    (7, "Constitution", "Attestation de mise à disposition du siège", "07", "GUCE", "Préparé (modèle rédigé)", "Normale", "Adresse réelle du siège à confirmer."),
    (8, "Constitution", "Registre des associés et bénéficiaires effectifs", "08", "Interne / autorité LBC-FT compétente", "Préparé (modèle rédigé)", "Normale",
     "Seuil de détention déclenchant la qualité de bénéficiaire effectif à vérifier."),
    (9, "Constitution", "Décision d'ouverture des comptes bancaires", "09", "Banque", "Préparé (modèle rédigé)", "Normale", "Aucun compte « fonds de tiers » requis : pas de paiement en ligne intégré."),
    (10, "Constitution", "Dépôt du dossier complet au GUCE", "01 à 09", "GUCE", "À faire (données réelles)", "Élevée",
     "Suppose les données réelles des associés et du gérant renseignées et le capital déposé."),
    (11, "Constitution", "Obtention du certificat d'immatriculation (RCCM)", "—", "GUCE", "À faire (données réelles)", "Élevée", "Délivré à l'issue de l'instruction du dossier GUCE."),
    (12, "Constitution", "Numéro d'identification nationale", "—", "GUCE", "À faire (données réelles)", "Élevée", "Délivré conjointement à l'immatriculation RCCM."),
    (13, "Constitution", "Immatriculation fiscale (numéro impôt)", "—", "DGI", "À faire (données réelles)", "Élevée", "Préalable à toute facturation fiscalement homologuée."),
    (14, "Numérique", "Contrat d'adhésion Vendeur (ELEGANZ Market)", "10", "Interne", "Préparé (modèle rédigé)", "Normale",
     "Complète le modèle autonome déjà livré (docs/contrats-politiques)."),
    (15, "Numérique", "Conditions d'utilisation ELEGANZ Gestion (SaaS)", "11", "Interne", "Préparé (modèle rédigé)", "Normale", ""),
    (16, "Numérique", "Politique de confidentialité", "12", "Interne", "Préparé (modèle rédigé)", "Normale", "Couvre l'ensemble des 7 modules de la plateforme."),
    (17, "Numérique", "Cession de propriété intellectuelle (fondateur → société)", "13", "Notaire / interne", "Préparé (modèle rédigé)", "Normale",
     "À articuler avec l'article 6 des statuts si traité en apport en nature."),
    (18, "Numérique", "CGU ELEGANZ Market", "14", "Interne", "Préparé (modèle rédigé)", "Normale", ""),
    (19, "Numérique", "Qualification dominante / non dominante de la plateforme", "15", "ARPTC", "À vérifier", "CRITIQUE",
     "Critère chiffré non publié à ce jour dans les sources consultées ; à clarifier directement avec l'ARPTC."),
    (20, "Numérique", "Dépôt de la demande d'autorisation ou de déclaration numérique", "15", "ARPTC / ministère compétent", "À faire (données réelles)", "CRITIQUE",
     "Période transitoire expirée le 30/06/2026 — retard d'environ 4,5 mois au 14/11/2026."),
    (21, "Numérique", "Paiement de la redevance d'autorisation numérique", "15", "ARPTC / Trésor public", "À faire (données réelles)", "CRITIQUE",
     "2 000 à 10 000 USD selon la qualification retenue et l'origine du capital (arrêté du 20/07/2026)."),
    (22, "Numérique", "Vérification du registre BCC des prestataires de services connexes", "15", "Banque Centrale du Congo", "À vérifier", "Élevée",
     "Existence et champ d'application non confirmés de façon indépendante à ce jour."),
    (23, "Bancaire", "Ouverture effective du compte bancaire de la société", "09", "Banque", "À faire (données réelles)", "Normale", "Conditionnée à l'obtention du RCCM."),
    (24, "Transversal", "Politiques générales ELEGANZ / CGU plateforme (hors Marketplace) et contrat Expert", "—", "Interne", "Déjà livré", "Normale",
     "Modèles déjà produits et livrés le 14 novembre 2026 (docs/contrats-politiques), distincts des pièces 10-14 propres à ce dossier."),
]

for i, r in enumerate(rows1, start=2):
    n, domaine, formalite, pieces, autorite, statut, urgence, obs = r
    body_cell(ws1, i, 1, n, align="center")
    body_cell(ws1, i, 2, domaine)
    body_cell(ws1, i, 3, formalite, bold=True)
    body_cell(ws1, i, 4, pieces, align="center")
    body_cell(ws1, i, 5, autorite)
    scolor, sfill = STATUT_STYLE.get(statut, (INK, None))
    body_cell(ws1, i, 6, statut, color=scolor, fill=sfill, bold=True)
    ucolor, ufill = URGENCE_STYLE.get(urgence, (INK, None))
    body_cell(ws1, i, 7, urgence, color=ucolor, fill=ufill, bold=True, align="center")
    body_cell(ws1, i, 8, obs)

ws1.sheet_view.showGridLines = False
setup_print(ws1, landscape=True)

# =====================================================================
# Feuille 2 — Priorités
# =====================================================================
ws2 = wb.create_sheet("Priorités")
cols2 = ["Rang", "Action prioritaire", "Pourquoi", "Urgence"]
widths2 = [7, 42, 56, 14]
for i, (h, w) in enumerate(zip(cols2, widths2), start=1):
    header_cell(ws2, 1, i, h)
    ws2.column_dimensions[get_column_letter(i)].width = w
ws2.row_dimensions[1].height = 28
ws2.freeze_panes = "A2"

rows2 = [
    (1, "Consulter un conseil juridique RDC spécialisé en droit du numérique",
     "La période transitoire du régime d'autorisation numérique est dépassée depuis le 30 juin 2026 ; une régularisation rapide limite l'exposition aux pénalités (100-200 % de la valeur du titre).", "CRITIQUE"),
    (2, "Clarifier la qualification dominante / non dominante d'ELEGANZ Market auprès de l'ARPTC",
     "Détermine le régime applicable (autorisation ou simple déclaration) et le montant de la redevance (2 000 à 10 000 USD).", "CRITIQUE"),
    (3, "Déposer la demande d'autorisation ou de déclaration numérique et régler la redevance",
     "Condition de poursuite légale de l'exploitation d'ELEGANZ Market à compter du 1er juillet 2026.", "CRITIQUE"),
    (4, "Réunir les données réelles des associés fondateurs et du gérant",
     "Préalable obligatoire à la finalisation des statuts et de l'ensemble du dossier de constitution (pièces 01 à 09).", "Élevée"),
    (5, "Choisir et mandater un notaire inscrit en RDC",
     "La rédaction définitive des statuts et la légalisation des actes de constitution doivent être supervisées par un notaire.", "Élevée"),
    (6, "Vérifier auprès de la Banque Centrale du Congo l'existence d'un registre des prestataires de services connexes",
     "Point non confirmé de façon indépendante ; à lever avant de conclure à l'absence d'obligation supplémentaire.", "Élevée"),
    (7, "Déposer les fonds du capital social et obtenir l'attestation de dépôt",
     "Préalable à la déclaration de souscription et de versement du capital (pièce 03).", "Normale"),
    (8, "Déposer le dossier complet au GUCE",
     "Déclenche l'immatriculation au RCCM et l'attribution du numéro d'identification nationale.", "Normale"),
    (9, "Obtenir l'immatriculation fiscale (DGI)",
     "Nécessaire pour toute facturation fiscalement homologuée (voir le document distinct sur la facture normalisée).", "Normale"),
    (10, "Ouvrir le compte bancaire de la société",
     "Conditionné par l'obtention du RCCM ; à distinguer de tout futur compte de fonds de tiers si un paiement en ligne était un jour intégré.", "Normale"),
    (11, "Finaliser l'acte de cession de propriété intellectuelle du ou des développeurs fondateurs",
     "Sécurise la titularité de la société sur le code, les bases de données et la marque de la plateforme (pièce 13).", "Normale"),
    (12, "Publier la politique de confidentialité et les CGU sur la plateforme",
     "Les pièces 12 et 14 doivent être mises en ligne et acceptées par les utilisateurs une fois validées juridiquement.", "Normale"),
    (13, "Planifier la révision de l'autorisation numérique à 5 ans et en cas de changement de contrôle",
     "L'autorisation doit être révisée en cas de fusion, de changement de dénomination ou de changement de majorité du capital.", "Normale"),
]
for i, r in enumerate(rows2, start=2):
    rang, action, pourquoi, urgence = r
    body_cell(ws2, i, 1, rang, align="center", bold=True)
    body_cell(ws2, i, 2, action, bold=True)
    body_cell(ws2, i, 3, pourquoi)
    ucolor, ufill = URGENCE_STYLE.get(urgence, (INK, None))
    body_cell(ws2, i, 4, urgence, color=ucolor, fill=ufill, bold=True, align="center")
ws2.sheet_view.showGridLines = False
setup_print(ws2, landscape=True)

# =====================================================================
# Feuille 3 — Mode d'emploi
# =====================================================================
ws3 = wb.create_sheet("Mode emploi")
ws3.column_dimensions["A"].width = 100
title = ws3.cell(row=1, column=1, value="Mode d'emploi du registre")
title.font = Font(name=FONT_NAME, bold=True, size=14, color=COBALT)
ws3.row_dimensions[1].height = 24

mode_emploi = [
    "1. Cette feuille « Registre formalités » recense les 24 formalités de constitution et de mise en conformité numérique identifiées pour GROUP ELEGANZ SARL. Elle distingue les modèles déjà rédigés (statut « Préparé (modèle rédigé) » ou « Déjà livré », en vert) des démarches qui nécessitent encore des données réelles ou une vérification externe (« À faire (données réelles) » en ambre, « À vérifier » en rouge clair).",
    "2. La colonne « Urgence » signale en rouge (CRITIQUE) les formalités liées au régime d'autorisation numérique, dont le délai transitoire légal a expiré le 30 juin 2026 : ces lignes doivent être traitées en priorité absolue, avant toute autre démarche de constitution.",
    "3. La feuille « Priorités » propose un ordre de traitement recommandé des 13 actions les plus importantes, avec, pour chacune, la raison de son urgence. Elle ne remplace pas un avis juridique mais aide à séquencer le travail avec le conseil juridique retenu.",
    "4. Mettre à jour le statut de chaque ligne au fur et à mesure de l'avancement réel (par exemple : « Préparé (modèle rédigé) » → « Déposé » → « Obtenu »), et ajouter une date dans la colonne « Observations » à chaque changement de statut pour garder un historique.",
    "5. Ce registre, comme l'ensemble des documents du présent dossier, est un outil de travail interne : il ne se substitue à aucune formalité officielle et doit être recoupé avec les textes en vigueur et les exigences effectivement demandées par le GUCE, l'ARPTC, la DGI et la banque au moment de chaque démarche.",
]
for i, text in enumerate(mode_emploi, start=3):
    c = ws3.cell(row=i, column=1, value=text)
    c.font = Font(name=FONT_NAME, size=11, color=INK)
    c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    ws3.row_dimensions[i].height = 46

ws3.sheet_view.showGridLines = False
setup_print(ws3, landscape=False)

out =__file__.rsplit("/", 1)[0] + "/Registre_formalites_autorisations_GROUP_ELEGANZ.xlsx"
wb.save(out)
print("Written:", out)
