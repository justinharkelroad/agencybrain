import React, { useRef, useState } from 'react';
import { X, Download, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import {
  CalculatorInputs,
  IntermediateValues,
  TierResult,
} from '@/types/bonus-calculator';
import { formatCurrency, formatPercentage, formatNumber } from '@/utils/bonusCalculations';

interface BonusForecastReportCardProps {
  inputs: CalculatorInputs;
  intermediate: IntermediateValues;
  autoHomeResults: TierResult[];
  splResults: TierResult[];
  combinedResults: TierResult[];
  onClose: () => void;
}

export default function BonusForecastReportCard({
  inputs,
  intermediate,
  autoHomeResults,
  splResults,
  combinedResults,
  onClose,
}: BonusForecastReportCardProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPng = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `bonus-forecast-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Report exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold">Export Bonus Forecast Report</h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportPng}
              disabled={isExporting}
              className="gap-2"
            >
              <FileImage className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Download PNG'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-4">
          <div
            ref={reportRef}
            className="bg-white text-gray-900 p-8 rounded-lg"
            style={{ minWidth: '800px' }}
          >
            {/* Report Header */}
            <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Annual Bonus Production Forecast
              </h1>
              <p className="text-sm text-gray-500">{currentDate}</p>
            </div>

            {/* Portfolio Summary */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Portfolio Summary
              </h2>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-gray-500 text-xs">Est. Year-End Premium</p>
                  <p className="font-bold text-lg">{formatCurrency(inputs.estimatedYearEndPremium)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-gray-500 text-xs">Auto+Home Items</p>
                  <p className="font-bold text-lg">{formatNumber(intermediate.autoHomeBaselineItems)}</p>
                  <p className="text-xs text-gray-400">{formatNumber(intermediate.autoHomePointsPerItem, 1)} pts/item</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-gray-500 text-xs">SPL Items</p>
                  <p className="font-bold text-lg">{formatNumber(intermediate.splBaselineItems)}</p>
                  <p className="text-xs text-gray-400">{formatNumber(intermediate.splPointsPerItem, 1)} pts/item</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-gray-500 text-xs">Total Baseline Items</p>
                  <p className="font-bold text-lg">{formatNumber(intermediate.totalBaselineItems)}</p>
                </div>
              </div>
            </div>

            {/* Auto & Home Results */}
            {autoHomeResults.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Auto & Home Production Targets
                </h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left px-3 py-2 font-medium border">PG Target</th>
                      <th className="text-right px-3 py-2 font-medium border">Bonus %</th>
                      <th className="text-right px-3 py-2 font-medium border">Est. Bonus</th>
                      <th className="text-right px-3 py-2 font-medium border">Annual Items</th>
                      <th className="text-right px-3 py-2 font-bold border bg-amber-100 text-amber-800">
                        ⭐ Monthly Items
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoHomeResults.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border font-medium">{formatNumber(row.pgPointTarget)}</td>
                        <td className="text-right px-3 py-2 border">{formatPercentage(row.bonusPercentage)}</td>
                        <td className="text-right px-3 py-2 border text-green-700 font-medium">
                          {formatCurrency(row.estimatedBonus)}
                        </td>
                        <td className="text-right px-3 py-2 border">{formatNumber(row.annualItemsNeeded, 0)}</td>
                        <td className="text-right px-3 py-2 border bg-amber-50 font-bold text-amber-800">
                          {formatNumber(row.monthlyItemsNeeded, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SPL Results */}
            {splResults.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  SPL Production Targets
                </h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left px-3 py-2 font-medium border">PG Target</th>
                      <th className="text-right px-3 py-2 font-medium border">Bonus %</th>
                      <th className="text-right px-3 py-2 font-medium border">Est. Bonus</th>
                      <th className="text-right px-3 py-2 font-medium border">Annual Items</th>
                      <th className="text-right px-3 py-2 font-bold border bg-amber-100 text-amber-800">
                        ⭐ Monthly Items
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {splResults.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border font-medium">{formatNumber(row.pgPointTarget)}</td>
                        <td className="text-right px-3 py-2 border">{formatPercentage(row.bonusPercentage)}</td>
                        <td className="text-right px-3 py-2 border text-green-700 font-medium">
                          {formatCurrency(row.estimatedBonus)}
                        </td>
                        <td className="text-right px-3 py-2 border">{formatNumber(row.annualItemsNeeded, 0)}</td>
                        <td className="text-right px-3 py-2 border bg-amber-50 font-bold text-amber-800">
                          {formatNumber(row.monthlyItemsNeeded, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Combined Results */}
            {combinedResults.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Combined Production Targets (Auto/Home + SPL)
                </h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="text-left px-3 py-2 font-medium border">Combined PG</th>
                      <th className="text-right px-3 py-2 font-medium border">Total Bonus %</th>
                      <th className="text-right px-3 py-2 font-medium border">Est. Total Bonus</th>
                      <th className="text-right px-3 py-2 font-medium border">Annual Items</th>
                      <th className="text-right px-3 py-2 font-bold border bg-amber-200 text-amber-900">
                        ⭐ Monthly Items
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedResults.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-blue-50/50' : 'bg-white'}>
                        <td className="px-3 py-2 border font-medium">{formatNumber(row.pgPointTarget)}</td>
                        <td className="text-right px-3 py-2 border">{formatPercentage(row.bonusPercentage)}</td>
                        <td className="text-right px-3 py-2 border text-green-700 font-bold">
                          {formatCurrency(row.estimatedBonus)}
                        </td>
                        <td className="text-right px-3 py-2 border">{formatNumber(row.annualItemsNeeded, 0)}</td>
                        <td className="text-right px-3 py-2 border bg-amber-100 font-bold text-amber-900 text-base">
                          {formatNumber(row.monthlyItemsNeeded, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Assumptions */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Calculation Assumptions
              </h3>
              <div className="text-xs text-gray-500 grid grid-cols-2 gap-2">
                <div>• Auto Retention: {inputs.autoRetention}%</div>
                <div>• Home Retention: {inputs.homeRetention}%</div>
                <div>• SPL Retention: {inputs.splRetention}%</div>
                <div>• New Business Retention: {inputs.newBusinessRetention}%</div>
                <div>• New Business Cushion: {inputs.newBusinessCushion}%</div>
                <div>• Point Values: Auto=10, Home=20, SPL=7.5</div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400 italic">
                Generated by AgencyBrain • These are estimates to help guide production goals
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
