import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
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
    @Res() res: Response,
  ) {
    // TODO(diagnostic temporaire) : ce bloc try/catch expose le vrai message
    // d'erreur dans la réponse JSON le temps de diagnostiquer le 500 rencontré
    // en production (aucun accès aux logs Railway depuis ce bac à sable) — à
    // retirer une fois la cause confirmée et corrigée.
    try {
      const doc = await this.documentsService.renderPdf(shopId, documentId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="document-${documentId}.pdf"`);
      doc.pipe(res);
      doc.on("error", (err: Error) => {
        // eslint-disable-next-line no-console
        console.error("[diagnostic pdf] erreur de flux PDFKit:", err);
        if (!res.headersSent) {
          res.status(500).json({ diagnostic: true, message: err.message, stack: err.stack });
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[diagnostic pdf] erreur capturée:", err);
      res.status(500).json({
        diagnostic: true,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  }
}
