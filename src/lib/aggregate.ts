import {
  Item,
  Customer,
  BrandId,
  ProcessingResult,
  BRAND_ORDER,
  DeliveryType,
} from '@/types';
import {
  GeralTransactionRow,
  deriveAtivosFromTransactions,
  RevendedorAtivo,
} from './parseGeralFile';

/**
 * Process items from all brands and generate cross-buyer analysis
 *
 * REGRA:
 * 1. Ativos = revendedores da planilha Geral com Tipo=Venda e CicloFaturamento=ciclo (deduplica por código)
 * 2. Multimarcas = ativos que aparecem em 2+ planilhas de marca no mesmo ciclo
 * 3. Planilhas de marca NÃO criam ativos, apenas enriquecem
 */
export function processAllBrands(
  brandItems: Map<BrandId, Item[]>,
  geralTransactions?: GeralTransactionRow[],
  selectedCiclo?: string | null
): ProcessingResult {
  const result: ProcessingResult = {
    success: false,
    customers: [],
    crossBuyers: [],
    stats: {
      totalBaseCustomers: 0,
      crossBuyerCount: 0,
      brandDistribution: { 2: 0, 3: 0, 4: 0, 5: 0 },
      brandOverlap: {
        boticario: 0,
        eudora: 0,
        auamigos: 0,
        oui: 0,
        qdb: 0,
      },
      topOverlapBrand: null,
      setorDistribution: {},
    },
    errors: [],
    availableCiclos: [],
    availableSetores: [],
    availableMeiosCaptacao: [],
    availableTiposEntrega: [],
  };

  // Verificar se O Boticário foi carregado (ainda é obrigatório para crossbuyers)
  const boticarioItems = brandItems.get('boticario');
  if (!boticarioItems || boticarioItems.length === 0) {
    result.errors.push('Nenhum dado encontrado para O Boticário (planilha obrigatória)');
    return result;
  }

  // Build customer data structure from ALL brands (união)
  // Ativo = teve pelo menos 1 VENDA em QUALQUER marca
  const customerData = new Map<string, Customer>();
  const customerNameMap = new Map<string, string>(); // normalized -> original display name

  // Conjunto separado para identificar quem tem O Boticário (apenas para crossbuyer)
  const boticarioCustomerNames = new Set<string>();

  // Process all brands - collect ALL customers with Venda type
  for (const brandId of BRAND_ORDER) {
    const items = brandItems.get(brandId);
    if (!items || items.length === 0) continue;

    for (const item of items) {
      // Skip Brinde and Doação - only count Venda
      if (item.tipo !== 'Venda') continue;

      const normalizedName = item.nomeRevendedoraNormalized;

      // Track boticário customers separately (for crossbuyer logic)
      if (brandId === 'boticario') {
        boticarioCustomerNames.add(normalizedName);
      }

      // Keep the first occurrence of the original name
      if (!customerNameMap.has(normalizedName)) {
        customerNameMap.set(normalizedName, item.nomeRevendedoraOriginal);
      }

      // Get or create customer
      let customer = customerData.get(normalizedName);
      if (!customer) {
        customer = {
          nomeRevendedora: customerNameMap.get(normalizedName) || normalizedName,
          nomeRevendedoraNormalized: normalizedName,
          brands: new Map(),
          brandCount: 0,
          totalValorVendaAllBrands: 0,
          totalItensVendaAllBrands: 0,
          allCiclos: new Set(),
          allSetores: new Set(),
          allMeiosCaptacao: new Set(),
          allTiposEntrega: new Set(),
        };
        customerData.set(normalizedName, customer);
      }

      // Get or create brand metrics
      let brandMetrics = customer.brands.get(brandId);
      if (!brandMetrics) {
        brandMetrics = {
          brand: brandId,
          items: [],
          totalItensVenda: 0,
          totalValorVenda: 0,
          ticketMedioPorItem: 0,
          ciclos: new Set(),
          setores: new Set(),
          meiosCaptacao: new Set(),
          tiposEntrega: new Set(),
        };
        customer.brands.set(brandId, brandMetrics);
      }

      // Add item
      brandMetrics.items.push(item);

      // Update metrics
      brandMetrics.totalItensVenda += item.quantidadeItens;
      brandMetrics.totalValorVenda += item.valorPraticado;

      // Track unique values
      brandMetrics.ciclos.add(item.cicloCaptacao);
      brandMetrics.setores.add(item.setor);
      brandMetrics.meiosCaptacao.add(item.meioCaptacao);
      brandMetrics.tiposEntrega.add(item.tipoEntrega);

      // Update customer aggregates
      customer.allCiclos.add(item.cicloCaptacao);
      customer.allSetores.add(item.setor);
      customer.allMeiosCaptacao.add(item.meioCaptacao);
      customer.allTiposEntrega.add(item.tipoEntrega);
    }
  }

  // totalBaseCustomers agora é o total de revendedores com venda em qualquer marca
  result.stats.totalBaseCustomers = customerData.size;

  // Calculate final metrics for each customer
  const allCiclos = new Set<string>();
  const allSetores = new Set<string>();
  const allMeiosCaptacao = new Set<string>();
  const allTiposEntrega = new Set<DeliveryType>();

  for (const customer of customerData.values()) {
    customer.brandCount = customer.brands.size;

    // Calculate totals and ticket médio per brand
    for (const brandMetrics of customer.brands.values()) {
      if (brandMetrics.totalItensVenda > 0) {
        brandMetrics.ticketMedioPorItem = Math.round(
          brandMetrics.totalValorVenda / brandMetrics.totalItensVenda
        );
      }
      customer.totalValorVendaAllBrands += brandMetrics.totalValorVenda;
      customer.totalItensVendaAllBrands += brandMetrics.totalItensVenda;
    }

    // Collect unique filter values
    customer.allCiclos.forEach(c => allCiclos.add(c));
    customer.allSetores.forEach(s => allSetores.add(s));
    customer.allMeiosCaptacao.forEach(m => allMeiosCaptacao.add(m));
    customer.allTiposEntrega.forEach(t => allTiposEntrega.add(t));

    result.customers.push(customer);
  }

  // Filter cross-buyers (2+ brands AND must have O Boticário)
  // Crossbuyer exige O Boticário - isso é regra de negócio para análise comercial
  result.crossBuyers = result.customers.filter(c => {
    const hasBoticario = boticarioCustomerNames.has(c.nomeRevendedoraNormalized);
    const hasTwoPlusBrands = c.brandCount >= 2;

    return hasTwoPlusBrands && hasBoticario;
  });

  // Calculate stats
  result.stats.crossBuyerCount = result.crossBuyers.length;

  // Brand distribution
  for (const customer of result.crossBuyers) {
    const count = customer.brandCount;
    if (count >= 2 && count <= 5) {
      result.stats.brandDistribution[count as 2 | 3 | 4 | 5]++;
    }
  }

  // Brand overlap (count customers per brand among cross-buyers)
  for (const customer of result.crossBuyers) {
    for (const brandId of customer.brands.keys()) {
      result.stats.brandOverlap[brandId]++;
    }
  }

  // Find top overlap brand (excluding boticario)
  let maxOverlap = 0;
  for (const brandId of BRAND_ORDER.slice(1)) {
    const overlap = result.stats.brandOverlap[brandId];
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      result.stats.topOverlapBrand = brandId;
    }
  }

  // Setor distribution (count cross-buyers per setor)
  for (const customer of result.crossBuyers) {
    for (const setor of customer.allSetores) {
      if (setor) {
        result.stats.setorDistribution[setor] = (result.stats.setorDistribution[setor] || 0) + 1;
      }
    }
  }

  // Set available filter options
  result.availableCiclos = Array.from(allCiclos).sort();
  result.availableSetores = Array.from(allSetores).sort();
  result.availableMeiosCaptacao = Array.from(allMeiosCaptacao).sort();
  result.availableTiposEntrega = Array.from(allTiposEntrega).sort() as DeliveryType[];

  // Process planilha Geral (transacional) if provided
  if (geralTransactions && geralTransactions.length > 0 && selectedCiclo) {
    // PASSO 1: Derivar ativos da planilha Geral
    // Ativo = Tipo=Venda + CicloFaturamento=ciclo selecionado + deduplicação por código
    const { ativos } = deriveAtivosFromTransactions(
      geralTransactions,
      selectedCiclo
    );

    console.log(`[AGGREGATE] Ativos derivados: ${ativos.length}`);

    // PASSO 2: Para cada ativo, verificar em quantas planilhas de marca ele aparece
    // Criar índice por nome normalizado para busca rápida
    const ativosByNome = new Map<string, RevendedorAtivo>();
    const ativosByCodigo = new Map<string, RevendedorAtivo>();
    for (const ativo of ativos) {
      ativosByNome.set(ativo.nomeRevendedoraNormalized, ativo);
      ativosByCodigo.set(ativo.codigoRevendedora, ativo);
    }

    // Criar estrutura para rastrear marcas por ativo
    interface AtivoEnriquecido {
      ativo: RevendedorAtivo;
      marcas: Set<BrandId>;
      valorPorMarca: Map<BrandId, number>;
      itensPorMarca: Map<BrandId, number>;
    }
    const ativosEnriquecidos = new Map<string, AtivoEnriquecido>();

    for (const ativo of ativos) {
      ativosEnriquecidos.set(ativo.codigoRevendedora, {
        ativo,
        marcas: new Set(),
        valorPorMarca: new Map(),
        itensPorMarca: new Map(),
      });
    }

    // Verificar cada planilha de marca
    for (const brandId of BRAND_ORDER) {
      const items = brandItems.get(brandId) || [];

      for (const item of items) {
        // Apenas Tipo=Venda
        if (item.tipo !== 'Venda') continue;

        // Verificar se o ciclo bate (usar cicloCaptacao como fallback se não tiver cicloFaturamento)
        const itemCiclo = item.cicloCaptacao; // Nas planilhas de marca, usar cicloCaptacao
        if (itemCiclo !== selectedCiclo) continue;

        // Tentar encontrar o ativo por nome normalizado
        const ativo = ativosByNome.get(item.nomeRevendedoraNormalized);
        if (!ativo) continue; // Não é ativo, ignorar

        // Registrar a marca
        const enriquecido = ativosEnriquecidos.get(ativo.codigoRevendedora);
        if (enriquecido) {
          enriquecido.marcas.add(brandId);
          enriquecido.valorPorMarca.set(
            brandId,
            (enriquecido.valorPorMarca.get(brandId) || 0) + item.valorPraticado
          );
          enriquecido.itensPorMarca.set(
            brandId,
            (enriquecido.itensPorMarca.get(brandId) || 0) + item.quantidadeItens
          );
        }
      }
    }

    // PASSO 3: Agregar por setor
    const sectorStats = new Map<string, {
      setor: string;
      totalAtivos: number;
      baseBoticario: number;
      multimarcas: number;
      percentMultimarcas: number;
      valorTotal: number;
      itensTotal: number;
      ativosDetalhes: Array<{
        codigo: string;
        nome: string;
        marcas: BrandId[];
        isMultimarcas: boolean;
      }>;
    }>();

    let totalAtivos = 0;
    let totalBaseBoticario = 0;
    let totalMultimarcas = 0;

    for (const [, enriquecido] of ativosEnriquecidos) {
      const setor = enriquecido.ativo.setor;
      const isMultimarcas = enriquecido.marcas.size >= 2;
      const hasBoticario = enriquecido.marcas.has('boticario');

      // Inicializar setor se não existir
      if (!sectorStats.has(setor)) {
        sectorStats.set(setor, {
          setor,
          totalAtivos: 0,
          baseBoticario: 0,
          multimarcas: 0,
          percentMultimarcas: 0,
          valorTotal: 0,
          itensTotal: 0,
          ativosDetalhes: [],
        });
      }

      const stats = sectorStats.get(setor)!;
      stats.totalAtivos++;
      totalAtivos++;

      if (hasBoticario) {
        stats.baseBoticario++;
        totalBaseBoticario++;
      }

      if (isMultimarcas) {
        stats.multimarcas++;
        totalMultimarcas++;
      }

      // Somar valores
      for (const [, valor] of enriquecido.valorPorMarca) {
        stats.valorTotal += valor;
      }
      for (const [, itens] of enriquecido.itensPorMarca) {
        stats.itensTotal += itens;
      }

      // Adicionar detalhes para auditoria
      stats.ativosDetalhes.push({
        codigo: enriquecido.ativo.codigoRevendedoraOriginal,
        nome: enriquecido.ativo.nomeRevendedora,
        marcas: Array.from(enriquecido.marcas),
        isMultimarcas,
      });
    }

    // Calcular percentuais
    for (const stats of sectorStats.values()) {
      stats.percentMultimarcas = stats.totalAtivos > 0
        ? (stats.multimarcas / stats.totalAtivos) * 100
        : 0;
    }

    // Converter para formato esperado pelo joinActiveRevendedores
    const joined = ativos.map(ativo => {
      const enriquecido = ativosEnriquecidos.get(ativo.codigoRevendedora)!;
      return {
        codigoRevendedora: ativo.codigoRevendedora,
        codigoRevendedoraOriginal: ativo.codigoRevendedoraOriginal,
        nomeRevendedora: ativo.nomeRevendedora,
        nomeRevendedoraNormalized: ativo.nomeRevendedoraNormalized,
        setor: ativo.setor,
        cicloCaptacao: ativo.cicloFaturamento,
        brands: new Map(),
        brandCount: enriquecido.marcas.size,
        totalValorVendaAllBrands: ativo.totalValor,
        totalItensVendaAllBrands: ativo.totalItens,
        existsInBoticario: enriquecido.marcas.has('boticario'),
        hasVendaRegistrada: enriquecido.marcas.size > 0,
        isCrossbuyerRegistrado: enriquecido.marcas.size >= 2,
        hasVendaFaturada: false,
        isCrossbuyerFaturado: false,
        hasPurchasesInCiclo: enriquecido.marcas.size > 0,
        isCrossbuyer: enriquecido.marcas.size >= 2,
        inconsistencies: [],
      };
    });

    // Converter sectorStats para o formato SectorActiveStats
    const sectorStatsArray = Array.from(sectorStats.values()).map(s => ({
      setor: s.setor,
      totalAtivos: s.totalAtivos,
      totalRegistrados: s.totalAtivos,
      registradosBaseBoticario: s.baseBoticario,
      crossbuyersRegistrados: s.multimarcas,
      percentCrossbuyerRegistrados: s.percentMultimarcas,
      totalFaturados: 0,
      faturadosBaseBoticario: 0,
      crossbuyersFaturados: 0,
      percentCrossbuyerFaturados: 0,
      gapRegistradoFaturado: 0,
      ativosBaseBoticario: s.baseBoticario,
      crossbuyers: s.multimarcas,
      percentCrossbuyer: s.percentMultimarcas,
      valorPorMarca: { boticario: 0, eudora: 0, auamigos: 0, oui: 0, qdb: 0 },
      itensPorMarca: { boticario: 0, eudora: 0, auamigos: 0, oui: 0, qdb: 0 },
      activeRevendedores: joined.filter(j => j.setor === s.setor),
    }));

    result.activeRevendedoresData = {
      activeRevendedores: joined,
      sectorStats: sectorStatsArray,
      selectedCiclo: selectedCiclo,
      availableCiclosFromActive: [],

      totalAtivos,
      totalRegistrados: totalAtivos,
      totalRegistradosBaseBoticario: totalBaseBoticario,
      totalCrossbuyersRegistrados: totalMultimarcas,

      totalFaturados: 0,
      totalFaturadosBaseBoticario: 0,
      totalCrossbuyersFaturados: 0,

      hasBillingData: false,

      totalAtivosBaseBoticario: totalBaseBoticario,
      totalCrossbuyersAtivos: totalMultimarcas,

      inconsistencies: [],
      diagnosticoJoin: {
        totalRecebidos: geralTransactions.length,
        excluidosPorCicloDiferente: 0,
        excluidosPorCicloNulo: 0,
        registrosProcessados: ativos.length,
        porSetor: new Map(),
      },
    };

    console.log(`[AGGREGATE] Resultado: ${totalAtivos} ativos, ${totalBaseBoticario} base Boticário, ${totalMultimarcas} multimarcas`);
  }

  result.success = true;
  return result;
}

/**
 * Get customer brand breakdown summary
 */
export function getCustomerBrandSummary(customer: Customer): {
  brandId: BrandId;
  valor: number;
  itens: number;
}[] {
  const summary: { brandId: BrandId; valor: number; itens: number }[] = [];

  for (const brandId of BRAND_ORDER) {
    const metrics = customer.brands.get(brandId);
    if (metrics) {
      summary.push({
        brandId,
        valor: metrics.totalValorVenda,
        itens: metrics.totalItensVenda,
      });
    }
  }

  return summary;
}
