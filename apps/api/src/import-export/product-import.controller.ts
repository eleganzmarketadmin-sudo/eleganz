import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { ProductImportService } from "./product-import.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { RequiresGestionFeature } from "../shops/gestion-feature.decorator";
import { StaffRole } from "@eleganz/database";

const TAILLE_MAX_OCTETS = 5 * 1024 * 1024; // 5 Mo — largement assez pour un fichier Excel de catalogue

@Controller("shops/:shopId/products")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class ProductImportController {
  constructor(private readonly importService: ProductImportService) {}

  @Get("import-template")
  gabarit(@Res() res: Response) {
    const buffer = this.importService.genererGabarit();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="gabarit-articles-eleganz.xlsx"');
    res.send(buffer);
  }

  // Réservé au bouquet "exportExcelPdf" (14 oct. 2026, plan commercial) —
  // `import-template`/`import` restent ouverts à tous (saisir son catalogue
  // n'est jamais une fonctionnalité premium, seule l'extraction l'est).
  @Get("export")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER, StaffRole.ACCOUNTANT)
  @RequiresGestionFeature("exportExcelPdf")
  async exporter(@Param("shopId") shopId: string, @Res() res: Response) {
    const buffer = await this.importService.exporterProduits(shopId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="articles-eleganz.xlsx"');
    res.send(buffer);
  }

  @Post("import")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER)
  @UseInterceptors(FileInterceptor("fichier", { limits: { fileSize: TAILLE_MAX_OCTETS } }))
  async importer(@Param("shopId") shopId: string, @UploadedFile() fichier?: Express.Multer.File) {
    if (!fichier) {
      throw new BadRequestException("Aucun fichier reçu — joignez un classeur Excel (.xlsx).");
    }
    return this.importService.importerProduits(shopId, fichier.buffer);
  }
}
