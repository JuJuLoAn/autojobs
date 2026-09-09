export type ProfileMatch = {
  eligible: boolean;
  score: number;
  area: 'Soporte IT'|'Desarrollo Web'|'Infraestructura / Sistemas'|'Redes'|'Ciberseguridad'|'Fuera de perfil';
  basis: 'experiencia'|'estudios'|'experiencia+estudios'|'ninguno';
  reasons: string[];
};

const norm=(s:string)=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// Perfil derivado del CV y de los módulos de ciberseguridad aportados por el usuario.
// Regla: experiencia real puede justificar puestos equivalentes; formación permite ampliar
// a puestos junior/de entrada sin convertir materias estudiadas en experiencia profesional.
const HARD_REJECT=/\b(?:senior|sr\.?|lead|manager|director|head|architect|arquitecto|responsable|jefe|coordinador|pmo|principal|especialista)\b|analista\s+programador|scada|\bplc\b|automatizacion industrial|labview|data scientist|data engineer|machine learning|mlops|ai engineer|ia engineer|genai|\bllm\b|\brpa\b|business intelligence|power bi|devops|devsecops|databricks|\bspark\b|\bscala\b|salesforce|sap abap|\bappian\b|\bcamunda\b|\bbpm\b|\bcmdb\b/i;
const JUNIOR=/\b(?:junior|jr\.?|trainee|beca|practicas|primer empleo|n1|nivel 1|l1)\b/i;
// Tecnologías/plataformas de desarrollo muy específicas que no constan en el CV ni en DAW.
// No se descartan si la propia vacante declara nivel junior/entrada, donde sí puede ser razonable aprenderlas.
const SPECIALIZED_DEV=/\bcells\b|sencha(?:\s+ext\s*js)?|oracle\s+pl\/sql/i;
// El CV acredita español nativo e inglés intermedio. Si el propio título exige otro idioma
// o inglés alto/avanzado, la candidatura no debe aparecer como recomendada.
const LANGUAGE_REJECT=/\b(?:aleman|german|frances|french|italiano|italian|portugues|portuguese)\b|ingles\s+(?:alto|avanzado|fluido|c1|c2)|english\s+(?:advanced|fluent|c1|c2)/i;
// No recomendar vacantes cuyo propio título exige una condición/certificación personal
// que no consta en el perfil. Esto evita falsos positivos aunque el puesto técnico encaje.
const ELIGIBILITY_REJECT=/certificado(?:\s+de)?\s+discapacidad|discapacidad\s+(?:igual|superior|>=?|mayor)\s*(?:al)?\s*33\s*%|diversidad funcional/i;

