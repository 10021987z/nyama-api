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
        this.logger.warn(`[WS] Connexion refusée — pas de token`);
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
        client.disconnect();
        return;
      }

      client.data.user = user as AuthenticatedUser;

      // Toujours rejoindre la room personnelle client
      await client.join(`client:${user.id}`);

      if (user.role === UserRole.COOK) {
        await client.join(`cook:${user.id}`);
        this.logger.log(`[WS] Cuisinière connectée : ${user.name ?? user.id}`);
      }

      if (user.role === UserRole.RIDER) {
        await client.join(`rider:${user.id}`);
        await client.join('riders:all');
        if (user.quarterId) {
          await client.join(`riders:${user.quarterId}`);
        }
        this.logger.log(`[WS] Livreur connecté : ${user.name ?? user.id}`);
      }

      if (user.role === UserRole.CLIENT) {
        this.logger.log(`[WS] Client connecté : ${user.name ?? user.id}`);
      }

      client.emit('connected', { userId: user.id, role: user.role });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (user) {
      this.logger.log(`[WS] Déconnexion : ${user.id}`);
    }
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
}
