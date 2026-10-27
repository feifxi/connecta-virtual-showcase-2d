// Values shared by web · api · realtime · numbers confirmed in the POC spikes (poc/README.md)

export const EVENT_ROLES = ['ADMIN', 'PRESENTER', 'JUDGE'] as const;
export type EventRole = (typeof EVENT_ROLES)[number];
/** Visitor = no row in event_members · used in UI and realtime badges only */
export type ViewerRole = EventRole | 'VISITOR';

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'LIVE', 'EXHIBITION', 'ARCHIVED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const VISITOR_TYPES = ['STUDENT', 'HIGH_SCHOOL', 'COMPANY', 'ALUMNI', 'PARENT', 'TEACHER'] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];
export const VISITOR_TYPE_LABELS: Record<VisitorType, string> = {
  STUDENT: 'University student',
  HIGH_SCHOOL: 'High school student',
  COMPANY: 'Company / industry',
  ALUMNI: 'Alumni',
  PARENT: 'Parent',
  TEACHER: 'Teacher / lecturer',
};

export const PLANS = ['FREE', 'PRO'] as const;
export type Plan = (typeof PLANS)[number];
export const PLAN_LIMITS: Record<Plan, { capacity: number; judges: number; exhibitionDays: number; ai: boolean }> = {
  FREE: { capacity: 50, judges: 5, exhibitionDays: 7, ai: false },
  PRO: { capacity: 300, judges: Number.POSITIVE_INFINITY, exhibitionDays: 30, ai: true },
};

export const FILE_KINDS = ['POSTER', 'SLIDES', 'DOC', 'MODEL_3D'] as const;
export type FileKind = (typeof FILE_KINDS)[number];
/** Accepted real MIME types (checked from magic bytes) and size limit per kind */
export const FILE_RULES: Record<FileKind, { mimes: string[]; maxBytes: number }> = {
  POSTER: { mimes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], maxBytes: 30 * 1024 * 1024 },
  SLIDES: { mimes: ['application/pdf'], maxBytes: 50 * 1024 * 1024 },
  DOC: { mimes: ['application/pdf', 'text/plain', 'text/markdown'], maxBytes: 10 * 1024 * 1024 },
  MODEL_3D: { mimes: ['model/gltf-binary'], maxBytes: 20 * 1024 * 1024 },
};
export const IMAGE_RULE = { mimes: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 5 * 1024 * 1024 };

export const MODULES = ['judging', 'popularVote', 'feedback', 'model3d', 'ai'] as const;
export type ModuleKey = (typeof MODULES)[number];
export type EventModules = Record<ModuleKey, boolean>;
export const DEFAULT_MODULES: EventModules = { judging: true, popularVote: true, feedback: true, model3d: false, ai: false };

export const INVITE_TTL_DAYS = 14;
export const INVITES_PER_DAY_PER_EVENT = 300;
export const HALL_TICKET_TTL_S = 60;

// ---------- hall / movement (S1 · S3) ----------
export const TILE = 32;
export const TICK_HZ = 15;
export const WALK_SPEED = 150; // px/s
export const FAST_WALK = 3; // "go to booth" walks 3× faster on the client · the server moves you instantly
export const SPEED_TOLERANCE = 1.25;
export const MAX_MOVE_BUDGET_PX = WALK_SPEED * FAST_WALK * 0.5;
/** Stop on a booth carpet = join now · still walking on it = join after this (S5 default) */
export const BOOTH_DWELL_MS = 600;
export const NEARBY_CHAT_TTL_MS = 5000;
export const CHAT_MAX_LENGTH = 300;
export const CHAT_HISTORY_LIMIT = 200;
export const HEATMAP_CELL_TILES = 2;
export const HEATMAP_SAMPLE_MS = 5000;
export const HEATMAP_FLUSH_MS = 60_000;

// ---------- proximity media (S4) ----------
export const HEAR_ENTER_TILES = 5;
export const HEAR_LEAVE_TILES = 7;
export const FULL_VOLUME_TILES = 2;
export const MIN_VOLUME = 0.15;
export const MEDIA_TICK_MS = 200;

/** Zone carpets in the hall art · a category's color is one of these keys */
export const ZONE_COLORS = ['mint', 'lilac', 'peach', 'sky'] as const;
export type ZoneColor = (typeof ZONE_COLORS)[number];
export const ZONE_HEX: Record<ZoneColor | 'neutral', string> = {
  mint: '#3fae7f',
  lilac: '#8a6ee0',
  peach: '#f08a5d',
  sky: '#4b95e0',
  neutral: '#5b6584',
};

export const HALL_PRESETS = ['room', 'hall'] as const;
export type HallPreset = (typeof HALL_PRESETS)[number];
export const HALL_PRESET_INFO: Record<HallPreset, { label: string; booths: number; description: string }> = {
  room: { label: 'Room', booths: 12, description: 'One room, up to 12 booths' },
  hall: { label: 'Hall', booths: 30, description: 'Rows, walkways, a stage, workshop and lounge · up to 30 booths' },
};

export const AVATAR_COUNT = 14;
