import {
  Item,
  BrandId,
  RankingData,
  ActiveRevendedor,
  SectorActivityRow,
  SectorActivityResult,
  SectorActivityTotals,
} from '@/types';
import { normalizeString } from './utils';

/**
 * Build sector activity comparison from detailed brand data and ranking data
 *
 * @param brandItems - Map of brand items from detailed spreadsheets
 * @param rankingData - Parsed ranking data (sector totals)
 * @param selectedCiclo - The ciclo to filter by
 * @param selectedBrands - Which brands to include in calculation
 * @param baseCustomerNames - Set of normalized names from O Boticário base (only these count)
 * @returns SectorActivityResult with comparison rows and totals
 */
export function buildSectorActivity(
  brandItems: Map<BrandId, Item[]>,
  rankingData: RankingData | null,
  selectedCiclo: string,
  selectedBrands: Set<BrandId>,
  baseCustomerNames: Set<string>
): SectorActivityResult {
  const result: SectorActivityResult = {
    success: false,
    rows: [],
    totals: {
      revendedoresAtivosCalc: 0,
      itensCalc: 0,
      valorCalc: 0,
      revendedoresRanking: 0,
      itensRanking: 0,
      valorRanking: 0,
      revendedoresDiff: 0,
      itensDiff: 0,
      valorDiff: 0,
      revendedoresCobertura: 0,
      itensCobertura: 0,
      valorCobertura: 0,
      setoresCount: 0,
      setoresComDiff: 0,
    },
    errors: [],
    selectedCiclo,
    selectedBrands: Array.from(selectedBrands),
  };

  if (!selectedCiclo) {
    result.errors.push('Selecione um ciclo para calcular a atividade');
    return result;
  }

  // Step 1: Get all active revendedores (Tipo=Venda in selected ciclo)
  const activeMap = new Map<string, ActiveRevendedor>();

  for (const [brandId, items] of brandItems) {
    // Skip brands not selected
    if (!selectedBrands.has(brandId)) continue;

    for (const item of items) {
      // Filter by ciclo
      if (item.cicloCaptacao !== selectedCiclo) continue;

      // Only Venda counts
      if (item.tipo !== 'Venda') continue;

      // Must exist in O Boticário base
      if (!baseCustomerNames.has(item.nomeRevendedoraNormalized)) continue;

      const existing = activeMap.get(item.nomeRevendedoraNormalized);
      if (existing) {
        existing.itens += item.quantidadeItens;
        existing.valor += item.valorPraticado;
        existing.brands.add(brandId);
        // Keep setor from first occurrence or update if different
        // (revendedor could appear in multiple sectors - use first)
      } else {
        activeMap.set(item.nomeRevendedoraNormalized, {
          nome: item.nomeRevendedoraOriginal,
          nomeNormalized: item.nomeRevendedoraNormalized,
          setor: item.setor,
          setorNormalized: normalizeString(item.setor),
          itens: item.quantidadeItens,
          valor: item.valorPraticado,
          brands: new Set([brandId]),
        });
      }
    }
  }

  // Step 2: Group by sector
  const sectorCalc = new Map<
    string,
    {
      setor: string;
      setorNormalized: string;
      revendedores: Set<string>;
      itens: number;
      valor: number;
      activeList: ActiveRevendedor[];
    }
  >();

  for (const rev of activeMap.values()) {
    const setorNormalized = rev.setorNormalized;
    const existing = sectorCalc.get(setorNormalized);

    if (existing) {
      existing.revendedores.add(rev.nomeNormalized);
      existing.itens += rev.itens;
      existing.valor += rev.valor;
      existing.activeList.push(rev);
    } else {
      sectorCalc.set(setorNormalized, {
        setor: rev.setor,
        setorNormalized,
        revendedores: new Set([rev.nomeNormalized]),
        itens: rev.itens,
        valor: rev.valor,
        activeList: [rev],
      });
    }
  }

  // Step 3: Build comparison rows
  const allSectorKeys = new Set<string>();

  // Add sectors from calculated data
  for (const key of sectorCalc.keys()) {
    allSectorKeys.add(key);
  }

  // Add sectors from ranking data
  if (rankingData) {
    for (const key of rankingData.sectors.keys()) {
      allSectorKeys.add(key);
    }
  }

  const rows: SectorActivityRow[] = [];

  for (const setorNormalized of allSectorKeys) {
    const calc = sectorCalc.get(setorNormalized);
    const ranking = rankingData?.sectors.get(setorNormalized);

    const revendedoresAtivosCalc = calc?.revendedores.size ?? 0;
    const itensCalc = calc?.itens ?? 0;
    const valorCalc = calc?.valor ?? 0;

    const revendedoresRanking = ranking?.quantidadeRevendedor ?? 0;
    const itensRanking = ranking?.quantidadeItens ?? 0;
    const valorRanking = ranking?.valorPraticado ?? 0;

    const row: SectorActivityRow = {
      setor: calc?.setor ?? ranking?.setor ?? setorNormalized,
      setorNormalized,
      revendedoresAtivosCalc,
      itensCalc,
      valorCalc,
      revendedoresRanking,
      itensRanking,
      valorRanking,
      revendedoresDiff: revendedoresAtivosCalc - revendedoresRanking,
      itensDiff: itensCalc - itensRanking,
      valorDiff: valorCalc - valorRanking,
      revendedoresCobertura:
        revendedoresRanking > 0
          ? Math.round((revendedoresAtivosCalc / revendedoresRanking) * 1000) / 10
          : revendedoresAtivosCalc > 0
            ? 100
            : 0,
      itensCobertura:
        itensRanking > 0
          ? Math.round((itensCalc / itensRanking) * 1000) / 10
          : itensCalc > 0
            ? 100
            : 0,
      valorCobertura:
        valorRanking > 0
          ? Math.round((valorCalc / valorRanking) * 1000) / 10
          : valorCalc > 0
            ? 100
            : 0,
      hasRanking: !!ranking,
      hasDetail: !!calc,
      activeRevendedores: calc?.activeList ?? [],
    };

    rows.push(row);
  }

  // Sort rows by setor name
  rows.sort((a, b) => a.setor.localeCompare(b.setor, 'pt-BR'));

  // Step 4: Calculate totals
  const totals = calculateTotals(rows, rankingData);

  result.rows = rows;
  result.totals = totals;
  result.success = true;

  return result;
}

