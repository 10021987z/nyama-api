import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    // Critical reviews: real query for reviews with cookRating <= 2
    const criticalReviews = await this.prisma.review.findMany({
      where: { cookRating: { lte: 2 } },
      include: {
        order: {
          select: {
            id: true,
            totalXaf: true,
            cook: {
              select: {
                name: true,
                cookProfile: { select: { displayName: true } },
              },
            },
          },
        },
        author: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      stats: {
        openTickets: 42,
        avgResolutionHours: 3.4,
        satisfactionRate: 94.2,
        refundsXaf: 840000,
      },
      tickets: [
        {
          id: 'LG-9421',
          severity: 'HAUT',
          client: { name: 'Emmanuelle N.', city: 'Yaoundé' },
          restaurant: 'Le Gourmet de Bastos',
          reason: 'Commande non reçue',
          orderId: 'ord-001',
          totalXaf: 12500,
          paymentMethod: 'ORANGE_MONEY',
          messages: [
            { sender: 'client', text: "Bonjour, j'ai commandé il y a 2h et je n'ai toujours rien reçu.", time: '11:42' },
            { sender: 'support', text: 'Désolé pour ce désagrément. Je contacte immédiatement le restaurant.', time: '11:45' },
            { sender: 'client', text: "C'est inadmissible. Je souhaite être remboursée.", time: '11:50' },
          ],
          status: 'OUVERT',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'LG-9425',
          severity: 'MOYEN',
          client: { name: 'Jean-Paul M.', city: 'Douala' },
          restaurant: 'Ndolé de Grand-Mère',
          reason: 'Erreur de commande',
          status: 'OUVERT',
        },
        {
          id: 'LG-9430',
          severity: 'FAIBLE',
          client: { name: 'Awa S.', city: 'Kribi' },
          restaurant: 'Poisson Grillé du Port',
          reason: 'Plat froid',
          status: 'OUVERT',
        },
      ],
      criticalReviews,
    };
  }
}
