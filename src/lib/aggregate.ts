import {
  Item,
  Customer,
  BrandId,
  ProcessingResult,
  BRAND_ORDER,
  DeliveryType,
  ActiveRevendedorData,
} from '@/types';
import { joinActiveRevendedores, aggregateActiveRevendedoresBySector } from './joinActiveRevendedores';

/**
 * Process items from all brands and generate cross-buyer analysis
 */
export function processAllBrands(
  brandItems: Map<BrandId, Item[]>,
  activeRevendedoresData?: ActiveRevendedorData[],
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

  // Process active revendedores if provided
  if (activeRevendedoresData && activeRevendedoresData.length > 0) {
    // Build customer map by normalized nome for joining
    const customersMap = new Map<string, Customer>();
    for (const customer of result.customers) {
      customersMap.set(customer.nomeRevendedoraNormalized, customer);
    }

    // Join active revendedores with brand purchases
    const { joined, inconsistencies, diagnostico } = joinActiveRevendedores(
      activeRevendedoresData,
      customersMap,
      selectedCiclo || null,
      brandItems
    );

    // Aggregate by sector
    const sectorStatsMap = aggregateActiveRevendedoresBySector(joined);
    const sectorStats = Array.from(sectorStatsMap.values());

    // Extract available ciclos from active file (if any)
    const availableCiclosFromActive = new Set<string>();
    for (const active of activeRevendedoresData) {
      if (active.cicloCaptacao) {
        availableCiclosFromActive.add(active.cicloCaptacao);
      }
    }

    // REGRA FUNDAMENTAL:
    // - totalAtivos = TODOS os revendedores da planilha Geral
    // - totalMultimarcas = ativos que compraram 2+ marcas no ciclo
    // - % multimarcas = totalMultimarcas / totalAtivos

    // Total de ATIVOS = todos da planilha Geral (não depende de ter compra)
    const totalAtivos = joined.length;

    // Métricas de compras nas planilhas de marca
    const totalRegistrados = joined.filter(a => a.hasVendaRegistrada).length;
    const totalRegistradosBaseBoticario = joined.filter(a => a.hasVendaRegistrada && a.existsInBoticario).length;
    const totalCrossbuyersRegistrados = joined.filter(a => a.isCrossbuyerRegistrado).length;

    // Métricas de Faturamento
    const totalFaturados = joined.filter(a => a.hasVendaFaturada).length;
    const totalFaturadosBaseBoticario = joined.filter(a => a.hasVendaFaturada && a.existsInBoticario).length;
    const totalCrossbuyersFaturados = joined.filter(a => a.isCrossbuyerFaturado).length;

    // Detectar se há dados de faturamento disponíveis
    // (verificar se algum item tem isFaturado definido)
    let hasBillingData = false;
    for (const brandId of BRAND_ORDER) {
      const items = brandItems.get(brandId);
      if (items) {
        for (const item of items) {
          if (item.isFaturado !== undefined) {
            hasBillingData = true;
            break;
          }
        }
        if (hasBillingData) break;
      }
    }

    result.activeRevendedoresData = {
      activeRevendedores: joined,
      sectorStats,
      selectedCiclo: selectedCiclo || null,
      availableCiclosFromActive: Array.from(availableCiclosFromActive).sort(),

      // REGRA: totalAtivos = TODOS da planilha Geral
      totalAtivos,

      // Métricas de compras nas planilhas de marca
      totalRegistrados,
      totalRegistradosBaseBoticario,
      totalCrossbuyersRegistrados, // Multimarcas

      // Métricas de Faturamento
      totalFaturados,
      totalFaturadosBaseBoticario,
      totalCrossbuyersFaturados,

      // Flag de disponibilidade
      hasBillingData,

      // Aliases para compatibilidade
      totalAtivosBaseBoticario: totalRegistradosBaseBoticario,
      totalCrossbuyersAtivos: totalCrossbuyersRegistrados,

      inconsistencies,
      diagnosticoJoin: diagnostico,
    };
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
