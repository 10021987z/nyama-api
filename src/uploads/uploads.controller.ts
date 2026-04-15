import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('uploads')
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
          return cb(
            new BadRequestException(
              'Format non supporté (JPG, PNG ou PDF uniquement)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }

    const doc = await this.prisma.documentUpload.create({
      data: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      },
      select: { id: true, mimeType: true, size: true, originalName: true },
    });

    return {
      id: doc.id,
      url: `/api/v1/uploads/document/${doc.id}`,
      originalName: doc.originalName,
      size: doc.size,
      mimeType: doc.mimeType,
    };
  }

  @Get('document/:id')
  async getDocument(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.prisma.documentUpload.findUnique({
      where: { id },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    const buffer = Buffer.from(doc.data, 'base64');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (doc.originalName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${doc.originalName}"`,
      );
    }
    res.end(buffer);
  }
}
