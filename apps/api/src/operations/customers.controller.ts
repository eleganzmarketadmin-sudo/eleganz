import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, RecordCreditPaymentDto } from "./dto/customer.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";

@Controller("shops/:shopId/customers")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.customersService.list(shopId);
  }

  @Post()
  create(@Param("shopId") shopId: string, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(shopId, dto);
  }

  @Post(":customerId/payments")
  recordPayment(@Param("customerId") customerId: string, @Body() dto: RecordCreditPaymentDto) {
    return this.customersService.recordPayment(customerId, dto.amount);
  }
}
