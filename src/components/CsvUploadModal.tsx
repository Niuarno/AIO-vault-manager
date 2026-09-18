'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function CsvUploadModal({
  isOpen,
  onClose,
  onImported,
}: CsvUploadModalProps) {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const sampleCsv = `title,sku,price,cost_price,stock_quantity,description,image_url
"Luxury Rose Bouquet - Red","FLW-ROSE-RED",1250,750,50,"Imported red roses bouquet","https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300"
"White Hydrangea Stem","FLW-HYD-WHT",450,220,100,"Single stem artificial flower","https://images.unsplash.com/photo-1508610048659-a06b669e3321?w=300"
"Ceramic Minimalist Vase - Beige","VASE-BEIGE-01",890,400,25,"Nordic matte ceramic floral vase","https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=300"`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'boyon_products_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header line and one data row.');
    }

    // Parse header
    const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Regex to parse comma-separated fields with quoted string support
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      if (!matches || matches.length === 0) continue;

      const rowObj: Record<string, string> = {};
      headers.forEach((h, colIdx) => {
        const rawVal = matches[colIdx] || '';
        rowObj[h] = rawVal.replace(/^["']|["']$/g, '').trim();
      });

      if (rowObj.title || rowObj.Title || rowObj.name) {
        rows.push(rowObj);
      }
    }
    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessCount(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          throw new Error('No valid product rows found in CSV.');
        }
        setParsedRows(parsed);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to parse CSV file.');
        setParsedRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsedRows }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import products.');
      }

      setSuccessCount(data.count || parsedRows.length);
      setTimeout(() => {
        onImported();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import products.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Upload Products by CSV</h3>
              <p className="text-[11px] text-slate-500">Bulk stock addition & catalog synchronization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Sample template download button */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-800 block">Need the standard CSV format?</span>
              <span className="text-slate-500 text-[11px]">Download our template with pre-filled columns</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Sample CSV</span>
            </button>
          </div>

          {/* File Picker Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/40 hover:bg-brand-50/20"
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-xs font-bold text-slate-700 block">
              {fileName ? fileName : 'Click to select CSV file from your computer'}
            </span>
            <span className="text-[11px] text-slate-400">Supported format: .csv</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Successfully imported {successCount} products! Refreshing inventory...</span>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Preview: {parsedRows.length} items detected</span>
                <span className="text-slate-400 text-[11px]">Showing first 5 rows</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-2.5">Title</th>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">Price</th>
                      <th className="p-2.5">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-900 truncate max-w-[180px]">
                          {row.title || row.Title || row.name}
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{row.sku || row.SKU || 'N/A'}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-700">
                          {formatCurrency(Number(row.price || row.Price || 0))}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 font-bold">
                          {row.stock_quantity || row.stock || row.quantity || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={importing || parsedRows.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all disabled:opacity-50"
          >
            {importing ? 'Importing Products...' : `Import ${parsedRows.length} Products`}
          </button>
        </div>
      </div>
    </div>
  );
}