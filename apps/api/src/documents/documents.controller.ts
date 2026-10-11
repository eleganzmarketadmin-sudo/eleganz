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
    const doc = await this.documentsService.renderPdf(shopId, documentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="document-${documentId}.pdf"`);
    doc.pipe(res);
  }
}
