import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new ConflictException("Un email ou un numéro de téléphone est requis.");
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as object[],
      },
    });
    if (existing) {
      throw new ConflictException("Un compte existe déjà avec cet email ou ce numéro.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
    });

    return this.issueToken(user.id, user.role);
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException("Identifiants invalides.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as object[],
      },
    });

    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      // Message volontairement générique : ne pas révéler si c'est l'identifiant ou le mot de passe qui est faux.
      throw new UnauthorizedException("Identifiants invalides.");
    }

    if (user.isSuspended) {
      throw new UnauthorizedException(
        "Ce compte a été suspendu. Contactez le support ELEGANZ pour plus d'informations.",
      );
    }

    return this.issueToken(user.id, user.role);
  }

  private async issueToken(userId: string, role: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, role });
    return { accessToken };
  }
}
