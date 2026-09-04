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
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CACHE = 'autojobs-feed-v12';
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
  'Prioriza las ofertas publicadas hoy: suelen recibir menos candidaturas al principio.',
  'Si una oferta encaja aunque no cumplas el 100%, revisa los requisitos antes de descartarla.',
  'Una candidatura adaptada al puesto suele ser mejor que enviar muchas genéricas.',
];

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
      const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (c?.jobs && Date.now() - c.at < TTL) {
        setJobs(c.jobs);
        setProviderStatus(c.providerStatus || 'ok');
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
      const r = await fetch(`/api/jobs?${force ? 'refresh=1&' : ''}_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const d = await r.json();
      const sorted = (d.jobs || [])
        .filter(
          (j: Job) =>
            j.category !== 'General' && /^https:\/\/(?:www\.)?infojobs\.net\//i.test(j.link),
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
      setProviderStatus(d.providerStatus || (r.ok ? 'ok' : 'provider_error'));
      setProviderError(d.providerError || '');
      if (r.ok) {
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

  function tracked(j: Job) {
    return saved.find((x) => x.id === j.id || norm(x.title) === norm(j.title));
  }

  function setTrack(j: Job, status: TrackStatus) {
    setSaved((current) => {
      const previous = current.find((x) => x.id === j.id || norm(x.title) === norm(j.title));
      const enteringApplied = APPLIED_STATUSES.has(status);
      const appliedAt = enteringApplied ? previous?.appliedAt || Date.now() : previous?.appliedAt;
      const next: Saved = {
        id: j.id,
        title: j.title,
        url: j.link,
        status,
        score: j.score,
        date: new Date().toLocaleDateString('es-ES'),
        salary: j.salary,
        appliedAt,
      };
      return [next, ...current.filter((x) => !(x.id === j.id || norm(x.title) === norm(j.title)))];
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

  async function generate(j: Job) {
    const k = norm(j.title);
    const cur = qa[k] || { question: '', answer: '' };
    if (!cur.question.trim()) return;
    setQa((v) => ({ ...v, [k]: { ...cur, busy: true } }));
    try {
      const r = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: j.title,
          question: cur.question,
          previousAnswer: cur.answer || undefined,
          regenerate: !!cur.answer,
        }),
      });
      const d = await r.json();
      setQa((v) => ({
        ...v,
        [k]: {
          question: cur.question,
          answer: d.answer || d.error || 'No pude preparar la respuesta.',
          busy: false,
        },
      }));
    } catch {
      setQa((v) => ({
        ...v,
        [k]: { ...cur, answer: 'No pude preparar la respuesta.', busy: false },
      }));
    }
  }

  const feed = useMemo(
    () =>
      jobs.filter((j) => {
        if (j.category === 'General') return false;
        const status = tracked(j)?.status as TrackStatus | undefined;
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
  const savedCount = saved.filter((x) => x.status !== 'Descartado').length;

  return (
    <main>
      <header className="appHeader">
        <div className="brand">
          AUTOJOBS <small style={{ opacity: 0.45 }}>v12</small>
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
                : `${feed.length} oportunidades · recientes y compatibles primero`
            : view === 'applied'
              ? `${applied.length} aplicadas · más recientes primero`
              : `${savedCount} ofertas guardadas`}
        </p>
      </header>

      <div className="filters">
        <button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')}>
          Para ti
        </button>
        <button
          className={view === 'applied' ? 'active' : ''}
          onClick={() => setView('applied')}
        >
          Aplicadas · {applied.length}
        </button>
        <button
          className={view === 'pipeline' ? 'active' : ''}
          onClick={() => setView('pipeline')}
        >
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
          <button className="ghost" onClick={() => setTip((x) => (x + 1) % tips.length)}>
            Otro consejo
          </button>
          <div className="loadingBar">
            <i />
          </div>
        </section>
      ) : view === 'feed' ? (
        <section className="list">
          {feed.map((j) => {
            const savedJob = tracked(j);
            const k = norm(j.title);
            const item = qa[k] || { question: '', answer: '' };
            return (
              <article className="job" key={j.id}>
                <div className="jobMain">
                  <div className={`scorePill ${j.score >= 80 ? 'scoreGood' : j.score >= 65 ? 'scoreMid' : ''}`}>
                    {j.score}%
                  </div>
                  <div className="jobInfo">
                    <div className="categoryLabel">
                      {j.category || 'IT'}{j.city ? ` · ${j.city}` : ''}
                    </div>
                    <h3>{j.title}</h3>
                    {j.company && <div className="small">{j.company}</div>}
                    <div className="jobMeta">
                      <span className={j.salary ? 'salary salaryKnown' : 'salary'}>
                        💰 {j.salary || 'No indicado'}
                      </span>
                      {j.experience && <span className="small">Experiencia: {j.experience}</span>}
                      {savedJob && <span className="status abierta">{savedJob.status}</span>}
                    </div>
                  </div>
                </div>
                <div className="jobActions">
                  <button className="ghost" onClick={() => setTrack(j, 'Descartado')}>
                    No me interesa
                  </button>
                  <button className="ghost" onClick={() => setTrack(j, 'Me gusta')}>
                    ♡ Me gusta
                  </button>
                  <button
                    onClick={() => {
                      setTrack(j, 'Ya he aplicado');
                      window.location.assign(j.link);
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
                        onChange={(e) =>
                          setQa((v) => ({ ...v, [k]: { ...item, question: e.target.value } }))
                        }
                        placeholder="Pega una pregunta de esta oferta"
                      />
                      {item.question && (
                        <button
                          className="clearBtn"
                          onClick={() => setQa((v) => ({ ...v, [k]: { question: '', answer: '' } }))}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => generate(j)}
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
                              setCopied(k);
                              setTimeout(() => setCopied(''), 1000);
                            }}
                          >
                            {copied === k ? '✓ Copiada' : 'Copiar'}
                          </button>
                          <button className="secondary" onClick={() => generate(j)}>
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
              <b>No hay oportunidades IT cargadas</b>
              <span>Pulsa ↻ para volver a consultar InfoJobs.</span>
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
                      onChange={(e) => changeSavedStatus(item, e.target.value as TrackStatus)}
                    >
                      {PIPELINE.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
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
                            onChange={(e) => changeSavedStatus(item, e.target.value as TrackStatus)}
                          >
                            {PIPELINE.map((nextStatus) => (
                              <option key={nextStatus}>{nextStatus}</option>
                            ))}
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
