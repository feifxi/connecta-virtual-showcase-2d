// Demo data for local development and the exam demo · safe to re-run (replaces the demo events by slug)
// Log in as any seeded user with a magic link (dev emails land in Mailpit: http://localhost:8025)
import { config } from 'dotenv';
import { planAllPlacements } from '@connecta/shared';
import { loadPresetMap, presetSlots } from '@connecta/shared/node';
import { createPrisma, type Prisma } from './index.js';

config({ path: new URL('../../../.env', import.meta.url).pathname });
const prisma = createPrisma();

const USERS = [
  { email: 'admin@connecta.local', displayName: 'Yuki', avatarPreset: 5, visitorType: 'TEACHER', appRole: 'PLATFORM_ADMIN' },
  { email: 'mika@connecta.local', displayName: 'Mika', avatarPreset: 0, visitorType: 'STUDENT' },
  { email: 'prae@connecta.local', displayName: 'Prae', avatarPreset: 9, visitorType: 'STUDENT' },
  { email: 'phum@connecta.local', displayName: 'Phum', avatarPreset: 8, visitorType: 'STUDENT' },
  { email: 'ren@connecta.local', displayName: 'Ren', avatarPreset: 3, visitorType: 'STUDENT' },
  { email: 'judge@connecta.local', displayName: 'Dr. Arun', avatarPreset: 10, visitorType: 'TEACHER', organization: 'KMUTT' },
  { email: 'visitor@connecta.local', displayName: 'Nont', avatarPreset: 7, visitorType: 'HIGH_SCHOOL' },
] as const;

const CATEGORIES = [
  { name: 'Engineering', color: 'mint' },
  { name: 'Computing', color: 'lilac' },
  { name: 'Health', color: 'peach' },
  { name: 'Design', color: 'sky' },
] as const;

const PROJECTS: { title: string; category: (typeof CATEGORIES)[number]['name']; summary: string; tags: string[]; member?: string }[] = [
  { title: 'Mapping urban heat with open satellite data', category: 'Engineering', summary: 'Turning open satellite imagery into practical maps of urban heat, so greener streets go where they help most.', tags: ['climate', 'gis'], member: 'mika@connecta.local' },
  { title: 'Sign-language recognition on edge devices', category: 'Computing', summary: 'On-device gesture recognition in real time, with no internet connection required.', tags: ['ai', 'accessibility'], member: 'prae@connecta.local' },
  { title: 'A smarter soil-moisture network for campus gardens', category: 'Engineering', summary: 'A low-cost sensor network that tells gardeners which beds need water today.', tags: ['iot'], member: 'phum@connecta.local' },
  { title: 'A modular bike-share dock from recycled aluminium', category: 'Design', summary: 'A repairable bike dock made from reclaimed aluminium for short campus trips.', tags: ['circular design'], member: 'ren@connecta.local' },
  { title: 'Adaptive prosthetic grip with tactile feedback', category: 'Health', summary: 'A lightweight prosthetic hand that buzzes the wearer when an object starts to slip.', tags: ['assistive tech'] },
  { title: 'Speech-to-text tutoring for first-generation students', category: 'Computing', summary: 'Accessible lecture notes and real-time captions, co-designed with students.', tags: ['education', 'hci'] },
  { title: 'Low-power air quality badges', category: 'Engineering', summary: 'Wearable PM2.5 sensors that last a semester on one charge.', tags: ['iot', 'health'] },
  { title: 'Campus wayfinding for wheelchair users', category: 'Design', summary: 'Step-free routes generated from building plans and crowd reports.', tags: ['accessibility', 'maps'] },
  { title: 'Early sepsis alerts from ward vitals', category: 'Health', summary: 'A triage model that flags sepsis risk hours earlier from routine vitals.', tags: ['ai', 'healthcare'] },
  { title: 'Peer code review bot for programming labs', category: 'Computing', summary: 'Gives first-year students instant, friendly feedback on lab submissions.', tags: ['education', 'ai'] },
];

const hours = (h: number) => new Date(Date.now() + h * 3_600_000);

async function upsertUsers() {
  const ids = new Map<string, string>();
  for (const u of USERS) {
    const data = {
      name: u.displayName,
      displayName: u.displayName,
      avatarPreset: u.avatarPreset,
      visitorType: u.visitorType,
      province: 'Bangkok',
      organization: 'organization' in u ? u.organization : null,
      appRole: 'appRole' in u ? u.appRole : 'USER',
      emailVerified: true,
      onboardedAt: new Date(),
    } satisfies Prisma.UserUpdateInput;
    const row = await prisma.user.upsert({ where: { email: u.email }, update: data, create: { email: u.email, ...data } });
    ids.set(u.email, row.id);
  }
  return ids;
}