export function matchProfessionalProfile(title:string, description=''):ProfileMatch {
  const titleText=norm(title);
  const t=norm(`${title} ${description}`);
  const reasons:string[]=[];
  if(!t || HARD_REJECT.test(t)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['Fuera del nivel o ámbito profesional objetivo']};
  if(LANGUAGE_REJECT.test(titleText)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['El título exige un idioma o nivel lingüístico no acreditado en el CV']};
  if(ELIGIBILITY_REJECT.test(titleText)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['La vacante exige una condición o acreditación personal que no consta en el perfil']};
  if(/\b(?:ingeniero|engineer)\b/.test(t) && !JUNIOR.test(t)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['Rol de ingeniería no junior fuera del nivel objetivo']};
  if(/administrador(?:\/a)?\b/.test(t) && !JUNIOR.test(t)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['Administración especializada sin nivel junior explícito']};
  // Kafka es una especialización de backend/distribuidos que no consta en el CV. Se permite
  // únicamente si la propia oferta declara nivel junior/entrada, donde puede ser aprendizaje.
  if(/\bkafka\b/.test(t) && !JUNIOR.test(t)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['Especialización Kafka sin nivel junior explícito ni experiencia acreditada']};
  if(SPECIALIZED_DEV.test(t) && !JUNIOR.test(t)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['Stack de desarrollo especializado no acreditado y sin nivel junior explícito']};

  const support=/soporte (?:it|ti|tecnico|informatico)|tecnico(?:\/a)? (?:de )?soporte|help.?desk|service desk|\bcau\b|microinformat|tecnico(?:\/a)? informatico|it support|desktop support|puesto de usuario/.test(t);
  if(support){reasons.push('Experiencia profesional y SMR en soporte IT/microinformática');return {eligible:true,score:JUNIOR.test(t)?98:94,area:'Soporte IT',basis:'experiencia+estudios',reasons};}

  const dev=/desarrollador(?:\/a)? web|programador(?:\/a)? web|frontend|front end|backend|back end|full.?stack|web developer|wordpress|javascript|typescript|react|php|node(?:\.js)?|java developer|python developer|\.net developer|programador(?:\/a)? (?:java|php|javascript|typescript|react|angular|\.net|python|full.?stack)/.test(t);
  if(dev){reasons.push('DAW y experiencia real en desarrollo y mantenimiento web');return {eligible:true,score:JUNIOR.test(t)?94:88,area:'Desarrollo Web',basis:'experiencia+estudios',reasons};}

  const systems=/tecnico(?:\/a)? (?:de )?sistemas|operador(?:\/a)? (?:de )?sistemas|operador(?:\/a)? (?:de )?(?:cpd|data center|datacenter)|tecnico(?:\/a)? (?:de )?(?:cpd|data center|datacenter)|data center technician|monitorizacion/.test(t);
  if(systems){reasons.push('SMR y experiencia en infraestructuras, equipos, redes y operación/monitorización técnica');return {eligible:true,score:JUNIOR.test(t)?96:92,area:'Infraestructura / Sistemas',basis:'experiencia+estudios',reasons};}

  const networks=/tecnico(?:\/a)? (?:de )?redes|network technician|operador(?:\/a)? noc|tecnico(?:\/a)? noc|redes informaticas/.test(t);
  if(networks){reasons.push('SMR, redes y experiencia técnica en infraestructuras');return {eligible:true,score:JUNIOR.test(t)?91:84,area:'Redes',basis:'experiencia+estudios',reasons};}

  // Formación cursada: prevención/detección/respuesta, ataques y malware, criptografía,
  // vulnerabilidades y CVSS, gestión de riesgos, hacking ético, seguridad web/sistemas/redes,
  // IoT, análisis forense, evidencias, logs, tráfico, IDS, Wireshark/tcpdump/Snort y respuesta a incidentes.
  // Como no hay experiencia profesional específica demostrada en ciberseguridad, el feed
  // exige una señal explícita de nivel de entrada (junior/N1/L1/trainee/prácticas) o un rol SOC operativo.
  const cyberDomain=/ciberseguridad|cybersecurity|\bsoc\b|security analyst|analista de seguridad|seguridad informatica|siem|respuesta a incidentes|incident response|vulnerabil|pentest|hacking etico|forense digital|digital forensics|analisis forense|threat analyst|blue team/.test(t);
  const cyberRole=/analista|tecnico|operador|trainee|beca|practicas/.test(t);
  const advancedCyber=/cloud security engineer|security engineer|ingeniero(?:\/a)? de seguridad|administrador(?:\/a)? (?:de )?siem|pentester(?!.*(?:junior|jr|trainee))|forensic expert|experto forense|consultor(?:\/a)?/.test(t);
  const explicitCyberEntry=JUNIOR.test(t)||/operador(?:\/a)? (?:de )?(?:seguridad.*)?soc\b|analista soc\b/.test(t);
  if(cyberDomain && cyberRole && !advancedCyber && explicitCyberEntry){
    reasons.push('Formación específica en ciberseguridad y nivel de entrada explícito; encaje por estudios, no por experiencia profesional');
    return {eligible:true,score:88,area:'Ciberseguridad',basis:'estudios',reasons};
  }

  return {eligible:false,score:35,area:'Fuera de perfil',basis:'ninguno',reasons:['No hay evidencia suficiente de encaje con experiencia o estudios']};
}
