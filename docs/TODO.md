# TODO

## Geral

- [x] Estruturar repositório para o GitHub de maneira limpa: criar `requirements.txt`/`package.json` separados para cada módulo.
- [x] Criar um `.gitignore` complexo para blindar subida de `venvs` e modelos/pesos (GGUFs, safetensors, etc.), porém mantendo intacta a estrutura vital de sub-módulos como llama.cpp, acestep e ComfyUI.
- [ ] Criar um Arquivo de Configuração Global unificado para todo o MediaHub (ou no escopo do ProjectVault): expor configurações de quais modelos usar (Gemini API vs llama.cpp local), quais workflows de ComfyUI acionar e quais engines priorizar. O objetivo é permitir ao frontend fazer "reruns" de partes específicas do projeto trocando os modelos sem gerar tudo do zero.
- [ ] Adicionar mais metadados úteis (tempo total de geração, tanto no json de metadados quanto no log)
- [ ] Conectar o llama.cpp a plataforma para substituir a API do Gemini em fluxos que quebrariam o RLFHF (histórias dark, horror, roleplays adultos, etc). Necessário tornar opcional diretamente na plataforma
- [ ] Reestruturar a arquitetura para conter as pastas de geração como algo interno criado diretamente na plataforma, dentro da estrutura `ProjectVault`. De maneira que a plataforma se transforme em uma "fábrica de fábricas".
- [ ] Adicionar como um dos "templates" de geração de fábrica a criação de músicas, de maneira a criar um pseudo-suno local já focado em criar toda a música final (música, imagem, padrão de youtube music e spotify, legendas, etc)
- [ ] Adicionar integração direta com plataformas para criar já output esperado por elas (ex: youtube precisa de titulo, descrição, tags, vídeo, thumbnail, etc)

## OrchestratorEngine

- [ ] Migrar/Estruturar o núcleo do OrchestratorEngine para Bun (TypeScript). Retirar do Python o peso da orquestração I/O e focar na performance bruta assíncrona com WebSockets.
- [ ] Implementar a "Pipeline Sequencial Estrita": Devido à limitação de 12GB de VRAM, o Orchestrator DEVE encadear chamadas síncronas (Texto -> Voz -> Legendas -> Trilha -> Visual -> Compositor) limpando a VRAM a cada etapa, enviando status via WebSocket para o UI.

## Frontend

- [ ] Reestruturar completamente o frontend com identidade visual mais sólida (usar o MCP do Google Stitch)
- [ ] Implementar a Geração Dinâmica de Agentes: Interface para o usuário definir a "alma" criativa dos agentes (ex: tom focado em retenção tiktok vs documentário hiper-realista).
- [ ] Adicionar visualização do vídeo de output diretamente na plataforma
- [ ] Corrigir bug de horários no tty serem os mesmos a cada novo texto

## StoryEngine

- [ ] Tornar o StoryEngine agnóstico à lógica de negócio: destruir a pasta `YouTube_Stories` e mover os agentes para um `core` genérico. 
- [ ] Implementar Injeção de Diretivas: O motor em Python deve receber o prompt criativo do frontend e sempre concatenar a obrigatoriedade estrita de resposta JSON, garantindo que a alma criativa flua sem quebrar o contrato do `director_blueprint.json`.
- [ ] Corrigir estrutura gerada por arquivos de output (garantir que o JSON final de blueprint contenha as áreas de voz, imagem e trilha sonora limpas).

## VoiceEngine

- [ ] (A definir)

## VisualEngine

- [ ] Integrar futuramente os workflows em .json dentro da plataforma, fazendo parte de cada fábrica, para evitar que sejam necessários arquivos externos dentro do ComfyUI

### Brainstorm arquitetural

O OrchestratorEngine precisa ver os diferentes módulos (StoryEngine, VoiceEngine, VideoEngine, SoundEngine) e decidir qual deles precisa ser chamado, em que ordem e com quais parâmetros. Devido às restrições de VRAM, essa chamada deve ser obrigatoriamente sequencial, ativando e desativando as Engines pontualmente.

Os módulos precisam ser cegos para o OrchestratorEngine. A comunicação entre um módulo e outro deve ser feita apenas pelo OrchestratorEngine em auxilio dos arquivos gerados (`director_blueprint.json` e arquivos finais da pasta do projeto).

O StoryEngine precisa ser estruturado de maneira que o Director seja um ponto focal agnóstico. A criatividade de cada agente virá injetada do Frontend via Project Config, garantindo que o tom seja fiel à fábrica (ex: Slop vs Factual). O Archivist será o responsável por criar os prompts visuais (hiper-realistas ou cartoon) e o SoundDesigner os prompts de áudio. Todas essas informações serão guardadas no `director_blueprint.json` gerado na pasta do respectivo projeto no `ProjectVault`, servindo como mapa para as próximas fases da pipeline do Orchestrator.