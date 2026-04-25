# YouTube Stories Pipeline

**Foco:** Público de YT Brasileiro (Geralmente mais maduro)
**Tema:** Moralidade, Carma, "Luz no fim do Túnel", Redenção e Humildade.

## Visão Detalhada do Projeto
Diferente da urgência maníaca exigida pelo TikTok, vídeos do YouTube prosperam em arcos de longo prazo. O foco deste pipeline é a **Escrita Emocional** somada a imagens evocativas e locução lenta e agradável (Voice-over PT-BR via Edge-TTS).

## Componentes Mecânicos (MVP Atual)
1. **Idea Generator (Agente Gemini):** Seleciona um arquétipo moral (ex: Rico cai na pobreza e é salvo por funcionário humilde) e um contexto ("Brasil dos anos 2000" ou "Era contemporânea").
2. **Escritor sem Fingerprint:** Elabora o Roteiro injetando dialeto humano/br e removendo termos clássicos de IA ("Nessa jornada", "Como uma sinfonia", "Com os olhos brilhando").
3. **Conversor de Áudio (Edge-TTS):** Foca em voz masculina/feminina forte gerando `pt-BR-AntonioNeural` ou `pt-BR-FranciscaNeural`.
4. **Cinematografia (Futuro via ComfyUI):** Um agente criará prompts baseados na história para disparar workflows de Image-To-Video e Ken Burns effects.

---
*Gerenciado inteiramente pela Nexus GUI Web App.*
