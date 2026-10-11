import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateCustomerDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class RecordCreditPaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number;
}
