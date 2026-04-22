

## Próximos passos do CriativoOS

A integração HeyGen já está implementada (drawer, proxies, polling, badge no card). Antes de continuar adicionando coisas, preciso confirmar o que você quer priorizar.

### Opções

**A. Testar e polir o que já existe**
- Eu rodo o fluxo end-to-end (gerar scripts → abrir drawer → escolher avatar/voz → gerar vídeo → polling → download) e ajusto qualquer atrito visual ou bug que aparecer.
- Confirmo que a chave `HEYGEN_API_KEY` está respondendo (chamando `/api/public/heygen/avatars` e `/voices`).
- Sem novas features.

**B. Persistência dos vídeos gerados**
Hoje `generatedVideos` vive só em memória — se você der refresh, perde tudo.
- Salvar `{ scriptIndex → { videoId, videoUrl, generatedAt } }` em `localStorage` por sessão de briefing.
- Opcionalmente, listar todos os vídeos já gerados na etapa 4 (Guia de Produção) com player + download.

**C. Histórico completo de briefings**
- Salvar cada briefing+resultado em `localStorage` com nome (ex: "Curso de inglês — 22/04").
- Sidebar pra abrir briefings anteriores e continuar produzindo vídeos deles.
- Sem backend ainda — tudo local no browser.

**D. Melhorias no drawer HeyGen**
- Busca/filtro nos avatares (a lista do HeyGen é grande).
- Agrupar vozes por gênero (masculino/feminino).
- Mostrar contagem de caracteres do script (ex: `847 / 1500`) antes de gerar.
- Preview da dimensão escolhida (mock visual 9:16 vs 1:1 vs 16:9).

**E. Outra coisa** — me diz o que tá na sua cabeça.

### Minha recomendação

Começar por **A** (10 min, valida que tudo funciona de verdade), depois **B** (resolve a dor real de perder os vídeos no refresh). **C** e **D** ficam pra depois se você quiser.

Qual seguimos?

