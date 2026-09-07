import { NextRequest, NextResponse } from 'next/server';
import { GET as getRawJobs } from '../jobs/route';

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
};

const norm = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function matchesProfile(job: Job) {
  const t = norm(job.title);
  if (!t) return false;

  // Only entry/junior roles that map directly to the user's studies or actual work.
  // Higher-responsibility titles are excluded even when they contain a matching technology.
  if (/\b(?:senior|sr\.?|lead|manager|director|head|architect|arquitecto|responsable|jefe|coordinador|supervisor|especialista)\b/.test(t)) return false;
  if (/analista\s+programador/.test(t)) return false;
  if (/administrador(?:\/a)?\s+(?:de\s+)?sistemas/.test(t) && !/\bjunior\b/.test(t)) return false;

  if (/\b(?:comercial|ventas|preventa|presales|teleoperador|call center|marketing|rrhh|recursos humanos|curso|formacion|docente|profesor|consultor)\b/.test(t)) return false;
  if (/scada|iiot|labview|plc|bms|ibms|spark|scala|etl|databricks|microstrategy|data engineer|data scientist|data science|machine learning|ml engineer|mlops|devops|ai engineer|ia engineer|ingeniero.*inteligencia artificial|genai|agentic|ag[eé]ntic|\bllm\b|\brpa\b|blue prism|power bi|business intelligence|prompt engineering|sagemaker|knowledge graph|\brag\b|cmdb|bpm|opentext|oracle webcenter/.test(t)) return false;

  const support = /soporte (?:it|ti|tecnico|informatico)|tecnico(?:\/a)? (?:de )?soporte|help.?desk|service desk|\bcau\b|microinformat|tecnico(?:\/a)? informatico|it support|desktop support|puesto de usuario|becario(?:\/a)? de soporte tecnico/.test(t);
  const development = /desarrollador(?:\/a)? (?:web|frontend|front|backend|full.?stack|react|ecommerce)|programador(?:\/a)?(?: junior)?$|programador(?:\/a)? (?:web|java|php|javascript|typescript|react|angular|\.net|python|full.?stack)|frontend developer|web developer|wordpress|javascript|typescript|react|php|node(?:\.js)?|java developer|python developer|\.net developer|full.?stack developer/.test(t);
  const systems = /tecnico(?:\/a)? (?:de )?sistemas|operador(?:\/a)? (?:de )?sistemas|sistemas informaticos|data center|datacenter|\bcpd\b|monitorizacion|active directory|microsoft 365|\bm365\b|office 365/.test(t);
  const cyber = /ciberseguridad|cybersecurity|analista soc|operador(?:\/a)? de seguridad.*soc|\bsoc\b|security analyst|\bsiem\b|seguridad informatica|pentest/.test(t);
  const networks = /tecnico(?:\/a)? (?:de )?redes|tecnico(?:\/a)? n[12] redes|network technician|\bnoc\b|\bcisco\b|redes informaticas|comunicaciones(?: it)?|routing|switching/.test(t);

  return support || development || systems || cyber || networks;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.clone();
  rawUrl.pathname = '/api/jobs';
  rawUrl.searchParams.set('__raw', '1');

  const rawResponse = await getRawJobs(new NextRequest(rawUrl));
  const data = await rawResponse.json();
  const jobs: Job[] = Array.isArray(data.jobs) ? data.jobs : [];
  const filtered = jobs.filter(matchesProfile);

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
        profile: 'Solo puestos de entrada o junior relacionados directamente con experiencia o estudios del perfil objetivo',
      },
    },
    { status: rawResponse.status },
  );
}
