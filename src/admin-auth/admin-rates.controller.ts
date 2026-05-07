import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { RatesService } from '../rates/rates.service';
import { SetRateDto } from '../rates/dto/set-rate.dto';

@ApiTags('Admin Rates')
@Controller('admin/rates')
@UseGuards(AdminJwtGuard)
export class AdminRatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current exchange rate' })
  getCurrent() {
    return this.ratesService.getCurrentRate();
  }

  @Patch()
  @ApiOperation({ summary: 'Set USD → NGN exchange rate' })
  setRate(@Body() dto: SetRateDto) {
    return this.ratesService.setRate(dto.usdToNgn, dto.spreadPercent);
  }
}
