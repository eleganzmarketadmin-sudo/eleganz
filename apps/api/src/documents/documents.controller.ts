import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentType } from "@eleganz/database";

@Controller("shops/:shopId/documents")
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
}
