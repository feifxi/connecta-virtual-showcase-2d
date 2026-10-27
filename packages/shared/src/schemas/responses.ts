// Response bodies · the api serializes through these (unknown fields are stripped) and OpenAPI is generated from them
import { z } from 'zod';
import { EVENT_ROLES, EVENT_STATUSES, FILE_KINDS, VISITOR_TYPES, ZONE_COLORS } from '../constants.js';
import { formField } from './index.js';

const id = z.uuid();
const iso = z.string(); // ISO 8601 UTC · mapped from Date in the api
const role = z.enum(EVENT_ROLES);
const errorCode = z.string();

export const page = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), nextCursor: z.string().nullable() });

export const personSchema = z.object({
  userId: id,
  displayName: z.string(),
  avatarPreset: z.number().int().nullable(),
  organization: z.string().nullable(),
  position: z.string().nullable(),
});
export type Person = z.infer<typeof personSchema>;

export const meSchema = z.object({
  id,
  email: z.string(),
  displayName: z.string(),
  avatarPreset: z.number().int().nullable(),
  visitorType: z.enum(VISITOR_TYPES).nullable(),
  province: z.string().nullable(),
  organization: z.string().nullable(),
  position: z.string().nullable(),
  appRole: z.enum(['USER', 'PLATFORM_ADMIN']),
  needsOnboarding: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

export const categoryResponse = z.object({
  id,
  name: z.string(),
  color: z.enum(ZONE_COLORS),
  sort: z.number().int(),
  projectCount: z.number().int(),
});
export type Category = z.infer<typeof categoryResponse>;

export const eventCardSchema = z.object({
  id,
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  coverUrl: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  startsAt: iso,
  endsAt: iso,
  exhibitionUntil: iso.nullable(),
  allowedDomain: z.string().nullable(),
  hostName: z.string(),
  boothCount: z.number().int(),
  interestedCount: z.number().int(),
});
export type EventCard = z.infer<typeof eventCardSchema>;

export const myEventSchema = eventCardSchema.extend({ myRoles: z.array(role), attended: z.boolean(), interested: z.boolean() });
export type MyEvent = z.infer<typeof myEventSchema>;

export const eventDetailSchema = eventCardSchema.extend({
  agenda: z.array(z.object({ time: z.string(), title: z.string() })),
  modules: z.object({ judging: z.boolean(), popularVote: z.boolean(), feedback: z.boolean(), model3d: z.boolean(), ai: z.boolean() }),
  plan: z.enum(['FREE', 'PRO']),
  capacity: z.number().int(),
  hallOpenMode: z.enum(['SCHEDULE', 'MANUAL']),
  resultsAnnouncedAt: iso.nullable(),
  boothDeadline: iso.nullable(),
  submissionsOpen: z.boolean(),
  entryPaused: z.boolean(),
  hallPreset: z.string().nullable(),
  categories: z.array(categoryResponse),
  myRoles: z.array(role),
  myProjectIds: z.array(id),
  interested: z.boolean(),
  attended: z.boolean(),
  /** whether "Join" would pass the gate now · reason = error code otherwise */
  canJoin: z.object({ ok: z.boolean(), reason: errorCode.nullable() }),
});
export type EventDetail = z.infer<typeof eventDetailSchema>;

export const projectCardSchema = z.object({
  id,
  eventId: id,
  title: z.string(),
  summary: z.string().nullable(),
  tags: z.array(z.string()),
  coverUrl: z.string().nullable(),
  category: z.object({ id, name: z.string(), color: z.enum(ZONE_COLORS) }).nullable(),
  boothSlotId: id.nullable(),
  boothLabel: z.string().nullable(),
  members: z.array(personSchema),
});
export type ProjectCard = z.infer<typeof projectCardSchema>;

export const projectFileSchema = z.object({
  id,
  kind: z.enum(FILE_KINDS),
  name: z.string(),
  url: z.string(),
  pageUrls: z.array(z.string()),
  pageCount: z.number().int().nullable(),
  mime: z.string(),
  sizeBytes: z.number(),
  useForAi: z.boolean(),
  createdAt: iso,
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

export const projectDetailSchema = projectCardSchema.extend({
  videoUrl: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  aiEnabled: z.boolean(),
  files: z.array(projectFileSchema),
  version: z.number().int(),
  canEdit: z.boolean(),
  pendingInvites: z.array(z.object({ id, email: z.string() })),
  /** what the booth checklist still misses (presenter view only) */
  checklist: z.array(z.object({ key: z.string(), label: z.string(), done: z.boolean() })),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const memberSchema = personSchema.extend({ email: z.string(), roles: z.array(role), projectIds: z.array(id), assignedAt: iso });
export const membersResponse = z.object({ data: z.array(memberSchema), reserved: z.number().int(), capacity: z.number().int() });
export type Member = z.infer<typeof memberSchema>;

export const inviteSchema = z.object({
  id,
  email: z.string(),
  roles: z.array(role),
  projectId: id.nullable(),
  projectTitle: z.string().nullable(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
  createdAt: iso,
  expiresAt: iso,
  acceptedBy: personSchema.nullable(),
});
export type Invite = z.infer<typeof inviteSchema>;

export const inviteLookupSchema = z.object({
  id,
  eventId: id,
  eventSlug: z.string(),
  eventTitle: z.string(),
  roles: z.array(role),
  projectTitle: z.string().nullable(),
  invitedByName: z.string(),
  maskedEmail: z.string(),
  matchesAccount: z.boolean(),
});
export type InviteLookup = z.infer<typeof inviteLookupSchema>;
export const myInviteSchema = inviteLookupSchema.omit({ matchesAccount: true, maskedEmail: true });
export type MyInvite = z.infer<typeof myInviteSchema>;
export const acceptanceSchema = z.object({ eventSlug: z.string(), roles: z.array(role), projectId: id.nullable() });

export const slotSchema = z.object({
  id,
  key: z.string(),
  label: z.string(),
  block: z.string(),
  fillOrder: z.number().int(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  projectId: id.nullable(),
});
export const hallSchema = z.object({
  preset: z.string().nullable(),
  mapJson: z.record(z.string(), z.unknown()),
  slots: z.array(slotSchema),
  projects: z.array(projectCardSchema),
  categories: z.array(categoryResponse),
  blocks: z.object({ needed: z.number().int(), available: z.number().int(), slotsPerBlock: z.number().int() }),
  unplacedProjectIds: z.array(id),
});
export type HallData = z.infer<typeof hallSchema>;

export const hallTicketSchema = z.object({
  realtimeUrl: z.string(),
  ticket: z.string(),
  mediaUrl: z.string(),
  mediaToken: z.string(),
});
export type HallTicket = z.infer<typeof hallTicketSchema>;

export const formResponseSchema = z.object({ kind: z.enum(['JOIN', 'SURVEY']), fields: z.array(formField), answered: z.boolean() });

export const criterionResponse = z.object({ id, name: z.string(), description: z.string(), maxScore: z.number().int(), weight: z.number(), sort: z.number().int() });
export const rubricResponse = z.object({ id: id.nullable(), lockedAt: iso.nullable(), criteria: z.array(criterionResponse) });
export type Rubric = z.infer<typeof rubricResponse>;

export const scoreSheetResponse = z.object({
  id: id.nullable(),
  projectId: id,
  status: z.enum(['NONE', 'DRAFT', 'SUBMITTED']),
  comment: z.string().nullable(),
  scores: z.array(z.object({ criterionId: id, score: z.number() })),
  percent: z.number().nullable(),
  version: z.number().int(),
  submittedAt: iso.nullable(),
});
export type ScoreSheet = z.infer<typeof scoreSheetResponse>;

export const judgeListSchema = z.object({
  rubric: rubricResponse,
  judgingOpen: z.boolean(),
  items: z.array(z.object({ project: projectCardSchema, status: z.enum(['NONE', 'DRAFT', 'SUBMITTED']), percent: z.number().nullable() })),
});
export type JudgeList = z.infer<typeof judgeListSchema>;

export const judgeAssignmentsResponse = z.object({
  judges: z.array(personSchema),
  assignments: z.array(z.object({ judgeId: id, projectId: id })),
});

export const judgingProgressSchema = z.object({
  judges: z.array(personSchema.extend({ assigned: z.number().int(), submitted: z.number().int(), drafts: z.number().int() })),
  projects: z.array(z.object({ projectId: id, title: z.string(), boothLabel: z.string().nullable(), expected: z.number().int(), submitted: z.number().int() })),
});

export const resultsSchema = z.object({
  criteria: z.array(criterionResponse),
  projects: z.array(
    z.object({
      projectId: id,
      title: z.string(),
      boothLabel: z.string().nullable(),
      category: z.string().nullable(),
      percent: z.number().nullable(),
      sheets: z.number().int(),
      perCriterion: z.record(z.string(), z.number().nullable()),
      votes: z.number().int(),
    }),
  ),
  sheets: z.array(
    z.object({
      id,
      projectId: id,
      judge: personSchema,
      percent: z.number().nullable(),
      comment: z.string().nullable(),
      commentVisible: z.boolean(),
    }),
  ),
});
export type Results = z.infer<typeof resultsSchema>;

export const awardSchema = z.object({ kind: z.enum(['JUDGES', 'AUDIENCE']), rank: z.number().int(), project: projectCardSchema });

export const feedbackResponse = z.object({
  id,
  text: z.string(),
  isAnonymous: z.boolean(),
  status: z.enum(['VISIBLE', 'HIDDEN', 'REMOVED']),
  createdAt: iso,
  author: personSchema.nullable(),
});
export type Feedback = z.infer<typeof feedbackResponse>;

export const myEngagementSchema = z.object({
  voted: z.boolean(),
  votesLeft: z.number().int().nullable(),
  contactRequested: z.boolean(),
  feedbackCount: z.number().int(),
});

export const contactRequestResponse = z.object({
  id,
  person: personSchema,
  email: z.string(),
  phone: z.string().nullable(),
  link: z.string().nullable(),
  message: z.string().nullable(),
  createdAt: iso,
});

export const reportResponse = z.object({
  id,
  reporter: personSchema,
  target: personSchema,
  targetKind: z.enum(['USER', 'CHAT', 'FEEDBACK']),
  snapshot: z.string().nullable(),
  reason: z.string(),
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']),
  createdAt: iso,
});
export const banResponse = z.object({ person: personSchema, reason: z.string(), createdAt: iso, bannedBy: personSchema });
export const auditLogResponse = z.object({
  id: z.string(),
  actor: personSchema.nullable(),
  action: z.string(),
  targetId: z.string().nullable(),
  reason: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
  createdAt: iso,
});

export const notificationResponse = z.object({ id, kind: z.string(), payload: z.record(z.string(), z.unknown()), readAt: iso.nullable(), createdAt: iso });

export const analyticsSummarySchema = z.object({
  interested: z.number().int(),
  attended: z.number().int(),
  attendedFromInterested: z.number().int(),
  walkIns: z.number().int(),
  peakConcurrent: z.number().int(),
  peakAt: iso.nullable(),
  avgMinutes: z.number().nullable(),
  boothVisits: z.number().int(),
  feedbackCount: z.number().int(),
  voteCount: z.number().int(),
});
export const attendancePointSchema = z.object({ at: iso, online: z.number().int() });
export const boothStatsSchema = z.object({
  projectId: id,
  title: z.string(),
  boothLabel: z.string().nullable(),
  visitors: z.number().int(),
  avgMinutes: z.number().nullable(),
  passedBy: z.number().int(),
  screenShareViews: z.number().int(),
  posterViews: z.number().int(),
  feedback: z.number().int(),
  votes: z.number().int(),
  percent: z.number().nullable(),
});
export const heatCellSchema = z.object({ cellX: z.number().int(), cellY: z.number().int(), samples: z.number().int() });
export const audienceSchema = z.object({
  visitorTypes: z.array(z.object({ key: z.string(), count: z.number().int() })),
  provinces: z.array(z.object({ key: z.string(), count: z.number().int() })),
  survey: z.array(z.object({ fieldId: z.string(), label: z.string(), type: z.string(), answers: z.array(z.object({ key: z.string(), count: z.number().int() })) })),
});
export const presenterSummarySchema = z.object({
  booth: boothStatsSchema,
  feedback: z.array(feedbackResponse),
  contactRequests: z.number().int(),
  results: z
    .object({ percent: z.number().nullable(), perCriterion: z.array(z.object({ name: z.string(), percent: z.number().nullable() })), comments: z.array(z.string()), awards: z.array(z.object({ kind: z.string(), rank: z.number().int() })) })
    .nullable(),
});

export const aiAnswerSchema = z.object({ answer: z.string(), sources: z.array(z.object({ fileId: id, name: z.string(), excerpt: z.string() })) });
export const importPreviewSchema = z.object({
  rows: z.array(z.object({ title: z.string(), category: z.string().nullable(), memberEmails: z.array(z.string()), summary: z.string().nullable(), errors: z.array(z.string()) })),
  created: z.number().int(),
});

export const platformEventSchema = eventCardSchema.extend({ suspendedAt: iso.nullable(), createdAt: iso, adminEmails: z.array(z.string()) });
export const platformHealthSchema = z.object({
  online: z.number().int(),
  liveEvents: z.number().int(),
  rooms: z.number().int(),
  storageBytes: z.number(),
  livekit: z.object({ ok: z.boolean(), rooms: z.number().int() }),
  db: z.object({ ok: z.boolean() }),
});
