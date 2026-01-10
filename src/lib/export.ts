import * as XLSX from 'xlsx';
import { Customer, BrandId, BRANDS, BRAND_ORDER, ActiveRevendedorJoined, SectorActiveStats } from '@/types';
import { formatNumber } from './utils';

/**
 * Export data as CSV string
 */
function generateCSV(headers: string[], rows: string[][]): string {
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Download a file in the browser
 */
function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Filter customers to ensure they have O Boticário (safety check)
 */
function filterValidCrossBuyers(customers: Customer[]): Customer[] {
  return customers.filter(c => c.brands.has('boticario') && c.brandCount >= 2);
}

/**
 * Export cross-buyers summary as CSV
 */
export function exportCrossBuyersSummaryCSV(customers: Customer[]) {
  // Ensure only valid cross-buyers (with O Boticário) are exported
  const validCustomers = filterValidCrossBuyers(customers);

  const headers = [
    'NomeRevendedora',
    'Setor',
    'MeioCaptacao',
    'QtdMarcas',
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Valor)`),
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Itens)`),
    'TotalValor',
    'TotalItens',
  ];

  const rows: string[][] = validCustomers.map(customer => {
    const brandValues = BRAND_ORDER.map(brandId => {
      const metrics = customer.brands.get(brandId);
      return metrics ? formatNumber(metrics.totalValorVenda) : '';
    });

    const brandItems = BRAND_ORDER.map(brandId => {
      const metrics = customer.brands.get(brandId);
      return metrics ? metrics.totalItensVenda.toString() : '';
    });

    // Get unique setores and meios de captação
    const setores = Array.from(customer.allSetores).filter(s => s).join('; ');
    const meiosCaptacao = Array.from(customer.allMeiosCaptacao).filter(m => m).join('; ');

    return [
      customer.nomeRevendedora,
      setores,
      meiosCaptacao,
      customer.brandCount.toString(),
      ...brandValues,
      ...brandItems,
      formatNumber(customer.totalValorVendaAllBrands),
      customer.totalItensVendaAllBrands.toString(),
    ];
  });

  const csv = generateCSV(headers, rows);
  downloadFile(csv, 'crossbuyers_resumo.csv', 'text/csv;charset=utf-8');
}

/**
 * Export detailed items as CSV (only Venda type)
 */
export function exportDetailedItemsCSV(customers: Customer[]) {
  // Ensure only valid cross-buyers (with O Boticário) are exported
  const validCustomers = filterValidCrossBuyers(customers);

  const headers = [
    'Marca',
    'NomeRevendedora',
    'Setor',
    'CicloCaptacao',
    'CodigoProduto',
    'NomeProduto',
    'QuantidadeItens',
    'ValorPraticado',
    'MeioCaptacao',
    'TipoEntrega',
  ];

  const rows: string[][] = [];

  for (const customer of validCustomers) {
    for (const brandId of BRAND_ORDER) {
      const metrics = customer.brands.get(brandId);
      if (!metrics) continue;

      for (const item of metrics.items) {
        // Only export Venda type
        if (item.tipo !== 'Venda') continue;

        rows.push([
          BRANDS[brandId].name,
          customer.nomeRevendedora,
          item.setor,
          item.cicloCaptacao,
          item.codigoProduto,
          item.nomeProduto,
          item.quantidadeItens.toString(),
          formatNumber(item.valorPraticado),
          item.meioCaptacao,
          item.tipoEntrega,
        ]);
      }
    }
  }

  const csv = generateCSV(headers, rows);
  downloadFile(csv, 'crossbuyers_detalhado.csv', 'text/csv;charset=utf-8');
}

/**
 * Export customer detail as CSV (only Venda type)
 */
export function exportCustomerCSV(customer: Customer, brandId?: BrandId) {
  const headers = [
    'Marca',
    'Setor',
    'CicloCaptacao',
    'CodigoProduto',
    'NomeProduto',
    'QuantidadeItens',
    'ValorPraticado',
    'MeioCaptacao',
    'TipoEntrega',
  ];

  const rows: string[][] = [];
  const brandsToExport = brandId ? [brandId] : BRAND_ORDER;

  for (const bid of brandsToExport) {
    const metrics = customer.brands.get(bid);
    if (!metrics) continue;

    for (const item of metrics.items) {
      // Only export Venda type
      if (item.tipo !== 'Venda') continue;

      rows.push([
        BRANDS[bid].name,
        item.setor,
        item.cicloCaptacao,
        item.codigoProduto,
        item.nomeProduto,
        item.quantidadeItens.toString(),
        formatNumber(item.valorPraticado),
        item.meioCaptacao,
        item.tipoEntrega,
      ]);
    }
  }

  const csv = generateCSV(headers, rows);
  const filename = brandId
    ? `${customer.nomeRevendedora}_${BRANDS[brandId].shortName}.csv`
    : `${customer.nomeRevendedora}_consolidado.csv`;

  downloadFile(csv, filename.replace(/[^a-zA-Z0-9_.-]/g, '_'), 'text/csv;charset=utf-8');
}

