'use client';
import {useEffect,useMemo,useRef,useState} from 'react';

type Prefs={province:string;minSalary:number;remote:boolean;profile:string};
type Item={title:string;url:string;status:'Interesa'|'Inscrito'|'Descartado';score:number;date:string;salary:number|null;remote:boolean};

type Analysis={score:number;hits:string[];exp:number|null;salary:number|null;remote:boolean;degree:boolean;english:boolean;commercial:boolean;freelance:boolean;missing:string[];reasons:string[]};

const roles=['soporte informatico','it helpdesk','tecnico informatico','service desk','data center','sistemas junior'];
const skillTerms=['soporte','helpdesk','hardware','software','windows','office 365','m365','redes','vpn','ticket','incidencias','teams','outlook','html','css','javascript','typescript','web','data center','monitorizacion','router','usuarios','copias de seguridad','active directory','cisco','fortinet','vmware','linux'];
const slug=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function analyzeOffer(text:string,prefs:Prefs):Analysis|null{
  if(!text.trim())return null;
  const t=norm(text);
  const hits=skillTerms.filter(x=>t.includes(norm(x)));
  const years=[...t.matchAll(/(\d+)\s*(?:anos|año|años|years?)/g)].map(m=>Number(m[1])).filter(n=>n>0&&n<20);
  const exp=years.length?Math.max(...years):null;
  const salaryRaw=[...t.matchAll(/(\d{2})[\.,]?(\d{3})?\s*(?:€|euros?)/g)].map(m=>m[2]?Number(m[1]+m[2]):Number(m[1])*1000).filter(n=>n>=12000&&n<=150000);
  const salary=salaryRaw.length?Math.max(...salaryRaw):null;
  const remote=/remoto|teletrabajo|hibrid/.test(t);
  const degree=/grado universitario|titulacion universitaria|ingenieria|licenciatura/.test(t);
  const english=/ingles|english/.test(t);
  const commercial=/comercial|ventas|captacion/.test(t);
  const freelance=/autonomo|freelance/.test(t);
  let score=45+Math.min(36,hits.length*3);
  const reasons:string[]=[];
  if(hits.length>=6)reasons.push('Buen encaje técnico por palabras clave.');
  if(remote&&prefs.remote){score+=6;reasons.push('Ofrece remoto o híbrido.');}
  if(salary&&salary>=prefs.minSalary){score+=8;reasons.push('Cumple tu salario mínimo.');}
  if(salary&&salary<prefs.minSalary){score-=18;reasons.push('El salario parece estar por debajo de tu mínimo.');}
  if(exp&&exp>=5){score-=12;reasons.push('Pide bastante experiencia.');}
  else if(exp&&exp<=3){score+=3;reasons.push('La experiencia pedida parece asumible.');}
  if(commercial){score-=10;reasons.push('Tiene componente comercial.');}
  if(freelance){score-=12;reasons.push('Menciona autónomo/freelance.');}
  score=Math.max(10,Math.min(98,score));
  const missing=skillTerms.filter(x=>/cisco|fortinet|vmware|linux|active directory/.test(x)&&t.includes(norm(x))&&!norm(prefs.profile).includes(norm(x)));
  return{score,hits,exp,salary,remote,degree,english,commercial,freelance,missing,reasons};
}

