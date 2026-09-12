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

function salaryBelowProfileMinimum(salary: string | null) {
  if (!salary) return false;
  const nums = [...salary.matchAll(/\d{2,3}(?:\.\d{3})?/g)]
    .map((match) => Number(match[0].replace(/\./g, '')))
    .filter((value) => value >= 12000);
  return nums.length > 0 && Math.max(...nums) < 23000;
}

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

function canonicalInfoJobsLink(link: string): string {
  try {
    const url = new URL(link);
    if (!/^(?:www\.)?infojobs\.net$/i.test(url.hostname)) return link;
    // Los parámetros applicationOrigin/page/sortBy pertenecen a la búsqueda y no a la oferta.
    // Mantener solo la URL canónica evita enlaces distintos para la misma vacante.
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return link;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.clone();
  rawUrl.pathname = '/api/jobs';
  rawUrl.searchParams.set('__raw', '1');

  const rawResponse = await getRawJobs(new NextRequest(rawUrl));
  const data = await rawResponse.json();
  const jobs: Job[] = Array.isArray(data.jobs) ? data.jobs : [];

  const evaluated = jobs.map((job) => ({
    job,
    match: matchProfessionalProfile(job.title),
  }));

  const filteredUnranked = evaluated
    .map(({ job, match }) => {
      if (!match.eligible || match.score < 70 || salaryBelowProfileMinimum(job.salary)) return null;
      return {
        ...job,
        link: canonicalInfoJobsLink(job.link),
        score: match.score,
        category: match.area,
        categories: [match.area],
        modality: modalityFromTitle(job.title),
        matchBasis: match.basis,
        matchReasons: match.reasons,
      } as Job;
    })
    .filter((job): job is Job => Boolean(job));

  // Defensa adicional contra duplicados: el scraper ya agrupa por ID de oferta, pero una
  // misma vacante puede llegar por varias búsquedas con parámetros distintos. Tras convertir
  // el enlace a su forma canónica, conservamos una sola tarjeta por URL y elegimos la versión
  // con mejor información (score, fecha, salario, empresa o experiencia) cuando existe.
  const byCanonicalLink = new Map<string, Job>();
  for (const job of filteredUnranked) {
    const key = job.link || job.id;
    const current = byCanonicalLink.get(key);
    if (!current) {
      byCanonicalLink.set(key, job);
      continue;
    }
    const quality = (item: Job) =>
      item.score +
      (item.timestamp ? 4 : 0) +
      (item.salary ? 3 : 0) +
      (item.company?.trim() ? 2 : 0) +
      (item.experience?.trim() ? 2 : 0) +
      (item.modality ? 1 : 0);
    if (quality(job) > quality(current)) byCanonicalLink.set(key, job);
  }
  const deduplicated = [...byCanonicalLink.values()];
  const duplicatesRemoved = filteredUnranked.length - deduplicated.length;

  // El `rank` original procede de búsquedas distintas por keyword y no representa un orden
  // global fiable. Cuando no existe fecha verificada, priorizamos el encaje con el perfil y
  // usamos el orden original de InfoJobs solo como desempate. Si hay fecha verificada, manda
  // la recencia. Después reasignamos un rank canónico para que cualquier cliente respete el
  // mismo orden sin tener que duplicar esta lógica.
  const filtered = [...deduplicated]
    .sort((a, b) => {
      const at = a.timestamp || 0;
      const bt = b.timestamp || 0;
      if (Boolean(at) !== Boolean(bt)) return bt ? 1 : -1;
      if (at !== bt) return bt - at;
      if (a.score !== b.score) return b.score - a.score;
      const ar = a.rank ?? 999999;
      const br = b.rank ?? 999999;
      if (ar !== br) return ar - br;
      return a.title.localeCompare(b.title, 'es');
    })
    .map((job, index) => ({ ...job, rank: index }));

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
    duplicatesRemoved,
  };

  const rejectedByReason: Record<string, number> = {};
  for (const { job, match } of evaluated) {
    if (match.eligible && match.score >= 70 && !salaryBelowProfileMinimum(job.salary)) continue;
    const reason = salaryBelowProfileMinimum(job.salary)
      ? 'Salario verificado por debajo de 23.000 €'
      : match.reasons[0] || 'Sin motivo de descarte';
    rejectedByReason[reason] = (rejectedByReason[reason] || 0) + 1;
  }

  const profileDiagnostics = {
    input: jobs.length,
    accepted: filtered.length,
    rejected: jobs.length - filteredUnranked.length,
    duplicatesRemoved,
    acceptanceRate: jobs.length ? Number((filtered.length / jobs.length).toFixed(3)) : 0,
    rejectedByReason,
  };

  const hasVerifiedDates = metadata.withVerifiedDate > 0;

  return NextResponse.json(
    {
      ...data,
      jobs: filtered,
      counts,
      metadataQuality: metadata,
      profileDiagnostics,
      filters: {
        ...(data.filters || {}),
        minimumSalary: '23.000 € cuando está indicado',
        sort: hasVerifiedDates
          ? 'Fechas verificadas primero; después afinidad con el perfil y orden de InfoJobs'
          : 'Afinidad con el perfil primero; orden de InfoJobs como desempate porque la fecha no es verificable',
        profile:
          'Motor de matching basado en CV: experiencia real + DAW + SMR + formación de IA aplicada y ciberseguridad; materias estudiadas solo habilitan puestos junior/de entrada.',
        modality:
          'Modalidad solo cuando InfoJobs la declara explícitamente en el título; teletrabajo parcial se clasifica como híbrido.',
        links:
          'URLs canónicas de InfoJobs sin parámetros de búsqueda o tracking; duplicados exactos se eliminan después de canonicalizar.',
      },
    },
    { status: rawResponse.status },
  );
}