/**
 * Calculate totals from sector activity rows
 */
function calculateTotals(
  rows: SectorActivityRow[],
  rankingData: RankingData | null
): SectorActivityTotals {
  let revendedoresAtivosCalc = 0;
  let itensCalc = 0;
  let valorCalc = 0;
  let setoresComDiff = 0;

  // Collect unique revendedores across all sectors
  const uniqueRevendedores = new Set<string>();

  for (const row of rows) {
    // Use unique revendedores for total count
    for (const rev of row.activeRevendedores) {
      uniqueRevendedores.add(rev.nomeNormalized);
    }
    itensCalc += row.itensCalc;
    valorCalc += row.valorCalc;

    // Count sectors with differences
    if (row.revendedoresDiff !== 0 || row.itensDiff !== 0 || row.valorDiff !== 0) {
      setoresComDiff++;
    }
  }

  revendedoresAtivosCalc = uniqueRevendedores.size;

  // Get ranking totals
  const revendedoresRanking = rankingData?.totalRevendedores ?? 0;
  const itensRanking = rankingData?.totalItens ?? 0;
  const valorRanking = rankingData?.totalValor ?? 0;

  return {
    revendedoresAtivosCalc,
    itensCalc,
    valorCalc,
    revendedoresRanking,
    itensRanking,
    valorRanking,
    revendedoresDiff: revendedoresAtivosCalc - revendedoresRanking,
    itensDiff: itensCalc - itensRanking,
    valorDiff: valorCalc - valorRanking,
    revendedoresCobertura:
      revendedoresRanking > 0
        ? Math.round((revendedoresAtivosCalc / revendedoresRanking) * 1000) / 10
        : revendedoresAtivosCalc > 0
          ? 100
          : 0,
    itensCobertura:
      itensRanking > 0 ? Math.round((itensCalc / itensRanking) * 1000) / 10 : itensCalc > 0 ? 100 : 0,
    valorCobertura:
      valorRanking > 0 ? Math.round((valorCalc / valorRanking) * 1000) / 10 : valorCalc > 0 ? 100 : 0,
    setoresCount: rows.length,
    setoresComDiff,
  };
}

/**
 * Get available ciclos from brand items (unique ciclos across all brands)
 */
export function getAvailableCiclos(brandItems: Map<BrandId, Item[]>): string[] {
  const ciclos = new Set<string>();

  for (const items of brandItems.values()) {
    for (const item of items) {
      if (item.cicloCaptacao && item.cicloCaptacao !== 'Não informado') {
        ciclos.add(item.cicloCaptacao);
      }
    }
  }

  return Array.from(ciclos).sort();
}

/**
 * Build base customer names set from O Boticário (Tipo=Venda only)
 */
export function buildBaseCustomerNames(boticarioItems: Item[]): Set<string> {
  const baseNames = new Set<string>();

  for (const item of boticarioItems) {
    if (item.tipo === 'Venda') {
      baseNames.add(item.nomeRevendedoraNormalized);
    }
  }

  return baseNames;
}
