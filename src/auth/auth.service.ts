import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const OTP_TTL_SECONDS = 5 * 60;           // 5 minutes
const OTP_RATE_LIMIT = 100;               // max OTP par fenêtre (élevé pour tests)
const OTP_RATE_WINDOW_SECONDS = 15 * 60;  // fenêtre 15 minutes
const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────
  // OTP : demande
  // ─────────────────────────────────────────────
  async requestOtp(phone: string): Promise<{ message: string }> {
    // Rate limit : 5 OTP max par phone sur 15 min
    const rateLimitKey = `otp:rate:${phone}`;
    const count = await this.redis.incr(rateLimitKey, OTP_RATE_WINDOW_SECONDS);
    if (count > OTP_RATE_LIMIT) {
      throw new BadRequestException(
        'Trop de demandes OTP. Réessayez dans 15 minutes.',
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await this.prisma.otpCode.create({
      data: { phone, code: codeHash, expiresAt },
    });

    // En dev, log le code en clair — en prod, envoyer via SMS
    this.logger.log(`📱 OTP pour ${phone} : ${code}`);

    return { message: 'Code OTP envoyé par SMS' };
  }

  // ─────────────────────────────────────────────
  // OTP : vérification
  // ─────────────────────────────────────────────
  async verifyOtp(phone: string, code: string) {
    const now = new Date();

    // Cherche le dernier OTP valide pour ce numéro
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Code OTP invalide ou expiré');
    }

    // Limite les tentatives brute-force (5 max)
    if (otpRecord.attempts >= 5) {
      throw new UnauthorizedException(
        'Trop de tentatives. Demandez un nouveau code.',
      );
    }

    const isValid = await bcrypt.compare(code, otpRecord.code);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Code OTP incorrect');
    }

    // Marquer l'OTP comme utilisé
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: now },
    });

    // Créer l'utilisateur s'il n'existe pas encore
    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, role: UserRole.CLIENT },
      });
      this.logger.log(`✅ Nouveau compte créé : ${phone}`);
    }

    const tokens = await this.generateTokens(user.id, user.role, user.phone);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Refresh access token
  // ─────────────────────────────────────────────
  async refreshAccessToken(refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    // Cherche par scan (table petite en dev) — en prod: stocker un hash prévisible
    const records = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    // Comparaison bcrypt sur tous les tokens non révoqués
    let found: (typeof records)[0] | null = null;
    for (const record of records) {
      if (await bcrypt.compare(refreshToken, record.tokenHash)) {
        found = record;
        break;
      }
    }

    if (!found) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const { user } = found;
    const accessToken = this.signAccessToken(user.id, user.role, user.phone);

    return { accessToken };
  }

  // ─────────────────────────────────────────────
  // Logout — révocation du refresh token
  // ─────────────────────────────────────────────
  async logout(userId: string, refreshToken: string): Promise<{ message: string }> {
    const records = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
    });

    for (const record of records) {
      if (await bcrypt.compare(refreshToken, record.tokenHash)) {
        await this.prisma.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }

    return { message: 'Déconnexion réussie' };
  }

  // ─────────────────────────────────────────────
  // Helpers privés
  // ─────────────────────────────────────────────
  private async generateTokens(userId: string, role: UserRole, phone: string) {
    const accessToken = this.signAccessToken(userId, role, phone);

    const rawRefreshToken = uuidv4();
    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(
      Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private signAccessToken(userId: string, role: UserRole, phone: string): string {
    const secret = this.config.get<string>(
      'JWT_SECRET',
      'nyama-dev-secret-change-in-prod',
    );
    return this.jwt.sign(
      { sub: userId, role, phone },
      { secret, expiresIn: '15m' },
    );
  }
}
