# Multimarcas - Análise de Cross-Buyers

Aplicação web estática para análise de cross-buyers entre marcas, com suporte a planilha única de revendedores ativos.

## 📋 Descrição

Esta aplicação permite analisar revendedores que compram em múltiplas marcas (cross-buyers), cruzando dados de 5 planilhas de marcas com uma 6ª planilha única de revendedores ativos. Todo o processamento ocorre 100% no navegador - nenhum dado é enviado para servidores.

**Novidade:** A aplicação agora diferencia automaticamente entre **Venda Registrada** (captação/pedidos) e **Faturamento** (pedidos efetivamente emitidos), permitindo análise de gap entre métricas de captação e métricas oficiais.

## 🏗️ Arquitetura

### Tecnologias

- **Vite** - Build tool e dev server
- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **shadcn/ui** - Componentes UI
- **xlsx** - Parsing de planilhas Excel/CSV

### Estrutura de Arquivos

```
src/
├── components/          # Componentes React
│   ├── ui/             # Componentes UI base (shadcn)
│   ├── UploadSection.tsx
│   ├── ResultsDashboard.tsx
│   ├── AtivosNoCicloTab.tsx
│   └── RevendedoresAtivosTab.tsx
├── lib/                # Lógica de negócio
│   ├── parseFile.ts
│   ├── parseActiveRevendedoresFile.ts
│   ├── joinActiveRevendedores.ts
│   ├── aggregate.ts
│   ├── export.ts
│   ├── utils.ts
│   └── columnMapping.ts
├── types/              # Definições TypeScript
│   ├── index.ts
│   └── sectorActivity.ts
└── App.tsx             # Componente principal
```

## 📊 Fluxo de Uso

### 1. Upload das Planilhas de Marcas (5 planilhas)

A aplicação aceita upload de 5 planilhas de marcas, na ordem:

1. **oBoticário** (obrigatória) - Define a base de revendedores para análise
2. **Eudora**
3. **Au Amigos**
4. **O.U.I**
5. **QDB?**

#### Colunas Esperadas nas Planilhas de Marcas

- `Setor`
- `NomeRevendedora` / `Nome Revendedora` (obrigatória)
- `CodigoRevendedora` / `Codigo Revendedora` (opcional)
- `CicloCaptacao` / `Ciclo Captacao` / `Ciclo`
- `CodigoProduto` / `Codigo Produto`
- `NomeProduto` / `Nome Produto`
- `Tipo` (Venda, Brinde, Doação) (obrigatória)
- `QuantidadeItens` / `Quantidade Itens` (obrigatória)
- `ValorPraticado` / `Valor Praticado` (obrigatória)
- `MeioCaptacao` / `Meio Captacao`
- `TipoEntrega` / `Tipo Entrega`

**Colunas Opcionais de Faturamento:**
- `StatusFaturamento` / `Status Faturamento` / `Status Pedido` / `Faturado`
- `CicloFaturamento` / `Ciclo Faturamento`
- `DataFaturamento` / `Data Faturamento` / `Data NF`

**Importante:**
- Apenas itens com `Tipo="Venda"` são considerados nos cálculos
- `ValorPraticado` já é o total da linha (não multiplicar por `QuantidadeItens`)
- O `NomeRevendedora` é usado como chave principal para matching
- Revendedores que não existem no oBoticário não são incluídos nas análises

### 2. Upload da Planilha Única de Revendedores Ativos (6ª planilha)

A 6ª planilha contém **todos os revendedores ativos**, já associados aos seus respectivos setores.

#### Colunas Esperadas na Planilha de Ativos

**Obrigatórias:**
- `CodigoRevendedora` / `Codigo Revendedora`
- `NomeRevendedora` / `Nome Revendedora`
- `Setor`

**Opcional:**
- `CicloCaptacao` / `Ciclo Captacao` / `Ciclo`

**Importante:**
- Se a planilha não tiver coluna de ciclo, será exibido aviso: "Base de ativos sem ciclo — resultados podem incluir revendedores fora do período"
- O setor da planilha de ativos é considerado autoritativo (sobrescreve setor das compras)

### 3. Seleção de Ciclo

Após o upload da planilha de ativos (se houver), a aplicação detecta automaticamente os ciclos disponíveis a partir de:
- **Prioritário:** ciclos do oBoticário (planilha 1)
- **Secundário:** ciclos da planilha de ativos (se houver coluna de ciclo)

O usuário deve selecionar um ciclo para filtrar:
- Revendedores ativos (se a planilha de ativos tem ciclo)
- Compras das marcas (filtra por ciclo selecionado)

**Regras:**
- Se nenhum ciclo for selecionado: todos os ciclos são incluídos
- Se a planilha de ativos não tem ciclo: todos os ativos são incluídos, independente do ciclo selecionado (com aviso)

