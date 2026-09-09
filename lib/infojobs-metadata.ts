type JsonObject = Record<string, unknown>;

export type InfoJobsMetadata = {
  company?: string;
  timestamp?: number;
  date?: string;
  salary?: string | null;
  city?: string;
  modality?: 'Remoto' | 'Híbrido' | 'Presencial';
};

type JobLike = {
  link: string;
  company?: string;
  timestamp?: number;
  date?: string;
  salary?: string | null;
  city?: string;
  modality?: 'Remoto' | 'Híbrido' | 'Presencial';
};

type CacheEntry = { at: number; value: InfoJobsMetadata };
const CACHE_TTL = 6 * 60 * 60 * 1000;
const DETAIL_LIMIT = 10;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<InfoJobsMetadata>>();

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function findJobPosting(value: unknown): JsonObject | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(value)) return null;
  const type = value['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return value;
  if ('@graph' in value) return findJobPosting(value['@graph']);
  return null;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseCompany(posting: JsonObject): string | undefined {
  const org = posting.hiringOrganization;
  if (!isObject(org)) return undefined;
  return text(org.name);
}

function parseTimestamp(posting: JsonObject): number | undefined {
  const raw = text(posting.datePosted);
  if (!raw) return undefined;
  const value = Date.parse(raw);
  if (!Number.isFinite(value)) return undefined;
  const now = Date.now();
  if (value > now + 60 * 60 * 1000 || value < now - 180 * 24 * 60 * 60 * 1000) return undefined;
  return value;
}

function parseCity(posting: JsonObject): string | undefined {
  const location = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
  if (!isObject(location) || !isObject(location.address)) return undefined;
  return text(location.address.addressLocality);
}

function parseModality(posting: JsonObject): InfoJobsMetadata['modality'] | undefined {
  if (text(posting.jobLocationType)?.toUpperCase() === 'TELECOMMUTE') return 'Remoto';
  return undefined;
}

function parseSalary(posting: JsonObject): string | null | undefined {
  const base = posting.baseSalary;
  if (!isObject(base)) return undefined;
  const currency = text(base.currency) || 'EUR';
  const valueObj = isObject(base.value) ? base.value : base;
  const unit = text(valueObj.unitText)?.toUpperCase();
  if (unit && unit !== 'YEAR') return undefined;
  const min = Number(valueObj.minValue);
  const max = Number(valueObj.maxValue);
  const single = Number(valueObj.value);
  const fmt = (n: number) => `${Math.round(n).toLocaleString('es-ES')} ${currency === 'EUR' ? '€' : currency}`;
  if (Number.isFinite(min) && Number.isFinite(max) && min >= 12000 && max <= 200000 && min <= max) {
    return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
  }
  if (Number.isFinite(single) && single >= 12000 && single <= 200000) return fmt(single);
  return undefined;
}

function parseJsonLd(html: string): InfoJobsMetadata {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1]);
      const posting = findJobPosting(parsed);
      if (!posting) continue;
      const timestamp = parseTimestamp(posting);
      return {
        company: parseCompany(posting),
        timestamp,
        date: timestamp ? new Date(timestamp).toISOString() : undefined,
        salary: parseSalary(posting),
        city: parseCity(posting),
        modality: parseModality(posting),
      };
    } catch {
      // JSON-LD inválido: no inventar metadatos ni bloquear el feed.
    }
  }
  return {};
}

async function fetchMetadata(link: string): Promise<InfoJobsMetadata> {
  const hit = cache.get(link);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
  const pending = inflight.get(link);
  if (pending) return pending;

  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(link, {
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AutoJobs/1.0)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });
      if (!response.ok) return {};
      const value = parseJsonLd(await response.text());
      cache.set(link, { at: Date.now(), value });
      return value;
    } catch {
      return {};
    } finally {
      clearTimeout(timer);
      inflight.delete(link);
    }
  })();

  inflight.set(link, promise);
  return promise;
}

export async function enrichInfoJobsJobs<T extends JobLike>(jobs: T[]): Promise<T[]> {
  const targets = jobs.slice(0, DETAIL_LIMIT);
  const metadata: InfoJobsMetadata[] = [];
  for (let i = 0; i < targets.length; i += 3) {
    metadata.push(...await Promise.all(targets.slice(i, i + 3).map((job) => fetchMetadata(job.link))));
  }

  return jobs.map((job, index) => {
    if (index >= targets.length) return job;
    const meta = metadata[index] || {};
    return {
      ...job,
      company: job.company || meta.company || '',
      timestamp: job.timestamp || meta.timestamp || 0,
      date: job.date || meta.date || '',
      salary: job.salary || meta.salary || null,
      city: job.city || meta.city,
      modality: job.modality || meta.modality,
    };
  });
}