/**
 * Export cross-buyers as XLSX workbook (only Venda type)
 */
export function exportCrossBuyersXLSX(customers: Customer[]) {
  // Ensure only valid cross-buyers (with O Boticário) are exported
  const validCustomers = filterValidCrossBuyers(customers);

  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryHeaders = [
    'NomeRevendedora',
    'Setor',
    'MeioCaptacao',
    'QtdMarcas',
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Valor)`),
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Itens)`),
    'TotalValor',
    'TotalItens',
  ];

  const summaryRows = validCustomers.map(customer => {
    const brandValues = BRAND_ORDER.map(brandId => {
      const metrics = customer.brands.get(brandId);
      return metrics ? metrics.totalValorVenda / 100 : '';
    });

    const brandItems = BRAND_ORDER.map(brandId => {
      const metrics = customer.brands.get(brandId);
      return metrics ? metrics.totalItensVenda : '';
    });

    // Get unique setores and meios de captação
    const setores = Array.from(customer.allSetores).filter(s => s).join('; ');
    const meiosCaptacao = Array.from(customer.allMeiosCaptacao).filter(m => m).join('; ');

    return [
      customer.nomeRevendedora,
      setores,
      meiosCaptacao,
      customer.brandCount,
      ...brandValues,
      ...brandItems,
      customer.totalValorVendaAllBrands / 100,
      customer.totalItensVendaAllBrands,
    ];
  });

  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

  // Detailed sheet
  const detailHeaders = [
    'Marca',
    'NomeRevendedora',
    'Setor',
    'CicloCaptacao',
    'CodigoProduto',
    'NomeProduto',
    'QuantidadeItens',
    'ValorPraticado',
    'MeioCaptacao',
    'TipoEntrega',
  ];

  const detailRows: (string | number)[][] = [];

  for (const customer of validCustomers) {
    for (const brandId of BRAND_ORDER) {
      const metrics = customer.brands.get(brandId);
      if (!metrics) continue;

      for (const item of metrics.items) {
        // Only export Venda type
        if (item.tipo !== 'Venda') continue;

        detailRows.push([
          BRANDS[brandId].name,
          customer.nomeRevendedora,
          item.setor,
          item.cicloCaptacao,
          item.codigoProduto,
          item.nomeProduto,
          item.quantidadeItens,
          item.valorPraticado / 100,
          item.meioCaptacao,
          item.tipoEntrega,
        ]);
      }
    }
  }

  const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalhado');

  // Download
  const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadFile(blob, 'crossbuyers_relatorio.xlsx', '');
}

/**
 * Export active revendedores as CSV
 */
export function exportActiveRevendedoresCSV(activeRevendedores: ActiveRevendedorJoined[]) {
  // Check if any revendedor has billing data
  const hasBillingData = activeRevendedores.some(a => a.hasVendaFaturada !== undefined);

  const headers = [
    'Setor',
    'CodigoRevendedora',
    'NomeRevendedora',
    'Ciclo',
    'Marcas',
    'VendaRegistrada',
    'ÉCrossbuyerRegistrado',
    ...(hasBillingData ? ['VendaFaturada', 'ÉCrossbuyerFaturado'] : []),
    'BaseOBoticario',
    'ItensVenda',
    'ValorVenda',
    'Inconsistencias',
  ];

  const rows: string[][] = activeRevendedores.map((active) => {
    const marcas = Array.from(active.brands.keys())
      .map(b => BRANDS[b].shortName)
      .join('; ');

    const inconsistências = active.inconsistencies.join(' | ');

    const baseRow = [
      active.setor,
      active.codigoRevendedoraOriginal || active.codigoRevendedora,
      active.nomeRevendedora,
      active.cicloCaptacao || '',
      marcas || '',
      active.hasVendaRegistrada ? 'Sim' : 'Não',
      active.isCrossbuyerRegistrado ? 'Sim' : 'Não',
    ];

    if (hasBillingData) {
      baseRow.push(
        active.hasVendaFaturada ? 'Sim' : 'Não',
        active.isCrossbuyerFaturado ? 'Sim' : 'Não'
      );
    }

    baseRow.push(
      active.existsInBoticario ? 'Sim' : 'Não',
      active.totalItensVendaAllBrands.toString(),
      formatNumber(active.totalValorVendaAllBrands),
      inconsistências || ''
    );

    return baseRow;
  });

  const csv = generateCSV(headers, rows);
  downloadFile(csv, 'revendedores_venda_registrada.csv', 'text/csv;charset=utf-8');
}

