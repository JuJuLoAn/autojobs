import {NextResponse} from 'next/server';

const profile=[
 'Formación: Grado Superior en Desarrollo de Aplicaciones Web (DAW).',
 'Formación: Grado Medio en Sistemas Microinformáticos y Redes (SMR).',
 'Formación adicional en ciberseguridad e inteligencia artificial aplicada al puesto de trabajo.',
 'Experiencia en soporte IT remoto a oficinas y tiendas, resolución de incidencias técnicas, hardware, software, equipos y redes.',
 'Experiencia en gestión y mantenimiento de bases de datos y plataforma web y realización de copias de seguridad.',
 'Experiencia como desarrollador web: creación y mantenimiento de páginas web corporativas y SEO.',
 'Experiencia como técnico de infraestructuras: instalación, mantenimiento y soporte de sistemas, equipos y redes.',
 'Experiencia PDI tecnológica en vehículos: instalación y conexión de dispositivos, sistemas multimedia, diagnóstico de incidencias y comprobaciones electrónicas.',
 'Inglés nivel intermedio.',
 'Carnet de conducir y vehículo propio.'
];
const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const profileText=norm(profile.join(' '));

function optionsFrom(question:string){
 const lines=question.split(/\n|\r|\s{2,}/).map(x=>x.trim()).filter(Boolean);
 const tagged=lines.filter(x=>/^(?:[a-dA-D][).:-]|\d+[).:-]|[-•])\s*/.test(x)).map(x=>x.replace(/^(?:[a-dA-D][).:-]|\d+[).:-]|[-•])\s*/,''));
 if(tagged.length>=2)return tagged;
 const inline=[...question.matchAll(/(?:^|\s)([A-Da-d])\)\s*([^A-Da-d\n]{2,80})(?=\s+[A-Da-d]\)|$)/g)].map(m=>m[2].trim());
 return inline.length>=2?inline:[];
}
function chooseOption(question:string,options:string[]){
 const q=norm(question);
 const scored=options.map((o,i)=>{const n=norm(o);let s=0;
  if(/si|sí/.test(n)&&/(carnet|vehiculo|coche|disponibilidad)/.test(q))s+=10;
  if(/intermedio|b1|b2/.test(n)&&/(ingles|english)/.test(q))s+=10;
  if(/grado superior|fp superior|daw/.test(n)&&/(estudios|formacion|titulacion|nivel)/.test(q))s+=10;
  if(/grado medio|smr/.test(n)&&/(estudios|formacion|titulacion|nivel)/.test(q))s+=7;
  if(/20.?000|24.?000|20k|24k/.test(n)&&/(salario|pretension|expectativa)/.test(q))s+=10;
  for(const kw of ['soporte','it','informatica','sistemas','redes','web','infraestructura','hardware','software','ciberseguridad','base de datos','sql'])if(n.includes(kw)&&profileText.includes(kw))s+=3;
  if(/no tengo experiencia|ninguna|sin experiencia/.test(n)&&/(soporte|sistemas|redes|web|informatica|it)/.test(q))s-=6;
  return {o,i,s};
 }).sort((a,b)=>b.s-a.s||a.i-b.i);
 return scored[0]?.o||options[0];
}
function variant(base:string,n:number){
 if(n%3===1)return base.replace(/^Tengo /,'Cuento con ').replace(/^He trabajado /,'He tenido experiencia ');
 if(n%3===2)return base.replace('Tengo experiencia','Mi experiencia incluye').replace('Me interesa','Este puesto me interesa');
 return base;
}
function grounded(question:string,title:string,regen=false,previous=''){
 const q=norm(question),role=title?.trim()?` para el puesto de ${title.trim()}`:'';
 const opts=optionsFrom(question);if(opts.length>=2)return chooseOption(question,opts);
 let base='';
 if(/salario|pretension|expectativa/.test(q))base=`Mi expectativa salarial está en torno a 20.000–24.000 € brutos anuales, aunque puedo valorarla según las funciones, horario, modalidad y posibilidades de crecimiento${role}.`;
 else if(/ingles|english|idioma/.test(q))base='Tengo un nivel de inglés intermedio. Puedo trabajar con documentación técnica y desenvolverme en comunicaciones profesionales habituales, y sigo mejorándolo.';
 else if(/carnet|coche|vehiculo|desplaz/.test(q))base='Sí. Tengo carnet de conducir y vehículo propio, por lo que puedo desplazarme cuando el puesto lo requiera.';
 else if(/universit|grado universit|ingenier|licenc/.test(q))base='No tengo grado universitario. Mi formación principal es un Grado Superior en Desarrollo de Aplicaciones Web y un Grado Medio en Sistemas Microinformáticos y Redes, además de formación adicional en ciberseguridad.';
 else if(/disponibilidad|incorpor/.test(q))base=`Tengo disponibilidad para incorporarme según las necesidades de la empresa${role}.`;
 else if(/base.? de datos|sql|database/.test(q))base='He trabajado en la gestión y mantenimiento de bases de datos y plataformas web, además de realizar copias de seguridad y resolver incidencias relacionadas con el entorno técnico.';
 else if(/redes|network|router|switch|tcp|ip/.test(q))base='Tengo formación en Sistemas Microinformáticos y Redes y experiencia práctica en soporte de equipos, redes e infraestructuras, diagnóstico de incidencias y mantenimiento técnico.';
 else if(/hardware|software|incidencia|help.?desk|service desk|soporte/.test(q))base='Tengo experiencia en soporte IT remoto a oficinas y tiendas, resolución de incidencias de hardware y software, mantenimiento de equipos, redes, copias de seguridad y apoyo técnico a usuarios.';
 else if(/web|javascript|typescript|frontend|desarroll|program/.test(q))base='Tengo un Grado Superior en Desarrollo de Aplicaciones Web y experiencia creando y manteniendo páginas web corporativas, gestionando plataformas web y realizando tareas de SEO y mantenimiento.';
 else if(/infraestruct|sistemas|servidor|data center|datacenter|cpd/.test(q))base='He trabajado como técnico de infraestructuras realizando instalación, mantenimiento y soporte de sistemas, equipos y redes. También tengo experiencia en soporte IT y diagnóstico de incidencias.';
 else if(/ciber|seguridad/.test(q))base='Tengo formación específica en ciberseguridad y prevención y gestión de ciberataques, complementada con mi base técnica en sistemas, redes y soporte IT.';
 else if(/experiencia/.test(q))base=`Mi experiencia encaja principalmente en soporte IT, infraestructuras, redes y desarrollo web. He resuelto incidencias técnicas, mantenido equipos y plataformas, trabajado con bases de datos y copias de seguridad y dado soporte remoto a usuarios${role}.`;
 else if(/por que|por qué|motiv|interes|empresa/.test(q))base=`Me interesa${role} porque encaja con mi formación en DAW y SMR y con mi experiencia en soporte IT, infraestructuras y resolución de incidencias. Busco seguir creciendo técnicamente y aportar desde el primer día en tareas que ya conozco.`;
 else base=`Para responder con precisión a esa pregunta no quiero inventar experiencia que no tengo. Lo que sí puedo acreditar es: ${profile.slice(0,6).join(' ')}`;
 if(!regen)return base;
 const seed=(previous.length+question.length+Date.now())%3;const v=variant(base,seed);return v===previous?variant(base,(seed+1)%3):v;
}

export async function POST(req:Request){try{const {question,title,regenerate,previousAnswer}=await req.json();if(!question?.trim())return NextResponse.json({error:'Escribe una pregunta'},{status:400});return NextResponse.json({answer:grounded(question,title||'',!!regenerate,previousAnswer||'')});}catch{return NextResponse.json({error:'No pude preparar la respuesta'},{status:500});}}
