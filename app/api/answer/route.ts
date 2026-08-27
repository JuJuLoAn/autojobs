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

function grounded(question:string,title:string){
 const q=norm(question); const role=title?.trim()?` para el puesto de ${title.trim()}`:'';
 if(/salario|pretension|expectativa/.test(q)) return `Mi expectativa salarial está en torno a 20.000–24.000 € brutos anuales, aunque puedo valorarla según las funciones, horario, modalidad y posibilidades de crecimiento${role}.`;
 if(/ingles|english|idioma/.test(q)) return 'Tengo un nivel de inglés intermedio. Puedo trabajar con documentación técnica y desenvolverme en comunicaciones profesionales habituales, y sigo mejorándolo.';
 if(/carnet|coche|vehiculo|desplaz/.test(q)) return 'Sí. Tengo carnet de conducir y vehículo propio, por lo que puedo desplazarme cuando el puesto lo requiera.';
 if(/universit|grado universit|ingenier|licenc/.test(q)) return 'No tengo grado universitario. Mi formación principal es un Grado Superior en Desarrollo de Aplicaciones Web y un Grado Medio en Sistemas Microinformáticos y Redes, además de formación adicional en ciberseguridad.';
 if(/disponibilidad|incorpor/.test(q)) return `Tengo disponibilidad para incorporarme según las necesidades de la empresa${role}.`;
 if(/base.? de datos|sql|database/.test(q)) return 'He trabajado en la gestión y mantenimiento de bases de datos y plataformas web, además de realizar copias de seguridad y resolver incidencias relacionadas con el entorno técnico.';
 if(/redes|network|router|switch|tcp|ip/.test(q)) return 'Tengo formación en Sistemas Microinformáticos y Redes y experiencia práctica en soporte de equipos, redes e infraestructuras, diagnóstico de incidencias y mantenimiento técnico.';
 if(/hardware|software|incidencia|help.?desk|service desk|soporte/.test(q)) return 'Tengo experiencia en soporte IT remoto a oficinas y tiendas, resolución de incidencias de hardware y software, mantenimiento de equipos, redes, copias de seguridad y apoyo técnico a usuarios.';
 if(/web|javascript|typescript|frontend|desarroll|program/.test(q)) return 'Tengo un Grado Superior en Desarrollo de Aplicaciones Web y experiencia creando y manteniendo páginas web corporativas, gestionando plataformas web y realizando tareas de SEO y mantenimiento.';
 if(/infraestruct|sistemas|servidor|data center|datacenter|cpd/.test(q)) return 'He trabajado como técnico de infraestructuras realizando instalación, mantenimiento y soporte de sistemas, equipos y redes. También tengo experiencia en soporte IT y diagnóstico de incidencias.';
 if(/ciber|seguridad/.test(q)) return 'Tengo formación específica en ciberseguridad y prevención y gestión de ciberataques, complementada con mi base técnica en sistemas, redes y soporte IT.';
 if(/experiencia/.test(q)) return `Mi experiencia encaja principalmente en soporte IT, infraestructuras, redes y desarrollo web. He resuelto incidencias técnicas, mantenido equipos y plataformas, trabajado con bases de datos y copias de seguridad y dado soporte remoto a usuarios${role}.`;
 if(/por que|por qué|motiv|interes|empresa/.test(q)) return `Me interesa${role} porque encaja con mi formación en DAW y SMR y con mi experiencia en soporte IT, infraestructuras y resolución de incidencias. Busco seguir creciendo técnicamente y aportar desde el primer día en tareas que ya conozco.`;
 return `Para responder con precisión a esa pregunta no quiero inventar experiencia que no tengo. Lo que sí puedo acreditar es: ${profile.slice(0,6).join(' ')}`;
}

export async function POST(req:Request){
 try{const {question,title}=await req.json();if(!question?.trim())return NextResponse.json({error:'Escribe una pregunta'},{status:400});return NextResponse.json({answer:grounded(question,title||'')});}
 catch{return NextResponse.json({error:'No pude preparar la respuesta'},{status:500});}
}
