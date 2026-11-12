import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";

/**
 * Route publique, SANS authentification (12 nov. 2026, demande : "donner la
 * possibilité à la boutique de partager la facture après paiement effectif
 * via whatsapp automatiquement au numéro whatsapp renseigné par le client").
 * Volontairement un contrôleur séparé, distinct de DocumentsController, pour
 * que l'absence de @UseGuards ici soit évidente au premier coup d'œil et ne
 * puisse jamais être confondue avec un oubli sur une route censée être
 * protégée. Voir DocumentsService.renderPdfPublic pour la restriction aux
 * seuls documents de commande Marketplace et le raisonnement de sécurité
 * (identifiant UUID v4 non énumérable = jeton de partage).
 */
@Controller("documents/public")
export class DocumentsPublicController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(":documentId/pdf")
  async pdf(@Param("documentId") documentId: string, @Res() res: Response) {
    const doc = await this.documentsService.renderPdfPublic(documentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="facture-${documentId}.pdf"`);
    doc.pipe(res);
  }
}
