import { Module } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { ReviewsController, TemoignagesController } from "./reviews.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [ReviewsService],
  controllers: [ReviewsController, TemoignagesController],
})
export class ReviewsModule {}
