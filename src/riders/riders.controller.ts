import { Controller } from '@nestjs/common';

// Routes publiques riders — à étendre si nécessaire
// Les routes protégées sont dans RiderController (/rider/*)
@Controller('riders')
export class RidersController {}
