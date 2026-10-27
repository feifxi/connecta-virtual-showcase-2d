import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { env } from '../env.js';

const httpUrl = (ws: string) => ws.replace(/^ws/, 'http');

/** LiveKit: token issue + server-side permission changes (the 3rd place roles are enforced) */
@Injectable()
export class Media {
  private readonly log = new Logger(Media.name);
  private readonly rooms = new RoomServiceClient(httpUrl(env.LIVEKIT_URL), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

  readonly publicUrl = env.PUBLIC_LIVEKIT_URL ?? env.LIVEKIT_URL;
  roomName = (eventId: string) => `hall-${eventId}`;

  /**
   * Everyone may publish a microphone · camera/screen only for presenters, and even then the realtime server
   * enables them only while the presenter stands in their own booth (UpdateParticipant).
   * Subscriptions are manual: the client subscribes by proximity.
   */
  async token(eventId: string, userId: string, name: string) {
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { identity: userId, name, ttl: '6h' });
    at.addGrant({ roomJoin: true, room: this.roomName(eventId), canSubscribe: true, canPublish: true, canPublishData: false, canPublishSources: [TrackSource.MICROPHONE] });
    return at.toJwt();
  }

  async muteMicrophone(eventId: string, userId: string) {
    const p = await this.rooms.getParticipant(this.roomName(eventId), userId).catch(() => null);
    if (!p) return false;
    const mics = p.tracks.filter((t) => t.source === TrackSource.MICROPHONE && !t.muted);
    await Promise.all(mics.map((t) => this.rooms.mutePublishedTrack(this.roomName(eventId), userId, t.sid, true)));
    return true;
  }

  async muteAll(eventId: string) {
    const list = await this.rooms.listParticipants(this.roomName(eventId)).catch(() => []);
    await Promise.all(list.map((p) => this.muteMicrophone(eventId, p.identity)));
  }

  async remove(eventId: string, userId: string) {
    await this.rooms.removeParticipant(this.roomName(eventId), userId).catch(() => undefined);
  }

  async health() {
    try {
      const rooms = await this.rooms.listRooms();
      return { ok: true, rooms: rooms.length };
    } catch (e) {
      this.log.warn(`livekit: ${(e as Error).message}`);
      return { ok: false, rooms: 0 };
    }
  }
}
