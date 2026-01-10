import {
  ActiveRevendedorData,
  ActiveRevendedorJoined,
  Customer,
  Item,
  BrandId,
  CustomerBrandMetrics,
  SectorActiveStats,
  BRAND_ORDER,
  JoinDiagnostico,
} from '@/types';

/**
 * Join active revendedores with brand purchases
 * Follows strict order: 1) CodigoRevendedora, 2) Fallback by NomeRevendedora normalized
 */
export function joinActiveRevendedores(
  activeRevendedores: ActiveRevendedorData[],
  customers: Map<string, Customer>, // Map by normalized nome (from existing processing)
  selectedCiclo: string | null,
  brandItems: Map<BrandId, Item[]>
): {
  joined: ActiveRevendedorJoined[];
  inconsistencies: string[];
  diagnostico: JoinDiagnostico;
} {
  const joined: ActiveRevendedorJoined[] = [];
  const inconsistencies: string[] = [];

  // DEBUG: Log para diagnóstico
  console.log('[JOIN] selectedCiclo:', selectedCiclo);
  console.log('[JOIN] Total activeRevendedores:', activeRevendedores.length);
  console.log('[JOIN] Total customers (com vendas):', customers.size);

  // Diagnóstico de exclusões por ciclo
  let excluidosPorCicloDiferente = 0;
  const porSetor = new Map<string, { total: number; excluidosPorCiclo: number }>();

  // Note: In future, if brand items have codigoRevendedora, we could build:
  // - customersByCodigo map for efficient lookup by codigo
  // - codigoToNomeNormalized map for reverse lookup

  // First, try to find customers by codigo from brand items
  // Note: brand items don't have codigoRevendedora yet, so we'll use nome as fallback
  // This is a limitation - we need to join primarily by nome

  // Build reverse map: normalized nome -> Customer
  const customersByNome = new Map<string, Customer>();
  for (const customer of customers.values()) {
    customersByNome.set(customer.nomeRevendedoraNormalized, customer);
  }

  // Process each active revendedor
  // IMPORTANTE: Não filtramos por ciclo da planilha Geral!
  // O que define "ativo no ciclo" é ter VENDA no ciclo (em qualquer marca),
  // NÃO o ciclo cadastrado na planilha Geral.
  for (const active of activeRevendedores) {
    const setor = active.setor || 'Não informado';

    // Rastrear total por setor (todos da planilha Geral)
    if (!porSetor.has(setor)) {
      porSetor.set(setor, { total: 0, excluidosPorCiclo: 0 });
    }
    porSetor.get(setor)!.total++;

    let matchedCustomer: Customer | null = null;

    // Step 1: Try to match by CodigoRevendedora
    // Since brand items don't have codigoRevendedora, we can't match by codigo directly
    // This is a limitation - we'll use nome as primary matching
    // In a real scenario, brand items would have codigoRevendedora column

    // Step 2: Fallback - match by NomeRevendedora normalized
    matchedCustomer = customersByNome.get(active.nomeRevendedoraNormalized) || null;

    // Build brand purchases for this active revendedor
    const brands = new Map<BrandId, CustomerBrandMetrics>();
    let existsInBoticario = false;
    let hasPurchasesInCiclo = false;
    const activeInconsistencies: string[] = [];

    // If matched by nome, use customer's brands
    if (matchedCustomer) {
      existsInBoticario = matchedCustomer.brands.has('boticario');

      // Filter by selected ciclo if provided
      for (const [brandId, metrics] of matchedCustomer.brands.entries()) {
        // Filter items by ciclo if selected
        const filteredItems = selectedCiclo
          ? metrics.items.filter(item => item.cicloCaptacao === selectedCiclo)
          : metrics.items;

        // Only include Venda type
        const vendaItems = filteredItems.filter(item => item.tipo === 'Venda');

        if (vendaItems.length > 0) {
          hasPurchasesInCiclo = true;

          // Recalculate metrics for filtered items
          let totalItensVenda = 0;
          let totalValorVenda = 0;

          for (const item of vendaItems) {
            totalItensVenda += item.quantidadeItens;
            totalValorVenda += item.valorPraticado;

            // Check for setor divergence
            if (item.setor !== active.setor) {
              activeInconsistencies.push(
                `Setor divergente: ativo tem "${active.setor}" mas compra tem "${item.setor}"`
              );
            }
          }

          brands.set(brandId, {
            brand: brandId,
            items: vendaItems,
            totalItensVenda,
            totalValorVenda,
            ticketMedioPorItem:
              totalItensVenda > 0 ? Math.round(totalValorVenda / totalItensVenda) : 0,
            ciclos: new Set(vendaItems.map(item => item.cicloCaptacao)),
            setores: new Set(vendaItems.map(item => item.setor)),
            meiosCaptacao: new Set(vendaItems.map(item => item.meioCaptacao)),
            tiposEntrega: new Set(vendaItems.map(item => item.tipoEntrega)),
          });
        }
      }
    } else {
      // No match found - try to find purchases by codigo or nome in brand items directly
      // This is a fallback if customer wasn't in the base (shouldn't happen if rules are correct)

      // Search brand items for this revendedor
      for (const brandId of BRAND_ORDER) {
        const items = brandItems.get(brandId) || [];
        const matchingItems: Item[] = [];

        for (const item of items) {
          // Match by normalized nome
          if (item.nomeRevendedoraNormalized === active.nomeRevendedoraNormalized) {
            // Filter by ciclo if selected
            if (selectedCiclo && item.cicloCaptacao !== selectedCiclo) {
              continue;
            }

            // Only include Venda type
            if (item.tipo === 'Venda') {
              matchingItems.push(item);

              // Check for setor divergence
              if (item.setor !== active.setor) {
                activeInconsistencies.push(
                  `Setor divergente: ativo tem "${active.setor}" mas compra tem "${item.setor}"`
                );
              }
            }
          }
        }

        if (matchingItems.length > 0) {
          hasPurchasesInCiclo = true;
          if (brandId === 'boticario') {
            existsInBoticario = true;
          }

          // Calculate metrics
          let totalItensVenda = 0;
          let totalValorVenda = 0;

          for (const item of matchingItems) {
            totalItensVenda += item.quantidadeItens;
            totalValorVenda += item.valorPraticado;
          }

          brands.set(brandId, {
            brand: brandId,
            items: matchingItems,
            totalItensVenda,
            totalValorVenda,
            ticketMedioPorItem:
              totalItensVenda > 0 ? Math.round(totalValorVenda / totalItensVenda) : 0,
            ciclos: new Set(matchingItems.map(item => item.cicloCaptacao)),
            setores: new Set(matchingItems.map(item => item.setor)),
            meiosCaptacao: new Set(matchingItems.map(item => item.meioCaptacao)),
            tiposEntrega: new Set(matchingItems.map(item => item.tipoEntrega)),
          });
        }
      }
    }

    // Add inconsistencies
    // Nota: Não existir no oBoticário NÃO é mais uma inconsistência - é apenas informação
    // O revendedor é considerado "ativo" se teve pelo menos 1 venda no ciclo em QUALQUER marca

    if (selectedCiclo && !hasPurchasesInCiclo) {
      activeInconsistencies.push(
        `Revendedor ativo não tem compras no ciclo selecionado (${selectedCiclo})`
      );
    }

    // Calculate totals
    let totalValorVendaAllBrands = 0;
    let totalItensVendaAllBrands = 0;

    for (const metrics of brands.values()) {
      totalValorVendaAllBrands += metrics.totalValorVenda;
      totalItensVendaAllBrands += metrics.totalItensVenda;
    }

    // Calcular métricas de VENDA REGISTRADA (Tipo=Venda)
    const hasVendaRegistrada = selectedCiclo ? hasPurchasesInCiclo : (brands.size > 0);
    const isCrossbuyerRegistrado = brands.size >= 2 && existsInBoticario;

    // Calcular métricas de FATURAMENTO (isFaturado=true)
    // Contar marcas onde há pelo menos 1 item faturado
    let brandsWithFaturamento = 0;
    let hasVendaFaturada = false;

    for (const metrics of brands.values()) {
      const faturadoItems = metrics.items.filter(item => item.isFaturado === true);
      if (faturadoItems.length > 0) {
        brandsWithFaturamento++;
        hasVendaFaturada = true;
      }
    }

    const isCrossbuyerFaturado = brandsWithFaturamento >= 2 && existsInBoticario;

    // DEBUG: Log para setores específicos
    if (setor.includes('INICIOS CENTRAL') || setor.includes('PRATA')) {
      console.log(`[DEBUG SETOR] ${setor}: ${active.nomeRevendedora} | matched=${!!matchedCustomer} | brands=${brands.size} | registrado=${hasVendaRegistrada} | faturado=${hasVendaFaturada}`);
    }

    joined.push({
      codigoRevendedora: active.codigoRevendedora,
      codigoRevendedoraOriginal: active.codigoRevendedoraOriginal,
      nomeRevendedora: active.nomeRevendedora,
      nomeRevendedoraNormalized: active.nomeRevendedoraNormalized,
      setor: active.setor, // Setor EXCLUSIVAMENTE da planilha Geral (authoritative)
      cicloCaptacao: active.cicloCaptacao,
      brands,
      brandCount: brands.size,
      totalValorVendaAllBrands,
      totalItensVendaAllBrands,
      existsInBoticario,
      // Métricas de Venda Registrada
      hasVendaRegistrada,
      isCrossbuyerRegistrado,
      // Métricas de Faturamento
      hasVendaFaturada,
      isCrossbuyerFaturado,
      // Aliases para compatibilidade
      hasPurchasesInCiclo: hasVendaRegistrada,
      isCrossbuyer: isCrossbuyerRegistrado,
      inconsistencies: activeInconsistencies,
    });
  }

  // Criar diagnóstico
  const diagnostico: JoinDiagnostico = {
    totalRecebidos: activeRevendedores.length,
    excluidosPorCicloDiferente,
    excluidosPorCicloNulo: 0, // Não excluímos mais por ciclo nulo
    registrosProcessados: joined.length,
    porSetor,
  };

  return { joined, inconsistencies, diagnostico };
}

