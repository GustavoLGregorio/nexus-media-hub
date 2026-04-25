# TODO

## Geral

- [ ] Estruturar repositório para o GitHub de maneira limpa: criar `requirements.txt`/`package.json` separados para cada módulo.
- [ ] Criar um `.gitignore` complexo para blindar subida de `venvs` e modelos/pesos (GGUFs, safetensors, etc.), porém mantendo intacta a estrutura vital de sub-módulos como llama.cpp, acestep e ComfyUI.
- [ ] Criar um Arquivo de Configuração Global unificado para todo o MediaHub: extrair todas as flags, models selecionados, workflows de imagem e endpoints de API que estão *hardcoded* no Python, parametrizando-os nesse config.
- [ ] Adicionar mais metadados úteis (tempo total de geração, tanto no json de metadados quanto no log)
- [ ] Conectar o llama.cpp a plataforma para substituir a API do Gemini em fluxos que quebrariam o RLFHF (histórias dark, horror, roleplays adultos, etc). Necessário tornar opcional diretamente na plataforma
- [ ] Reestruturar a arquitetura para conter as pastas de geração como algo interno criado diretamente na plataforma, ou seja, "YouTube_Stories" seria apenas um "grupo" criado dentro da plataforma, que depois é gerado localmente com suas próprias pastas internas, gerações, prompts customizados, etc. De maneira que a plataforma se transforme em uma "fábrica de fábricas"
- [ ] Adicionar como um dos "templates" de geração de fábrica a criação de músicas, de maneira a criar um pseudo-suno local já focado em criar toda a música final (música, imagem, padrão de youtube music e spotify, legendas, etc)
- [ ] Adicionar integração direta com plataformas para criar já output esperado por elas (ex: youtube precisa de titulo, descrição, tags, vídeo, thumbnail, etc)

## OrchestratorEngine

- [ ] Migrar/Estruturar o núcleo do OrchestratorEngine para Bun (TypeScript). Retirar do Python o peso da orquestração I/O e focar na performance bruta assíncrona com WebSockets.

## Frontend

- [ ] Reestruturar completamente o frontend com identidade visual mais sólida (usar o MCP do Google Stitch)
- [ ] Adicionar visualização do vídeo de output diretamente na plataforma
- [ ] Corrigir bug de horários no tty serem os mesmos a cada novo texto

## StoryEngine

- [ ] Tornar o StoryEngine agnóstico à lógica de negócio/projetos fixos: ele deverá conter apenas "templates" base vazios aguardando orquestração.
- [ ] Implementar injeção dinâmica de projetos via Frontend: a criação de um projeto na UI gera uma pasta com configurações únicas (agents, aspect-ratios de vídeo/imagem, demografia/público, e qual pipeline será acionado - ex: pipeline enxuto de Música x pipeline complexo de YouTube).
- [ ] Corrigir estrutura gerada por arquivos de output (atualmente existem diretivas sendo retornadas, como descrição do narrador e algumas tags iniciais)

## VoiceEngine

- [ ] 

## VisualEngine

- [ ] Integrar futuramente os workflows em .json dentro da plataforma, fazendo parte de cada fábrica, para evitar que sejam necessários arquivos externos dentro do ComfyUI


### Brainstorm arquitetural

O OrchestratorEngine precisa ver os diferentes módulos (StoryEngine, VoiceEngine, VideoEngine, SoundEngine) e decidir qual deles precisa ser chamado, em que ordem e com quais parâmetros. Ele também precisa saber quais módulos já foram chamados e quais ainda precisam ser chamados. Ele precisa escutar os status code e os logs de cada módulo para decidir qual deles precisa ser chamado, em que ordem e com quais parâmetros.

Os módulos precisão ser cegos para o OrchestratorEngine. Ou seja, eles não precisam saber que existe um OrchestratorEngine. Eles só precisam fazer seu trabalho. A comunicação entre um módulo e outro deve ser feita apenas pelo OrchestratorEngine em auxilio dos arquivos gerados (metadados, instruções de passos, instruções do diretor, etc).

O StoryEngine precisa ser estruturado de maneira que o Director seja um ponto focal, pois ele fará a base da história criada, e os outros agentes (writer, critic, etc) serão apenas auxiliares para o Director. O Director será o responsável por decidir qual dos outros agentes precisa ser chamado, em que ordem e com quais parâmetros. Ele também criará o .json que será usado para saber qual tipo de voz/narrador será usado, qual estilo e entonação, qual trilha sonora, aspectos de estilo e tipo de output de imagens, vídeos, etc. Quanto a imagens e vídeos, o Arquivist será o responsável por criar os prompts e parâmetros necessários para que o VideoEngine gere as imagens e vídeos (já que ele é que possui noção de estado sob cada ato, como qual personagem deve aparecer na imagem, segurando qual item, vestindo qual roupa, em qual cenário, etc). Todas as essas informações relevantes devem ser guardadas no json que será repassado entre os agentes e módulos (e orquestrado pelo OrchestratorEngine).