import {NextResponse} from 'next/server';

export async function GET(){
  const u=new URL('https://www.infojobs.net/ofertas-trabajo');
  u.searchParams.set('provinceIds','33');u.searchParams.set('sortBy','PUBLICATION_DATE');u.searchParams.set('page','1');u.searchParams.set('keyword','soporte it');
  const r=await fetch(u.toString(),{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1','Accept':'text/html,application/xhtml+xml','Accept-Language':'es-ES,es;q=0.9'}});
  const html=await r.text();
  const m=html.match(/<a[^>]+href=["']([^"']*\/of-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if(!m)return NextResponse.json({status:r.status,found:false});
  const idx=m.index||0;
  return NextResponse.json({status:r.status,found:true,href:m[1],anchor:m[0].slice(0,1200),before:html.slice(Math.max(0,idx-5000),idx),after:html.slice(idx,idx+10000)});
}
