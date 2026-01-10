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

  // Get base customers from O Boticário
  const boticarioItems = brandItems.get('boticario');
  if (!boticarioItems || boticarioItems.length === 0) {
    result.errors.push('Nenhum dado encontrado para O Boticário (planilha obrigatória)');
    return result;
  }

  // Build base customer set from O Boticário - ONLY customers with Venda type
  const baseCustomerNames = new Set<string>();
  const customerNameMap = new Map<string, string>(); // normalized -> original display name

  for (const item of boticarioItems) {
    // Only include customers who have VENDA in O Boticário
    // This ensures cross-buyers must have purchased (not just received gifts/donations) from O Boticário
    if (item.tipo !== 'Venda') continue;

    baseCustomerNames.add(item.nomeRevendedoraNormalized);
    // Keep the first occurrence of the original name
    if (!customerNameMap.has(item.nomeRevendedoraNormalized)) {
      customerNameMap.set(item.nomeRevendedoraNormalized, item.nomeRevendedoraOriginal);
    }
  }

  result.stats.totalBaseCustomers = baseCustomerNames.size;

  // Build customer data structure
  const customerData = new Map<string, Customer>();

  // Initialize customers from base
  for (const normalizedName of baseCustomerNames) {
    customerData.set(normalizedName, {
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
    });
  }

  // Process all brands - only consider "Venda" type items
  for (const brandId of BRAND_ORDER) {
    const items = brandItems.get(brandId);
    if (!items || items.length === 0) continue;

    for (const item of items) {
      // Skip if not in base (O Boticário)
      if (!baseCustomerNames.has(item.nomeRevendedoraNormalized)) continue;

      // Skip Brinde and Doação - only count Venda
      if (item.tipo !== 'Venda') continue;

      const customer = customerData.get(item.nomeRevendedoraNormalized)!;

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
  // The second condition is a safety check - with proper base filtering, all customers should have O Boticário
  result.crossBuyers = result.customers.filter(c => {
    const hasBoticario = c.brands.has('boticario');
    const hasTwoPlusBrands = c.brandCount >= 2;

    // Debug: log customers that would be filtered out
    if (hasTwoPlusBrands && !hasBoticario) {
      console.warn(`[CROSS-BUYER FILTRADO] Cliente "${c.nomeRevendedora}" tem ${c.brandCount} marcas mas NÃO tem O Boticário:`,
        Array.from(c.brands.keys()));
    }

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

    // Calculate totals - Nova lógica:
    // - totalAtivos = revendedores que tiveram pelo menos 1 VENDA no ciclo (qualquer marca)
    // - totalAtivosBaseBoticario = dos ativos, quantos têm compra no O Boticário
    // - totalCrossbuyersAtivos = crossbuyers (2+ marcas E existe no O Boticário)
    const totalAtivos = joined.filter(a => a.hasPurchasesInCiclo).length;
    const totalAtivosBaseBoticario = joined.filter(a => a.hasPurchasesInCiclo && a.existsInBoticario).length;
    const totalCrossbuyersAtivos = joined.filter(a => a.isCrossbuyer).length;

    result.activeRevendedoresData = {
      activeRevendedores: joined,
      sectorStats,
      selectedCiclo: selectedCiclo || null,
      availableCiclosFromActive: Array.from(availableCiclosFromActive).sort(),
      totalAtivos,
      totalAtivosBaseBoticario,
      totalCrossbuyersAtivos,
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
