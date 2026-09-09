import { NextRequest, NextResponse } from 'next/server';
import { GET as getRawJobs } from '../jobs/route';
import { matchProfessionalProfile } from '../../../lib/profile-matching';

type Job = {
  id: string;
  title: string;
  link: string;
  score: number;
  salary: string | null;
  date: string;
  timestamp?: number;
  rank?: number;
  status: string;
  category?: string;
  categories?: string[];
  city?: string;
  company?: string;
  experience?: string;
  source?: string;
  matchBasis?: string;
  matchReasons?: string[];
};

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.clone();
  rawUrl.pathname = '/api/jobs';
  rawUrl.searchParams.set('__raw', '1');

  const rawResponse = await getRawJobs(new NextRequest(rawUrl));
  const data = await rawResponse.json();
  const jobs: Job[] = Array.isArray(data.jobs) ? data.jobs : [];

  const filtered = jobs
    .map((job) => {
      const match = matchProfessionalProfile(job.title);
      if (!match.eligible || match.score < 70) return null;
      return {
        ...job,
        score: match.score,
        category: match.area,
        categories: Array.from(new Set([...(job.categories || []), match.area])),
        matchBasis: match.basis,
        matchReasons: match.reasons,
      } as Job;
    })
    .filter((job): job is Job => Boolean(job));

  const counts: Record<string, number> = { Todas: filtered.length };
  for (const job of filtered) {
    const category = job.category || 'General';
    counts[category] = (counts[category] || 0) + 1;
  }

  const metadata = {
    total: filtered.length,
    withVerifiedDate: filtered.filter((job) => Boolean(job.timestamp)).length,
    withSalary: filtered.filter((job) => Boolean(job.salary)).length,
    withCompany: filtered.filter((job) => Boolean(job.company?.trim())).length,
    withExperience: filtered.filter((job) => Boolean(job.experience?.trim())).length,
  };
  const hasVerifiedDates = metadata.withVerifiedDate > 0;

  return NextResponse.json(
    {
      ...data,
      jobs: filtered,
      counts,
      metadataQuality: metadata,
      filters: {
        ...(data.filters || {}),
        sort: hasVerifiedDates
          ? 'Fechas verificadas primero; después orden de InfoJobs'
          : 'Orden de InfoJobs; fecha de publicación no verificable',
        profile:
          'Motor de matching basado en CV: experiencia real + DAW + SMR + formación de IA aplicada y ciberseguridad; materias estudiadas solo habilitan puestos junior/de entrada.',
      },
    },
    { status: rawResponse.status },
  );
}
