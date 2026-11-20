import { IsEnum, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from "class-validator";
import { DriverVehicleType } from "@eleganz/database";

export class CreateDeliveryZoneDto {
  @IsString()
  commune!: string;

  @IsNumber()
  @Min(0)
  fee!: number;
}

/**
 * Informations d'inscription d'un livreur (prompt du 13 oct. 2026, point 2) :
 * tout ce dont l'administration a besoin pour instruire le dossier avant de
 * valider la souscription (verified = true) — identité, coordonnées, et
 * véhicule. Plaque et permis ne sont exigés qu'en moto/voiture ; un livreur
 * à pied ou à vélo n'a ni l'un ni l'autre.
 */
export class RegisterDriverDto {
  @IsString()
  zone!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsString()
  address!: string;

  @IsEnum(DriverVehicleType)
  vehicleType!: DriverVehicleType;

  @ValidateIf((dto) => dto.vehicleType === DriverVehicleType.MOTO || dto.vehicleType === DriverVehicleType.VOITURE)
  @IsString()
  vehiclePlate?: string;

  @ValidateIf((dto) => dto.vehicleType === DriverVehicleType.MOTO || dto.vehicleType === DriverVehicleType.VOITURE)
  @IsString()
  licenseNumber?: string;

  @IsString()
  idDocumentNumber!: string;

  // Réouverture de l'auto-inscription (20 nov. 2026, demande du propriétaire) :
  // texte libre et facultatif décrivant son offre de service (tarifs
  // indicatifs, zones, disponibilités...) — affiché à titre informatif
  // seulement, jamais un contrat. Voir Driver.conditions, schema.prisma.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditions?: string;

  // Case à cocher obligatoire du bandeau de responsabilité (même esprit que
  // gliv_noteResponsabilite, du point de vue du livreur qui s'inscrit lui-
  // même) : il propose son service en son nom propre, ELEGANZ ne le vérifie
  // pas plus que ce que l'admin valide via `verified`, et la boutique qui le
  // choisit reste seule responsable de la livraison. Jamais stocké comme un
  // enregistrement de consentement séparé — simple garde côté DTO, même
  // niveau de rigueur que le module Experts.
  @IsIn([true], { message: "Vous devez accepter les conditions pour vous inscrire comme livreur." })
  accepteConditions!: boolean;
}

/**
 * Filtres de recherche d'un livreur du réseau ELEGANZ depuis le module
 * Gestion (20 nov. 2026) — une boutique cherche ici avant de demander son
 * ajout à sa propre liste de livreurs agréés (voir ShopDriverAccess).
 */
export class RechercherLivreursDto {
  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsEnum(DriverVehicleType)
  vehicleType?: DriverVehicleType;
}

/**
 * Réponse du livreur à une demande d'ajout envoyée par une boutique — accepter
 * fait passer ShopDriverAccess en ACTIVE (la boutique peut alors l'affecter à
 * une livraison), refuser la fait passer en DECLINED. Jamais un ajout
 * unilatéral de la boutique (décision verrouillée du 20 nov. 2026).
 */
export class RepondreDemandeLivreurDto {
  @IsIn([true, false], { message: "Réponse invalide." })
  accepte!: boolean;
}
