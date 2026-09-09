# 016 — Profile Matching Engine

## Objetivo
AutoJobs no debe decidir el encaje por una palabra aislada. Debe comprobar si las funciones del puesto pueden justificarse por experiencia profesional real o por formación estudiada.

## Regla de evidencia
- **Experiencia**: puede justificar puestos equivalentes al trabajo realizado.
- **Estudios**: puede justificar puestos junior, trainee, N1/L1 o de entrada relacionados con materias cursadas.
- **Estudiado != experiencia profesional**. Nunca presentar una herramienta o disciplina del temario como experiencia laboral si no la hubo.
- Ante duda, se excluye la oferta antes que inventar encaje.

## Áreas objetivo
### Soporte IT — prioridad máxima
Base: SMR + experiencia de soporte. Helpdesk, CAU, Service Desk, microinformática, soporte de usuario, técnico informático y desktop support.

### Infraestructura / CPD — prioridad máxima
Base: SMR + experiencia en CPD/data center y monitorización. Técnico/operador de sistemas, CPD/data center y operaciones técnicas. No convertir menciones a “data center” en match si el puesto es vigilancia, servicios auxiliares u otro oficio.

### Desarrollo web — prioridad alta
Base: DAW + experiencia de desarrollo/mantenimiento web. Frontend, backend, full stack junior, desarrollo web, WordPress y programación compatible con formación/experiencia.

### Redes — prioridad alta
Base: SMR + formación/experiencia técnica relacionada. Técnico de redes y NOC de entrada. No Network Engineer senior/especialista por la mera presencia de Cisco.

### Ciberseguridad — prioridad de entrada
Base: formación específica aportada por el usuario, sin convertirla en experiencia profesional. El temario cubre, entre otras materias, ataques y credenciales, ingeniería social/malware, vulnerabilidades y riesgos, redes y sistemas, seguridad web, hacking ético, análisis forense digital, evidencias, logs, tráfico de red, IDS y respuesta/investigación de incidentes.

Puestos razonables: Analista SOC N1/L1/junior, técnico de ciberseguridad junior, operador SOC, analista de seguridad junior, trainee de vulnerabilidades, respuesta a incidentes o forense cuando la oferta sea explícitamente formativa/de entrada.

No asumir automáticamente: Security Engineer, DevSecOps, administrador SIEM, especialista cloud security, pentester experimentado, experto forense o puestos que exijan experiencia profesional no demostrada.

## Fuera del objetivo por defecto
Senior/lead/manager/arquitectura; SCADA/PLC/automatización industrial; Data Scientist/Data Engineer/ML/MLOps; AI Engineer/GenAI/LLM; RPA/BI/Power BI; DevOps/cloud especializado y puestos comerciales o no técnicos.

## Scoring orientativo
- 90–100: experiencia + estudios, encaje directo.
- 80–89: formación relevante y nivel junior/entrada, o experiencia parcialmente transferible.
- <70: no mostrar en feed principal.

El score nunca debe compensar un requisito excluyente de seniority o una disciplina fuera del perfil.

## Implementación
La lógica reutilizable vive en `lib/profile-matching.ts`. Backend y frontend deben converger en esta función para evitar reglas divergentes. El backend debe filtrar antes de enviar el feed y la UI debe mostrar el motivo del match cuando se disponga de datos suficientes.
