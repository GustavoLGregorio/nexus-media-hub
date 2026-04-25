# TikTok TrueCrime Pipeline

**Foco:** Público Internacional (Geralmente GenZ até Millennials), Consumo Cereal.
**Tema:** Bizarrices reais, Casos True Crime brutais e inexplicáveis, Mistérios do Cártel/Guerras, EFEITO CHOQUE.

## Visão Detalhada do Projeto
O TikTok retém o público através da estimulação neurológica agressiva em segundos minúsculos. Ao contrário do YouTube, o roteiro precisa agarrar nos 3 primeiros segundos. É a era do "Brainrot" com substância, gerando curiosidade maníaca pelo final do clipe de 60 segundos.

## Componentes Mecânicos
1. **Scraping Subreddits News:** Motores autônomos que mineram `/r/TrueCrime`, `/r/MorbidReality` para encontrar os eventos que alcançaram viralidade global no mesmo dia ou são históricos.
2. **Validador Sem Sentimentos (Gemini API):** Lê o "gore/conteúdo chocante" da reportagem crua para validar se a história passará no controle do TikTok enquanto se mascara atrás de "Notícia Histórica/Curiosidade". Se for muito fraco, joga fora. Se for muito pesado, ordena suavização semântica.
3. **Escritor do Gancho (Hook Writer):** Transmuta o texto cru num formato Brainrot focado ("You won't believe what they found..." / "Here is the darkest secret of...").
4. **Scrap_Assets:** Em vez de Imagens de IA (que podem parecer falsas pra True Crime), priorizará o scraping as imagens da matéria real. O TTS (`en-US-ChristopherNeural` ou `en-US-AndrewNeural`) narrará com energia e suspense sobre um fundo sonoro opressor.
5. **Autocensura e Subtitle-Syncing:** A cereja do bolo. Legendas rápidas geradas pelo Whisper ou TTS integradas diretamente no frame, pulando palavras engatilhadas de ban (Ex: mUrd3red ao invés de murdered).

---
*Gerenciado inteiramente pela Nexus GUI Web App.*
