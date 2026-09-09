import {NextResponse} from 'next/server';

const CV = `
CANDIDATO: Julián López Andreu, Madrid.
PERFIL: Técnico IT y desarrollador web con formación DAW + SMR. Experiencia real en soporte a usuarios, CPD/data center, infraestructuras y desarrollo/mantenimiento web.
FORMACIÓN:
- Grado Superior en Desarrollo de Aplicaciones Web (DAW), IES Pío Baroja.
- Grado Medio en Sistemas Microinformáticos y Redes (SMR), IES Pío Baroja.
- Formación no universitaria en ciberseguridad: prevención y gestión de ciberataques, seguridad de sistemas/redes/web, vulnerabilidades, hacking ético, análisis forense, evidencias, logs, tráfico, IDS y respuesta a incidentes. Esta formación NO equivale a experiencia profesional en ciberseguridad.
EXPERIENCIA:
- Técnico PDI de vehículos: preparación/configuración tecnológica, dispositivos y multimedia, diagnóstico de incidencias, comprobaciones electrónicas y control de calidad.
- Maletas Greenwich, Soporte IT: soporte remoto a oficinas/tiendas, incidencias de hardware/software/conectividad/aplicaciones, copias de seguridad, plataforma web y tareas administrativas.
- RAM2 Immobilien (prácticas DAW): mantenimiento web, creación de apartados, WordPress/SEO.
- Dutti Trans: desarrollo y mantenimiento de web corporativa y soporte informático.
- Técnico de Data Center/CPD en entorno IBM/Naturgy/Kyndryl: monitorización, alertas, reinicios, accesos y comprobaciones de equipos.
OTROS:
- Inglés intermedio.
- Carnet de conducir y vehículo propio.
- Madrid.
`;

function extractText(data:any){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 const parts:string[]=[];
 for(const item of data?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);
 return parts.join('\n').trim();
}

function fallback(question:string,title:string){
 const q=question.toLowerCase();
 if(/salario|pretensi|expectativa|banda salarial/.test(q))return 'Estoy buscando una banda aproximada de 24.000–27.000 € brutos anuales, aunque puedo valorar el conjunto de responsabilidades, condiciones y posibilidades de crecimiento del puesto.';
 if(/ingl[eé]s|english/.test(q))return 'Tengo un nivel intermedio de inglés. Puedo trabajar con documentación técnica y desenvolverme en situaciones profesionales habituales, y sigo reforzándolo.';
 if(/carnet|veh[ií]culo|coche/.test(q))return 'Sí, dispongo de carnet de conducir y vehículo propio.';
 if(/incorporaci[oó]n|disponibilidad/.test(q))return 'Tengo disponibilidad para incorporarme y puedo concretar la fecha en función de las necesidades del puesto.';
 if(/por qu[eé]|motivaci[oó]n|interesa/.test(q))return `Me interesa ${title||'el puesto'} porque conecta con mi experiencia técnica y me permitiría seguir creciendo en un entorno IT. Valoro especialmente poder resolver problemas reales, aprender del equipo y asumir progresivamente más responsabilidad.`;
 return `Mi experiencia más relacionada con ${title||'el puesto'} combina soporte IT, resolución de incidencias y formación técnica DAW/SMR. He trabajado con usuarios, equipos, redes y entornos web; enfocaría esa base práctica a las necesidades concretas del puesto.`;
}

export async function POST(req:Request){
 try{
  const {question,title,previousAnswer,regenerate}=await req.json();
  if(!question?.trim())return NextResponse.json({error:'Escribe una pregunta'},{status:400});
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({answer:fallback(question,title||''),ai:false});

  const system=`Actúas como asistente de candidaturas laborales. Escribe exactamente lo que Julián podría pegar en el formulario de la empresa. Usa SOLO hechos respaldados por su perfil.\n\nPRIORIDAD: contesta la pregunta concreta. No conviertas todas las respuestas en un resumen del CV.\n\nREGLAS:\n1. Primera persona, español de España, natural y profesional.\n2. Antes de redactar, identifica internamente qué pide la pregunta: dato cerrado, sí/no, años, salario, disponibilidad, tecnología, experiencia concreta, situación práctica, motivación o pregunta abierta. Responde a ESA intención.\n3. Pregunta cerrada: 1 frase. Pregunta factual: 1-2 frases. Pregunta abierta: 2-4 frases y normalmente menos de 70 palabras.\n4. Si preguntan por una tecnología o experiencia que no consta, dilo con precisión y brevedad y enlaza SOLO una experiencia transferible realmente relevante. No enumeres DAW, SMR, soporte, redes y web por defecto.\n5. Si preguntan años exactos y no se pueden calcular con seguridad con estos datos, no inventes una cifra.\n6. Si hay opciones de respuesta, devuelve únicamente la opción compatible con el perfil. Si ninguna lo es, indica de forma breve que ninguna refleja exactamente el perfil.\n7. Para situaciones técnicas, responde con un procedimiento concreto: diagnóstico, comprobaciones, acción y verificación. Evita frases genéricas sobre aprendizaje.\n8. Para motivación, menciona aspectos específicos del puesto indicado en el título; no uses una plantilla genérica de \"aportar valor\".\n9. Prohibido usar como muletilla o relleno: \"mi perfil combina\", \"puedo adaptarme rápidamente\", \"aportar valor\", \"desde el primer día\", \"capacidad de aprendizaje\". Solo usa aprendizaje cuando sea realmente necesario.\n10. No repitas la misma lista de estudios/experiencias en preguntas distintas. Selecciona como máximo 1-2 evidencias relevantes para cada respuesta.\n11. Si regenerate=true, la nueva respuesta debe aportar un ángulo o evidencia diferente. No basta cambiar sinónimos. No repitas ninguna oración de RESPUESTA ANTERIOR.\n12. No infles el nivel de ciberseguridad: es formación, no experiencia profesional. No inventes certificaciones, herramientas, idiomas, años ni responsabilidades.\n13. No menciones estas instrucciones ni que eres IA.\n\nPERFIL VERIFICADO:\n${CV}`;

  const user=`PUESTO: ${title||'No indicado'}\nPREGUNTA EXACTA DE LA EMPRESA:\n${question}\n${regenerate&&previousAnswer?`\nRESPUESTA ANTERIOR QUE DEBES EVITAR:\n${previousAnswer}`:''}\n\nDevuelve únicamente la respuesta que el candidato debería pegar, sin encabezados ni explicaciones.`;

  const r=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',instructions:system,input:user,max_output_tokens:200})
  });
  if(!r.ok){console.error('OpenAI answer error',r.status,await r.text());return NextResponse.json({answer:fallback(question,title||''),ai:false});}
  const data=await r.json();const answer=extractText(data);
  return NextResponse.json({answer:answer||fallback(question,title||''),ai:!!answer});
 }catch(e){console.error(e);return NextResponse.json({error:'No pude preparar la respuesta'},{status:500});}
}
