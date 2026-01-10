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
 *
 * REGRA FUNDAMENTAL:
 * - A planilha Geral é a ÚNICA fonte de verdade para "revendedor ativo"
 * - TODOS os revendedores da planilha Geral são considerados ATIVOS
 * - As planilhas de marca apenas ENRIQUECEM os dados (não criam ativos)
 * - Revendedor multimarcas = ativo que comprou 2+ marcas no ciclo
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
  console.log('[JOIN] Total activeRevendedores (da planilha Geral):', activeRevendedores.length);
  console.log('[JOIN] Total customers (com vendas nas planilhas de marca):', customers.size);

  // Diagnóstico por setor
  const porSetor = new Map<string, { total: number; excluidosPorCiclo: number }>();

  // Build reverse map: normalized nome -> Customer
  const customersByNome = new Map<string, Customer>();
  for (const customer of customers.values()) {
    customersByNome.set(customer.nomeRevendedoraNormalized, customer);
  }

  // Process each active revendedor from planilha Geral
  // REGRA: Todos da planilha Geral são ATIVOS por definição
  for (const active of activeRevendedores) {
    const setor = active.setor || 'Não informado';

    // Rastrear total por setor (todos da planilha Geral = ativos)
    if (!porSetor.has(setor)) {
      porSetor.set(setor, { total: 0, excluidosPorCiclo: 0 });
    }
    porSetor.get(setor)!.total++;

    // Tentar encontrar compras deste revendedor nas planilhas de marca
    const matchedCustomer = customersByNome.get(active.nomeRevendedoraNormalized) || null;

    // Build brand purchases for this active revendedor
    const brands = new Map<BrandId, CustomerBrandMetrics>();
    let existsInBoticario = false;
    const activeInconsistencies: string[] = [];

    // Se encontrou nas planilhas de marca, enriquecer com dados de compra
    if (matchedCustomer) {
      existsInBoticario = matchedCustomer.brands.has('boticario');

      // Processar cada marca
      for (const [brandId, metrics] of matchedCustomer.brands.entries()) {
        // Filtrar por ciclo se selecionado
        const filteredItems = selectedCiclo
          ? metrics.items.filter(item => item.cicloCaptacao === selectedCiclo)
          : metrics.items;

        // Apenas tipo Venda
        const vendaItems = filteredItems.filter(item => item.tipo === 'Venda');

        if (vendaItems.length > 0) {
          let totalItensVenda = 0;
          let totalValorVenda = 0;

          for (const item of vendaItems) {
            totalItensVenda += item.quantidadeItens;
            totalValorVenda += item.valorPraticado;
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
      // Fallback: buscar diretamente nas planilhas de marca
      for (const brandId of BRAND_ORDER) {
        const items = brandItems.get(brandId) || [];
        const matchingItems: Item[] = [];

        for (const item of items) {
          if (item.nomeRevendedoraNormalized === active.nomeRevendedoraNormalized) {
            if (selectedCiclo && item.cicloCaptacao !== selectedCiclo) {
              continue;
            }
            if (item.tipo === 'Venda') {
              matchingItems.push(item);
            }
          }
        }

        if (matchingItems.length > 0) {
          if (brandId === 'boticario') {
            existsInBoticario = true;
          }

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

    // Calculate totals
    let totalValorVendaAllBrands = 0;
    let totalItensVendaAllBrands = 0;

    for (const metrics of brands.values()) {
      totalValorVendaAllBrands += metrics.totalValorVenda;
      totalItensVendaAllBrands += metrics.totalItensVenda;
    }

    // REGRA: Multimarcas = comprou 2+ marcas diferentes no ciclo
    const isMultimarcas = brands.size >= 2;

    // Métricas de faturamento (se disponível)
    let brandsWithFaturamento = 0;
    let hasVendaFaturada = false;

    for (const metrics of brands.values()) {
      const faturadoItems = metrics.items.filter(item => item.isFaturado === true);
      if (faturadoItems.length > 0) {
        brandsWithFaturamento++;
        hasVendaFaturada = true;
      }
    }

    const isMultimarcasFaturado = brandsWithFaturamento >= 2;

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
      // Métricas - todos são ativos (da planilha Geral)
      hasVendaRegistrada: brands.size > 0, // Tem compras nas planilhas de marca
      isCrossbuyerRegistrado: isMultimarcas, // Comprou 2+ marcas (multimarcas)
      // Métricas de Faturamento
      hasVendaFaturada,
      isCrossbuyerFaturado: isMultimarcasFaturado,
      // Aliases para compatibilidade
      hasPurchasesInCiclo: brands.size > 0,
      isCrossbuyer: isMultimarcas,
      inconsistencies: activeInconsistencies,
    });
  }

  // Criar diagnóstico
  const diagnostico: JoinDiagnostico = {
    totalRecebidos: activeRevendedores.length,
    excluidosPorCicloDiferente: 0,
    excluidosPorCicloNulo: 0,
    registrosProcessados: joined.length,
    porSetor,
  };

  return { joined, inconsistencies, diagnostico };
}

/**
 * Aggregate active revendedores by sector
 *
 * REGRA FUNDAMENTAL:
 * - totalAtivos = TODOS os revendedores da planilha Geral naquele setor
 * - totalMultimarcas = ativos que compraram 2+ marcas no ciclo
 * - % multimarcas = totalMultimarcas / totalAtivos
 *
 * Os números DEVEM bater 1:1 com o painel oficial.
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
        // ATIVOS = todos da planilha Geral (não depende de ter compra)
        totalAtivos: 0,
        // Métricas de compras nas planilhas de marca
        totalRegistrados: 0,      // Ativos que têm compras registradas
        registradosBaseBoticario: 0,
        crossbuyersRegistrados: 0, // Multimarcas (2+ marcas)
        percentCrossbuyerRegistrados: 0,
        // Métricas de Faturamento
        totalFaturados: 0,
        faturadosBaseBoticario: 0,
        crossbuyersFaturados: 0,
        percentCrossbuyerFaturados: 0,
        // Gap Analysis
        gapRegistradoFaturado: 0,
        // Aliases para compatibilidade
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

    // REGRA: Cada revendedor da planilha Geral = 1 ativo
    stats.totalAtivos++;

    // Adicionar à lista para visualização
    stats.activeRevendedores.push(active);

    // --- COMPRAS NAS PLANILHAS DE MARCA ---
    if (active.hasVendaRegistrada) {
      stats.totalRegistrados++;

      if (active.existsInBoticario) {
        stats.registradosBaseBoticario++;
      }
    }

    // Multimarcas = comprou 2+ marcas
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

    // Agregar valores por marca (apenas para ativos com compras)
    for (const [brandId, metrics] of active.brands.entries()) {
      stats.valorPorMarca[brandId] += metrics.totalValorVenda;
      stats.itensPorMarca[brandId] += metrics.totalItensVenda;
    }
  }

  // Calculate percentages
  for (const stats of sectorStats.values()) {
    // % Multimarcas sobre ATIVOS (não sobre registrados)
    stats.percentCrossbuyerRegistrados =
      stats.totalAtivos > 0
        ? (stats.crossbuyersRegistrados / stats.totalAtivos) * 100
        : 0;

    // % Multimarcas Faturados sobre totalFaturados
    stats.percentCrossbuyerFaturados =
      stats.totalFaturados > 0
        ? (stats.crossbuyersFaturados / stats.totalFaturados) * 100
        : 0;

    // Gap
    stats.gapRegistradoFaturado = stats.totalRegistrados - stats.totalFaturados;

    // Aliases para compatibilidade
    stats.ativosBaseBoticario = stats.registradosBaseBoticario;
    stats.crossbuyers = stats.crossbuyersRegistrados;
    stats.percentCrossbuyer = stats.percentCrossbuyerRegistrados;

    // DEBUG: Log para setores específicos
    if (stats.setor.includes('INICIOS CENTRAL') || stats.setor.includes('PRATA')) {
      console.log(`[DEBUG AGREGACAO] ${stats.setor}: totalAtivos=${stats.totalAtivos} | multimarcas=${stats.crossbuyersRegistrados} | %=${stats.percentCrossbuyerRegistrados.toFixed(1)}%`);
    }
  }

  return sectorStats;
}
