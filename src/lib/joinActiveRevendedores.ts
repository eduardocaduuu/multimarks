import {
  ActiveRevendedorData,
  ActiveRevendedorJoined,
  Customer,
  Item,
  BrandId,
  CustomerBrandMetrics,
  SectorActiveStats,
  BRAND_ORDER,
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
} {
  const joined: ActiveRevendedorJoined[] = [];
  const inconsistencies: string[] = [];

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
  for (const active of activeRevendedores) {
    // Filter by ciclo if selected
    if (selectedCiclo && active.cicloCaptacao && active.cicloCaptacao !== selectedCiclo) {
      // Skip if ciclo doesn't match (only if active file has ciclo column)
      continue;
    }

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
    if (!existsInBoticario) {
      activeInconsistencies.push('Ativo não existe no oBoticário (regra base)');
      inconsistencies.push(
        `Revendedor ativo "${active.nomeRevendedora}" (${active.codigoRevendedoraOriginal}) não existe no oBoticário`
      );
    }

    if (selectedCiclo && !hasPurchasesInCiclo && existsInBoticario) {
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

    const isCrossbuyer = brands.size >= 2 && existsInBoticario;

    joined.push({
      codigoRevendedora: active.codigoRevendedora,
      codigoRevendedoraOriginal: active.codigoRevendedoraOriginal,
      nomeRevendedora: active.nomeRevendedora,
      nomeRevendedoraNormalized: active.nomeRevendedoraNormalized,
      setor: active.setor, // Authoritative from active file
      cicloCaptacao: active.cicloCaptacao,
      brands,
      brandCount: brands.size,
      totalValorVendaAllBrands,
      totalItensVendaAllBrands,
      existsInBoticario,
      hasPurchasesInCiclo: hasPurchasesInCiclo || !selectedCiclo, // If no ciclo selected, consider as having purchases
      isCrossbuyer,
      inconsistencies: activeInconsistencies,
    });
  }

  return { joined, inconsistencies };
}

/**
 * Aggregate active revendedores by sector
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
        totalAtivos: 0,
        ativosBaseBoticario: 0,
        crossbuyers: 0,
        percentCrossbuyer: 0,
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

    stats.totalAtivos++;
    stats.activeRevendedores.push(active);

    if (active.existsInBoticario) {
      stats.ativosBaseBoticario++;
    }

    if (active.isCrossbuyer) {
      stats.crossbuyers++;
    }

    // Aggregate by brand
    for (const [brandId, metrics] of active.brands.entries()) {
      stats.valorPorMarca[brandId] += metrics.totalValorVenda;
      stats.itensPorMarca[brandId] += metrics.totalItensVenda;
    }
  }

  // Calculate percentages
  for (const stats of sectorStats.values()) {
    stats.percentCrossbuyer =
      stats.totalAtivos > 0 ? (stats.crossbuyers / stats.totalAtivos) * 100 : 0;
  }

  return sectorStats;
}
