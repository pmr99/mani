import Papa from 'papaparse'

export interface ParsedHolding {
  ticker_symbol: string
  security_name: string
  quantity: number
  cost_basis: number | null
  current_value: number
  asset_class: string
}

export interface ParsedAccount {
  name: string
  holdings: ParsedHolding[]
  totalValue: number
}

export interface CsvParseResult {
  accounts: ParsedAccount[]
  errors: string[]
}

// Guess asset class from ticker symbol and description
function guessAssetClass(symbol: string, description?: string): string {
  if (!symbol || symbol === 'Cash' || symbol === 'SPAXX' || symbol === 'FDRXX' || symbol === 'FCASH')
    return 'cash'
  const desc = (description || '').toUpperCase()
  if (desc.includes('MONEY MARKET') || desc.includes('HELD IN')) return 'cash'
  if (desc.includes('INDEX FUND') || desc.includes('MUTUAL FUND') || (symbol.length === 5 && symbol.endsWith('X')))
    return 'mutual_fund'
  if (desc.includes('ETF')) return 'etf'
  return 'stock'
}

// Strip dollar signs, commas, and whitespace from value strings
function parseNumber(val: string | undefined): number | null {
  if (!val) return null
  const cleaned = val.replace(/[$,\s]/g, '').replace(/^\+/, '').trim()
  if (cleaned === '' || cleaned === '--' || cleaned === 'n/a') return null
  const num = Number(cleaned)
  return isNaN(num) ? null : num
}

// ─── Fidelity Positions CSV ──────────────────────────────────────────────────

export function parseFidelityCsv(csvText: string): CsvParseResult {
  const errors: string[] = []

  // Let PapaParse handle line endings natively (handles \r\n, \r, \n, BOM, etc.)
  // Skip disclaimer lines at bottom (start with ") via comments option
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    comments: '"',
  })

  if (parseErrors.length > 0) {
    // Ignore FieldMismatch (trailing commas create an extra empty column — harmless)
    const real = parseErrors.filter((e) => e.type !== 'FieldMismatch')
    errors.push(...real.map((e) => `Row ${e.row}: ${e.message}`))
  }

  // Group holdings by account name
  const accountMap = new Map<string, ParsedHolding[]>()

  for (const row of data) {
    let symbol = (row['Symbol'] || '').trim()
    if (!symbol || symbol.toLowerCase() === 'symbol') continue

    // Strip Fidelity's ** suffix (e.g. FCASH**, SPAXX**)
    symbol = symbol.replace(/\*+$/, '')

    const acctName = (row['Account Name'] || row['Account Name/Number'] || 'Unknown').trim()
    const description = (row['Description'] || row['Security Description'] || '').trim()
    const quantity = parseNumber(row['Quantity'])
    const costBasis = parseNumber(row['Cost Basis Total'] || row['Cost Basis'])
    const currentValue = parseNumber(row['Current Value'])

    // Skip rows with no value (summary/footer rows)
    if (currentValue === null && quantity === null) continue

    if (!accountMap.has(acctName)) accountMap.set(acctName, [])
    accountMap.get(acctName)!.push({
      ticker_symbol: symbol,
      security_name: description || symbol,
      quantity: quantity ?? 0,
      cost_basis: costBasis,
      current_value: currentValue ?? 0,
      asset_class: guessAssetClass(symbol, description),
    })
  }

  const accounts: ParsedAccount[] = [...accountMap.entries()].map(([name, holdings]) => ({
    name,
    holdings,
    totalValue: holdings.reduce((s, h) => s + h.current_value, 0),
  }))

  if (accounts.length === 0) {
    errors.push('No holdings found in CSV. Make sure you exported Positions (not Activity) from Fidelity.')
  }

  return { accounts, errors }
}

// ─── Schwab Positions CSV ────────────────────────────────────────────────────
// Exported from: Schwab.com → Accounts → Positions → Export → CSV
// Has a title row on line 1 ("Positions for account..."), empty line 2, then headers on line 3.
// All values are quoted. Column names include parenthetical aliases like "Qty (Quantity)".

export function parseSchwabCsv(csvText: string): CsvParseResult {
  const errors: string[] = []

  // Find the actual header row — skip title lines until we find one with "Symbol"
  const lines = csvText.split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('"Symbol"') || lines[i].includes('Symbol')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    return { accounts: [], errors: ['Could not find header row with "Symbol" column. Is this a Schwab Positions export?'] }
  }

  // Extract account name from the title row
  let accountName = 'Schwab'
  const titleMatch = lines[0]?.match(/Positions for account\s+(.+?)\s+as of/i)
  if (titleMatch) accountName = titleMatch[1].replace(/["\.]+$/g, '').trim()

  // Parse from header row onward
  const csvFromHeader = lines.slice(headerIdx).join('\n')
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvFromHeader, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.replace(/"/g, '').trim(),
  })

  if (parseErrors.length > 0) {
    const real = parseErrors.filter((e) => e.type !== 'FieldMismatch')
    errors.push(...real.map((e) => `Row ${e.row}: ${e.message}`))
  }

  const holdings: ParsedHolding[] = []

  for (const row of data) {
    const symbol = (row['Symbol'] || '').replace(/"/g, '').trim()
    // Skip summary rows, cash placeholders without symbols, and empty rows
    if (!symbol || symbol === 'Positions Total' || symbol === 'Account Total') continue

    const description = (row['Description'] || '').replace(/"/g, '').trim()
    const qtyStr = (row['Qty (Quantity)'] || row['Quantity'] || row['Qty'] || '').replace(/"/g, '').trim()
    const valueStr = (row['Mkt Val (Market Value)'] || row['Market Value'] || row['Mkt Val'] || '').replace(/"/g, '').trim()
    const costStr = (row['Cost Basis'] || '').replace(/"/g, '').trim()
    const assetType = (row['Asset Type'] || '').replace(/"/g, '').trim().toLowerCase()

    const quantity = parseNumber(qtyStr)
    const currentValue = parseNumber(valueStr)
    const costBasis = parseNumber(costStr)

    if (currentValue === null && quantity === null) continue

    // Determine asset class from Schwab's "Asset Type" column
    let asset_class = 'stock'
    if (assetType.includes('cash') || assetType.includes('money market') || symbol === 'Cash & Cash Investments') asset_class = 'cash'
    else if (assetType.includes('mutual fund')) asset_class = 'mutual_fund'
    else if (assetType.includes('etf')) asset_class = 'etf'
    else if (assetType.includes('bond') || assetType.includes('fixed income')) asset_class = 'bond'

    holdings.push({
      ticker_symbol: symbol === 'Cash & Cash Investments' ? 'CASH' : symbol,
      security_name: description || symbol,
      quantity: quantity ?? 0,
      cost_basis: costBasis,
      current_value: currentValue ?? 0,
      asset_class,
    })
  }

  if (holdings.length === 0) {
    errors.push('No holdings found. Make sure you exported Positions (not History) from Schwab.')
  }

  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0)
  return { accounts: [{ name: accountName, holdings, totalValue }], errors }
}

// ─── Generic CSV (fallback) ──────────────────────────────────────────────────

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

  return { accounts: [{ name: 'Investments', holdings, totalValue: holdings.reduce((s, h) => s + h.current_value, 0) }], errors }
}
