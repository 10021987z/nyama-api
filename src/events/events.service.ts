import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsGateway } from './events.gateway';

const RIDER_LOCATION_TTL = 60; // secondes

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject(forwardRef(() => EventsGateway))
    private readonly gateway: EventsGateway,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private get server() {
    return this.gateway.server;
  }

  /** Émet un événement vers la room personnelle d'une cuisinière (colon + hyphen). */
  notifyCook(cookUserId: string, event: string, data: unknown): void {
    this.server?.to(`cook:${cookUserId}`).emit(event, data);
    this.server?.to(`cook-${cookUserId}`).emit(event, data);
  }

  /** Émet un événement vers la room personnelle d'un client (colon + hyphen). */
  notifyClient(clientUserId: string, event: string, data: unknown): void {
    this.server?.to(`client:${clientUserId}`).emit(event, data);
    this.server?.to(`client-${clientUserId}`).emit(event, data);
  }

  /** Émet un événement vers la room personnelle d'un livreur (colon + hyphen). */
  notifyRider(riderUserId: string, event: string, data: unknown): void {
    this.server?.to(`rider:${riderUserId}`).emit(event, data);
    this.server?.to(`rider-${riderUserId}`).emit(event, data);
  }

  /** Émet un événement vers la room d'une commande (chat cuisinière ↔ livreur). */
  emitToOrderRoom(orderId: string, event: string, data: unknown): void {
    this.server?.to(`order-${orderId}`).emit(event, data);
  }

  /**
   * Émet un `menu:updated` vers la room du cook concerné ET en broadcast
   * global pour que toute app Client connectée (qu'elle consulte ce resto
   * ou non) soit prévenue et re-fetch le menu si pertinent pour elle.
   */
  emitMenuUpdated(
    cookId: string,
    action: 'created' | 'updated' | 'deleted' | 'availability',
    menuItem: unknown,
  ): void {
    const payload = { cookId, action, menuItem };
    this.logger.log(
      `📡 emit('menu:updated') → cook-${cookId} + broadcast | action=${action}`,
    );
    this.server?.to(`cook:${cookId}`).emit('menu:updated', payload);
    this.server?.to(`cook-${cookId}`).emit('menu:updated', payload);
    // Broadcast à tous les sockets (clients consulteront s'ils regardent ce cook)
    this.server?.emit('menu:updated', payload);
  }

  /**
   * Notifie les livreurs disponibles d'une nouvelle commande READY.
   * Si quarterId fourni → room du quartier, sinon → tous les livreurs.
   */
  notifyAvailableRiders(
    quarterId: string | null,
    event: string,
    data: unknown,
  ): void {
    const room = quarterId ? `riders:${quarterId}` : 'riders:all';
    this.server?.to(room).emit(event, data);
  }

  /**
   * Stocke la position GPS du livreur en Redis (TTL 60s)
   * et pousse une mise à jour de tracking au client de sa commande active.
   */
  async updateRiderLocation(
    riderUserId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    // Persistance Redis
    await this.redis.set(
      `rider:location:${riderUserId}`,
      JSON.stringify({ lat, lng, updatedAt: Date.now() }),
      RIDER_LOCATION_TTL,
    );

    // Commande active du livreur (en transit)
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        riderId: riderUserId,
        status: { in: [OrderStatus.PICKED_UP, OrderStatus.DELIVERING] },
      },
      select: { id: true, clientId: true },
    });

    if (activeOrder) {
      const payload = {
        orderId: activeOrder.id,
        riderId: riderUserId,
        lat,
        lng,
        updatedAt: new Date().toISOString(),
      };
      // TODO: standardiser sur 'rider:location' côté clients (actuellement 'tracking:update'
      // est écouté par le client). On émet les deux events + sur la room order-<id>
      // pour que tous les participants puissent suivre la position en temps réel.
      this.logger.log(
        `📡 emit('rider:location'/'tracking:update') → rooms: order-${activeOrder.id}, client-${activeOrder.clientId} | payload: lat=${lat} lng=${lng}`,
      );
      this.notifyClient(activeOrder.clientId, 'tracking:update', payload);
      this.gateway.server?.to(`order-${activeOrder.id}`).emit('tracking:update', payload);
      this.gateway.server?.to(`order-${activeOrder.id}`).emit('rider:location', payload);
      this.notifyClient(activeOrder.clientId, 'rider:location', payload);
    }
  }
}
