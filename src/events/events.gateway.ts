import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

interface AuthenticatedUser {
  id: string;
  role: UserRole;
  quarterId: string | null;
  name: string | null;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Récupère le token depuis auth.token ou Authorization header
      const raw: string | undefined =
        (client.handshake.auth as { token?: string })?.token ??
        (client.handshake.headers?.authorization as string | undefined);

      const token = raw?.replace(/^Bearer\s+/i, '');

      if (!token) {
        this.logger.warn(`[WS] Connexion refusée — pas de token (socket.id=${client.id})`);
        client.disconnect();
        return;
      }

      const secret = this.config.get<string>(
        'JWT_SECRET',
        'nyama-dev-secret-change-in-prod',
      );
      const payload = this.jwtService.verify<{ sub: string }>(token, { secret });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, quarterId: true, name: true },
      });

      if (!user) {
        this.logger.warn(`[WS] Connexion refusée — user introuvable sub=${payload.sub}`);
        client.disconnect();
        return;
      }

      client.data.user = user as AuthenticatedUser;

      // Log explicite de connexion avec role/userId/socket.id
      this.logger.log(
        `🔌 ${user.role} ${user.id} connected, socket.id=${client.id}`,
      );

      // Auto-join room personnelle au format `${role.toLowerCase()}-${userId}`
      const roleRoom = `${user.role.toLowerCase()}-${user.id}`;
      await client.join(roleRoom);
      this.logger.log(`🚪 Joined room: ${roleRoom}`);

      // Rooms personnelles — on rejoint les 2 formats (colon + hyphen) pour
      // couvrir tous les clients legacy/nouveaux sans casser l'existant.
      await client.join(`client:${user.id}`);
      await client.join(`client-${user.id}`);

      if (user.role === UserRole.COOK) {
        await client.join(`cook:${user.id}`);
        await client.join(`cook-${user.id}`);
        this.logger.log(`[WS] Cuisinière connectée : ${user.name ?? user.id}`);
      }

      if (user.role === UserRole.RIDER) {
        await client.join(`rider:${user.id}`);
        await client.join(`rider-${user.id}`);
        await client.join('riders:all');
        if (user.quarterId) {
          await client.join(`riders:${user.quarterId}`);
        }
        this.logger.log(`[WS] Livreur connecté : ${user.name ?? user.id}`);
      }

      if (user.role === UserRole.CLIENT) {
        this.logger.log(`[WS] Client connecté : ${user.name ?? user.id}`);
      }

      if (user.role === UserRole.ADMIN) {
        await client.join('admin');
        await client.join(`admin-${user.id}`);
        this.logger.log(`[WS] Admin connecté : ${user.name ?? user.id} → room 'admin'`);
      }

      client.emit('connected', { userId: user.id, role: user.role });
    } catch (err) {
      this.logger.warn(
        `[WS] Connexion rejetée : ${(err as Error)?.message ?? 'unknown'} (socket.id=${client.id})`,
      );
      client.disconnect();
    }
  }

  /**
   * Fallback manuel : permet à un client d'émettre 'join' avec {userId, role}
   * pour forcer l'entrée dans sa room personnelle. Utile si le JWT n'est pas
   * encore intégré ou en cas de race condition côté front.
   */
  @SubscribeMessage('join')
  handleManualJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string; role?: string },
  ) {
    if (!data?.userId || !data?.role) {
      this.logger.warn(
        `[WS] Manual join rejeté — payload invalide (socket.id=${client.id})`,
      );
      return;
    }
    const room = `${data.role.toLowerCase()}-${data.userId}`;
    client.join(room);
    this.logger.log(`🚪 Manual join: ${room} by ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (user) {
      this.logger.log(`[WS] Déconnexion : ${user.id}`);
    }
  }

  /**
   * Renvoie une vue inspectable de toutes les sockets connectées (pour debug).
   * Utilisé par GET /admin/socket/debug.
   */
  getDebugInfo() {
    const sockets: Array<{
      socketId: string;
      userId: string | null;
      role: string | null;
      rooms: string[];
    }> = [];

    const socketMap = this.server?.sockets?.sockets;
    if (socketMap) {
      for (const [socketId, socket] of socketMap) {
        const user = (socket.data?.user as AuthenticatedUser | undefined) ?? null;
        sockets.push({
          socketId,
          userId: user?.id ?? null,
          role: user?.role ?? null,
          rooms: Array.from(socket.rooms),
        });
      }
    }

    return {
      totalConnections: sockets.length,
      sockets,
    };
  }

  @SubscribeMessage('rider:location')
  async handleRiderLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { lat: number; lng: number },
  ) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user || user.role !== UserRole.RIDER) return;
    if (typeof payload?.lat !== 'number' || typeof payload?.lng !== 'number') return;

    await this.eventsService.updateRiderLocation(user.id, payload.lat, payload.lng);
  }

  /**
   * Autorise le cuisinier ou le livreur d'une commande à rejoindre la room
   * de chat `order-<orderId>`. Les clients ne sont pas admis dans cette room
   * (ils ont leur propre canal `client:<id>`).
   */
  @SubscribeMessage('join:order')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orderId: string },
  ) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user) return;
    const orderId = payload?.orderId;
    if (!orderId || typeof orderId !== 'string') return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, cookId: true, riderId: true },
    });
    if (!order) return;

    const isCook = user.role === UserRole.COOK && order.cookId === user.id;
    const isRider = user.role === UserRole.RIDER && order.riderId === user.id;
    if (!isCook && !isRider) return;

    await client.join(`order-${orderId}`);
    client.emit('joined:order', { orderId });
  }

  /**
   * Permet au client, à la cuisinière ou au livreur impliqué dans une commande
   * de rejoindre la room `order-<orderId>` pour recevoir les events temps-réel
   * (statut, messages, tracking). Appelé typiquement depuis l'écran de détail.
   */
  @SubscribeMessage('order:subscribe')
  async handleOrderSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orderId: string },
  ) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user) return;
    const orderId = payload?.orderId;
    if (!orderId || typeof orderId !== 'string') return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, clientId: true, cookId: true, riderId: true },
    });
    if (!order) return;

    const isClient = user.role === UserRole.CLIENT && order.clientId === user.id;
    const isCook = user.role === UserRole.COOK && order.cookId === user.id;
    const isRider = user.role === UserRole.RIDER && order.riderId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isClient && !isCook && !isRider && !isAdmin) return;

    await client.join(`order-${orderId}`);
    client.emit('order:subscribed', { orderId });
  }
}
