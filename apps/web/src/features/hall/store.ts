'use client';
import { create } from 'zustand';
import type { BoothView, ChatMessage, ErrorCode, EventRole } from '@connecta/shared';

/** People as React needs them (no x/y: positions stay in Phaser so React doesn't re-render 15×/s) */
export type HallPerson = { sessionId: string; userId: string; name: string; avatar: number; badges: EventRole[]; booth: string };
export type NearbyBubble = ChatMessage & { expiresAt: number };
export type Side = 'booths' | 'people' | 'agenda' | 'admin' | null;
export type Phase = 'ticket' | 'joining' | 'media' | 'ready' | 'failed' | 'blocked' | 'kicked';

type HallStore = {
  phase: Phase;
  blockedBy: ErrorCode | null;
  kicked: { reason: string; banned: boolean } | null;
  reconnecting: boolean;
  audioOk: boolean;
  mySessionId: string;
  myUserId: string;
  roles: EventRole[];
  people: Record<string, HallPerson>;
  booths: Record<string, BoothView & { sharing: boolean }>;
  entryPaused: boolean;
  /** booth I'm standing next to (outside it) · decided locally from position */
  peek: string | null;
  /** userIds I can hear right now (from the media layer) */
  hearing: string[];
  speaking: string[];
  nearby: NearbyBubble[];
  everyone: ChatMessage[];
  banner: string | null;
  side: Side;
  boothOpen: boolean;
  chatOpen: boolean;
  mic: boolean;
  camera: boolean;
  sharing: boolean;
  zoom: number;
  set: (p: Partial<HallStore>) => void;
};

export const useHall = create<HallStore>((set) => ({
  phase: 'ticket',
  blockedBy: null,
  kicked: null,
  reconnecting: false,
  audioOk: true,
  mySessionId: '',
  myUserId: '',
  roles: [],
  people: {},
  booths: {},
  entryPaused: false,
  peek: null,
  hearing: [],
  speaking: [],
  nearby: [],
  everyone: [],
  banner: null,
  side: null,
  boothOpen: true,
  chatOpen: false,
  mic: false, // everyone enters muted
  camera: false,
  sharing: false,
  zoom: 1.7,
  set: (p) => set(p),
}));

export const selectMe = (s: HallStore) => s.people[s.mySessionId];
export const selectMyBooth = (s: HallStore) => (s.mySessionId ? s.people[s.mySessionId]?.booth || null : null);
