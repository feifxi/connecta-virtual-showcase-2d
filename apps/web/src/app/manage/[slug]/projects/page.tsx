import type { Metadata } from 'next';
import { AdminHeader } from '@/features/manage/admin-header';
import { ProjectsManager } from '@/features/manage/projects-manager';
import { getEventBySlug } from '@/lib/api/server-data';

export const metadata: Metadata = { title: 'Projects & hall' };

export default async function ProjectsPage({ params }: PageProps<'/manage/[slug]/projects'>) {
  const event = await getEventBySlug((await params).slug);
  return (
    <>
      <AdminHeader event={event} title="Projects & hall" />
      <ProjectsManager initial={event} />
    </>
  );
}
