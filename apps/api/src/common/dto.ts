// Nest DTO classes from the shared zod schemas · request validation + OpenAPI + response serialization
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import * as s from '@connecta/shared';

// ---------- requests ----------
export class UpdateMeDto extends createZodDto(s.updateMeSchema) {}
export class CreateEventDto extends createZodDto(s.createEventSchema) {}
export class UpdateEventDto extends createZodDto(s.updateEventSchema) {}
export class CategoryDto extends createZodDto(s.categorySchema) {}
export class UpdateCategoryDto extends createZodDto(s.categorySchema.partial()) {}
export class CreateInvitesDto extends createZodDto(s.createInvitesSchema) {}
export class ProjectInviteDto extends createZodDto(s.projectInviteSchema) {}
export class InviteStatusDto extends createZodDto(z.object({ status: z.literal('REVOKED') })) {}
export class SetRolesDto extends createZodDto(s.setRolesSchema) {}
export class BanDto extends createZodDto(s.banSchema) {}
export class HallPresetDto extends createZodDto(s.hallPresetSchema) {}
export class PlacementsDto extends createZodDto(s.placementsSchema) {}
export class CreateProjectDto extends createZodDto(s.createProjectSchema) {}
export class UpdateProjectDto extends createZodDto(s.updateProjectSchema) {}
export class UpdateFileDto extends createZodDto(s.updateFileSchema) {}
export class FormDto extends createZodDto(s.formSchema) {}
export class AttendanceDto extends createZodDto(s.attendanceSchema) {}
export class SurveyResponseDto extends createZodDto(s.surveyResponseSchema) {}
export class MicrophoneDto extends createZodDto(s.microphoneSchema) {}
export class HallSettingsDto extends createZodDto(s.hallSettingsSchema) {}
export class AnnouncementDto extends createZodDto(s.announcementSchema) {}
export class ReportDto extends createZodDto(s.reportSchema) {}
export class ReportStatusDto extends createZodDto(s.reportStatusSchema) {}
export class FeedbackDto extends createZodDto(s.feedbackSchema) {}
export class FeedbackStatusDto extends createZodDto(s.feedbackStatusSchema) {}
export class ContactRequestDto extends createZodDto(s.contactRequestSchema) {}
export class AiQuestionDto extends createZodDto(s.aiQuestionSchema) {}
export class RubricDto extends createZodDto(s.rubricSchema) {}
export class JudgeAssignmentsDto extends createZodDto(s.judgeAssignmentsSchema) {}
export class ScoreSheetDto extends createZodDto(s.scoreSheetSchema) {}
export class SubmitSheetDto extends createZodDto(s.submitSheetSchema) {}
export class SheetVisibilityDto extends createZodDto(s.sheetVisibilitySchema) {}
export class AwardsDto extends createZodDto(s.awardsSchema) {}
export class ImportTextDto extends createZodDto(z.object({ text: z.string().max(100_000) })) {}

