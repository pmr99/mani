import Papa from 'papaparse'

export interface ParsedHolding {
  ticker_symbol: string
  security_name: string
  quantity: number
  cost_basis: number | null
  current_value: number
  asset_class: string
}

export interface CsvParseResult {
  holdings: ParsedHolding[]
  accountName: string | null
  errors: string[]
}

// Guess asset class from ticker symbol and description
function guessAssetClass(symbol: string, description?: string): string {
  if (!symbol || symbol === 'Cash' || symbol === 'SPAXX' || symbol === 'FDRXX' || symbol === 'FCASH')
    return 'cash'
  const desc = (description || '').toUpperCase()
  if (desc.includes('MONEY MARKET') || desc.includes('HELD IN')) return 'cash'
  if (desc.includes('INDEX FUND') || desc.includes('MUTUAL FUND') || symbol.length === 5 && symbol.endsWith('X'))
    return 'mutual_fund'
  if (desc.includes('ETF')) return 'etf'
  return 'stock'
}

// Strip dollar signs, commas, and whitespace from value strings
function parseNumber(val: string | undefined): number | null {
  if (!val) return null
  const cleaned = val.replace(/[$,\s]/g, '').trim()
  if (cleaned === '' || cleaned === '--' || cleaned === 'n/a') return null
  const num = Number(cleaned)
  return isNaN(num) ? null : num
}

// ─── Fidelity Positions CSV ──────────────────────────────────────────────────
// Exported from: Fidelity.com → Positions → Download
// Columns: Account Number/Name, Symbol, Description, Quantity, Last Price,
//          Last Price Change, Current Value, Today's Gain/Loss Dollar/Percent,
//          Total Gain/Loss Dollar/Percent, Cost Basis Per Share, Cost Basis Total, ...

export function parseFidelityCsv(csvText: string): CsvParseResult {
  const errors: string[] = []
  let accountName: string | null = null

  // Fidelity CSVs have trailing commas on every row and disclaimer text at the bottom.
  // Strip trailing commas per line, and remove disclaimer lines (start with ")
  const cleanedLines = csvText
    .split('\n')
    .filter((line) => !line.startsWith('"') && line.trim() !== '')
    .map((line) => line.replace(/,\s*$/, ''))
    .join('\n')

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(cleanedLines, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  // Only report non-field-count errors (trailing commas are already handled)
  if (parseErrors.length > 0) {
    const real = parseErrors.filter((e) => e.type !== 'FieldMismatch')
    errors.push(...real.map((e) => `Row ${e.row}: ${e.message}`))
  }

  const holdings: ParsedHolding[] = []

  for (const row of data) {
    // Try to extract account name from first row
    if (!accountName) {
      accountName = row['Account Name'] || row['Account Name/Number'] || null
    }

    // Get symbol — skip rows without one (totals/summary rows)
    let symbol = (row['Symbol'] || '').trim()
    if (!symbol || symbol === '' || symbol.toLowerCase() === 'symbol') continue

    // Strip Fidelity's ** suffix (e.g. FCASH**, SPAXX**)
    symbol = symbol.replace(/\*+$/, '')

    // Track account name from Account Name column
    const rowAcct = (row['Account Name'] || row['Account Name/Number'] || '').trim()
    if (!accountName && rowAcct) accountName = rowAcct

    const description = (row['Description'] || row['Security Description'] || '').trim()
    const quantity = parseNumber(row['Quantity'])
    const costBasis = parseNumber(row['Cost Basis Total'] || row['Cost Basis'])
    const currentValue = parseNumber(row['Current Value'])

    // Skip rows with no value (summary/footer rows)
    if (currentValue === null && quantity === null) continue

    holdings.push({
      ticker_symbol: symbol,
      security_name: description || symbol,
      quantity: quantity ?? 0,
      cost_basis: costBasis,
      current_value: currentValue ?? 0,
      asset_class: guessAssetClass(symbol, description),
    })
  }

  if (holdings.length === 0) {
    errors.push('No holdings found in CSV. Make sure you exported Positions (not Activity) from Fidelity.')
  }

  return { holdings, accountName, errors }
}

// ─── Generic CSV (fallback) ──────────────────────────────────────────────────
// For Schwab, Vanguard, or any brokerage with a positions export.
// Attempts to auto-detect common column names.

const SYMBOL_COLS = ['Symbol', 'Ticker', 'Ticker Symbol', 'symbol', 'ticker']
const NAME_COLS = ['Description', 'Security Description', 'Security Name', 'Name', 'Security', 'description', 'name']
const QTY_COLS = ['Quantity', 'Shares', 'Qty', 'quantity', 'shares']
const VALUE_COLS = ['Current Value', 'Market Value', 'Value', 'current value', 'market value']
const COST_COLS = ['Cost Basis Total', 'Cost Basis', 'Total Cost', 'cost basis', 'Cost Basis Per Share']

function findCol(row: Record<string, string>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c]
  }
  return undefined
}

export function parseGenericCsv(csvText: string): CsvParseResult {
  const errors: string[] = []

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (parseErrors.length > 0) {
    errors.push(...parseErrors.map((e) => `Row ${e.row}: ${e.message}`))
  }

  const holdings: ParsedHolding[] = []

  for (const row of data) {
    const symbol = (findCol(row, SYMBOL_COLS) || '').trim()
    if (!symbol) continue

    const description = (findCol(row, NAME_COLS) || '').trim()
    const quantity = parseNumber(findCol(row, QTY_COLS))
    const currentValue = parseNumber(findCol(row, VALUE_COLS))
    const costBasis = parseNumber(findCol(row, COST_COLS))

    if (currentValue === null && quantity === null) continue

    holdings.push({
      ticker_symbol: symbol,
      security_name: description || symbol,
      quantity: quantity ?? 0,
      cost_basis: costBasis,
      current_value: currentValue ?? 0,
      asset_class: guessAssetClass(symbol, description),
    })
  }

  if (holdings.length === 0) {
    errors.push('No holdings found. Make sure the CSV has columns like Symbol, Quantity, and Current Value.')
  }

  return { holdings, accountName: null, errors }
}