export default function Home(){
  const[prefs,setPrefs]=useState<Prefs>({province:'Madrid',minSalary:20000,remote:true,profile:'Soporte IT, helpdesk, incidencias, hardware/software, Windows, M365, redes, tickets, Outlook, Teams, desarrollo web, JavaScript/TypeScript y experiencia en data center.'});
  const[roleIndex,setRoleIndex]=useState(0);const[text,setText]=useState('');const[title,setTitle]=useState('');const[url,setUrl]=useState('');const[items,setItems]=useState<Item[]>([]);
  const[tab,setTab]=useState<'buscar'|'importar'|'seguimiento'>('buscar');
  const[ocrBusy,setOcrBusy]=useState(false);const[ocrProgress,setOcrProgress]=useState(0);const[ocrStatus,setOcrStatus]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{try{const p=localStorage.getItem('autojobs-prefs');if(p)setPrefs(JSON.parse(p));const i=localStorage.getItem('autojobs-items-v3');if(i)setItems(JSON.parse(i));}catch{}},[]);
  useEffect(()=>{localStorage.setItem('autojobs-prefs',JSON.stringify(prefs))},[prefs]);
  useEffect(()=>{localStorage.setItem('autojobs-items-v3',JSON.stringify(items))},[items]);

  const role=roles[roleIndex];
  const searchUrl=`https://www.infojobs.net/ofertas-trabajo/${slug(prefs.province)}/${slug(role)}`;
  const analysis=useMemo(()=>analyzeOffer(text,prefs),[text,prefs]);
  const answer=analysis?`Tengo experiencia práctica en ${analysis.hits.slice(0,6).join(', ')||'soporte IT y resolución de incidencias'}. Estoy acostumbrado a trabajar con usuarios, diagnosticar problemas y aprender herramientas nuevas rápidamente. Me interesa la posición porque encaja con mi perfil técnico y quiero seguir creciendo en entornos IT.`:'';

  async function readScreenshots(files:FileList|null){
    if(!files?.length)return;
    setOcrBusy(true);setOcrProgress(0);setOcrStatus('Preparando OCR…');
    try{
      const {recognize}=await import('tesseract.js');
      let combined='';
      for(let i=0;i<files.length;i++){
        const file=files[i];
        const src=URL.createObjectURL(file);
        setOcrStatus(`Leyendo captura ${i+1}/${files.length}…`);
        const result=await recognize(src,'spa',{logger:(m:any)=>{if(m.status==='recognizing text')setOcrProgress(Math.round(((i+(m.progress||0))/files.length)*100));}});
        URL.revokeObjectURL(src);
        combined+=`\n${result.data.text}`;
      }
      setText(combined.trim());
      setOcrProgress(100);setOcrStatus('Texto leído. Ya puedes revisar la compatibilidad.');
      setTab('importar');
    }catch(e){console.error(e);setOcrStatus('No pude leer la captura. Prueba con una captura más nítida o pega texto manualmente.');}
    finally{setOcrBusy(false);}
  }

  async function paste(){try{setText(await navigator.clipboard.readText())}catch{alert('Mantén pulsado en el cuadro y toca Pegar.')}}
  function nextSearch(){window.open(searchUrl,'_blank');setRoleIndex(i=>(i+1)%roles.length)}
  function save(status:Item['status']){const u=url.trim()||searchUrl;if(items.some(x=>x.url===u&&u!==searchUrl)){alert('Esta oferta ya está guardada.');return;}const score=analysis?.score||0;setItems(x=>[{title:title.trim()||'Oferta InfoJobs',url:u,status,score,date:new Date().toLocaleDateString('es-ES'),salary:analysis?.salary||null,remote:analysis?.remote||false},...x]);}
  function setStatus(idx:number,status:Item['status']){setItems(x=>x.map((it,i)=>i===idx?{...it,status}:it))}
  function removeItem(idx:number){setItems(x=>x.filter((_,i)=>i!==idx))}

  return <main>
    <div className="brand">AUTOJOBS · ASSISTANT</div><h1>Encuentra, analiza y aplica desde el móvil.</h1><div className="sub">La ruta útil hoy: InfoJobs → captura → AutoJobs la lee → tú decides → abrir candidatura.</div>
    <nav className="tabs"><button className={tab==='buscar'?'active':''} onClick={()=>setTab('buscar')}>Buscar</button><button className={tab==='importar'?'active':''} onClick={()=>setTab('importar')}>Importar</button><button className={tab==='seguimiento'?'active':''} onClick={()=>setTab('seguimiento')}>Seguimiento</button></nav>

    {tab==='buscar'&&<>
      <section className="card"><h2>Tu filtro</h2><div className="row"><div><label>Provincia</label><input value={prefs.province} onChange={e=>setPrefs({...prefs,province:e.target.value})}/></div><div><label>Salario mínimo</label><input type="number" value={prefs.minSalary} onChange={e=>setPrefs({...prefs,minSalary:Number(e.target.value)})}/></div></div><label className="toggle"><input type="checkbox" checked={prefs.remote} onChange={e=>setPrefs({...prefs,remote:e.target.checked})}/> Priorizar remoto/híbrido</label><label>Tu perfil</label><textarea className="profile" value={prefs.profile} onChange={e=>setPrefs({...prefs,profile:e.target.value})}/></section>
      <section className="card"><div className="kicker">RONDA DE BÚSQUEDA</div><h2>{role}</h2><p className="small">Abre resultados en InfoJobs. Cuando veas una oferta interesante, haz una o varias capturas y vuelve a AutoJobs.</p><button onClick={nextSearch}>Abrir búsqueda {roleIndex+1}/{roles.length}</button><div className="queue">{roles.map((r,i)=><span key={r} className={i===roleIndex?'current':''}>{i<roleIndex?'✓ ':''}{r}</span>)}</div></section>
      <section className="card highlight"><h2>Atajo móvil</h2><p className="small">Después de hacer la captura, pulsa el botón de abajo y elige la imagen. AutoJobs intentará leer todo el texto automáticamente.</p><button onClick={()=>fileRef.current?.click()}>📸 Analizar captura de oferta</button><input ref={fileRef} className="hiddenFile" type="file" accept="image/*" multiple onChange={e=>readScreenshots(e.target.files)}/>{ocrStatus&&<div className="ocrStatus">{ocrStatus}{ocrBusy&&<div className="progress"><span style={{width:`${ocrProgress}%`}}/></div>}</div>}</section>
    </>}

    {tab==='importar'&&<>
      <section className="card"><h2>Importar oferta</h2><div className="row"><button onClick={()=>fileRef.current?.click()}>📸 Leer captura</button><button className="secondary" onClick={paste}>📋 Pegar texto</button></div><input ref={fileRef} className="hiddenFile" type="file" accept="image/*" multiple onChange={e=>readScreenshots(e.target.files)}/>{ocrStatus&&<div className="ocrStatus">{ocrStatus}{ocrBusy&&<div className="progress"><span style={{width:`${ocrProgress}%`}}/></div>}</div>}<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="El texto leído de la captura aparecerá aquí…"/>{analysis&&<><div className={'score '+(analysis.score>=80?'good':analysis.score>=65?'mid':'bad')}>{analysis.score}%</div><div className="verdict">{analysis.score>=80?'Muy buena candidata':analysis.score>=65?'Merece revisión':'Probablemente no prioritaria'}</div><div className="facts"><span>💰 {analysis.salary?`${analysis.salary.toLocaleString('es-ES')} €`:'Salario no detectado'}</span><span>🧭 {analysis.remote?'Remoto/híbrido':'No detectado'}</span><span>⏳ {analysis.exp?`${analysis.exp} años exp.`:'Experiencia no clara'}</span><span>🎓 {analysis.degree?'Pide grado':'Grado no detectado'}</span></div>{analysis.reasons.map(r=><div className="reason" key={r}>• {r}</div>)}{analysis.missing.length>0&&<div className="warning">⚠️ Pide tecnologías que no aparecen en tu perfil: {analysis.missing.join(', ')}</div>}<div className="match"><b>Coincidencias:</b> {analysis.hits.join(', ')||'pocas detectadas'}</div></>}</section>
      {analysis&&<section className="card"><h2>Respuesta preparada</h2><textarea readOnly value={answer}/><button className="secondary" onClick={()=>navigator.clipboard.writeText(answer)}>Copiar respuesta</button></section>}
      <section className="card"><h2>Guardar y aplicar</h2><label>Título</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Técnico de Soporte IT"/><label>Enlace de la oferta</label><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Pega el enlace de InfoJobs si lo tienes"/><div className="row"><button onClick={()=>save('Interesa')}>⭐ Guardar</button><button onClick={()=>save('Inscrito')}>✅ Marcar inscrito</button></div>{url.trim()&&<a className="btn apply" href={url} target="_blank">Abrir oferta y pulsar Inscribirme</a>}</section>
    </>}

    {tab==='seguimiento'&&<section className="card"><div className="stats"><b>{items.filter(x=>x.status==='Interesa').length}</b><span>interesan</span><b>{items.filter(x=>x.status==='Inscrito').length}</b><span>inscritas</span></div><h2>Seguimiento</h2>{items.length===0&&<p className="small">Todavía no has guardado ofertas.</p>}{items.map((x,i)=><div className="history" key={x.url+i}><div><b>{x.title}</b><div className="small">{x.status} · {x.date}{x.score?` · ${x.score}%`:''}{x.salary?` · ${x.salary.toLocaleString('es-ES')} €`:''}</div></div><div className="historyActions"><a href={x.url} target="_blank">Abrir</a><select value={x.status} onChange={e=>setStatus(i,e.target.value as Item['status'])}><option>Interesa</option><option>Inscrito</option><option>Descartado</option></select><button className="delete" onClick={()=>removeItem(i)}>×</button></div></div>)}</section>}
  </main>
}