// ---------- queries ----------
export class PageQuery extends createZodDto(s.pageQuery) {}
export class ExploreQuery extends createZodDto(
  s.pageQuery.extend({ q: z.string().trim().max(100).optional(), status: z.enum(['PUBLISHED', 'LIVE', 'EXHIBITION']).optional(), slug: z.string().max(120).optional() }),
) {}
export class MyEventsQuery extends createZodDto(z.object({ role: z.enum(['ADMIN', 'PRESENTER', 'JUDGE', 'VISITOR']).optional() })) {}
export class ProjectsQuery extends createZodDto(
  s.pageQuery.extend({ q: z.string().trim().max(100).optional(), categoryId: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
) {}
export class StatusQuery extends createZodDto(z.object({ status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED', 'OPEN', 'RESOLVED', 'DISMISSED']).optional() })) {}
export class UnreadQuery extends createZodDto(z.object({ unread: z.enum(['true', 'false']).optional() })) {}
export class IntervalQuery extends createZodDto(z.object({ interval: z.enum(['1m', '5m', '15m', '60m']).default('5m') })) {}
export class ConfirmQuery extends createZodDto(z.object({ confirm: z.string().max(200) })) {}
export class DryRunQuery extends createZodDto(z.object({ dryRun: z.enum(['true', 'false']).default('false') })) {}
export class FileUploadQuery extends createZodDto(z.object({ kind: s.fileKindSchema, useForAi: z.enum(['true', 'false']).default('false') })) {}

// ---------- responses ----------
export class MeDto extends createZodDto(s.meSchema) {}
export class EventCardPageDto extends createZodDto(s.page(s.eventCardSchema)) {}
export class MyEventDto extends createZodDto(s.myEventSchema) {}
export class EventDetailDto extends createZodDto(s.eventDetailSchema) {}
export class CategoryResponseDto extends createZodDto(s.categoryResponse) {}
export class ProjectCardDto extends createZodDto(s.projectCardSchema) {}
export class ProjectPageDto extends createZodDto(s.page(s.projectCardSchema)) {}
export class ProjectDetailDto extends createZodDto(s.projectDetailSchema) {}
export class ProjectFileDto extends createZodDto(s.projectFileSchema) {}
export class PersonDto extends createZodDto(s.personSchema) {}
export class MembersDto extends createZodDto(s.membersResponse) {}
export class InviteDto extends createZodDto(s.inviteSchema) {}
export class InviteLookupDto extends createZodDto(s.inviteLookupSchema) {}
export class MyInviteDto extends createZodDto(s.myInviteSchema) {}
export class AcceptanceResponseDto extends createZodDto(s.acceptanceSchema) {}
export class HallDto extends createZodDto(s.hallSchema) {}
export class HallTicketDto extends createZodDto(s.hallTicketSchema) {}
export class FormResponseDto extends createZodDto(s.formResponseSchema) {}
export class RubricResponseDto extends createZodDto(s.rubricResponse) {}
export class ScoreSheetResponseDto extends createZodDto(s.scoreSheetResponse) {}
export class JudgeListDto extends createZodDto(s.judgeListSchema) {}
export class JudgeAssignmentsResponseDto extends createZodDto(s.judgeAssignmentsResponse) {}
export class JudgingProgressDto extends createZodDto(s.judgingProgressSchema) {}
export class ResultsDto extends createZodDto(s.resultsSchema) {}
export class AwardDto extends createZodDto(s.awardSchema) {}
export class FeedbackResponseDto extends createZodDto(s.feedbackResponse) {}
export class MyEngagementDto extends createZodDto(s.myEngagementSchema) {}
export class ContactRequestResponseDto extends createZodDto(s.contactRequestResponse) {}
export class ReportResponseDto extends createZodDto(s.reportResponse) {}
export class BanResponseDto extends createZodDto(s.banResponse) {}
export class AuditLogDto extends createZodDto(s.auditLogResponse) {}
export class NotificationDto extends createZodDto(s.notificationResponse) {}
export class AnalyticsSummaryDto extends createZodDto(s.analyticsSummarySchema) {}
export class AttendancePointDto extends createZodDto(s.attendancePointSchema) {}
export class BoothStatsDto extends createZodDto(s.boothStatsSchema) {}
export class HeatCellDto extends createZodDto(s.heatCellSchema) {}
export class AudienceDto extends createZodDto(s.audienceSchema) {}
export class PresenterSummaryDto extends createZodDto(s.presenterSummarySchema) {}
export class AiAnswerDto extends createZodDto(s.aiAnswerSchema) {}
export class ImportPreviewDto extends createZodDto(s.importPreviewSchema) {}
export class PlatformEventDto extends createZodDto(s.platformEventSchema) {}
export class PlatformHealthDto extends createZodDto(s.platformHealthSchema) {}
export class SlugDto extends createZodDto(z.object({ id: z.uuid(), slug: z.string() })) {}
