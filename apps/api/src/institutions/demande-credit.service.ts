import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FinanceService } from "../finance/finance.service";
import { SoumettreDemandeCreditDto, CreerDemandeCreditLibreDto } from "./dto/demande-credit.dto";
import { InstitutionStatus } from "@eleganz/database";

function versNombre(d: { montantDemande: unknown; garantieValeurEstimee?: unknown }) {
  return {
    ...d,
    montantDemande: Number(d.montantDemande as number),
    // garantieValeurEstimee est un Decimal? Prisma — même piège que
    // montantDemande (sérialisé en chaîne côté JSON sans cette conversion),
    // mais ici optionnel : `null`/`undefined` doit rester tel quel plutôt
    // que devenir 0, pour ne pas laisser croire qu'une valeur a été saisie.
    garantieValeurEstimee:
      d.garantieValeurEstimee === null || d.garantieValeurEstimee === undefined
        ? d.garantieValeurEstimee
        : Number(d.garantieValeurEstimee as number),
  };
}

// `detail`/`detailPourBoutique` incluent la LoanDecision complète (contrairement
// à `lister`/`listerPourBoutique`, qui n'en gardent que {statut, loanId}) —
// ses propres champs Decimal (montant/tauxAnnuel) ont besoin de la même
// conversion que montantDemande ci-dessus, sans quoi ils resteraient des
// objets Prisma.Decimal sérialisés en chaîne côté JSON (même piège que
// InstitutionPortalService.mesDecisions, déjà corrigé là-bas).
function versNombreAvecDecision(d: { montantDemande: unknown; decision: { montant: unknown; tauxAnnuel: unknown } | null }) {
  return {
    ...versNombre(d),
    decision: d.decision ? { ...d.decision, montant: Number(d.decision.montant as number), tauxAnnuel: Number(d.decision.tauxAnnuel as number) } : null,
  };
}

/**
 * Candidatures de crédit numérotées (16 nov. 2026, demande du propriétaire,
 * point 1 : "le partage du dossier par une boutique doit à sa réception
 * par l'institution générer un numéro unique"). Voir le commentaire sur
 * DemandeCredit dans schema.prisma pour ce que cette entité ajoute par
 * rapport à ShopInstitutionAccess (autorisation permanente, inchangée) et
 * LoanDecision (verdict final, désormais rattachée à une demande via
 * LoanDecision.demandeCreditId).
 */
