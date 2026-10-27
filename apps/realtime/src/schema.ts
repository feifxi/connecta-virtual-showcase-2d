import { schema, t, type SchemaType } from '@colyseus/schema';

// Synced to every client in the hall · shapes match PlayerView / BoothView in @connecta/shared
export const Player = schema(
  {
    userId: t.string(),
    name: t.string(),
    avatar: t.uint8(),
    x: t.uint16(),
    y: t.uint16(),
    dir: t.string(),
    badges: t.string(), // comma-separated event roles, set by the server only
    booth: t.string(), // projectId of the booth they're in, '' = walking the hall
  },
  'Player',
);
export type Player = SchemaType<typeof Player>;

export const Booth = schema(
  {
    projectId: t.string(),
    slotKey: t.string(),
    title: t.string(),
    zone: t.string(),
    categoryName: t.string(),
    live: t.boolean(),
    count: t.uint16(),
    sharing: t.boolean(),
  },
  'Booth',
);
export type Booth = SchemaType<typeof Booth>;

export const HallState = schema(
  {
    players: t.map(Player),
    booths: t.map(Booth),
    entryPaused: t.boolean(),
  },
  'HallState',
);
export type HallState = SchemaType<typeof HallState>;
