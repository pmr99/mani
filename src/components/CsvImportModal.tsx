import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { parseFidelityCsv, parseGenericCsv, type CsvParseResult } from '../lib/csvParsers'
import { formatCurrency } from '../lib/engines/utils'

interface CsvImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CsvImportModal({ onClose, onSuccess }: CsvImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [institutionName, setInstitutionName] = useState('Fidelity')
  const [format, setFormat] = useState<'fidelity' | 'generic'>('fidelity')
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = format === 'fidelity' ? parseFidelityCsv(text) : parseGenericCsv(text)
      setParseResult(result)
      setStep('preview')
    }
    reader.readAsText(file)
  }, [format])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }, [handleFile])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const doImport = async () => {
    if (!parseResult || parseResult.accounts.length === 0) return
    setStep('importing')
    setImportError(null)

    try {
      // 1. Create one plaid_items row for the CSV source
      const { data: plaidItem, error: itemErr } = await supabase
        .from('plaid_items')
        .insert({
          access_token: 'csv-import',
          institution_id: `csv_${institutionName.toLowerCase().replace(/\s+/g, '_')}`,
          institution_name: institutionName,
        })
        .select()
        .single()

      if (itemErr) throw new Error(`Failed to create institution: ${itemErr.message}`)

      // 2. Create an account + holdings for each parsed account
      for (const acct of parseResult.accounts) {
        const { data: account, error: acctErr } = await supabase
          .from('accounts')
          .insert({
            plaid_item_id: plaidItem.id,
            plaid_account_id: `csv-${institutionName.toLowerCase().replace(/\s+/g, '-')}-${acct.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
            name: `${institutionName} — ${acct.name}`,
            type: 'investment',
            subtype: acct.name.toLowerCase().includes('401') ? '401k'
              : acct.name.toLowerCase().includes('roth') ? 'roth ira'
              : acct.name.toLowerCase().includes('ira') ? 'ira'
              : 'brokerage',
            current_balance: acct.totalValue,
          })
          .select()
          .single()

        if (acctErr) throw new Error(`Failed to create account "${acct.name}": ${acctErr.message}`)

        const holdingRows = acct.holdings.map((h) => ({
          account_id: account.id,
          ticker_symbol: h.ticker_symbol,
          security_name: h.security_name,
          quantity: h.quantity,
          cost_basis: h.cost_basis,
          current_value: h.current_value,
          asset_class: h.asset_class,
        }))

        const { error: holdErr } = await supabase
          .from('investment_holdings')
          .insert(holdingRows)

        if (holdErr) throw new Error(`Failed to import holdings for "${acct.name}": ${holdErr.message}`)
      }

      setStep('done')
      onSuccess()
    } catch (err) {
      setImportError((err as Error).message)
      setStep('preview')
    }
  }

  const totalHoldings = parseResult?.accounts.reduce((s, a) => s + a.holdings.length, 0) ?? 0
  const totalValue = parseResult?.accounts.reduce((s, a) => s + a.totalValue, 0) ?? 0
  const totalCost = parseResult?.accounts.reduce((s, a) => s + a.holdings.reduce((ss, h) => ss + (h.cost_basis ?? 0), 0), 0) ?? 0

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2d3d]">
          <h2 className="text-lg font-semibold text-white">Import CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-auto flex-1">
          {step === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">CSV Format</label>
                <div className="flex gap-2">
                  {(['fidelity', 'generic'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        format === f
                          ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#818cf8]'
                          : 'border-[#2a2d3d] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {f === 'fidelity' ? 'Fidelity' : 'Other (auto-detect)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Institution Name</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#252839] border border-[#2a2d3d] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#6366f1]"
                  placeholder="e.g. Fidelity, Schwab, Vanguard"
                />
              </div>

              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#6366f1] bg-[#6366f1]/5'
                    : 'border-[#2a2d3d] hover:border-gray-500'
                }`}
              >
                <p className="text-gray-400 text-sm">
                  {dragOver ? 'Drop CSV here' : 'Drag & drop a CSV file, or click to browse'}
                </p>
                <p className="text-gray-600 text-xs mt-2">
                  {format === 'fidelity'
                    ? 'Export from Fidelity: Portfolio → Positions → Download'
                    : 'Any CSV with Symbol, Quantity, and Value columns'}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileSelect}
                />
              </div>
            </div>
          )}

          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              {parseResult.errors.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                  {parseResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-400">{e}</p>
                  ))}
                </div>
              )}

              {importError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                  <p className="text-xs text-rose-400">{importError}</p>
                </div>
              )}

              {/* Summary */}
              <div className="flex gap-4">
                <div className="bg-[#252839] rounded-lg px-4 py-3 flex-1">
                  <p className="text-xs text-gray-500">Accounts</p>
                  <p className="text-lg font-semibold text-white">{parseResult.accounts.length}</p>
                </div>
                <div className="bg-[#252839] rounded-lg px-4 py-3 flex-1">
                  <p className="text-xs text-gray-500">Holdings</p>
                  <p className="text-lg font-semibold text-white">{totalHoldings}</p>
                </div>
                <div className="bg-[#252839] rounded-lg px-4 py-3 flex-1">
                  <p className="text-xs text-gray-500">Total Value</p>
                  <p className="text-lg font-semibold text-emerald-400">{formatCurrency(totalValue)}</p>
                </div>
                <div className="bg-[#252839] rounded-lg px-4 py-3 flex-1">
                  <p className="text-xs text-gray-500">Cost Basis</p>
                  <p className="text-lg font-semibold text-white">{formatCurrency(totalCost)}</p>
                </div>
              </div>

              {/* Per-account holdings tables */}
              {parseResult.accounts.map((acct, ai) => (
                <div key={ai} className="rounded-lg border border-[#2a2d3d] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#252839] flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200">{acct.name}</span>
                    <span className="text-xs text-gray-500">{acct.holdings.length} holdings · {formatCurrency(acct.totalValue)}</span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1f2233] sticky top-0">
                        <tr className="text-left text-gray-500">
                          <th className="px-3 py-1.5 font-medium text-xs">Symbol</th>
                          <th className="px-3 py-1.5 font-medium text-xs">Name</th>
                          <th className="px-3 py-1.5 font-medium text-xs text-right">Qty</th>
                          <th className="px-3 py-1.5 font-medium text-xs text-right">Value</th>
                          <th className="px-3 py-1.5 font-medium text-xs text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2d3d]/50">
                        {acct.holdings.map((h, i) => (
                          <tr key={i} className="text-gray-300">
                            <td className="px-3 py-1.5 font-mono text-xs">{h.ticker_symbol}</td>
                            <td className="px-3 py-1.5 text-xs truncate max-w-[180px]">{h.security_name}</td>
                            <td className="px-3 py-1.5 text-xs text-right">{h.quantity.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-xs text-right text-emerald-400">{formatCurrency(h.current_value)}</td>
                            <td className="px-3 py-1.5 text-xs text-right">{h.cost_basis != null ? formatCurrency(h.cost_basis) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400 text-sm">Importing {parseResult?.accounts.length} accounts, {totalHoldings} holdings...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <span className="text-emerald-400 text-2xl">✓</span>
              </div>
              <p className="text-white font-medium">Import Complete</p>
              <p className="text-gray-500 text-sm mt-1">
                {parseResult?.accounts.length} accounts, {totalHoldings} holdings added from {institutionName}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2d3d] flex justify-end gap-3">
          {step === 'preview' && (
            <>
              <button
                onClick={() => { setParseResult(null); setStep('upload') }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={doImport}
                disabled={!parseResult || totalHoldings === 0}
                className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
              >
                Import {parseResult?.accounts.length} Accounts
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] transition-colors"
            >
              Done
            </button>
          )}
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