### 4. Processamento e Cruzamento

O processamento segue estas etapas:

1. **Processamento das Marcas:**
   - Extrai todos os itens de tipo "Venda"
   - Agrupa por revendedor (nome normalizado)
   - Cria estrutura de clientes com compras por marca
   - Identifica cross-buyers (2+ marcas)

2. **Join Ativos × Marcas:**
   - Para cada revendedor ativo na planilha de ativos:
     - Tenta match por `CodigoRevendedora` (normalizado como string)
     - **Fallback:** match por `NomeRevendedora` normalizado:
       - trim
       - collapse spaces
       - case-insensitive
       - remove acentos
     - Filtra compras pelo ciclo selecionado (se aplicável)
     - Associa ao setor da planilha de ativos (autoritativo)

3. **Validações e Inconsistências:**
   - Marca ativo que não existe no oBoticário
   - Marca revendedor ativo sem compras no ciclo selecionado
   - Detecta divergência entre setor da base ativa e setor das compras

### 5. Visualização dos Resultados

O dashboard possui 3 abas:

#### Aba 1: Crossbuyers
- Visão geral dos cross-buyers (mantém como estava)
- Filtros por marca, ciclo, setor, meio de captação, tipo de entrega
- Tabela com detalhes por revendedor

#### Aba 2: Venda Registrada (por Setor)
- Tabela por SETOR mostrando:
  - **Registrados** - Total de revendedores com venda registrada (captação)
  - **Faturados** - Total de revendedores com venda faturada (quando disponível)
  - **Gap** - Diferença entre Registrados e Faturados (quando disponível)
  - Base oBoticário
  - Crossbuyers
  - % crossbuyer
  - Valor / Itens por marca
- **Tooltip explicativo:** Diferença entre Venda Registrada e Faturamento
- **Ações:**
  - Clique no setor → abre drawer com lista de revendedores
  - Clique no revendedor → abre detalhe por marca (já existente)

#### Aba 3: Revendedores Ativos (NOVA)
- Lista completa dos ativos no ciclo
- Badges indicando:
  - Base oBoticário (sim/não)
  - É crossbuyer (com quantidade de marcas)
  - Inconsistências encontradas
- **Busca e Filtros:**
  - Busca por nome/código
  - Busca por setor
  - Filtro por marca
  - Apenas crossbuyers
  - Apenas base oBoticário
  - Com inconsistências

## 📤 Exportações

A aplicação permite exportar dados em CSV:

1. **Resumo (CSV)** - Crossbuyers resumido
2. **Detalhado (CSV)** - Todos os itens dos crossbuyers
3. **Relatório Completo (XLSX)** - Workbook com múltiplas abas
4. **Revendedores Ativos (CSV)** - Todos os revendedores ativos
5. **Ativos por Setor (CSV)** - Agregação por setor
6. **Crossbuyers Ativos (CSV)** - Apenas crossbuyers da base de ativos

### Colunas Mínimas nas Exportações

- Setor
- CodigoRevendedora
- NomeRevendedora
- Ciclo
- Marca(s)
- ItensVenda
- ValorVenda
- éCrossbuyer
- Inconsistências

## 🚀 Como Usar

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

### Build para Produção

```bash
npm run build
```

Os arquivos estáticos serão gerados em `dist/`, prontos para deploy em qualquer serviço de hosting estático (Render Static Site, Vercel, Netlify, etc.).

### Preview da Build

```bash
npm run preview
```

## 🔒 Privacidade e Segurança

- **100% estático** - Não há backend, API routes ou banco de dados
- **Processamento local** - Todos os dados são processados no navegador
- **Sem envio de dados** - Nenhuma informação é enviada para servidores externos
- **Compatível com offline** - Após carregar a página, funciona offline

## 🎯 Regras de Negócio

### Universo Base
- Apenas revendedores que existem no **oBoticário** entram nas análises
- Revendedores do oBoticário devem ter pelo menos uma compra do tipo "Venda"

### Crossbuyer
- Revendedor que aparece em **2 ou mais marcas**
- Deve existir no oBoticário (regra base)
- Apenas compras do tipo "Venda" são consideradas

### Revendedor Ativo (Venda Registrada)
- Revendedor presente na **planilha única de ativos** E que teve pelo menos 1 **venda registrada** (Tipo=Venda) no ciclo selecionado em qualquer marca
- **Não é necessário** estar no oBoticário para ser considerado "ativo" - basta ter venda em qualquer marca
- O requisito de oBoticário só se aplica para identificação de **Crossbuyer**

### Venda Registrada vs Faturamento

A aplicação distingue automaticamente entre duas métricas:

1. **Venda Registrada (Captação):**
   - Pedidos registrados no sistema (independente de entrega/faturamento)
   - Detectada pelo campo `Tipo="Venda"` nas planilhas
   - Métricas: `totalRegistrados`, `crossbuyersRegistrados`

2. **Faturamento (quando disponível):**
   - Pedidos efetivamente faturados/emitidos
   - Detectada automaticamente por colunas como `StatusFaturamento`, `Faturado`, etc.
   - Valores reconhecidos como faturado: "faturado", "aprovado", "concluído", "emitido", "sim", "ok"
   - Métricas: `totalFaturados`, `crossbuyersFaturados`

3. **Gap Analysis:**
   - Diferença entre Registrados e Faturados por setor
   - Ajuda a identificar setores com alto índice de pedidos não convertidos

**Por que pode haver divergência com o painel oficial?**
- O painel oficial pode usar métricas de **faturamento** (pedidos realmente entregues)
- Esta aplicação mostra **vendas registradas** (captação) como métrica principal
- Quando colunas de faturamento estão disponíveis, ambas métricas são exibidas

### Join Ativos × Marcas
Ordem de matching (estrita):

1. **CodigoRevendedora** (normalizado como string)
   - Se match encontrado, usa este
   
2. **Fallback: NomeRevendedora normalizado**
   - trim
   - collapse spaces (múltiplos espaços → 1 espaço)
   - case-insensitive
   - remove acentos
   
3. **Conflitos:**
   - Mesmo nome com códigos diferentes → marca como inconsistência
   - Não quebra o fluxo

### Setor
- Setor da **planilha de ativos é autoritativo**
- Se divergir do setor das compras, marca como inconsistência
- Mas usa o setor da planilha de ativos para agrupamento

## 🐛 Validações e Avisos

A aplicação identifica e avisa sobre:

- ✅ Ativo não existe no oBoticário
- ✅ Revendedor ativo não tem compras no ciclo selecionado
- ✅ Divergência entre setor da base ativa e setor da compra
- ✅ Códigos duplicados na planilha de ativos
- ✅ Nomes duplicados com códigos diferentes

Inconsistências são exibidas:
- Na lista de revendedores ativos (badges vermelhas)
- Na aba de detalhes por setor
- Nas exportações CSV (coluna "Inconsistências")

## 📝 Formato das Planilhas

### Formatos Suportados
- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)
- `.csv` (valores separados por vírgula)

### Mapeamento de Colunas
A aplicação usa mapeamento inteligente de colunas:
- Tenta match exato primeiro
- Depois match parcial (contém)
- Por fim match fuzzy (similaridade ≥ 80%)

Isso permite trabalhar com planilhas que tenham nomes de colunas ligeiramente diferentes.

## 🔧 Configuração e Customização

### Marcas
As marcas são definidas em `src/types/index.ts`:

```typescript
export const BRANDS: Record<BrandId, Brand> = {
  boticario: { id: 'boticario', name: 'O Boticário', ... },
  eudora: { id: 'eudora', name: 'Eudora', ... },
  // ...
};
```

### Cores das Marcas
As cores são definidas em `tailwind.config.js` e podem ser customizadas.

## 🐞 Troubleshooting

### Planilha não carrega
- Verifique se o arquivo está em formato suportado (.xlsx, .xls, .csv)
- Verifique se as colunas obrigatórias estão presentes
- Veja o console do navegador para erros detalhados

### Revendedores não aparecem
- Verifique se existem no oBoticário (planilha 1)
- Verifique se têm compras do tipo "Venda"
- Verifique se o nome está normalizado corretamente

### Join não funciona
- Verifique se o nome na planilha de ativos corresponde ao nome nas planilhas de marcas
- Códigos devem ser normalizados como string
- Nomes são comparados após normalização (trim, lowercase, sem acentos)

### Performance lenta
- Para planilhas muito grandes (>50k linhas), pode haver lentidão
- Considere filtrar os dados antes do upload
- Use um navegador moderno (Chrome, Firefox, Edge)

## 📄 Licença

Este projeto é privado e proprietário.

## 👥 Suporte

Para dúvidas ou problemas, consulte a documentação acima ou entre em contato com a equipe de desenvolvimento.

---

**Versão:** 2.1.0
**Última atualização:** Janeiro 2026
**Arquitetura:** 100% estática - Compatível com Render Static Site

**Changelog 2.1.0:**
- Adicionado suporte a métricas de Faturamento (quando colunas disponíveis)
- Renomeado "Ativos no Ciclo" para "Venda Registrada" com tooltip explicativo
- Gap Analysis entre Registrados e Faturados por setor
- Exportações atualizadas com novos campos de billing
