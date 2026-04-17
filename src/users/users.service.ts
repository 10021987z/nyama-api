import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { extname, join, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const PUBLIC_PREFIX = '/api/v1/uploads/avatars';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getStorageRoot(): string {
    const base = this.config.get<string>('AVATAR_STORAGE_PATH');
    return base && base.length > 0
      ? resolve(base)
      : resolve(process.cwd(), 'uploads', 'avatars');
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });
    if (!user) throw new BadRequestException('Utilisateur introuvable');
    return user;
  }

  async uploadAvatar(
    userId: string,
    file?: Express.Multer.File,
    base64Body?: { dataBase64?: string; mimeType?: string },
  ): Promise<{ avatarUrl: string }> {
    let buffer: Buffer;
    let mimeType: string;

    if (file) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        throw new BadRequestException(
          'Format non supporté (JPG ou PNG uniquement)',
        );
      }
      if (file.size > MAX_SIZE) {
        throw new BadRequestException('Image trop lourde (max 5 MB)');
      }
      buffer = file.buffer;
      mimeType = file.mimetype;
    } else if (base64Body?.dataBase64) {
      const mt = (base64Body.mimeType ?? 'image/jpeg').toLowerCase();
      if (!ALLOWED_MIME.has(mt)) {
        throw new BadRequestException(
          'Format non supporté (JPG ou PNG uniquement)',
        );
      }
      // Support data-url prefix
      const raw = base64Body.dataBase64.replace(
        /^data:image\/(jpe?g|png);base64,/i,
        '',
      );
      try {
        buffer = Buffer.from(raw, 'base64');
      } catch {
        throw new BadRequestException('Base64 invalide');
      }
      if (buffer.length > MAX_SIZE) {
        throw new BadRequestException('Image trop lourde (max 5 MB)');
      }
      mimeType = mt;
    } else {
      throw new BadRequestException('Aucun fichier reçu');
    }

    const ext = MIME_EXT[mimeType] ?? extname('') ?? '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const root = this.getStorageRoot();
    try {
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(join(root, filename), buffer);
    } catch (err) {
      this.logger.error(
        `Échec écriture avatar ${filename} dans ${root} : ${(err as Error).message}`,
      );
      throw new InternalServerErrorException(
        'Impossible de stocker la photo de profil',
      );
    }

    const avatarUrl = `${PUBLIC_PREFIX}/${filename}`;

    // Best-effort cleanup of previous file on disk.
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (previous?.avatarUrl && previous.avatarUrl.startsWith(PUBLIC_PREFIX)) {
      const prevName = previous.avatarUrl.slice(PUBLIC_PREFIX.length + 1);
      if (prevName && prevName !== filename) {
        fs.unlink(join(root, prevName)).catch(() => undefined);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }
}