async function createEvent(opts: { slug: string; title: string; description: string; status: 'DRAFT' | 'PUBLISHED' | 'LIVE'; startsAt: Date; endsAt: Date; adminId: string; preset: 'hall' | 'room'; allowedDomain?: string }) {
  await prisma.event.deleteMany({ where: { slug: opts.slug } });
  return prisma.event.create({
    data: {
      slug: opts.slug,
      title: opts.title,
      description: opts.description,
      status: opts.status,
      plan: 'PRO',
      capacity: 300,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      allowedDomain: opts.allowedDomain ?? null,
      createdById: opts.adminId,
      agenda: [
        { time: '10:00', title: 'Hall opens, with a short tour of how to get around' },
        { time: '10:15', title: 'Booths open — walk in any time' },
        { time: '13:00', title: 'Judges start their rounds' },
        { time: '16:00', title: 'Hall closes · results announced by the organizer' },
      ],
      members: { create: { userId: opts.adminId, roles: ['ADMIN'], assignedById: opts.adminId } },
      hall: {
        create: {
          preset: opts.preset,
          mapJson: loadPresetMap(opts.preset) as unknown as Prisma.InputJsonValue,
          slots: { create: presetSlots(opts.preset) },
        },
      },
      forms: { create: [{ kind: 'JOIN', fields: [] }, { kind: 'SURVEY', fields: [] }] },
    },
    include: { hall: { include: { slots: true } } },
  });
}

async function main() {
  const users = await upsertUsers();
  const adminId = users.get('admin@connecta.local')!;
  const judgeId = users.get('judge@connecta.local')!;

  const live = await createEvent({
    slug: 'senior-design-2026',
    title: 'Senior Design Showcase 2026',
    description: 'A year of making, questioning and figuring things out. Walk into any booth and talk to the students turning their ideas into something real.',
    status: 'LIVE',
    startsAt: hours(-1),
    endsAt: hours(6),
    adminId,
    preset: 'hall',
  });
  const categories = [];
  for (const [sort, c] of CATEGORIES.entries())
    categories.push(await prisma.eventCategory.create({ data: { eventId: live.id, name: c.name, color: c.color, sort } }));
  const catId = new Map(categories.map((c) => [c.name, c.id]));

  const projects = [];
  for (const p of PROJECTS) {
    projects.push(
      await prisma.project.create({
        data: {
          eventId: live.id,
          title: p.title,
          summary: p.summary,
          tags: p.tags,
          categoryId: catId.get(p.category)!,
          links: [],
          members: p.member ? { create: { userId: users.get(p.member)! } } : undefined,
        },
      }),
    );
  }
  const { placements } = planAllPlacements(
    live.hall!.slots.map((s) => ({ id: s.id, block: s.block, fillOrder: s.fillOrder })),
    projects.map((p) => ({ id: p.id, categoryId: p.categoryId, boothSlotId: null })),
    categories.map((c) => c.id),
  );
  for (const [projectId, boothSlotId] of placements) await prisma.project.update({ where: { id: projectId }, data: { boothSlotId } });

  const presenters = PROJECTS.filter((p) => p.member).map((p) => users.get(p.member!)!);
  for (const userId of presenters)
    await prisma.eventMember.create({ data: { eventId: live.id, userId, roles: ['PRESENTER'], assignedById: adminId } });
  await prisma.eventMember.create({ data: { eventId: live.id, userId: judgeId, roles: ['JUDGE'], assignedById: adminId } });

  await prisma.rubric.create({
    data: {
      eventId: live.id,
      criteria: {
        create: [
          { name: 'Technical depth', description: 'How hard the problem is and how well it was solved', maxScore: 10, weight: 35, sort: 0 },
          { name: 'Problem & impact', description: 'A real problem, with evidence it matters', maxScore: 10, weight: 30, sort: 1 },
          { name: 'Presentation', description: 'Clear booth, poster and answers', maxScore: 10, weight: 20, sort: 2 },
          { name: 'Feasibility', description: 'Could this be used for real?', maxScore: 10, weight: 15, sort: 3 },
        ],
      },
    },
  });

  await createEvent({
    slug: 'greener-tomorrow',
    title: 'Ideas for a greener tomorrow',
    description: 'Student projects on climate, energy and circular design.',
    status: 'PUBLISHED',
    startsAt: hours(24 * 6),
    endsAt: hours(24 * 6 + 6),
    adminId,
    preset: 'room',
    allowedDomain: 'kmutt.ac.th',
  });

  console.log(`seeded ${USERS.length} users · live event /e/${live.slug} with ${projects.length} booths`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
