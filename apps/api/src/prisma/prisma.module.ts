import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// Module global : tous les autres modules injectent PrismaService sans le ré-importer.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
