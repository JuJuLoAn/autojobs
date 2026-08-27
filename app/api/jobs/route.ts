import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {accessFromRefresh,decrypt,flattenParts} from '@/lib/google';

const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const norm=(s:string)=>clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const key=(s:string)=>norm(s).replace(/[^a-z0-9]/g,'');

const SEARCHES=[
 {category:'Soporte IT',slug:'soporte-it'},
 {category:'Desarrollo Web',slug:'desarrollo-web'},
 {category:'Infraestructura / Sistemas',slug:'tecnico-sistemas'},
 {category:'Ciberseguridad',slug:'ciberseguridad'},
 {category:'IA / Automatización',slug:'inteligencia-artificial'},
 {category:'Redes',slug:'redes'}
];

const profileTerms=['soporte','helpdesk','service desk','informatica','sistemas','redes','infraestructura','web','frontend','javascript','typescript','react','wordpress','php','hardware','software','windows','m365','active directory','ciber','seguridad','ia','inteligencia artificial','automatizacion','python','sql','base de datos'];
function scoreTitle(title:string,body=''){const t=norm(`${title} ${body}`);let s=48;for(const x of profileTerms)if(t.includes(x))s+=3;if(/madrid|remoto|hibrido/.test(t))s+=4;if(/junior|nivel 1|n1|primer empleo|sin experiencia|practicas|beca/.test(t))s+=8;if(/senior|sr\b|lead\b|manager\b|director\b|jefe de|head of/.test(norm(title)))s-=22;return Math.max(30,Math.min(98,s));}
function tooSenior(title:string,body:string){const t=norm(`${title} ${body}`);if(/senior|sr\b|lead\b|manager\b|director\b|jefe de|head of|arquitecto/.test(norm(title)))return true;if(/(?:minimo|al menos|mas de|experiencia de)\s*(?:5|6|7|8|9|10)\s*(?:anos|años)/.test(t))return true;if(/(?:5|6|7|8|9|10)\+?\s*(?:anos|años)\s+de experiencia/.test(t))return true;return false;}
function salaryFromText(raw:string){const txt=clean(raw);const range=txt.match(/(\d{2,3}(?:[.\s]\d{3})?)\s*€?\s*(?:-|–|a|hasta)\s*(\d{2,3}(?:[.\s]\d{3})?)\s*€/i);const money=(x:string)=>Number(x.replace(/[^0-9]/g,''));if(range){const a=money(range[1]),b=money(range[2]);if(a>=12000&&b<=150000)return`${a.toLocaleString('es-ES')}–${b.toLocaleString('es-ES')} €`;}const single=[...txt.matchAll(/(\d{2,3}(?:[.\s]\d{3})?)\s*€/gi)].map(m=>money(m[1])).find(n=>n>=12000&&n<=150000);return single?`${single.toLocaleString('es-ES')} €`:null;}
function timestampFromBlock(raw:string){const t=norm(clean(raw)),now=Date.now();let m=t.match(/hace\s+(\d+)\s*(?:min|minutos?)/);if(m)return now-Number(m[1])*60_000;m=t.match(/hace\s+(\d+)\s*h/);if(m)return now-Number(m[1])*3_600_000;m=t.match(/hace\s+(\d+)\s*d/);if(m)return now-Number(m[1])*86_400_000;const months:any={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};m=t.match(/\b(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/);if(m)return new Date(new Date().getFullYear(),months[m[2]],Number(m[1]),12).getTime();return now-30*86_400_000;}
function offerId(link:string,title:string){const m=link.match(/\/of-([a-z0-9]+)/i);return m?.[1]||key(title);}

async function liveSearch(category:string,slug:string){const url=`https://www.infojobs.net/ofertas-trabajo/madrid/${slug}?sortBy=PUBLICATION_DATE`;const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; AutoJobs/1.0)','Accept':'text/html,application/xhtml+xml'}});if(!r.ok)return[];const html=await r.text(),out:any[]=[],seen=new Set<string>();const matches=[...html.matchAll(/<a[^>]+href=["']([^"']*\/of-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];for(const m of matches){let link=m[1].replace(/&amp;/g,'&');if(link.startsWith('/'))link=`https://www.infojobs.net${link}`;const title=clean(m[2]);if(!title||title.length<4||title.length>180)continue;const id=offerId(link,title);if(seen.has(id))continue;const idx=m.index||0,block=html.slice(idx,idx+5000),text=clean(block);if(tooSenior(title,text))continue;seen.add(id);out.push({id:`live-${id}`,title,link,score:scoreTitle(title,text),salary:salaryFromText(text),date:new Date(timestampFromBlock(text)).toISOString(),timestamp:timestampFromBlock(text),status:'Nueva',category,source:'live'});if(out.length>=30)break;}return out;}catch{return[];}finally{clearTimeout(timer);}}

function appTitle(subject:string,snippet:string,body:string){const t=clean(`${snippet} ${body}`).slice(0,1600);let m=t.match(/te has inscrito (?:en|a) la oferta\s+(.+?)(?:\s+puedes seguir|$)/i);if(m?.[1])return clean(m[1]);m=t.match(/proceso para\s+(.+?)\s+ha finalizado/i);return m?.[1]?clean(m[1]):subject;}
async function gmail(access:string,q:string,max=20){const lr=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${max}`,{headers:{Authorization:`Bearer ${access}`},cache:'no-store'});if(!lr.ok)return[];const list=await lr.json();const rows=await Promise.all((list.messages||[]).map(async(it:any)=>{const r=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${it.id}?format=full`,{headers:{Authorization:`Bearer ${access}`},cache:'no-store'});if(!r.ok)return null;const m=await r.json(),hs=Object.fromEntries((m.payload?.headers||[]).map((h:any)=>[h.name.toLowerCase(),h.value]));return{id:it.id,subject:hs.subject||'',date:hs.date||'',snippet:m.snippet||'',body:flattenParts(m.payload)};}));return rows.filter(Boolean) as any[];}