/**
 * Export active revendedores by sector as CSV
 */
export function exportAtivosPorSetorCSV(sectorStats: SectorActiveStats[]) {
  // Check if any sector has billing data
  const hasBillingData = sectorStats.some(s => s.totalFaturados > 0 || s.gapRegistradoFaturado !== 0);

  const headers = [
    'Setor',
    'TotalRegistrados',
    ...(hasBillingData ? ['TotalFaturados', 'Gap'] : []),
    'BaseOBoticario',
    'CrossbuyersRegistrados',
    'PercentualCrossbuyerRegistrados',
    ...(hasBillingData ? ['CrossbuyersFaturados', 'PercentualCrossbuyerFaturados'] : []),
    'ValorTotal',
    'ItensTotal',
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Valor)`),
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Itens)`),
  ];

  const rows: string[][] = sectorStats.map((sector) => {
    const brandValues = BRAND_ORDER.map(brandId => formatNumber(sector.valorPorMarca[brandId] || 0));
    const brandItems = BRAND_ORDER.map(brandId => (sector.itensPorMarca[brandId] || 0).toString());
    const valorTotal = Object.values(sector.valorPorMarca).reduce((sum, v) => sum + v, 0);
    const itensTotal = Object.values(sector.itensPorMarca).reduce((sum, v) => sum + v, 0);

    const baseRow = [
      sector.setor,
      sector.totalRegistrados.toString(),
    ];

    if (hasBillingData) {
      baseRow.push(
        sector.totalFaturados.toString(),
        sector.gapRegistradoFaturado.toString()
      );
    }

    baseRow.push(
      sector.registradosBaseBoticario.toString(),
      sector.crossbuyersRegistrados.toString(),
      sector.percentCrossbuyerRegistrados.toFixed(2) + '%'
    );

    if (hasBillingData) {
      baseRow.push(
        sector.crossbuyersFaturados.toString(),
        sector.percentCrossbuyerFaturados.toFixed(2) + '%'
      );
    }

    baseRow.push(
      formatNumber(valorTotal),
      itensTotal.toString(),
      ...brandValues,
      ...brandItems
    );

    return baseRow;
  });

  const csv = generateCSV(headers, rows);
  downloadFile(csv, 'revendedores_por_setor.csv', 'text/csv;charset=utf-8');
}

/**
 * Export active crossbuyers as CSV
 */
export function exportCrossbuyersAtivosCSV(activeRevendedores: ActiveRevendedorJoined[]) {
  // Filter only crossbuyers (registered)
  const crossbuyers = activeRevendedores.filter(a => a.isCrossbuyerRegistrado && a.existsInBoticario);

  // Check if any revendedor has billing data
  const hasBillingData = crossbuyers.some(a => a.hasVendaFaturada !== undefined);

  const headers = [
    'Setor',
    'CodigoRevendedora',
    'NomeRevendedora',
    'Ciclo',
    'QtdMarcas',
    ...(hasBillingData ? ['Faturado', 'CrossbuyerFaturado'] : []),
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Valor)`),
    ...BRAND_ORDER.map(b => `${BRANDS[b].shortName} (Itens)`),
    'TotalValor',
    'TotalItens',
    'Inconsistencias',
  ];

  const rows: string[][] = crossbuyers.map((active) => {
    const brandValues = BRAND_ORDER.map(brandId => {
      const metrics = active.brands.get(brandId);
      return metrics ? formatNumber(metrics.totalValorVenda) : '';
    });

    const brandItems = BRAND_ORDER.map(brandId => {
      const metrics = active.brands.get(brandId);
      return metrics ? metrics.totalItensVenda.toString() : '';
    });

    const inconsistências = active.inconsistencies.join(' | ');

    const baseRow = [
      active.setor,
      active.codigoRevendedoraOriginal || active.codigoRevendedora,
      active.nomeRevendedora,
      active.cicloCaptacao || '',
      active.brandCount.toString(),
    ];

    if (hasBillingData) {
      baseRow.push(
        active.hasVendaFaturada ? 'Sim' : 'Não',
        active.isCrossbuyerFaturado ? 'Sim' : 'Não'
      );
    }

    baseRow.push(
      ...brandValues,
      ...brandItems,
      formatNumber(active.totalValorVendaAllBrands),
      active.totalItensVendaAllBrands.toString(),
      inconsistências || ''
    );

    return baseRow;
  });

  const csv = generateCSV(headers, rows);
  downloadFile(csv, 'crossbuyers_venda_registrada.csv', 'text/csv;charset=utf-8');
}
