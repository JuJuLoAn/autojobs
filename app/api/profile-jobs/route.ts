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
  modality?: 'Remoto' | 'Híbrido' | 'Presencial';
  source?: string;
  matchBasis?: string;
  matchReasons?: string[];
};

const norm = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function modalityFromTitle(title: string): Job['modality'] | undefined {
  const t = norm(title);
  // Solo se devuelve modalidad cuando está declarada explícitamente en el título.
  // No inferirla por ciudad, empresa ni otras señales ambiguas.
  // El teletrabajo parcial (p. ej. "3 días a la semana") es híbrido, no remoto total.
  if (/\bhibri(?:do|da)\b|\bhybrid\b/.test(t)) return 'Híbrido';
  if (/\b(?:teletrabajo|remoto|remote)\b[^)]{0,35}\b(?:1|2|3|4)\s*dias?\b|\b(?:1|2|3|4)\s*dias?\b[^)]{0,35}\b(?:teletrabajo|remoto|remote)\b/.test(t)) return 'Híbrido';
  if (/100\s*%\s*(?:remoto|teletrabajo|remote)|\b(?:remoto|remote)\b|\bteletrabajo\b/.test(t)) return 'Remoto';
  if (/\bpresencial\b|\bon[- ]?site\b/.test(t)) return 'Presencial';
  return undefined;
}

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
        modality: modalityFromTitle(job.title),
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
    withModality: filtered.filter((job) => Boolean(job.modality)).length,
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
        modality:
          'Modalidad solo cuando InfoJobs la declara explícitamente en el título; teletrabajo parcial se clasifica como híbrido.',
      },
    },
    { status: rawResponse.status },
  );
}
