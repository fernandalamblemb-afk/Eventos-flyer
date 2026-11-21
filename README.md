# Studio Design AI

Aplicativo web de design gráfico para flyers de eventos: gera 3 propostas de layout a partir de um briefing e abre cada uma em um editor visual completo, com versões **Feed (1080×1350)** e **Story (1080×1920)** recompostas e editáveis de forma independente.

**Stack:** React 18 · TypeScript · Tailwind CSS · Konva / react-konva · Zustand · Vite.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ (site estático, pode ser hospedado em qualquer CDN)
```

## O que está implementado (v0.1)

| Tela | Status | Detalhes |
|---|---|---|
| 1 · Criar design | ✅ | Todos os campos do briefing, upload de fotos/logos/referência, 6 estilos, 9 paletas + paleta extraída da referência ou da foto + paleta da marca. |
| 2 · Geração automática | ✅ | Motor de composição vetorial local (`src/engine/compose.ts`) com 6 conceitos de grade/hierarquia próprios: Editorial, Cinematográfico, Suíço minimalista, Arco clássico, Contemporâneo, Institucional. Cada estilo escolhe 3 conceitos diferentes. Ajuste automático de corpo tipográfico, laço de compressão para evitar sobreposição, contraste garantido. Não inventa informações: campos vazios não aparecem. |
| 3 · Editor visual | ✅ | Canvas central, barra de ferramentas lateral, painel de propriedades, painel de camadas, zoom (botões, Ctrl+roda, ajustar à tela), desfazer/refazer (80 passos). Selecionar, arrastar, redimensionar, girar (com snap de 45°), duplicar, excluir, opacidade, cores, edição de texto direto no canvas (duplo clique), fontes, peso, itálico, caixa-alta, tamanho, espaçamento entre letras, entrelinha, alinhamento, reordenar camadas (botões e arrastar), bloquear, ocultar, substituir fotografia, recorte (zoom + ponto focal), máscaras (cantos arredondados, círculo, arco), sombras, fundo sólido/gradiente, formas (retângulo, elipse, triângulo, linha, arco). Guias de alinhamento magnéticas (bordas/centros da prancheta e de outros elementos). |
| 4 · Formatos | ✅ | Cada conceito tem lógica própria para Feed e Story (áreas seguras do Instagram respeitadas no Story). Edição independente; modo "Ambos" mostra as duas pranchetas lado a lado. |
| 5 · Identidade visual | ✅ | Biblioteca de marcas (nome, logo, paleta de 6 papéis, fontes de título/texto, estilo, elementos gráficos recorrentes). Selecionável no briefing: aplica fontes, paleta, estilo, logo e motivos. |
| 6 · Exportação | ✅ | PNG em resolução real (1× = 1080 px, 2× = 2160 px) renderizado fora da tela com o mesmo motor do editor; "Baixar ambos"; SVG vetorial (texto como texto); salvar projeto (IndexedDB); abrir projeto; exportar/importar `.json`. |
| Integração IA de imagens | ⚠️ Preparada | Diálogo "Fundo com IA" (ícone ✦ na barra lateral). Suporta OpenAI Images (`gpt-image-1`) ou endpoint próprio (`POST {prompt,width,height}` → `{image}`). Gera apenas o fundo, inserido como camada inferior; textos e logos continuam vetoriais e editáveis. **Não foi testado com chave real.** |

### Atalhos

`Ctrl+Z` desfazer · `Ctrl+Shift+Z`/`Ctrl+Y` refazer · `Ctrl+D` duplicar · `Delete` excluir · setas movem (Shift = 10 px) · `Enter` edita texto · `Esc` desmarca · `Ctrl+S` salvar.

## Limitações conhecidas / o que exige aplicação hospedada

- **Chave de API de imagens no navegador:** funciona para testes, mas expõe a chave a quem usar o navegador. Em produção, crie um endpoint no servidor (contrato acima) e use o modo "Endpoint próprio".
- **Fontes:** carregadas do Google Fonts. Offline, o app cai para fontes do sistema. No SVG exportado, as fontes são referenciadas via `@import` (precisa de internet ao abrir); para impressão, use PNG 2×.
- **Persistência:** IndexedDB do navegador (por dispositivo). Sincronização entre dispositivos/equipes exige backend.
- **Seleção múltipla, agrupamento e guias durante redimensionamento** ainda não implementados (guias funcionam ao arrastar).
- **Edição sincronizada Feed↔Story** não existe por decisão de projeto: as versões são independentes.
- O motor de composição é determinístico (regras de direção de arte), não um modelo de IA; a "IA" generativa fica restrita a fundos opcionais.

## Estrutura

```
src/
  types.ts                 modelo de dados (Project, Artboard, elementos, Brand…)
  store.ts                 estado global + histórico de desfazer/refazer
  engine/
    compose.ts             motor de composição (6 conceitos × feed/story)
    factory.ts             criação de elementos
    text.ts                medição/quebra de linhas/ajuste de corpo
    palettes.ts            paletas, contraste, extração de cores
    fonts.ts               catálogo e carregamento de fontes
  components/
    ArtboardRenderer.tsx   renderizador único modelo → Konva (editor, miniaturas, exportação)
    editor/                canvas, propriedades, camadas, ferramentas, exportação, IA
  lib/                     exportação PNG/SVG/JSON, IndexedDB, arquivos, IA de imagens
  screens/                 Criar, Propostas, Editor, Marcas, Projetos
```
