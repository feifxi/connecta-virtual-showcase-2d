// Request bodies shared by the api (validation + OpenAPI) and the web (forms) · docs/api.md
import { z } from 'zod';
import { AVATAR_COUNT, EVENT_ROLES, EVENT_STATUSES, FILE_KINDS, HALL_PRESETS, VISITOR_TYPES, ZONE_COLORS } from '../constants.js';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1, 'Required').max(max);
const optionalText = (max: number) => text(max).optional().transform((v) => (v ? v : undefined));
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Use a domain like kmutt.ac.th');
const httpUrl = z.url({ protocol: /^https?$/ }).max(500);

export const eventRole = z.enum(EVENT_ROLES);
export const visitorType = z.enum(VISITOR_TYPES);

// ---------- me ----------
export const updateMeSchema = z.object({
  displayName: required(60).optional(),
  avatarPreset: z.number().int().min(0).max(AVATAR_COUNT - 1).optional(),
  visitorType: visitorType.optional(),
  province: required(60).optional(),
  organization: text(120).nullable().optional(),
  position: text(120).nullable().optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export const onboardingSchema = updateMeSchema.required({ displayName: true, avatarPreset: true, visitorType: true, province: true });
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ---------- events ----------
export const agendaItem = z.object({ time: required(10), title: required(160) });
export const modulesSchema = z.object({
  judging: z.boolean(),
  popularVote: z.boolean(),
  feedback: z.boolean(),
  model3d: z.boolean(),
  ai: z.boolean(),
});

// no defaults here: a PATCH must leave fields it doesn't send untouched
const eventFields = {
  title: required(120),
  description: text(4000),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  hallOpenMode: z.enum(['SCHEDULE', 'MANUAL']),
  capacity: z.number().int().min(2).max(10_000),
  allowedDomain: domain.nullable().optional(),
  agenda: z.array(agendaItem).max(40),
  modules: modulesSchema.partial().optional(),
  boothDeadline: z.iso.datetime({ offset: true }).nullable().optional(),
};

export const createEventSchema = z
  .object({
    ...eventFields,
    description: eventFields.description.default(''),
    hallOpenMode: eventFields.hallOpenMode.default('SCHEDULE'),
    agenda: eventFields.agenda.default([]),
    preset: z.enum(HALL_PRESETS),
    categories: z.array(z.object({ name: required(40), color: z.enum(ZONE_COLORS) })).max(12).default([]),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { path: ['endsAt'], message: 'Must be after the start time' });
export type CreateEventInput = z.input<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    ...eventFields,
    status: z.enum(EVENT_STATUSES),
    submissionsOpen: z.boolean(),
  })
  .partial();
export type UpdateEventInput = z.input<typeof updateEventSchema>;

export const categorySchema = z.object({ name: required(40), color: z.enum(ZONE_COLORS), sort: z.number().int().min(0).optional() });

// ---------- people ----------
export const createInvitesSchema = z.object({
  emails: z.array(z.email().trim().toLowerCase()).min(1).max(100),
  roles: z.array(eventRole).min(1),
  projectId: z.uuid().optional(),
});
export const setRolesSchema = z.object({ roles: z.array(eventRole) });
export const banSchema = z.object({ reason: text(300).default('') });
export const projectInviteSchema = z.object({ emails: z.array(z.email().trim().toLowerCase()).min(1).max(10) });

// ---------- hall · projects ----------
export const hallPresetSchema = z.object({ preset: z.enum(HALL_PRESETS) });
export const placementsSchema = z.object({
  placements: z.array(z.object({ projectId: z.uuid(), boothSlotId: z.uuid().nullable() })).max(500),
});
export const createProjectSchema = z.object({
  title: required(160),
  categoryId: z.uuid().nullable().optional(),
  memberEmails: z.array(z.email().trim().toLowerCase()).max(10).default([]),
  summary: optionalText(2000),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

const videoUrl = httpUrl.refine((u) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//.test(u), {
  message: 'YouTube or Vimeo links only',
});
export const updateProjectSchema = z
  .object({
    title: required(160),
    summary: text(2000).nullable(),
    categoryId: z.uuid().nullable(),
    tags: z.array(required(30)).max(10),
    videoUrl: videoUrl.nullable().or(z.literal('').transform(() => null)),
    links: z.array(z.object({ label: required(60), url: httpUrl })).max(10),
    aiEnabled: z.boolean(),
  })
  .partial();
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export const fileKindSchema = z.enum(FILE_KINDS);
export const updateFileSchema = z.object({ useForAi: z.boolean() });

// ---------- joining ----------
export const formField = z.object({
  id: required(40),
  type: z.enum(['short_text', 'single', 'multi', 'rating']),
  label: required(200),
  options: z.array(required(100)).max(20).optional(),
  required: z.boolean().default(false),
  purpose: required(200), // PDPA: what the answer is used for
});
export type FormField = z.infer<typeof formField>;
export const formSchema = z.object({ fields: z.array(formField).max(30) });
export const answersSchema = z.record(z.string(), z.union([z.string().max(1000), z.array(z.string().max(100)), z.number()]));
export const attendanceSchema = z.object({
  displayName: required(60),
  visitorType,
  consentMarketing: z.boolean().default(false),
  answers: answersSchema.default({}),
});
export type AttendanceInput = z.input<typeof attendanceSchema>;
export const surveyResponseSchema = z.object({ answers: answersSchema });

// ---------- in the hall ----------
export const microphoneSchema = z.object({ muted: z.boolean() });
export const hallSettingsSchema = z.object({ entryPaused: z.boolean().optional(), muteAll: z.boolean().optional() });
export const announcementSchema = z.object({ text: required(280) });
export const reportSchema = z.object({
  targetUserId: z.uuid(),
  targetKind: z.enum(['USER', 'CHAT', 'FEEDBACK']),
  targetRef: text(100).optional(),
  snapshot: text(1000).optional(),
  reason: required(500),
});
export const reportStatusSchema = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']) });
export const feedbackSchema = z.object({ text: required(2000), isAnonymous: z.boolean().default(false) });
export const feedbackStatusSchema = z.object({ status: z.enum(['VISIBLE', 'HIDDEN', 'REMOVED']) });
export const contactRequestSchema = z.object({
  email: z.email().trim(),
  phone: optionalText(30),
  link: httpUrl.optional().or(z.literal('').transform(() => undefined)),
  message: optionalText(1000),
});
export const aiQuestionSchema = z.object({ question: required(500) });

// ---------- judging ----------
export const rubricSchema = z.object({
  criteria: z
    .array(
      z.object({
        id: z.uuid().optional(),
        name: required(80),
        description: text(500).default(''),
        maxScore: z.number().int().min(1).max(100),
        weight: z.number().positive().max(100),
      }),
    )
    .min(1)
    .max(20),
});
export type RubricInput = z.input<typeof rubricSchema>;
export const judgeAssignmentsSchema = z.object({
  assignments: z.array(z.object({ judgeId: z.uuid(), projectId: z.uuid() })).max(5000),
});
export const scoreSheetSchema = z.object({
  scores: z.array(z.object({ criterionId: z.uuid(), score: z.number().min(0) })).max(20),
  comment: text(2000).nullable().optional(),
});
export const submitSheetSchema = z.object({ status: z.literal('SUBMITTED') });
export const sheetVisibilitySchema = z.object({ commentVisible: z.boolean() });
export const awardsSchema = z.object({
  judgesTop: z.number().int().min(0).max(10).default(3),
  audienceTop: z.number().int().min(0).max(10).default(3),
});

// ---------- lists ----------
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
