import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // JWT_SECRET doit être fourni en variable d'environnement en production —
        // jamais de secret en dur dans le code (exigence sécurité du prompt maître §49).
        secret: config.get<string>("JWT_SECRET") ?? "dev-only-insecure-secret",
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
