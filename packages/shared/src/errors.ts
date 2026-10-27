// RFC 9457 Problem Details · the client shows messages from `code`, never from `detail` (docs/api.md → Error)

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  PLAN_LIMIT: 402,
  FORBIDDEN_ROLE: 403,
  BANNED: 403,
  DOMAIN_NOT_ALLOWED: 403,
  NOT_ASSIGNED: 403,
  MODULE_DISABLED: 403,
  NOT_FOUND: 404,
  HALL_FULL: 409,
  INVALID_STATUS_TRANSITION: 409,
  LAST_ADMIN: 409,
  RUBRIC_LOCKED: 409,
  JUDGING_CLOSED: 409,
  ALREADY_EXISTS: 409,
  HALL_NO_SLOT: 409,
  SUBMISSIONS_CLOSED: 409,
  JOIN_FORM_REQUIRED: 409,
  HALL_NOT_OPEN: 409,
  ENTRY_PAUSED: 409,
  CATEGORY_IN_USE: 409,
  INVITE_EXPIRED: 410,
  INVITE_REVOKED: 410,
  INVITE_USED: 410,
  STALE_VERSION: 412,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  CONFIRMATION_MISMATCH: 422,
  SHEET_INCOMPLETE: 422,
  CANNOT_UNMUTE_OTHERS: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UPSTREAM_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type Problem = {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  errors?: { field: string; message: string }[];
  [extra: string]: unknown;
};

/** Short, user-facing text per code · the UI may override with context-specific copy */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Some fields need fixing.',
  UNAUTHENTICATED: 'Please log in to continue.',
  PLAN_LIMIT: 'This is over the limit of the event plan. Upgrade to continue.',
  FORBIDDEN_ROLE: "You don't have permission to do that.",
  BANNED: 'You have been removed from this event.',
  DOMAIN_NOT_ALLOWED: 'This event is only open to a specific email domain.',
  NOT_ASSIGNED: "You aren't assigned to judge this project.",
  MODULE_DISABLED: 'This feature is turned off for this event.',
  NOT_FOUND: "We couldn't find that.",
  HALL_FULL: 'The hall is full right now. Try again in a minute.',
  INVALID_STATUS_TRANSITION: "The event can't move to that status from where it is now.",
  LAST_ADMIN: "You're the only Admin. Add another Admin first, or delete the event.",
  RUBRIC_LOCKED: 'Scoring has started, so criteria and weights are locked. You can still edit descriptions.',
  JUDGING_CLOSED: 'Judging is closed for this event.',
  ALREADY_EXISTS: 'That already exists.',
  HALL_NO_SLOT: 'There are no free booth spots left. Choose a bigger hall preset.',
  SUBMISSIONS_CLOSED: 'Project submissions are closed.',
  JOIN_FORM_REQUIRED: 'Fill in the join form first.',
  HALL_NOT_OPEN: "The hall isn't open yet.",
  ENTRY_PAUSED: 'The organizer has paused new entries for a moment.',
  CATEGORY_IN_USE: 'Move the projects out of this category first.',
  INVITE_EXPIRED: 'This invite has expired. Ask the organizer to send a new one.',
  INVITE_REVOKED: 'This invite was cancelled or replaced by a newer one.',
  INVITE_USED: 'This invite has already been accepted.',
  STALE_VERSION: 'Someone else saved changes first. Reload to see the latest version.',
  FILE_TOO_LARGE: 'That file is too large.',
  UNSUPPORTED_FILE: "That file type isn't supported.",
  CONFIRMATION_MISMATCH: "The name you typed doesn't match.",
  SHEET_INCOMPLETE: 'Score every criterion before submitting.',
  CANNOT_UNMUTE_OTHERS: 'Only people can unmute themselves.',
  RATE_LIMITED: "You're doing that too often. Try again shortly.",
  INTERNAL: 'Something went wrong on our side.',
  UPSTREAM_UNAVAILABLE: 'A service we depend on is unavailable. Try again shortly.',
};
