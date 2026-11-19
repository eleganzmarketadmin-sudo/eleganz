import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { DocumentsService } from "./documents.service";
import { DocumentType } from "@eleganz/database";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";

@Controller("shops/:shopId/documents")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.documentsService.listForShop(shopId);
  }

  @Get("export")
  async export(@Param("shopId") shopId: string, @Res() res: Response) {
    const buffer = await this.documentsService.exporterExcel(shopId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="mes-ventes-eleganz.xlsx"');
    res.send(buffer);
  }

  @Post("pos-sale/:posSaleId")
  generateForPosSale(
    @Param("shopId") shopId: string,
    @Param("posSaleId") posSaleId: string,
    @Body("type") type: DocumentType,
  ) {
    return this.documentsService.generateForPosSale(shopId, posSaleId, type);
  }

  @Post("shop-order/:shopOrderId")
  generateForShopOrder(
    @Param("shopId") shopId: string,
    @Param("shopOrderId") shopOrderId: string,
    @Body("type") type: DocumentType,
  ) {
    return this.documentsService.generateForShopOrder(shopId, shopOrderId, type);
  }

  @Get(":documentId/pdf")
  async pdf(
    @Param("shopId") shopId: string,
    @Param("documentId") documentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Hôte de la requête (19 nov. 2026) — sert à construire le lien public
    // encodé dans le QR code imprimé sur le document (voir
    // DocumentsService.rendrerDocumentCharge) : jamais de domaine codé en
    // dur, pour fonctionner identiquement derrière Railway ou un domaine
    // personnalisé.
    const doc = await this.documentsService.renderPdf(shopId, documentId, req.get("host"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="document-${documentId}.pdf"`);
    doc.pipe(res);
  }
}
