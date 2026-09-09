export type ProfileMatch = {
  eligible: boolean;
  score: number;
  area: 'Soporte IT'|'Desarrollo Web'|'Infraestructura / Sistemas'|'Redes'|'Ciberseguridad'|'Fuera de perfil';
  basis: 'experiencia'|'estudios'|'experiencia+estudios'|'ninguno';
  reasons: string[];
};

const norm=(s:string)=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// Perfil objetivo derivado del CV y de la formación aportada por el usuario.
// Regla clave: estudiar una materia permite optar a puestos junior/trainee; no se convierte en experiencia profesional.
const HARD_REJECT=/\b(?:senior|sr\.?|lead|manager|director|head|architect|arquitecto|responsable|jefe|coordinador|pmo)\b|scada|\bplc\b|automatizacion industrial|labview|data scientist|data engineer|machine learning|mlops|ai engineer|ia engineer|genai|\bllm\b|\brpa\b|business intelligence|power bi/i;
const JUNIOR=/\b(?:junior|jr\.?|trainee|beca|practicas|primer empleo|n1|nivel 1|l1)\b/i;

export function matchProfessionalProfile(title:string, description=''):ProfileMatch {
  const t=norm(`${title} ${description}`);
  const reasons:string[]=[];
  if(!t || HARD_REJECT.test(t)) return {eligible:false,score:0,area:'Fuera de perfil',basis:'ninguno',reasons:['Fuera del nivel o ámbito profesional objetivo']};

  const support=/soporte (?:it|ti|tecnico|informatico)|tecnico(?:\/a)? (?:de )?soporte|help.?desk|service desk|\bcau\b|microinformat|tecnico(?:\/a)? informatico|it support|desktop support|puesto de usuario/.test(t);
  if(support){reasons.push('Experiencia y formación en soporte IT/microinformática');return {eligible:true,score:JUNIOR.test(t)?98:94,area:'Soporte IT',basis:'experiencia+estudios',reasons};}

  const dev=/desarrollador(?:\/a)? web|programador(?:\/a)? web|frontend|front end|backend|back end|full.?stack|web developer|wordpress|javascript|typescript|react|php|node(?:\.js)?|java developer|python developer|\.net developer/.test(t);
  if(dev){reasons.push('DAW y experiencia real en desarrollo/mantenimiento web');return {eligible:true,score:JUNIOR.test(t)?94:88,area:'Desarrollo Web',basis:'experiencia+estudios',reasons};}

  const systems=/tecnico(?:\/a)? (?:de )?sistemas|operador(?:\/a)? (?:de )?sistemas|operador(?:\/a)? (?:de )?(?:cpd|data center)|tecnico(?:\/a)? (?:de )?(?:cpd|data center)|data center technician|monitorizacion/.test(t);
  if(systems){reasons.push('SMR y experiencia de operación/monitorización de infraestructura y CPD');return {eligible:true,score:JUNIOR.test(t)?96:92,area:'Infraestructura / Sistemas',basis:'experiencia+estudios',reasons};}

  const networks=/tecnico(?:\/a)? (?:de )?redes|network technician|operador(?:\/a)? noc|tecnico(?:\/a)? noc|redes informaticas/.test(t);
  if(networks){reasons.push('SMR, redes y experiencia técnica relacionada');return {eligible:true,score:JUNIOR.test(t)?91:84,area:'Redes',basis:'experiencia+estudios',reasons};}

  // Formación de ciberseguridad aportada: ataques/contraseñas, ingeniería social y malware,
  // vulnerabilidades/riesgos, seguridad de redes/web/sistemas, hacking ético, análisis forense,
  // evidencias/logs/tráfico, IDS, respuesta a incidentes y materias relacionadas.
  // Sin experiencia profesional específica demostrada: se exige forma de puesto de entrada.
  const cyberDomain=/ciberseguridad|cybersecurity|\bsoc\b|security analyst|analista de seguridad|seguridad informatica|siem|respuesta a incidentes|incident response|vulnerabil|pentest|hacking etico|forense digital|digital forensics|analisis forense/.test(t);
  const cyberRole=/analista|tecnico|operador|trainee|beca|practicas/.test(t);
  const advancedCyber=/devsecops|cloud security engineer|security engineer|ingeniero(?:\/a)? de seguridad|administrador(?:\/a)? (?:de )?siem|pentester(?!.*junior)|forensic expert|experto forense/.test(t);
  if(cyberDomain && cyberRole && !advancedCyber && (JUNIOR.test(t)||/operador(?:\/a)? soc|analista soc/.test(t))){
    reasons.push('Formación específica en ciberseguridad; candidatura adecuada solo a nivel junior/entrada');
    return {eligible:true,score:86,area:'Ciberseguridad',basis:'estudios',reasons};
  }

  return {eligible:false,score:35,area:'Fuera de perfil',basis:'ninguno',reasons:['No hay evidencia suficiente de encaje con experiencia o estudios']};
}
