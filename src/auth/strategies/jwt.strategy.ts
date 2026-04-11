import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  // Standard user tokens
  role?: string;
  phone?: string;
  // Admin dashboard tokens (signed by nyama-dashboard with the shared
  // JWT_SECRET). Presence of `adminRole` + `isAdmin === true` switches
  // validation into the admin bypass path — see `validate()` below.
  adminRole?: string;
  isAdmin?: boolean;
  username?: string;
  displayName?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'nyama-dev-secret-change-in-prod'),
    });
  }

  async validate(payload: JwtPayload) {
    // ── Admin dashboard path ─────────────────────────────────────────
    // Tokens signed by nyama-dashboard contain `adminRole` + `isAdmin`
    // claims and a `sub` that maps to AdminAccount.id (NOT User.id).
    // We skip the User lookup entirely and return a synthetic principal
    // with role = ADMIN so existing @Roles(UserRole.ADMIN) guards pass.
    if (payload.adminRole) {
      return {
        id: payload.sub,
        role: UserRole.ADMIN,
        adminRole: payload.adminRole,
        isAdmin: true,
        username: payload.username,
        displayName: payload.displayName,
        name: payload.displayName ?? payload.username ?? 'Admin',
        phone: null,
      };
    }

    // ── Standard user path (CLIENT / COOK / RIDER) ───────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, role: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedException('Token invalide : utilisateur introuvable');
    }

    return user;
  }
}