/**
 * Aggregate active revendedores by sector
 *
 * Nova lógica com duas métricas:
 * 1. VENDA REGISTRADA (captação/pedidos):
 *    - totalRegistrados = revendedores com venda registrada (Tipo=Venda) no ciclo
 *    - registradosBaseBoticario = que existem no O Boticário
 *    - crossbuyersRegistrados = 2+ marcas com venda registrada
 *
 * 2. FATURAMENTO (quando disponível):
 *    - totalFaturados = revendedores com venda faturada no ciclo
 *    - faturadosBaseBoticario = que existem no O Boticário
 *    - crossbuyersFaturados = 2+ marcas com venda faturada
 *
 * Gap = Registrados - Faturados
 */
export function aggregateActiveRevendedoresBySector(
  joined: ActiveRevendedorJoined[]
): Map<string, SectorActiveStats> {
  const sectorStats = new Map<string, SectorActiveStats>();

  for (const active of joined) {
    const setor = active.setor || 'Não informado';

    let stats = sectorStats.get(setor);
    if (!stats) {
      stats = {
        setor,
        // Métricas de Venda Registrada
        totalRegistrados: 0,
        registradosBaseBoticario: 0,
        crossbuyersRegistrados: 0,
        percentCrossbuyerRegistrados: 0,
        // Métricas de Faturamento
        totalFaturados: 0,
        faturadosBaseBoticario: 0,
        crossbuyersFaturados: 0,
        percentCrossbuyerFaturados: 0,
        // Gap Analysis
        gapRegistradoFaturado: 0,
        // Aliases para compatibilidade
        totalAtivos: 0,
        ativosBaseBoticario: 0,
        crossbuyers: 0,
        percentCrossbuyer: 0,
        // Por marca
        valorPorMarca: {
          boticario: 0,
          eudora: 0,
          auamigos: 0,
          oui: 0,
          qdb: 0,
        },
        itensPorMarca: {
          boticario: 0,
          eudora: 0,
          auamigos: 0,
          oui: 0,
          qdb: 0,
        },
        activeRevendedores: [],
      };
      sectorStats.set(setor, stats);
    }

    // Sempre adicionar à lista para visualização
    stats.activeRevendedores.push(active);

    // --- VENDA REGISTRADA ---
    if (active.hasVendaRegistrada) {
      stats.totalRegistrados++;

      if (active.existsInBoticario) {
        stats.registradosBaseBoticario++;
      }
    }

    if (active.isCrossbuyerRegistrado) {
      stats.crossbuyersRegistrados++;
    }

    // --- FATURAMENTO ---
    if (active.hasVendaFaturada) {
      stats.totalFaturados++;

      if (active.existsInBoticario) {
        stats.faturadosBaseBoticario++;
      }
    }

    if (active.isCrossbuyerFaturado) {
      stats.crossbuyersFaturados++;
    }

    // Aggregate by brand (vendas registradas)
    for (const [brandId, metrics] of active.brands.entries()) {
      stats.valorPorMarca[brandId] += metrics.totalValorVenda;
      stats.itensPorMarca[brandId] += metrics.totalItensVenda;
    }
  }

  // Calculate percentages and gap
  for (const stats of sectorStats.values()) {
    // % Crossbuyer Registrados
    stats.percentCrossbuyerRegistrados =
      stats.registradosBaseBoticario > 0
        ? (stats.crossbuyersRegistrados / stats.registradosBaseBoticario) * 100
        : 0;

    // % Crossbuyer Faturados
    stats.percentCrossbuyerFaturados =
      stats.faturadosBaseBoticario > 0
        ? (stats.crossbuyersFaturados / stats.faturadosBaseBoticario) * 100
        : 0;

    // Gap
    stats.gapRegistradoFaturado = stats.totalRegistrados - stats.totalFaturados;

    // Aliases para compatibilidade (apontam para Registrados)
    stats.totalAtivos = stats.totalRegistrados;
    stats.ativosBaseBoticario = stats.registradosBaseBoticario;
    stats.crossbuyers = stats.crossbuyersRegistrados;
    stats.percentCrossbuyer = stats.percentCrossbuyerRegistrados;

    // DEBUG: Log para setores específicos
    if (stats.setor.includes('INICIOS CENTRAL') || stats.setor.includes('PRATA')) {
      console.log(`[DEBUG AGREGACAO] ${stats.setor}: registrados=${stats.totalRegistrados} | faturados=${stats.totalFaturados} | gap=${stats.gapRegistradoFaturado}`);
    }
  }

  return sectorStats;
}
