import * as XLSX from 'xlsx';
import {
  BrandId,
  Item,
  ParseResult,
  TransactionType,
  DeliveryType,
  RawRow,
  BRANDS,
} from '@/types';
import { mapColumns, getColumnDisplayName } from './columnMapping';
import {
  normalizeString,
  normalizeNameForDisplay,
  parseMoneyToCents,
  parseQuantity,
} from './utils';

/**
 * Normalize transaction type
 */
function normalizeType(value: string | undefined | null): TransactionType {
  if (!value) return 'Venda';
  const normalized = normalizeString(value);

  if (normalized.includes('brinde')) return 'Brinde';
  if (normalized.includes('doacao') || normalized.includes('doação')) return 'Doação';
  if (normalized.includes('venda')) return 'Venda';

  // Default to Venda if unrecognized
  return 'Venda';
}

/**
 * Normalize delivery type
 */
function normalizeDeliveryType(value: string | undefined | null): { normalized: DeliveryType; original: string } {
  const original = value?.toString().trim() || '';
  if (!original) return { normalized: 'Outro', original: '' };

  const lower = original.toLowerCase();

  if (lower.includes('endereço') || lower.includes('endereco') || lower.includes('entrega')) {
    return { normalized: 'Entrega/Frete', original };
  }
  if (lower.includes('retirar') || lower.includes('central') || lower.includes('retirada')) {
    return { normalized: 'Retirada', original };
  }

  return { normalized: 'Outro', original };
}

/**
 * Parse a file (xlsx or csv) and extract items
 */
export async function parseFile(file: File, brandId: BrandId): Promise<ParseResult> {
  const result: ParseResult = {
    success: false,
    items: [],
    errors: [],
    warnings: [],
    rowCount: 0,
  };

  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      result.errors.push(`Arquivo vazio ou sem planilhas: ${file.name}`);
      return result;
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData: RawRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonData.length === 0) {
      result.errors.push(`Planilha vazia: ${file.name}`);
      return result;
    }

    result.rowCount = jsonData.length;

    // Get headers from the first row's keys
    const headers = Object.keys(jsonData[0]);

    // Map columns
    const { mapping, missingRequired, warnings: mappingWarnings } = mapColumns(headers);

    result.warnings.push(...mappingWarnings);

    if (missingRequired.length > 0) {
      const brandName = BRANDS[brandId].name;
      const missingNames = missingRequired.map(col => getColumnDisplayName(col as keyof typeof mapping));
      result.errors.push(
        `Colunas obrigatórias faltando em ${brandName}: ${missingNames.join(', ')}`
      );
      return result;
    }

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and has header row

      try {
        const item = parseRow(row, mapping, brandId);

        // Validate essential fields
        if (!item.nomeRevendedoraNormalized) {
          result.warnings.push(`Linha ${rowNum}: Nome da revendedora vazio, linha ignorada`);
          continue;
        }

        result.items.push(item);
      } catch (err) {
        result.warnings.push(`Linha ${rowNum}: Erro ao processar - ${err}`);
      }
    }

    if (result.items.length === 0) {
      result.errors.push(`Nenhum item válido encontrado em ${BRANDS[brandId].name}`);
      return result;
    }

    result.success = true;
  } catch (err) {
    result.errors.push(`Erro ao ler arquivo ${file.name}: ${err}`);
  }

  return result;
}

/**
 * Parse a single row into an Item
 */
function parseRow(
  row: RawRow,
  mapping: ReturnType<typeof mapColumns>['mapping'],
  brandId: BrandId
): Item {
  const getValue = (key: keyof typeof mapping): string => {
    const colName = mapping[key];
    if (!colName) return '';
    const value = row[colName];
    return value?.toString() ?? '';
  };

  const nomeOriginal = normalizeNameForDisplay(getValue('nomeRevendedora'));
  const tipoOriginal = getValue('tipo').trim();
  const deliveryInfo = normalizeDeliveryType(getValue('tipoEntrega'));

  return {
    setor: getValue('setor').trim() || 'Não informado',
    nomeRevendedora: nomeOriginal,
    nomeRevendedoraOriginal: nomeOriginal,
    nomeRevendedoraNormalized: normalizeString(nomeOriginal),
    cicloCaptacao: getValue('cicloCaptacao').trim() || 'Não informado',
    codigoProduto: getValue('codigoProduto').toString().trim(),
    nomeProduto: getValue('nomeProduto').trim() || 'Produto não identificado',
    tipo: normalizeType(tipoOriginal),
    tipoOriginal: tipoOriginal || 'Venda',
    quantidadeItens: parseQuantity(getValue('quantidadeItens')),
    valorPraticado: parseMoneyToCents(getValue('valorPraticado')),
    meioCaptacao: getValue('meioCaptacao').trim() || 'Não informado',
    tipoEntrega: deliveryInfo.normalized,
    tipoEntregaOriginal: deliveryInfo.original || 'Não informado',
    brand: brandId,
  };
}

/**
 * Read file as ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
