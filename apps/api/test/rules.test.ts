import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashToken } from '../src/common/tokens.js';
import { as, attend, boot, db, event, shutdown, user } from './harness.js';

beforeAll(boot);
afterAll(shutdown);

const live = (eventId: string, adminId: string) => as(adminId).patch(`/events/${eventId}`, { status: 'LIVE' });

describe('events', () => {
  it('a Draft event is 404 for everyone but its Admins', async () => {
    const admin = await user();
    const other = await user();
    const id = await event(admin.id);
    expect((await as(admin.id).get(`/events/${id}`)).status).toBe(200);
    expect((await as(other.id).get(`/events/${id}`)).status).toBe(404);
    expect((await as().get(`/events/${id}`)).status).toBe(404);
  });

  it('ends must be after starts (400 with the field)', async () => {
    const admin = await user();
    const res = await as(admin.id).post('/events', { title: 'x', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() - 1000).toISOString(), capacity: 10, preset: 'room' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors[0].field).toBe('endsAt');
  });

  it('Free plan capacity above 50 is refused with 402', async () => {
    const admin = await user();
    const res = await as(admin.id).post('/events', { title: 'x', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(), capacity: 51, preset: 'room' });
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('PLAN_LIMIT');
  });

  it('a Presenter or Judge cannot end the event', async () => {
    const admin = await user();
    const judge = await user();
    const id = await event(admin.id);
    await live(id, admin.id);
    await db.eventMember.create({ data: { eventId: id, userId: judge.id, roles: ['JUDGE'] } });
    const res = await as(judge.id).patch(`/events/${id}`, { status: 'EXHIBITION' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('a status-only PATCH keeps the description', async () => {
    const admin = await user();
    const id = await event(admin.id, { description: 'Keep me' });
    await as(admin.id).patch(`/events/${id}`, { status: 'PUBLISHED' });
    expect((await as(admin.id).get(`/events/${id}`)).body.description).toBe('Keep me');
  });

  it('delete needs the exact event name (422 otherwise)', async () => {
    const admin = await user();
    const id = await event(admin.id);
    expect((await as(admin.id).delete(`/events/${id}?confirm=nope`)).body.code).toBe('CONFIRMATION_MISMATCH');
    expect((await as(admin.id).delete(`/events/${id}?confirm=Test%20showcase`)).status).toBe(204);
  });
});

describe('people', () => {
  it('the last Admin cannot be removed, even by themselves', async () => {
    const admin = await user();
    const id = await event(admin.id);
    const res = await as(admin.id).delete(`/events/${id}/members/${admin.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_ADMIN');
  });

  it('an invite link works once (410 INVITE_USED for a second account)', async () => {
    const admin = await user();
    const a = await user();
    const b = await user();
    const id = await event(admin.id);
    await as(admin.id).post(`/events/${id}/invites`, { emails: [a.email], roles: ['JUDGE'] });
    const token = 'fixed-test-token-' + id;
    await db.eventInvite.updateMany({ where: { eventId: id, email: a.email }, data: { tokenHash: hashToken(token) } });
    expect((await as(a.id).post(`/invites/${token}/acceptances`)).status).toBe(201);
    const second = await as(b.id).post(`/invites/${token}/acceptances`);
    expect(second.status).toBe(410);
    expect(second.body.code).toBe('INVITE_USED');
  });

  it('a 6th judge on the Free plan is refused with 402', async () => {
    const admin = await user();
    const id = await event(admin.id);
    const emails = Array.from({ length: 5 }, (_, i) => `j${i}-${id.slice(0, 6)}@test.local`);
    expect((await as(admin.id).post(`/events/${id}/invites`, { emails, roles: ['JUDGE'] })).status).toBe(202);
    const sixth = await as(admin.id).post(`/events/${id}/invites`, { emails: [`j6-${id.slice(0, 6)}@test.local`], roles: ['JUDGE'] });
    expect(sixth.status).toBe(402);
  });

  it('only Admins assign roles', async () => {
    const admin = await user();
    const presenter = await user();
    const visitor = await user();
    const id = await event(admin.id);
    await as(admin.id).patch(`/events/${id}`, { status: 'PUBLISHED' });
    await db.eventMember.create({ data: { eventId: id, userId: presenter.id, roles: ['PRESENTER'] } });
    await attend(id, visitor.id);
    expect((await as(presenter.id).put(`/events/${id}/members/${visitor.id}`, { roles: ['ADMIN'] })).status).toBe(403);
  });
});

describe('the gate into the hall', () => {
  it('domain lock refuses outsiders but an invited judge with gmail gets in', async () => {
    const admin = await user();
    const outsider = await user('someone@gmail.com'.replace('someone', `o${Date.now()}`));
    const judge = await user(`j${Date.now()}@gmail.com`);
    const id = await event(admin.id, { allowedDomain: 'kmutt.ac.th' });
    await live(id, admin.id);
    await db.eventMember.create({ data: { eventId: id, userId: judge.id, roles: ['JUDGE'] } });
    await attend(id, outsider.id);
    await attend(id, judge.id);
    const o = await as(outsider.id).post(`/events/${id}/hall-tickets`);
    expect(o.status).toBe(403);
    expect(o.body.code).toBe('DOMAIN_NOT_ALLOWED');
    expect((await as(judge.id).post(`/events/${id}/hall-tickets`)).status).toBe(201);
  });

  it('a full hall refuses visitors but not judges', async () => {
    const admin = await user();
    const visitor = await user();
    const judge = await user();
    const id = await event(admin.id, { capacity: 2 });
    await live(id, admin.id);
    await db.eventMember.create({ data: { eventId: id, userId: judge.id, roles: ['JUDGE'] } });
    for (const u of [visitor, judge]) await attend(id, u.id);
    const others = [await user(), await user()];
    for (const o of others) await db.presenceSession.create({ data: { eventId: id, userId: o.id } });
    const v = await as(visitor.id).post(`/events/${id}/hall-tickets`);
    expect(v.status).toBe(409);
    expect(v.body.code).toBe('HALL_FULL');
    expect((await as(judge.id).post(`/events/${id}/hall-tickets`)).status).toBe(201);
    await db.presenceSession.deleteMany({ where: { eventId: id } });
  });

  it('no join form yet → 409 JOIN_FORM_REQUIRED · banned → 403', async () => {
    const admin = await user();
    const v = await user();
    const id = await event(admin.id);
    await live(id, admin.id);
    expect((await as(v.id).post(`/events/${id}/hall-tickets`)).body.code).toBe('JOIN_FORM_REQUIRED');
    await attend(id, v.id);
    await as(admin.id).put(`/events/${id}/bans/${v.id}`, { reason: 'test' });
    expect((await as(v.id).post(`/events/${id}/hall-tickets`)).body.code).toBe('BANNED');
  });
});

describe('judging, votes and feedback', () => {
  async function setup() {
    const admin = await user();
    const judge = await user();
    const otherJudge = await user();
    const presenter = await user();
    const visitor = await user();
    const id = await event(admin.id);
    const p1 = (await as(admin.id).post(`/events/${id}/projects`, { title: 'P1', memberEmails: [] })).body.id;
    const p2 = (await as(admin.id).post(`/events/${id}/projects`, { title: 'P2', memberEmails: [] })).body.id;
    await db.eventMember.createMany({ data: [{ eventId: id, userId: judge.id, roles: ['JUDGE'] }, { eventId: id, userId: otherJudge.id, roles: ['JUDGE'] }, { eventId: id, userId: presenter.id, roles: ['PRESENTER'] }] });
    await db.projectMember.create({ data: { projectId: p2, userId: presenter.id } });
    const rubric = (await as(admin.id).put(`/events/${id}/rubric`, { criteria: [{ name: 'Depth', maxScore: 10, weight: 60 }, { name: 'Impact', maxScore: 10, weight: 40 }] })).body;
    await as(admin.id).put(`/events/${id}/judge-assignments`, { assignments: [{ judgeId: judge.id, projectId: p1 }] });
    await live(id, admin.id);
    await attend(id, visitor.id);
    return { admin, judge, otherJudge, presenter, visitor, id, p1, p2, rubric };
  }

  it('scores need an assignment, lock the rubric, and close when the event ends', async () => {
    const s = await setup();
    const [c1, c2] = s.rubric.criteria;
    expect((await as(s.otherJudge.id).put(`/projects/${s.p1}/score-sheets/me`, { scores: [] })).body.code).toBe('NOT_ASSIGNED');
    expect((await as(s.judge.id).put(`/projects/${s.p1}/score-sheets/me`, { scores: [{ criterionId: c1.id, score: 11 }] })).status).toBe(400);
    expect((await as(s.judge.id).put(`/projects/${s.p1}/score-sheets/me`, { scores: [{ criterionId: c1.id, score: 8 }] })).status).toBe(200);
    expect((await as(s.judge.id).patch(`/projects/${s.p1}/score-sheets/me`, { status: 'SUBMITTED' })).body.code).toBe('SHEET_INCOMPLETE');
    const locked = await as(s.admin.id).put(`/events/${s.id}/rubric`, { criteria: [{ id: c1.id, name: 'Depth', maxScore: 10, weight: 50 }, { id: c2.id, name: 'Impact', maxScore: 10, weight: 50 }] });
    expect(locked.body.code).toBe('RUBRIC_LOCKED');
    await as(s.judge.id).put(`/projects/${s.p1}/score-sheets/me`, { scores: [{ criterionId: c2.id, score: 5 }] });
    await as(s.admin.id).patch(`/events/${s.id}`, { status: 'EXHIBITION' });
    // a complete draft counts when the event ends
    expect((await db.scoreSheet.findFirstOrThrow({ where: { projectId: s.p1, judgeId: s.judge.id } })).status).toBe('SUBMITTED');
    expect((await as(s.judge.id).put(`/projects/${s.p1}/score-sheets/me`, { scores: [{ criterionId: c1.id, score: 1 }] })).body.code).toBe('JUDGING_CLOSED');
    // scores stay private until the results are announced
    expect((await as(s.visitor.id).get(`/events/${s.id}/awards`)).body).toEqual([]);
  });

  it('one vote per project, none after the end', async () => {
    const s = await setup();
    expect((await as(s.visitor.id).put(`/projects/${s.p1}/votes/me`)).status).toBe(204);
    expect((await as(s.visitor.id).put(`/projects/${s.p1}/votes/me`)).body.code).toBe('ALREADY_EXISTS');
    await as(s.admin.id).patch(`/events/${s.id}`, { status: 'EXHIBITION' });
    expect((await as(s.visitor.id).put(`/projects/${s.p2}/votes/me`)).status).toBe(409);
  });

  it('feedback is only for the booth team and Admins · anonymous hides the name from the team', async () => {
    const s = await setup();
    await as(s.visitor.id).post(`/projects/${s.p2}/feedbacks`, { text: 'Nice!', isAnonymous: true });
    const team = await as(s.presenter.id).get(`/projects/${s.p2}/feedbacks`);
    expect(team.body[0].author).toBeNull();
    expect((await as(s.admin.id).get(`/projects/${s.p2}/feedbacks`)).body[0].author.userId).toBe(s.visitor.id);
    expect((await as(s.presenter.id).get(`/projects/${s.p1}/feedbacks`)).status).toBe(403);
    expect((await as(s.visitor.id).get(`/projects/${s.p2}/feedbacks`)).status).toBe(403);
  });

  it('a Presenter cannot mute someone outside their own booth', async () => {
    const s = await setup();
    const res = await as(s.presenter.id).put(`/events/${s.id}/hall/participants/${s.visitor.id}/microphone`, { muted: true });
    expect(res.status).toBe(403);
    expect((await as(s.admin.id).put(`/events/${s.id}/hall/participants/${s.visitor.id}/microphone`, { muted: false })).body.code).toBe('CANNOT_UNMUTE_OTHERS');
  });
});
