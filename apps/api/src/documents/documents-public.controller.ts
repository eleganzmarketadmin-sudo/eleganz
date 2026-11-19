import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { DocumentsService } from "./documents.service";

/**
 * Route publique, SANS authentification (12 nov. 2026, demande : "donner la
 * possibilité à la boutique de partager la facture après paiement effectif
 * via whatsapp automatiquement au numéro whatsapp renseigné par le client").
 * Volontairement un contrôleur séparé, distinct de DocumentsController, pour
 * que l'absence de @UseGuards ici soit évidente au premier coup d'œil et ne
 * puisse jamais être confondue avec un oubli sur une route censée être
 * protégée.
 *
 * Mise à jour du 19 nov. 2026 : cette route n'est plus limitée aux documents
 * de commande Marketplace (demande : "voir la possibilité d'un qr code/code
 * barre", réponse explicite de l'utilisateur "Les deux" — code-barres ET QR
 * — ce qui implique que le QR imprimé sur un ticket de caisse pointe lui
 * aussi vers cette route). Voir DocumentsService.renderPdfPublic pour le
 * raisonnement de sécurité inchangé (identifiant UUID v4 non énumérable =
 * jeton de partage) qui rend cette ouverture sûre.
 */
@Controller("documents/public")
export class DocumentsPublicController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(":documentId/pdf")
  async pdf(@Param("documentId") documentId: string, @Req() req: Request, @Res() res: Response) {
    const doc = await this.documentsService.renderPdfPublic(documentId, req.get("host"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="facture-${documentId}.pdf"`);
    doc.pipe(res);
  }
}
