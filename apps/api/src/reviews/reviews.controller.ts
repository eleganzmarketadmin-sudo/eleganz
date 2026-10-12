import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

// Lecture publique (comme le catalogue Marketplace), écriture réservée aux
// acheteurs connectés — voir marketplace.module.ts pour la convention.
@Controller("marketplace/shops/:shopId/reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Param("shopId") shopId: string, @Query("productId") productId?: string) {
    return this.reviewsService.listForShop(shopId, productId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param("shopId") shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(shopId, user.id, dto);
  }

  @Get("commandes-avisables")
  @UseGuards(JwtAuthGuard)
  commandesAvisables(@Param("shopId") shopId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.commandesAvisables(shopId, user.id);
  }
}

@Controller("marketplace/temoignages")
export class TemoignagesController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Query("limite") limite?: string) {
    return this.reviewsService.listTemoignages(limite ? Number(limite) : undefined);
  }
}
