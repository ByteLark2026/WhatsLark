import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';

@WebSocketGateway({
  cors: { origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', credentials: true },
  namespace: '/realtime',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly supabase: SupabaseService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      client.disconnect();
      return;
    }

    const { data: { user } } = await this.supabase.getAdminClient().auth.getUser(token);
    if (!user) {
      client.disconnect();
      return;
    }

    client.data.userId = user.id;
    this.logger.log(`Client connected: ${client.id} (user: ${user.id})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-company')
  handleJoinCompany(@ConnectedSocket() client: Socket, @MessageBody() data: { company_id: string }) {
    client.join(`company:${data.company_id}`);
    this.logger.log(`Client ${client.id} joined company room ${data.company_id}`);
    return { success: true };
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversation_id: string }) {
    client.join(`conversation:${data.conversation_id}`);
    return { success: true };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversation_id: string }) {
    client.leave(`conversation:${data.conversation_id}`);
    return { success: true };
  }

  /** Emit a new message to all clients in a company room */
  emitNewMessage(companyId: string, conversationId: string, message: any) {
    this.server.to(`company:${companyId}`).emit('new-message', { conversation_id: conversationId, message });
    this.server.to(`conversation:${conversationId}`).emit('message', message);
  }

  /** Emit conversation status change */
  emitConversationUpdate(companyId: string, conversation: any) {
    this.server.to(`company:${companyId}`).emit('conversation-updated', conversation);
  }

  /** Emit typing indicator */
  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { conversation_id: string; is_typing: boolean }) {
    client.to(`conversation:${data.conversation_id}`).emit('typing', {
      user_id: client.data.userId,
      is_typing: data.is_typing,
    });
  }
}
