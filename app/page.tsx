'use client';
import {useEffect,useMemo,useState} from 'react';

type Prefs={province:string;minSalary:number;remote:boolean;profile:string};
type Item={title:string;url:string;status:'Interesa'|'Inscrito'|'Descartado';score:number;date:string};

const roles=['soporte informatico','it helpdesk','tecnico informatico','service desk','data center','sistemas junior'];
const skillTerms=['soporte','helpdesk','hardware','software','windows','office 365','m365','redes','vpn','ticket','incidencias','teams','outlook','html','css','javascript','typescript','web','data center','monitorizacion','router','usuarios','copias de seguridad','active directory','cisco','fortinet','vmware','linux'];
const slug=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export default function Home(){
  const[prefs,setPrefs]=useState<Prefs>({province:'Madrid',minSalary:20000,remote:true,profile:'Soporte IT, helpdesk, incidencias, hardware/software, Windows, M365, redes, tickets, Outlook, Teams, desarrollo web, JavaScript/TypeScript y experiencia en data center.'});
  const[roleIndex,setRoleIndex]=useState(0); const[text,setText]=useState(''); const[title,setTitle]=useState(''); const[url,setUrl]=useState(''); const[items,setItems]=useState<Item[]>([]);
  const[tab,setTab]=useState<'buscar'|'analizar'|'seguimiento'>('buscar');

  useEffect(()=>{try{const p=localStorage.getItem('autojobs-prefs');if(p)setPrefs(JSON.parse(p));const i=localStorage.getItem('autojobs-items-v2');if(i)setItems(JSON.parse(i));}catch{}},[]);
  useEffect(()=>{localStorage.setItem('autojobs-prefs',JSON.stringify(prefs))},[prefs]);
  useEffect(()=>{localStorage.setItem('autojobs-items-v2',JSON.stringify(items))},[items]);

  const role=roles[roleIndex];
  const searchUrl=`https://www.infojobs.net/ofertas-trabajo/${slug(prefs.province)}/${slug(role)}`;

  const analysis=useMemo(()=>{
    if(!text.trim()) return null;
    const t=norm(text); const hits=skillTerms.filter(x=>t.includes(norm(x)));
    const years=[...t.matchAll(/(\d+)\s*(?:anos|año|years?)/g)].map(m=>Number(m[1])).filter(n=>n>0&&n<20); const exp=years.length?Math.max(...years):null;
    const salaryMatches=[...t.matchAll(/(\d{2})[\.,]?\d{3}\s*(?:€|euros?)/g)].map(m=>Number(m[1])*1000); const salary=salaryMatches.length?Math.max(...salaryMatches):null;
    const remote=/remoto|teletrabajo|hibrid/.test(t); const degree=/grado universitario|titulacion universitaria|ingenieria|licenciatura/.test(t);
    const english=/ingles|english/.test(t); const commercial=/comercial|ventas|captacion/.test(t); const freelance=/autonomo|freelance/.test(t);
    let score=45+Math.min(36,hits.length*3); if(remote&&prefs.remote)score+=6; if(salary&&salary>=prefs.minSalary)score+=8; if(salary&&salary<prefs.minSalary)score-=18; if(exp&&exp>=5)score-=12; else if(exp&&exp<=3)score+=3; if(commercial)score-=10; if(freelance)score-=12; score=Math.max(10,Math.min(98,score));
    const missing=skillTerms.filter(x=>/cisco|fortinet|vmware|linux|active directory/.test(x)&&t.includes(norm(x))&&!norm(prefs.profile).includes(norm(x)));
    return{score,hits,exp,salary,remote,degree,english,commercial,freelance,missing};
  },[text,prefs]);

  async function paste(){try{setText(await navigator.clipboard.readText())}catch{alert('Mantén pulsado en el cuadro y toca Pegar.')}}
  function nextSearch(){window.open(searchUrl,'_blank');setRoleIndex(i=>(i+1)%roles.length)}
  function save(status:Item['status']){const u=url.trim()||searchUrl; if(items.some(x=>x.url===u)){alert('Esta oferta ya está guardada.');return;} const score=analysis?.score||0; setItems(x=>[{title:title.trim()||'Oferta InfoJobs',url:u,status,score,date:new Date().toLocaleDateString('es-ES')},...x]);}
  function setStatus(idx:number,status:Item['status']){setItems(x=>x.map((it,i)=>i===idx?{...it,status}:it))}
  const answer=analysis?`Tengo experiencia práctica en ${analysis.hits.slice(0,6).join(', ')||'soporte IT y resolución de incidencias'}. Estoy acostumbrado a trabajar con usuarios, diagnosticar problemas y aprender herramientas nuevas rápidamente. Me interesa la posición porque encaja con mi perfil técnico y quiero seguir creciendo en entornos IT.`:'';

  return <main>
    <div className="brand">AUTOJOBS · ASSISTANT</div><h1>Menos buscar. Más candidaturas buenas.</h1><div className="sub">Prepara una ronda de búsquedas, analiza cada oferta y decide en segundos si merece la pena.</div>
    <nav className="tabs"><button className={tab==='buscar'?'active':''} onClick={()=>setTab('buscar')}>Buscar</button><button className={tab==='analizar'?'active':''} onClick={()=>setTab('analizar')}>Analizar</button><button className={tab==='seguimiento'?'active':''} onClick={()=>setTab('seguimiento')}>Seguimiento</button></nav>

    {tab==='buscar'&&<>
      <section className="card"><h2>Tu filtro</h2><div className="row"><div><label>Provincia</label><input value={prefs.province} onChange={e=>setPrefs({...prefs,province:e.target.value})}/></div><div><label>Salario mínimo</label><input type="number" value={prefs.minSalary} onChange={e=>setPrefs({...prefs,minSalary:Number(e.target.value)})}/></div></div><label className="toggle"><input type="checkbox" checked={prefs.remote} onChange={e=>setPrefs({...prefs,remote:e.target.checked})}/> Priorizar remoto/híbrido</label><label>Tu perfil (editable)</label><textarea className="profile" value={prefs.profile} onChange={e=>setPrefs({...prefs,profile:e.target.value})}/></section>
      <section className="card"><div className="kicker">RONDA AUTOMÁTICA</div><h2>{role}</h2><p className="small">Pulsa una vez, revisa los resultados y vuelve a AutoJobs. Al regresar, el siguiente puesto ya estará preparado.</p><button onClick={nextSearch}>Abrir búsqueda {roleIndex+1}/{roles.length}</button><div className="queue">{roles.map((r,i)=><span key={r} className={i===roleIndex?'current':''}>{i<roleIndex?'✓ ':''}{r}</span>)}</div></section>
    </>}

    {tab==='analizar'&&<>
      <section className="card"><h2>Analizar oferta</h2><div className="row"><button className="secondary" onClick={paste}>📋 Pegar del portapapeles</button><button className="ghost" onClick={()=>setText('')}>Limpiar</button></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Copia requisitos, funciones y condiciones de InfoJobs…"/>{analysis&&<><div className={'score '+(analysis.score>=80?'good':analysis.score>=65?'mid':'bad')}>{analysis.score}%</div><div className="facts"><span>💰 {analysis.salary?`${analysis.salary.toLocaleString('es-ES')} €`:'Salario no detectado'}</span><span>🧭 {analysis.remote?'Remoto/híbrido':'No detectado'}</span><span>⏳ {analysis.exp?`${analysis.exp} años exp.`:'Experiencia no clara'}</span><span>🎓 {analysis.degree?'Pide grado':'Grado no detectado'}</span></div>{analysis.missing.length>0&&<div className="warning">⚠️ Tecnologías que aparecen y no están en tu perfil: {analysis.missing.join(', ')}</div>}{(analysis.commercial||analysis.freelance)&&<div className="warning">⚠️ {analysis.commercial?'Tiene componente comercial. ':''}{analysis.freelance?'Menciona autónomo/freelance.':''}</div>}<div className="match"><b>Coincidencias:</b> {analysis.hits.join(', ')||'pocas detectadas'}</div></>}</section>
      {analysis&&<section className="card"><h2>Respuesta preparada</h2><p className="small">Base para preguntas tipo “¿por qué encajas?” o “describe tu experiencia”.</p><textarea readOnly value={answer}/><button className="secondary" onClick={()=>navigator.clipboard.writeText(answer)}>Copiar respuesta</button></section>}
      <section className="card"><h2>Guardar oferta</h2><label>Título</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Técnico de Soporte IT"/><label>Enlace de InfoJobs</label><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Pega la URL"/><div className="row"><button onClick={()=>save('Interesa')}>⭐ Me interesa</button><button onClick={()=>save('Inscrito')}>✅ Ya inscrito</button></div></section>
    </>}

    {tab==='seguimiento'&&<section className="card"><div className="stats"><b>{items.filter(x=>x.status==='Interesa').length}</b><span>interesan</span><b>{items.filter(x=>x.status==='Inscrito').length}</b><span>inscritas</span></div><h2>Seguimiento</h2>{items.length===0&&<p className="small">Todavía no has guardado ofertas.</p>}{items.map((x,i)=><div className="history" key={x.url+i}><div><b>{x.title}</b><div className="small">{x.status} · {x.date}{x.score?` · ${x.score}%`:''}</div></div><div className="historyActions"><a href={x.url} target="_blank">Abrir</a><select value={x.status} onChange={e=>setStatus(i,e.target.value as Item['status'])}><option>Interesa</option><option>Inscrito</option><option>Descartado</option></select></div></div>)}</section>}
  </main>
}