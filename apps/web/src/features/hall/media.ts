'use client';
import { ConnectionState, Room as LkRoom, RoomEvent, Track, type LocalTrackPublication, type Participant, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client';
import { HEAR_ENTER_TILES, HEAR_LEAVE_TILES, MEDIA_TICK_MS, proximityVolume, TILE, type PlayerView } from '@connecta/shared';
import type { HallConnection } from './connection';
import { useHall } from './store';

export type BoothVideo = { userId: string; source: Track.Source; track: RemoteTrack | null; local?: boolean };
type Listener = (videos: BoothVideo[]) => void;

/**
 * Who you hear and see, decided from Colyseus positions (S4 + booth zones):
 * - in a booth: everyone in the same booth at full volume · nobody outside (no leaking either way)
 * - in the hall: people not inside a booth, by distance (hear < 5 tiles, stop > 7 tiles, quieter with distance)
 * - camera / screen share: only from people in the same booth (LiveKit lets only presenters publish them)
 * LiveKit identity = userId, so participants map to players by userId.
 */
export class HallMedia {
  readonly lk = new LkRoom({ adaptiveStream: true, dynacast: true, publishDefaults: { simulcast: true } });
  private hearing = new Set<string>();
  private wanted = new Map<string, boolean>(); // trackSid → last decision
  private audioEls = new Map<string, HTMLMediaElement>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private lastVideoKey = '';

  constructor(private readonly conn: HallConnection) {}

  onVideos(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  async connect(url: string, token: string) {
    const set = useHall.getState().set;
    const kick = () => this.tick();
    this.lk
      .on(RoomEvent.TrackPublished, kick)
      .on(RoomEvent.ParticipantConnected, kick)
      .on(RoomEvent.TrackSubscribed, (track, pub, p) => this.attach(track, pub, p))
      .on(RoomEvent.TrackUnsubscribed, (track, pub) => this.detach(track, pub))
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => set({ speaking: speakers.map((s) => s.identity) }))
      .on(RoomEvent.LocalTrackPublished, kick)
      .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.ScreenShare) this.setSharing(false);
        if (pub.source === Track.Source.Camera) set({ camera: false });
        kick();
      })
      // an Admin/Presenter muted us on the server → reflect it (only we can unmute ourselves)
      .on(RoomEvent.TrackMuted, (pub, p) => {
        if (p.isLocal && pub.source === Track.Source.Microphone) set({ mic: false });
      })
      .on(RoomEvent.Disconnected, () => set({ audioOk: false }))
      .on(RoomEvent.Reconnected, () => set({ audioOk: true }));
    try {
      await this.lk.connect(url, token, { autoSubscribe: false });
      set({ audioOk: true });
    } catch {
      set({ audioOk: false });
    }
    this.timer = setInterval(() => this.tick(), MEDIA_TICK_MS);
  }

  get connected() {
    return this.lk.state === ConnectionState.Connected;
  }

  async setMic(on: boolean) {
    if (!this.connected) return false;
    try {
      await this.lk.localParticipant.setMicrophoneEnabled(on, { echoCancellation: true, noiseSuppression: true });
      useHall.getState().set({ mic: on });
      return true;
    } catch {
      useHall.getState().set({ mic: false });
      return false;
    }
  }

  async setCamera(on: boolean) {
    if (!this.connected) return false;
    try {
      await this.lk.localParticipant.setCameraEnabled(on);
      useHall.getState().set({ camera: on });
      this.tick();
      return true;
    } catch {
      useHall.getState().set({ camera: false });
      return false;
    }
  }

  /** One screen per booth: a new share replaces the old one (the server tracks who is sharing) */
  async setScreen(on: boolean) {
    if (!this.connected) return false;
    try {
      await this.lk.localParticipant.setScreenShareEnabled(on, { audio: false, resolution: { width: 1920, height: 1080, frameRate: 15 } });
      this.setSharing(on);
      this.tick();
      return true;
    } catch {
      this.setSharing(false);
      return false;
    }
  }

  private setSharing(on: boolean) {
    if (useHall.getState().sharing === on) return;
    useHall.getState().set({ sharing: on });
    this.conn.share(on);
  }

  /** Called when the server says I left my booth: camera and screen stop there */
  async leaveStage() {
    if (this.lk.localParticipant.isScreenShareEnabled) await this.setScreen(false);
    if (this.lk.localParticipant.isCameraEnabled) await this.setCamera(false);
  }

  private players() {
    return this.conn.room?.state.players as Map<string, PlayerView> | undefined;
  }

  private tick() {
    const room = this.conn.room;
    const players = this.players();
    const me = room && players?.get(room.sessionId);
    if (!me) return;
    const byUser = new Map<string, PlayerView>();
    for (const p of players!.values()) byUser.set(p.userId, p);
    const videos: BoothVideo[] = [];
    const hearing: string[] = [];

    for (const p of this.lk.remoteParticipants.values()) {
      const ps = byUser.get(p.identity);
      const tiles = ps ? Math.hypot(ps.x - me.x, ps.y - me.y) / TILE : Infinity;
      let hear: boolean;
      let volume = 1;
      if (me.booth) hear = !!ps && ps.booth === me.booth;
      else if (!ps || ps.booth) hear = false;
      else {
        hear = this.hearing.has(p.identity) ? tiles <= HEAR_LEAVE_TILES : tiles < HEAR_ENTER_TILES;
        volume = proximityVolume(tiles);
      }
      if (hear) this.hearing.add(p.identity);
      else this.hearing.delete(p.identity);
      if (hear) hearing.push(p.identity);
      const see = !!me.booth && ps?.booth === me.booth;

      for (const pub of p.trackPublications.values()) {
        const want = pub.source === Track.Source.Microphone ? hear : see && (pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare);
        this.apply(pub, want);
        if (pub.source === Track.Source.Microphone && pub.track) (pub.track as RemoteTrack & { setVolume(v: number): void }).setVolume(volume);
        if (want && pub.track && pub.source !== Track.Source.Microphone) videos.push({ userId: p.identity, source: pub.source, track: pub.track });
      }
    }
    // my own camera / screen preview while presenting
    for (const pub of this.lk.localParticipant.trackPublications.values())
      if ((pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare) && pub.track) videos.push({ userId: me.userId, source: pub.source, track: pub.track as unknown as RemoteTrack, local: true });

    const st = useHall.getState();
    if (hearing.join() !== st.hearing.join()) st.set({ hearing });
    const key = videos.map((v) => `${v.userId}:${v.source}:${v.track?.sid}`).join('|');
    if (key !== this.lastVideoKey) {
      this.lastVideoKey = key;
      for (const fn of this.listeners) fn(videos);
    }
  }

  private apply(pub: RemoteTrackPublication, want: boolean) {
    if (this.wanted.get(pub.trackSid) === want) return;
    this.wanted.set(pub.trackSid, want);
    if (pub.isSubscribed !== want) pub.setSubscribed(want);
  }

  private attach(track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      el.dataset.identity = p.identity;
      document.body.appendChild(el);
      this.audioEls.set(pub.trackSid, el);
    }
    this.tick();
  }

  private detach(track: RemoteTrack, pub: RemoteTrackPublication) {
    const el = this.audioEls.get(pub.trackSid);
    if (el) {
      track.detach(el);
      el.remove();
      this.audioEls.delete(pub.trackSid);
    }
    this.tick();
  }

  /** Browsers block audio until a click · call from any user gesture */
  async unlockAudio() {
    await this.lk.startAudio().catch(() => undefined);
  }

  async dispose() {
    if (this.timer) clearInterval(this.timer);
    for (const el of this.audioEls.values()) el.remove();
    this.audioEls.clear();
    this.listeners.clear();
    await this.lk.disconnect().catch(() => undefined);
  }
}