export async function GET(){try{
 const jar=await cookies(),enc=jar.get('autojobs_google_refresh')?.value;
 const livePromise=Promise.all(SEARCHES.map(s=>liveSearch(s.category,s.slug)));
 let applications:any[]=[];
 if(enc){try{const access=(await accessFromRefresh(decrypt(enc))).access_token;const appMails=await gmail(access,'(from:pushinfojobs@comms.infojobs.net OR from:pushinfojobs@notify.infojobs.net) newer_than:120d',24);for(const m of appMails){const lower=norm(`${m.subject} ${m.snippet} ${m.body}`);let status='Novedades';if(/te has inscrito/.test(lower))status='Inscrito';if(/proceso ha finalizado|este proceso ha finalizado/.test(lower))status='Finalizado';applications.push({id:m.id,title:appTitle(m.subject,m.snippet,m.body),status,date:m.date});}}catch{}}
 const groups=await livePromise;const merged=groups.flat();const statusBy=[...new Map(applications.map(a=>[key(a.title),a.status])).entries()];
 const seen=new Set<string>(),jobs:any[]=[];for(const j of merged.sort((a,b)=>b.timestamp-a.timestamp)){const id=offerId(j.link,j.title);if(seen.has(id))continue;seen.add(id);let state=j.status;const jk=key(j.title);for(const[ak,st]of statusBy)if(ak.includes(jk)||jk.includes(ak)){state=st;break;}jobs.push({...j,status:state});}
 const appUnique=[...new Map(applications.map(a=>[key(a.title),a])).values()].filter((a:any)=>key(a.title));
 return NextResponse.json({connected:!!enc,jobs,applications:appUnique,live:true,filters:{location:'Madrid',maxExperience:'Se excluyen senior/lead/manager y requisitos claros de 5+ años',sort:'Más recientes primero',areas:SEARCHES.map(s=>s.category)}});
 }catch(e:any){return NextResponse.json({connected:false,jobs:[],applications:[],error:e?.message||'Error buscando ofertas'},{status:500});}}
