import React, { useMemo, useState } from 'react';
import { BarChart2, Trophy, TrendingUp, TrendingDown, Layers, PieChart } from 'lucide-react';
import { MultiStructurePnLChart, DailyPnLChart } from './Charts';
import { rankStructures, calculatePortfolioStats, calculateDailySummary } from '../utils/insightsGenerator';
import { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT } from '../utils/fifoCalculator';

export default function Analytics({ structuresData }) {
    const [selectedChartType, setSelectedChartType] = useState('cumulative');

    const portfolioStats = useMemo(() =>
        calculatePortfolioStats(structuresData),
        [structuresData]
    );

    const dailySummary = useMemo(() =>
        calculateDailySummary(structuresData),
        [structuresData]
    );

    const rankedStructures = useMemo(() =>
        rankStructures(structuresData),
        [structuresData]
    );

    const formatDollars = (value) => {
        if (value === undefined || value === null) return '$0.00';
        const prefix = value >= 0 ? '+' : '';
        return prefix + '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    if (structuresData.length === 0) {
        return (
            <div className="empty-state">
                <BarChart2 size={80} />
                <h3>No Analytics Yet</h3>
                <p>Add some trades to see performance analytics</p>
            </div>
        );
    }

    return (
        <div className="analytics-container">
            <div className="analytics-main">
                {/* Portfolio Summary */}
                <div className="analytics-section">
                    <h2 className="section-title">
                        <PieChart size={20} />
                        Portfolio Summary
                    </h2>

                    <div className="portfolio-summary-grid">
                        <div className="summary-stat primary">
                            <div className={`value ${portfolioStats.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                                {formatDollars(portfolioStats.totalPnL)}
                            </div>
                            <div className="label">Net P&L</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value">{formatDollars(portfolioStats.totalGross)}</div>
                            <div className="label">Gross P&L</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value negative">-${portfolioStats.totalRT.toFixed(2)}</div>
                            <div className="label">RT Costs ({portfolioStats.rtCostRatio.toFixed(1)}%)</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value">{portfolioStats.overallWinRate.toFixed(1)}%</div>
                            <div className="label">Win Rate</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value">{portfolioStats.totalTrades}</div>
                            <div className="label">Total Trades</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value">{formatDollars(portfolioStats.pnlPerTrade)}</div>
                            <div className="label">P&L / Trade</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value">{formatDollars(portfolioStats.pnlPerLot)}</div>
                            <div className="label">P&L / Lot</div>
                        </div>
                        <div className="summary-stat">
                            <div className="value">{portfolioStats.totalVolume}</div>
                            <div className="label">Total Volume</div>
                        </div>
                    </div>
                </div>

                {/* P&L by Structure Type */}
                <div className="analytics-section">
                    <h2 className="section-title">
                        <Layers size={20} />
                        P&L by Structure Type
                    </h2>

                    <div className="type-breakdown-grid">
                        {Object.entries(portfolioStats.pnlByType)
                            .sort((a, b) => b[1].pnl - a[1].pnl)
                            .map(([type, data]) => (
                                <div key={type} className={`type-card ${data.pnl >= 0 ? 'positive' : 'negative'}`}>
                                    <div className="type-name">{type}</div>
                                    <div className={`type-pnl ${data.pnl >= 0 ? 'positive' : 'negative'}`}>
                                        {formatDollars(data.pnl)}
                                    </div>
                                    <div className="type-meta">
                                        {data.count} structures • {data.trades} trades
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Charts */}
                <div className="analytics-section">
                    <div className="chart-header">
                        <h2 className="section-title">
                            <TrendingUp size={20} />
                            P&L Charts
                        </h2>
                        <div className="chart-type-selector">
                            <button
                                className={selectedChartType === 'cumulative' ? 'active' : ''}
                                onClick={() => setSelectedChartType('cumulative')}
                            >
                                Cumulative
                            </button>
                            <button
                                className={selectedChartType === 'daily' ? 'active' : ''}
                                onClick={() => setSelectedChartType('daily')}
                            >
                                Daily
                            </button>
                            <button
                                className={selectedChartType === 'structures' ? 'active' : ''}
                                onClick={() => setSelectedChartType('structures')}
                            >
                                By Structure
                            </button>
                        </div>
                    </div>

                    {selectedChartType === 'daily' && (
                        <DailyPnLChart data={dailySummary} />
                    )}

                    {selectedChartType === 'cumulative' && (
                        <div className="chart-container">
                            <DailyPnLChart data={dailySummary} showCumulative />
                        </div>
                    )}

                    {selectedChartType === 'structures' && (
                        <MultiStructurePnLChart structuresData={rankedStructures.slice(0, 10)} />
                    )}
                </div>
            </div>

            {/* Rankings Sidebar */}
            <div className="analytics-sidebar">
                <div className="analytics-section">
                    <h2 className="section-title">
                        <Trophy size={20} />
                        Performance Rankings
                    </h2>

                    <div className="rankings-list">
                        {rankedStructures.map((structure, index) => (
                            <div key={structure.name} className="ranking-item">
                                <div className={`ranking-position ${index === 0 ? 'top-1' :
                                        index === 1 ? 'top-2' :
                                            index === 2 ? 'top-3' : 'default'
                                    }`}>
                                    {index + 1}
                                </div>
                                <div className="ranking-info">
                                    <div className="ranking-name">{structure.name}</div>
                                    <div className="ranking-meta">
                                        {structure.stats?.totalTrades || 0} trades •
                                        {(structure.stats?.winRate || 0).toFixed(0)}% win
                                    </div>
                                </div>
                                <div className={`ranking-pnl ${(structure.realizedPnLDollars || 0) >= 0 ? 'positive' : 'negative'}`}>
                                    {formatDollars(structure.realizedPnLDollars)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trading Constants */}
                <div className="analytics-section">
                    <h3 className="section-title" style={{ fontSize: '0.9rem' }}>Trading Constants</h3>
                    <div className="constants-display">
                        <div><span>Tick Value:</span> <strong>${TICK_VALUE}</strong></div>
                        <div><span>Tick Size:</span> <strong>{TICK_SIZE}</strong></div>
                        <div><span>RT Cost:</span> <strong>${RT_COST_PER_LOT}/leg</strong></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