@Injectable()
export class DemandeCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  /**
   * Compteur atomique par année civile (voir CompteurDemandeCredit dans
   * schema.prisma) — `upsert` + `increment` dans une seule requête,
   * verrouillage de ligne Postgres standard sous Prisma : deux soumissions
   * simultanées ne peuvent jamais recevoir le même numéro.
   */
  private async genererNumero(): Promise<string> {
    const annee = String(new Date().getUTCFullYear());
    const compteur = await this.prisma.compteurDemandeCredit.upsert({
      where: { annee },
      create: { annee, valeur: 1 },
      update: { valeur: { increment: 1 } },
    });
    return `CR-${annee}-${String(compteur.valeur).padStart(6, "0")}`;
  }

  /**
   * Soumission par une boutique (16 nov. 2026) — exige un
   * ShopInstitutionAccess déjà ACTIVE : soumettre une demande n'accorde
   * jamais l'accès de son propre chef, voir le commentaire sur
   * ShopInstitutionAccess. Fige au passage les vrais chiffres financiers
   * de la boutique (FinanceService.dossierCredit) — c'est ce
   * snapshotDossierCreditJson que l'institution consultera, jamais une
   * relecture live modifiable après coup.
   */
  async soumettre(shopId: string, userId: string, dto: SoumettreDemandeCreditDto) {
    const acces = await this.prisma.shopInstitutionAccess.findUnique({
      where: { shopId_institutionId: { shopId, institutionId: dto.institutionId } },
    });
    if (!acces || acces.status !== "ACTIVE") {
      throw new ForbiddenException("Cette institution n'a pas (ou plus) accès à votre dossier.");
    }
    const institution = await this.prisma.institution.findUnique({ where: { id: dto.institutionId } });
    if (!institution || institution.status !== InstitutionStatus.ACTIVE) {
      throw new NotFoundException("Institution introuvable ou inactive.");
    }

    const [shop, dossierCredit] = await Promise.all([
      this.prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { name: true, invoicePhone: true, owner: { select: { email: true, phone: true } } },
      }),
      this.finance.dossierCredit(shopId),
    ]);

    const numero = await this.genererNumero();
    const demande = await this.prisma.demandeCredit.create({
      data: {
        numero,
        institutionId: dto.institutionId,
        shopId,
        nomDemandeur: shop.name,
        contactTelephone: shop.invoicePhone ?? shop.owner.phone ?? null,
        contactEmail: shop.owner.email ?? null,
        raisonSociale: dossierCredit.identiteFiscale.fiscalLegalName,
        scenarioId: dto.scenarioId,
        montantDemande: dto.montantDemande,
        dureeMoisDemandee: dto.dureeMoisDemandee,
        objetFinancement: dto.objetFinancement,
        garantieType: dto.garantieType,
        garantieDescription: dto.garantieDescription,
        garantieValeurEstimee: dto.garantieValeurEstimee,
        snapshotDossierCreditJson: dossierCredit as unknown as object,
        soumiseParUserId: userId,
      },
    });
    return versNombre(demande);
  }

  /**
   * Création libre et autonome par l'institution elle-même (16 nov. 2026,
   * même demande, point 1) — pour un prospect qui n'est pas (encore)
   * boutique ELEGANZ. Pas de snapshot financier possible ici (aucune
   * comptabilité ELEGANZ à figer) : `snapshotDossierCreditJson` reste null,
   * l'analyse reposera sur ce que l'institution recueille elle-même
   * (rendez-vous, documents échangés par ses propres moyens).
   */
  async creerLibre(institutionId: string, userId: string, dto: CreerDemandeCreditLibreDto) {
    const numero = await this.genererNumero();
    const demande = await this.prisma.demandeCredit.create({
      data: {
        numero,
        institutionId,
        shopId: null,
        nomDemandeur: dto.nomDemandeur,
        contactTelephone: dto.contactTelephone,
        contactEmail: dto.contactEmail,
        raisonSociale: dto.raisonSociale,
        montantDemande: dto.montantDemande,
        dureeMoisDemandee: dto.dureeMoisDemandee,
        objetFinancement: dto.objetFinancement,
        soumiseParUserId: userId,
      },
    });
    return versNombre(demande);
  }

  async lister(institutionId: string) {
    const demandes = await this.prisma.demandeCredit.findMany({
      where: { institutionId },
      include: { shop: { select: { id: true, name: true, slug: true } }, decision: { select: { statut: true, loanId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return demandes.map(versNombre);
  }

  async listerPourBoutique(shopId: string) {
    const demandes = await this.prisma.demandeCredit.findMany({
      where: { shopId },
      include: { institution: { select: { id: true, name: true } }, decision: { select: { statut: true, loanId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return demandes.map(versNombre);
  }

  async detail(institutionId: string, numero: string) {
    const demande = await this.prisma.demandeCredit.findUnique({
      where: { numero },
      // `institution` ajouté le 16 nov. 2026 (additif, jamais consommé
      // jusqu'ici côté écran qui connaît déjà "son" institution) pour
      // l'export PDF (demande-credit-pdf-renderer.ts), qui a besoin du nom
      // de l'institution sur le document sans avoir à le redemander.
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        decision: true,
        institution: { select: { name: true } },
      },
    });
    if (!demande || demande.institutionId !== institutionId) {
      throw new NotFoundException("Demande de crédit introuvable.");
    }
    return versNombreAvecDecision(demande);
  }

  async detailPourBoutique(shopId: string, numero: string) {
    const demande = await this.prisma.demandeCredit.findUnique({
      where: { numero },
      include: { institution: { select: { id: true, name: true } }, decision: true },
    });
    if (!demande || demande.shopId !== shopId) {
      throw new NotFoundException("Demande de crédit introuvable.");
    }
    return versNombreAvecDecision(demande);
  }
}
