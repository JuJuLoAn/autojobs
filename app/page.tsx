'use client';

import { useEffect, useMemo, useState } from 'react';

type Job = {
  id: string;
  title: string;
  link: string;
  score: number;
  salary: string | null;
  date: string;
  status: string;
  category?: string;
  categories?: string[];
  timestamp?: number;
  rank?: number;
  city?: string;
  company?: string;
  experience?: string;
};

type TrackStatus =
  | 'Me gusta'
  | 'Ya he aplicado'
  | 'En espera'
  | 'Entrevista'
  | 'Descartado'
  | 'Rechazado'
  | 'Oferta recibida';

type Saved = {
  id?: string;
  title: string;
  url: string;
  status: TrackStatus | string;
  score: number;
  date: string;
  salary?: string | null;
  appliedAt?: number;
};

type QA = { question: string; answer: string; busy?: boolean };
type View = 'feed' | 'applied' | 'pipeline';

const norm = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CACHE = 'autojobs-feed-v13';
const SAVED_KEY = 'autojobs-cards-v11';
const TTL = 10 * 60 * 1000;
const PIPELINE: TrackStatus[] = [
  'Me gusta',
  'Ya he aplicado',
  'En espera',
  'Entrevista',
  'Oferta recibida',
  'Rechazado',
  'Descartado',
];
const APPLIED_STATUSES = new Set<TrackStatus>([
  'Ya he aplicado',
  'En espera',
  'Entrevista',
  'Oferta recibida',
]);
const tips = [
  'Priorizamos soporte IT, desarrollo, sistemas, redes y ciberseguridad junior.',
  'Solo mostramos puestos relacionados con tu experiencia o tus estudios.',
  'Las ofertas senior, comerciales o demasiado especializadas se descartan.',
];

function matchesProfileJob(job: Job) {
  const t = norm(job.title);
  if (!t) return false;

  if (
    /\b(?:senior|sr\.?|lead|manager|director|head|architect|arquitecto|responsable|jefe|coordinador)\b/.test(t)
  ) return false;

  if (
    /\b(?:comercial|ventas|preventa|presales|teleoperador|call center|marketing|rrhh|recursos humanos|curso|formacion|docente|profesor)\b/.test(t)
  ) return false;

  if (
    /data scientist|data engineer|machine learning|ml engineer|mlops|ai engineer|ia engineer|genai|\bllm\b|\brpa\b|business intelligence|power bi/.test(t)
  ) return false;

  const support = /soporte (?:it|ti|tecnico|informatico)|tecnico(?:\/a)? (?:de )?soporte|help.?desk|service desk|\bcau\b|microinformat|tecnico(?:\/a)? informatico|it support|desktop support|puesto de usuario/.test(t);
  const development = /desarrollador(?:\/a)? web|programador(?:\/a)?|frontend|front end|backend|back end|full.?stack|web developer|software developer|wordpress|javascript|typescript|react|php|node(?:\.js)?|java developer|python developer|\.net developer/.test(t);
  const systems = /tecnico(?:\/a)? (?:de )?sistemas|operador(?:\/a)? (?:de )?sistemas|sistemas informaticos|data center|datacenter|\bcpd\b|monitorizacion|active directory|microsoft 365|\bm365\b|office 365/.test(t);
  const cyber = /ciberseguridad|cybersecurity|analista soc|\bsoc\b|security analyst|\bsiem\b|seguridad informatica|pentest/.test(t);
  const networks = /tecnico(?:\/a)? (?:de )?redes|network technician|\bnoc\b|\bcisco\b|redes informaticas|comunicaciones it/.test(t);

  return support || development || systems || cyber || networks;
}

function legacyDateToTimestamp(date?: string) {
  if (!date) return 0;
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return 0;
  const [, d, m, y] = match;
  const value = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  return Number.isFinite(value) ? value : 0;
}

function appliedTimestamp(item: Saved) {
  return item.appliedAt || legacyDateToTimestamp(item.date);
}

