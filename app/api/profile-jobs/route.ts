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

  // Strict whitelist: a title is accepted only when the actual role maps directly
  // to support/microinformatics, DAW development, CPD/systems operations,
  // entry-level networking or entry-level cybersecurity.
  // Technology keywords by themselves are never enough to admit a job.
  if (/\b(?:senior|sr\.?|lead|manager|director|head|architect|arquitecto|responsable|jefe|coordinador|supervisor|especialista|consultor|pmo)\b/.test(t)) return false;
  if (/analista\s+programador/.test(t)) return false;
  if (/\b(?:ingeniero|engineer)\b/.test(t) && !/\bjunior\b/.test(t)) return false;
  if (/administrador(?:\/a)?\b/.test(t) && !/\bjunior\b/.test(t)) return false;

  if (/\b(?:comercial|ventas|preventa|presales|teleoperador|call center|marketing|rrhh|recursos humanos|curso|formacion|docente|profesor|vigilante|auxiliar(?:es)? de servicios|seguridad fisica)\b/.test(t)) return false;
  if (/scada|iiot|labview|plc|bms|ibms|spark|scala|etl|databricks|microstrategy|data engineer|data scientist|data science|machine learning|ml engineer|mlops|devops|devsecops|ai engineer|ia engineer|ingeniero.*inteligencia artificial|genai|agentic|ag[eé]ntic|\bllm\b|\brpa\b|blue prism|power bi|business intelligence|prompt engineering|sagemaker|knowledge graph|\brag\b|cmdb|bpm|opentext|oracle webcenter|insider threat|\bdlp\b/.test(t)) return false;

  const support =
    /soporte (?:it|ti|tecnico|informatico)|tecnico(?:\/a)? (?:de )?soporte|help.?desk|service desk|\bcau\b|microinformat|tecnico(?:\/a)? informatico|it support|desktop support|puesto de usuario|becario(?:\/a)? de soporte tecnico/.test(t);

  const development =
    /desarrollador(?:\/a)? (?:web|frontend|front|backend|full.?stack|react|ecommerce)|programador(?:\/a)?(?: junior)?$|programador(?:\/a)? (?:web|java|php|javascript|typescript|react|angular|\.net|python|full.?stack)|frontend developer|web developer|wordpress developer|java developer|python developer|\.net developer|full.?stack developer/.test(t);

  // Systems/CPD requires an explicit technical/operations role. A title that merely
  // contains “data center” or “CPD” is not accepted.
  const systems =
    /(?:tecnico|tecnica)(?:\/a)? (?:de )?(?:sistemas|cpd|data center|datacenter)|operador(?:\/a)? (?:de )?(?:sistemas|cpd|data center|datacenter)|tecnico(?:\/a)? de red -? cpd|tecnico(?:\/a)? cpd|operador(?:\/a)? cpd/.test(t);

  // Networking is limited to technician/NOC roles, not network engineers.
  const networks =
    /tecnico(?:\/a)? (?:de )?redes|tecnico(?:\/a)? n[12] (?:de )?redes|network technician|tecnico(?:\/a)? de red(?:\b| )|operador(?:\/a)? noc|tecnico(?:\/a)? noc/.test(t);

  // Cybersecurity is intentionally entry-level only. Generic analyst/admin/SIEM
  // titles are excluded unless N1/junior is explicit, or the role is SOC operator.
  const cyber =
    /analista (?:de )?ciberseguridad (?:n1|nivel 1|junior)\b|analista soc (?:n1|nivel 1|junior)\b|operador(?:\/a)? de seguridad.*\bsoc\b|operador(?:\/a)? soc\b|tecnico(?:\/a)? (?:de )?ciberseguridad (?:n1|nivel 1|junior)\b|tecnico(?:\/a)? de redes n[12].*ciberseguridad/.test(t);

  return support || development || systems || networks || cyber;
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
        profile:
          'Whitelist estricta: soporte/microinformática, desarrollo DAW, operación técnica CPD/sistemas, redes técnicas y ciberseguridad de entrada',
      },
    },
    { status: rawResponse.status },
  );
}
