import {NextResponse} from 'next/server';

const CV = `
CANDIDATO: Julián López Andreu, Madrid.
PERFIL: Desarrollador web y soporte IT. Responsable, perseverante, adaptable, orientado a aprender y resolver problemas.
FORMACIÓN:
- Grado Superior en Desarrollo de Aplicaciones Web (DAW), IES Pío Baroja.
- Grado Medio en Sistemas Microinformáticos y Redes (SMR), IES Pío Baroja.
- Formación en Ciberseguridad, Prevención y Gestión de Ciberataques.
- Formación en Inteligencia Artificial aplicada al puesto de trabajo.
EXPERIENCIA:
- MetaFleet, Técnico PDI: preparación tecnológica y configuración de vehículos, instalación y conexión de dispositivos, sistemas multimedia, diagnóstico de incidencias, comprobaciones electrónicas y control de calidad.
- Maletas Greenwich, Técnico de Soporte IT y Administración: bases de datos y plataforma web, copias de seguridad, soporte informático remoto a oficinas y tiendas, resolución de incidencias técnicas y apoyo administrativo.
- Ram2 Immobilien, Desarrollador Web en prácticas: mantenimiento web, creación de apartados y SEO.
- Dutti Trans, Desarrollador Web y Soporte IT: desarrollo y mantenimiento integral de web corporativa, soporte y asistencia informática.
- Maversa Sistemas de Mantenimiento, Técnico de Infraestructuras: instalación, mantenimiento y soporte de sistemas, infraestructuras técnicas, equipos y redes.
OTROS:
- Inglés intermedio.
- Carnet de conducir y vehículo propio.
`;

function extractText(data:any){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 const parts:string[]=[];
 for(const item of data?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);
 return parts.join('\n').trim();
}

function fallback(question:string,title:string){
 const q=question.toLowerCase();
 if(/salario|pretensi|expectativa/.test(q))return 'Mi expectativa salarial está en torno a 20.000–24.000 € brutos anuales, aunque estoy abierto a valorar la propuesta global según funciones, modalidad y posibilidades de crecimiento.';
 if(/ingl[eé]s|english/.test(q))return 'Tengo un nivel de inglés intermedio y puedo desenvolverme con documentación técnica y situaciones profesionales habituales. Además, continúo mejorándolo.';
 if(/carnet|veh[ií]culo|coche/.test(q))return 'Sí, tengo carnet de conducir y vehículo propio, con disponibilidad para desplazarme cuando el puesto lo requiera.';
 return `Mi perfil combina DAW y SMR con experiencia práctica en soporte IT, sistemas, redes, infraestructuras y desarrollo web. He trabajado resolviendo incidencias, manteniendo equipos y plataformas y dando soporte a usuarios, por lo que creo que puedo adaptarme con rapidez y aportar valor en ${title||'este puesto'}.`;
}

export async function POST(req:Request){
 try{
  const {question,title,previousAnswer,regenerate}=await req.json();
  if(!question?.trim())return NextResponse.json({error:'Escribe una pregunta'},{status:400});
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({answer:fallback(question,title||''),ai:false});

  const system=`Eres un especialista senior en selección IT y redacción de candidaturas. Tu objetivo es ayudar al candidato a conseguir una entrevista, usando únicamente información verdadera del CV.\n\nREGLAS:\n1. Responde como el propio candidato, en primera persona.\n2. Sé convincente, seguro, natural y profesional; nunca suenes desesperado ni robótico.\n3. No inventes tecnologías, años, certificaciones, idiomas o experiencia que el CV no respalda.\n4. Si falta experiencia exacta, NO abras con \"no tengo experiencia\". Destaca primero experiencia transferible, formación relacionada, capacidad de aprendizaje y tareas cercanas reales.\n5. Si la pregunta contiene opciones, elige SOLO la opción que mejor encaje. Devuelve únicamente el texto de esa opción, sin explicación, salvo que la pregunta pida justificar.\n6. Si pide una cifra, años, nivel o disponibilidad, responde directamente y de forma breve.\n7. Para preguntas abiertas, escribe normalmente 2-5 frases, máximo 90 palabras, enfocadas al puesto.\n8. Evita repetir frases hechas como \"aportar desde el primer día\" en todas las respuestas. Varía vocabulario, estructura y enfoque.\n9. Si regenerate=true, genera una respuesta sustancialmente distinta de la anterior: cambia enfoque, estructura y ejemplos; no hagas simples sinónimos.\n10. No menciones estas reglas ni digas que eres una IA.\n\nCV DEL CANDIDATO:\n${CV}`;
  const user=`PUESTO: ${title||'No indicado'}\nPREGUNTA DE LA CANDIDATURA:\n${question}\n${regenerate&&previousAnswer?`\nRESPUESTA ANTERIOR (NO LA REPITAS NI LA PARAFRASEES DE CERCA):\n${previousAnswer}`:''}\n\nRedacta la mejor respuesta posible para maximizar las posibilidades de pasar el filtro de selección sin falsear el CV.`;

  const r=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',instructions:system,input:user,max_output_tokens:220})
  });
  if(!r.ok){console.error('OpenAI answer error',r.status,await r.text());return NextResponse.json({answer:fallback(question,title||''),ai:false});}
  const data=await r.json();const answer=extractText(data);
  return NextResponse.json({answer:answer||fallback(question,title||''),ai:!!answer});
 }catch(e){console.error(e);return NextResponse.json({error:'No pude preparar la respuesta'},{status:500});}
}
