"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "../lib/i18n/LocaleContext";
import { DropdownNavGroup } from "../components/DropdownNavGroup";
import styles from "./AdminFinanceSubNav.module.css";

interface OngletSimple {
  href: string;
  cle: string;
}

interface GroupeOnglets {
  groupeCle: string;
  onglets: OngletSimple[];
}

function estGroupe(e: OngletSimple | GroupeOnglets): e is GroupeOnglets {
  return "onglets" in e;
}

// Sous-navigation du menu "Finance & Comptabilité" du Centre de pilotage
// (demande du 16 oct. 2026, point 2 : "LE Dossier crédit n'est pas dans le
// menu finances et compta du centre de pilotage") — jusqu'ici chaque
// sous-page (comptabilité, règles fiscales) n'avait qu'un simple lien de
// retour vers le tableau de bord, rien ne regroupait les rubriques entre
// elles comme FinanceSubNav le fait côté boutique.
//
// Regroupement en menus déroulants (19 nov. 2026, même demande que
// AdminShell/GestionShell : "créer des options navigables ... au lieu de
// défiler sur une longue page interminable des listes d'options" — ces 14
// onglets débordaient déjà sur 2 lignes).
const GROUPE_COMPTABILITE: OngletSimple[] = [
  { href: "/admin/finance/comptabilite", cle: "admfinnav_comptabilite" },
  { href: "/admin/finance/rapport-annuel", cle: "admfinnav_rapportAnnuel" },
  { href: "/admin/finance/cloture", cle: "admfinnav_cloture" },
  { href: "/admin/finance/immobilisations", cle: "admfinnav_immobilisations" },
  { href: "/admin/finance/charges", cle: "admfinnav_charges" },
];
const GROUPE_FISCALITE: OngletSimple[] = [
  { href: "/admin/finance/regles-fiscales", cle: "admfinnav_reglesFiscales" },
  // Ajout du 18 oct. 2026 (audit du 18 oct. 2026, point 2) — jusqu'ici
  // ELEGANZ n'avait aucun moyen d'estimer sa propre charge fiscale, alors
  // que l'outil existait déjà côté boutique (FinanceSubNav).
  { href: "/admin/finance/simulation-fiscale", cle: "admfinnav_simulationFiscale" },
];
const GROUPE_TRESORERIE_CREDIT: OngletSimple[] = [
  { href: "/admin/finance/tresorerie", cle: "admfinnav_tresorerie" },
  { href: "/admin/finance/dossier-credit", cle: "admfinnav_dossierCredit" },
  // Ajout du 19 oct. 2026 — prêts réellement obtenus par ELEGANZ.
  { href: "/admin/finance/prets", cle: "admfinnav_prets" },
];
const GROUPE_RAPPORTS: OngletSimple[] = [
  { href: "/admin/finance/analytique", cle: "admfinnav_analytique" },
  // Ajouts du 19 nov. 2026 (demande : rendre cliquables les cartes "Ventes
  // Caisse" et "Commission Institutions" du Centre de pilotage vers un
  // rapport détaillé) — onglets pour y revenir sans repasser par le
  // pilotage.
  { href: "/admin/finance/ventes-caisse", cle: "admfinnav_ventesCaisse" },
  { href: "/admin/finance/commission-institutions", cle: "admfinnav_commissionInstitutions" },
];

const ENTREES: (OngletSimple | GroupeOnglets)[] = [
  { href: "/admin/finance", cle: "admfinnav_tableauBord" },
  { groupeCle: "admfinnav_comptabilite", onglets: GROUPE_COMPTABILITE },
  { groupeCle: "admfinnav_groupeFiscalite", onglets: GROUPE_FISCALITE },
  { groupeCle: "admfinnav_groupeTresorerieCredit", onglets: GROUPE_TRESORERIE_CREDIT },
  { groupeCle: "admfinnav_groupeRapports", onglets: GROUPE_RAPPORTS },
];

export function AdminFinanceSubNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className={styles.nav}>
      {ENTREES.map((entree, index) => {
        if (!estGroupe(entree)) {
          const actif = pathname === entree.href;
          return (
            <Link key={entree.href} href={entree.href} className={`${styles.onglet} ${actif ? styles.ongletActif : ""}`}>
              {t(entree.cle)}
            </Link>
          );
        }

        if (entree.onglets.length === 1) {
          const seul = entree.onglets[0];
          const actif = pathname === seul.href;
          return (
            <Link key={seul.href} href={seul.href} className={`${styles.onglet} ${actif ? styles.ongletActif : ""}`}>
              {t(seul.cle)}
            </Link>
          );
        }

        const actifGroupe = entree.onglets.some((o) => pathname === o.href);
        return (
          <DropdownNavGroup
            key={`groupe-${index}`}
            label={t(entree.groupeCle)}
            enfants={entree.onglets.map((o) => ({ href: o.href, label: t(o.cle) }))}
            actif={actifGroupe}
            triggerClassName={styles.onglet}
            activeClassName={styles.ongletActif}
          />
        );
      })}
    </nav>
  );
}
