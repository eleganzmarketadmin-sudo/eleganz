import { Module } from "@nestjs/common";
import { GuidesService } from "./guides.service";
import { GuidesController } from "./guides.controller";
import { GuidesPublicController } from "./guides-public.controller";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [GuidesController, GuidesPublicController],
  providers: [GuidesService],
})
export class GuidesModule {}
