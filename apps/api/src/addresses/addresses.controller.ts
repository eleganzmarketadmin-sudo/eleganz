import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AddressesService } from "./addresses.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";

// Carnet d'adresses personnel — réservé au titulaire du compte, jamais
// visible par un tiers (ni une boutique, ni un livreur) : seules les
// commandes transmettent une adresse ponctuelle (deliveryCommune, etc.),
// jamais ce carnet directement.
@Controller("addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  lister(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.lister(user.id);
  }

  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.addresses.creer(user.id, dto);
  }

  @Patch(":id")
  modifier(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.modifier(user.id, id, dto);
  }

  @Delete(":id")
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.addresses.supprimer(user.id, id);
  }
}
