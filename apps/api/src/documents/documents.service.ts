import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentType } from "@eleganz/database";

// Types émis sans restriction tant que l'homologation DGI n'est pas confirmée
// (décision #9, docs/COMPLIANCE_FACTURE_NORMALISEE.md). INVOICE_FISCAL est
// volontairement absent de cette liste : il ne doit pas pouvoir être généré
// par ce chemin de code avant que l'homologation soit vérifiée manuellement.
const NON_HOMOLOGATED_TYPES: DocumentType[] = [
  DocumentType.TICKET,
  DocumentType.RECEIPT,
  DocumentType.INVOICE_INTERNAL,
  DocumentType.PROFORMA,
  DocumentType.QUOTE,
  DocumentType.CREDIT_NOTE,
  DocumentType.DELIVERY_NOTE,
];

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un document commercial lié à une vente de caisse. N'émet jamais
   * INVOICE_FISCAL — voir docs/COMPLIANCE_FACTURE_NORMALISEE.md pour la
   * procédure à suivre avant d'activer ce type, une fois l'homologation DGI
   * obtenue (décision #9 : les deux versions seront proposées au choix,
   * mais seule la version non homologuée est automatisée pour l'instant).
   */
  async generateForPosSale(shopId: string, posSaleId: string, type: DocumentType) {
    if (!NON_HOMOLOGATED_TYPES.includes(type)) {
      throw new BadRequestException(
        `${type} ne peut pas être généré automatiquement tant que l'homologation DGI n'est pas confirmée (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).`,
      );
    }

    const number = await this.nextNumber(shopId, type);

    return this.prisma.commercialDocument.create({
      data: {
        shopId,
        posSaleId,
        type,
        number,
        isFiscallyHomologated: false,
      },
    });
  }

  async listForShop(shopId: string) {
    return this.prisma.commercialDocument.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Numérotation séquentielle par boutique et par type — basique mais
   * suffisant pour les documents non homologués. La numérotation exigée pour
   * INVOICE_FISCAL dépendra des spécifications techniques DGI, pas encore
   * obtenues (voir docs/COMPLIANCE_FACTURE_NORMALISEE.md).
   */
  private async nextNumber(shopId: string, type: DocumentType): Promise<string> {
    const count = await this.prisma.commercialDocument.count({ where: { shopId, type } });
    const prefix = type.slice(0, 3).toUpperCase();
    return `${prefix}-${shopId.slice(0, 8)}-${String(count + 1).padStart(6, "0")}`;
  }
}