function formatAppliedDate(item: Saved) {
  const ts = appliedTimestamp(item);
  if (!ts) return item.date || 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(true);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [view, setView] = useState<View>('feed');
  const [qa, setQa] = useState<Record<string, QA>>({});
  const [copied, setCopied] = useState('');
  const [tip, setTip] = useState(0);
  const [providerStatus, setProviderStatus] = useState('');
  const [providerError, setProviderError] = useState('');

  useEffect(() => {
    try {
      const raw: Saved[] = JSON.parse(
        localStorage.getItem(SAVED_KEY) || localStorage.getItem('autojobs-cards') || '[]',
      );
      const migrated = raw.map((item) => {
        if (!APPLIED_STATUSES.has(item.status as TrackStatus) || item.appliedAt) return item;
        const legacy = legacyDateToTimestamp(item.date);
        return { ...item, appliedAt: legacy || undefined };
      });
      setSaved(migrated);
      setQa(JSON.parse(localStorage.getItem('autojobs-qa') || '{}'));
      Object.keys(localStorage)
        .filter((k) => k.startsWith('autojobs-feed-') && k !== CACHE)
        .forEach((k) => localStorage.removeItem(k));

      const cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (cached?.jobs && Date.now() - cached.at < TTL) {
        setJobs((cached.jobs as Job[]).filter(matchesProfileJob));
        setProviderStatus(cached.providerStatus || 'ok');
        setBusy(false);
        load(false, false);
      } else {
        load(true, true);
      }
    } catch {
      load(true, true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    localStorage.setItem('autojobs-qa', JSON.stringify(qa));
  }, [qa]);

  async function load(show = true, force = true) {
    if (show) setBusy(true);
    if (force) {
      try {
        localStorage.removeItem(CACHE);
      } catch {}
    }

    try {
      const response = await fetch(`/api/jobs?${force ? 'refresh=1&' : ''}_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();
      const sorted = (data.jobs || [])
        .filter(
          (job: Job) =>
            job.category !== 'General' &&
            /^https:\/\/(?:www\.)?infojobs\.net\//i.test(job.link) &&
            matchesProfileJob(job),
        )
        .sort((a: Job, b: Job) => {
          const at = a.timestamp || 0;
          const bt = b.timestamp || 0;
          if (Boolean(at) !== Boolean(bt)) return bt ? 1 : -1;
          if (at !== bt) return bt - at;
          const ar = a.rank ?? 999999;
          const br = b.rank ?? 999999;
          if (ar !== br) return ar - br;
          return b.score - a.score;
        });

      setJobs(sorted);
      setProviderStatus(data.providerStatus || (response.ok ? 'ok' : 'provider_error'));
      setProviderError(data.providerError || '');

      if (response.ok) {
        localStorage.setItem(
          CACHE,
          JSON.stringify({ jobs: sorted, providerStatus: 'ok', at: Date.now() }),
        );
      }
    } catch {
      setProviderStatus('internal_error');
      setProviderError('No se ha podido consultar AutoJobs.');
    } finally {
      setBusy(false);
    }
  }

  function tracked(job: Job) {
    return saved.find((item) => item.id === job.id || norm(item.title) === norm(job.title));
  }

  function setTrack(job: Job, status: TrackStatus) {
    setSaved((current) => {
      const previous = current.find(
        (item) => item.id === job.id || norm(item.title) === norm(job.title),
      );
      const enteringApplied = APPLIED_STATUSES.has(status);
      const appliedAt = enteringApplied ? previous?.appliedAt || Date.now() : previous?.appliedAt;
      const next: Saved = {
        id: job.id,
        title: job.title,
        url: job.link,
        status,
        score: job.score,
        date: new Date().toLocaleDateString('es-ES'),
        salary: job.salary,
        appliedAt,
      };
      return [
        next,
        ...current.filter(
          (item) => !(item.id === job.id || norm(item.title) === norm(job.title)),
        ),
      ];
    });
  }

  function changeSavedStatus(target: Saved, status: TrackStatus) {
    setSaved((current) =>
      current.map((item) => {
        if (item !== target) return item;
        const enteringApplied = APPLIED_STATUSES.has(status);
        return {
          ...item,
          status,
          appliedAt: enteringApplied ? item.appliedAt || Date.now() : item.appliedAt,
        };
      }),
    );
  }

  async function generate(job: Job) {
    const key = norm(job.title);
    const current = qa[key] || { question: '', answer: '' };
    if (!current.question.trim()) return;
    setQa((value) => ({ ...value, [key]: { ...current, busy: true } }));

    try {
      const response = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: job.title,
          question: current.question,
          previousAnswer: current.answer || undefined,
          regenerate: !!current.answer,
        }),
      });
      const data = await response.json();
      setQa((value) => ({
        ...value,
        [key]: {
          question: current.question,
          answer: data.answer || data.error || 'No pude preparar la respuesta.',
          busy: false,
        },
      }));
    } catch {
      setQa((value) => ({
        ...value,
        [key]: { ...current, answer: 'No pude preparar la respuesta.', busy: false },
      }));
    }
  }

  const feed = useMemo(
    () =>
      jobs.filter((job) => {
        if (!matchesProfileJob(job)) return false;
        const status = tracked(job)?.status as TrackStatus | undefined;
        if (!status) return true;
        return status !== 'Descartado' && status !== 'Rechazado' && !APPLIED_STATUSES.has(status);
      }),
    [jobs, saved],
  );

  const applied = useMemo(
    () =>
      saved
        .filter((item) => APPLIED_STATUSES.has(item.status as TrackStatus))
        .sort((a, b) => appliedTimestamp(b) - appliedTimestamp(a)),
    [saved],
  );

  const providerBroken = providerStatus && providerStatus !== 'ok';
  const savedCount = saved.filter((item) => item.status !== 'Descartado').length;

  return (
    <main>
      <header className="appHeader">
        <div className="brand">
          AUTOJOBS <small style={{ opacity: 0.45 }}>v13</small>
        </div>
        <div className="topline">
          <h1>
            {view === 'feed' ? 'Para ti' : view === 'applied' ? 'Aplicadas' : 'Mis candidaturas'}
          </h1>
          <button className="iconBtn" onClick={() => load(true, true)} disabled={busy}>
            ↻
          </button>
        </div>
        <p className="sub">
          {view === 'feed'
            ? busy && !jobs.length
              ? 'Buscando oportunidades…'
              : busy
                ? 'Actualizando InfoJobs…'
                : `${feed.length} oportunidades · solo de tu perfil`
            : view === 'applied'
              ? `${applied.length} aplicadas · más recientes primero`
              : `${savedCount} ofertas guardadas`}
        </p>
      </header>

      <div className="filters">
        <button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')}>
          Para ti
        </button>
        <button className={view === 'applied' ? 'active' : ''} onClick={() => setView('applied')}>
          Aplicadas · {applied.length}
        </button>
        <button className={view === 'pipeline' ? 'active' : ''} onClick={() => setView('pipeline')}>
          Seguimiento · {savedCount}
        </button>
      </div>

      {providerBroken && (
        <section className="card compact">
          <b>No se ha podido consultar InfoJobs</b>
          <p className="small">{providerError}</p>
          <button onClick={() => load(true, true)}>Reintentar</button>
        </section>
      )}

      {busy && !jobs.length ? (
        <section className="loadGame">
          <b>Buscando oportunidades que encajan contigo…</b>
          <p className="gameQ">{tips[tip]}</p>
          <button className="ghost" onClick={() => setTip((value) => (value + 1) % tips.length)}>
            Otro consejo
          </button>
          <div className="loadingBar"><i /></div>
        </section>
      ) : view === 'feed' ? (
        <section className="list">
          {feed.map((job) => {
            const savedJob = tracked(job);
            const key = norm(job.title);
            const item = qa[key] || { question: '', answer: '' };
            return (
              <article className="job" key={job.id}>
                <div className="jobMain">
                  <div className={`scorePill ${job.score >= 80 ? 'scoreGood' : job.score >= 65 ? 'scoreMid' : ''}`}>
                    {job.score}%
                  </div>
                  <div className="jobInfo">
                    <div className="categoryLabel">
                      {job.category || 'IT'}{job.city ? ` · ${job.city}` : ''}
                    </div>
                    <h3>{job.title}</h3>
                    {job.company && <div className="small">{job.company}</div>}
                    <div className="jobMeta">
                      <span className={job.salary ? 'salary salaryKnown' : 'salary'}>
                        💰 {job.salary || 'No indicado'}
                      </span>
                      {job.experience && <span className="small">Experiencia: {job.experience}</span>}
                      {savedJob && <span className="status abierta">{savedJob.status}</span>}
                    </div>
                  </div>
                </div>

                <div className="jobActions">
                  <button className="ghost" onClick={() => setTrack(job, 'Descartado')}>
                    No me interesa
                  </button>
                  <button className="ghost" onClick={() => setTrack(job, 'Me gusta')}>
                    ♡ Me gusta
                  </button>
                  <button
                    onClick={() => {
                      setTrack(job, 'Ya he aplicado');
                      window.location.assign(job.link);
                    }}
                  >
                    Aplicar
                  </button>
                </div>

                <details className="jobQa">
                  <summary>Preparar candidatura</summary>
                  <div className="jobQaBody">
                    <div className="questionBox">
                      <textarea
                        value={item.question}
                        onChange={(event) =>
                          setQa((value) => ({ ...value, [key]: { ...item, question: event.target.value } }))
                        }
                        placeholder="Pega una pregunta de esta oferta"
                      />
                      {item.question && (
                        <button
                          className="clearBtn"
                          onClick={() => setQa((value) => ({ ...value, [key]: { question: '', answer: '' } }))}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => generate(job)}
                      disabled={!item.question.trim() || item.busy}
                    >
                      {item.busy ? 'Preparando…' : 'Responder con mi CV'}
                    </button>
                    {item.answer && (
                      <>
                        <div className="answer">{item.answer}</div>
                        <div className="answerActions">
                          <button
                            className="ghost"
                            onClick={async () => {
                              await navigator.clipboard.writeText(item.answer);
                              setCopied(key);
                              setTimeout(() => setCopied(''), 1000);
                            }}
                          >
                            {copied === key ? '✓ Copiada' : 'Copiar'}
                          </button>
                          <button className="secondary" onClick={() => generate(job)}>
                            ↻ Otra respuesta
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </article>
            );
          })}

          {!feed.length && !busy && (
            <div className="empty">
              <b>No hay ofertas que encajen con tu perfil ahora mismo</b>
              <span>Solo mostramos puestos relacionados con lo que has estudiado o trabajado.</span>
            </div>
          )}
        </section>
      ) : view === 'applied' ? (
        <section className="list">
          {applied.length ? (
            applied.map((item, index) => (
              <div className="card compact" key={`${item.id || item.title}-${index}`}>
                <div className="saved">
                  <div>
                    <b>{item.title}</b>
                    <span className="small">Aplicada: {formatAppliedDate(item)}</span>
                    <span className="small">{item.salary || 'Salario no indicado'}</span>
                    <select
                      value={item.status}
                      onChange={(event) => changeSavedStatus(item, event.target.value as TrackStatus)}
                    >
                      {PIPELINE.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div>
                  <a href={item.url}>Abrir</a>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">
              <b>Todavía no hay ofertas aplicadas</b>
              <span>Cuando pulses “Aplicar”, se guardarán aquí automáticamente.</span>
            </div>
          )}
        </section>
      ) : (
        <section className="list">
          {PIPELINE.filter((status) => status !== 'Descartado').map((status) => {
            const list = saved
              .filter((item) => item.status === status)
              .sort((a, b) => appliedTimestamp(b) - appliedTimestamp(a));
            return (
              <details className="card compact" key={status} open={list.length > 0}>
                <summary>
                  {status} <span className="count">{list.length}</span>
                </summary>
                <div className="detailsBody">
                  {list.length ? (
                    list.map((item, index) => (
                      <div className="saved" key={`${item.id || item.title}-${index}`}>
                        <div>
                          <b>{item.title}</b>
                          {APPLIED_STATUSES.has(item.status as TrackStatus) && (
                            <span className="small">Aplicada: {formatAppliedDate(item)}</span>
                          )}
                          <span className="small">{item.salary || 'Salario no indicado'}</span>
                          <select
                            value={item.status}
                            onChange={(event) => changeSavedStatus(item, event.target.value as TrackStatus)}
                          >
                            {PIPELINE.map((nextStatus) => <option key={nextStatus}>{nextStatus}</option>)}
                          </select>
                        </div>
                        <a href={item.url}>Abrir</a>
                      </div>
                    ))
                  ) : (
                    <div className="small">Ninguna todavía.</div>
                  )}
                </div>
              </details>
            );
          })}
        </section>
      )}
    </main>
  );
}
