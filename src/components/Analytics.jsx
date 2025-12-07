import React, { useMemo, useState } from 'react';
import {
    BarChart2, Trophy, TrendingUp, TrendingDown, Layers,
    Target, Zap, Calendar, Clock, AlertTriangle
} from 'lucide-react';
import { MultiStructurePnLChart, DailyPnLChart } from './Charts';
import { rankStructures, calculatePortfolioStats, calculateDailySummary, calculateSharpeRatio, calculateSortinoRatio } from '../utils/insightsGenerator';
import { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT } from '../utils/fifoCalculator';

/**
 * Calculate Maximum Drawdown
 */
function calculateMaxDrawdown(dailyPnL) {
    if (!dailyPnL || dailyPnL.length === 0) return { maxDD: 0, maxDDPercent: 0 };

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const day of dailyPnL) {
        cumulative += day.pnl;
        if (cumulative > peak) peak = cumulative;
        const drawdown = peak - cumulative;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const maxDDPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    return { maxDD: maxDrawdown, maxDDPercent };
}

/**
 * Calculate win/loss streaks
 */
function calculateStreaks(matches) {
    if (!matches || matches.length === 0) return { currentStreak: 0, maxWinStreak: 0, maxLossStreak: 0 };

    let currentStreak = 0;
    let currentType = null;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let winStreak = 0;
    let lossStreak = 0;

    for (const match of matches) {
        const isWin = (match.netPnLDollars || 0) > 0;

        if (isWin) {
            winStreak++;
            lossStreak = 0;
            maxWinStreak = Math.max(maxWinStreak, winStreak);
        } else {
            lossStreak++;
            winStreak = 0;
            maxLossStreak = Math.max(maxLossStreak, lossStreak);
        }
    }

    // Current streak
    const lastIsWin = (matches[matches.length - 1]?.netPnLDollars || 0) > 0;
    currentStreak = lastIsWin ? winStreak : -lossStreak;

    return { currentStreak, maxWinStreak, maxLossStreak };
}

/**
 * Calculate expectancy
 * Expectancy = (Win% × Avg Win) - (Loss% × Avg Loss)
 */
function calculateExpectancy(matches) {
    if (!matches || matches.length === 0) return 0;

    const wins = matches.filter(m => (m.netPnLDollars || 0) > 0);
    const losses = matches.filter(m => (m.netPnLDollars || 0) < 0);

    const winRate = wins.length / matches.length;
    const lossRate = losses.length / matches.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, m) => s + m.netPnLDollars, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, m) => s + m.netPnLDollars, 0) / losses.length) : 0;

    return (winRate * avgWin) - (lossRate * avgLoss);
}

/**
 * Analyze best/worst days
 */
function analyzeDays(dailySummary) {
    if (!dailySummary || dailySummary.length === 0) return { best: null, worst: null, avgDay: 0 };

    const sorted = [...dailySummary].sort((a, b) => b.pnl - a.pnl);
    const total = dailySummary.reduce((s, d) => s + d.pnl, 0);

    return {
        best: sorted[0],
        worst: sorted[sorted.length - 1],
        avgDay: total / dailySummary.length,
        profitDays: dailySummary.filter(d => d.pnl > 0).length,
        lossDays: dailySummary.filter(d => d.pnl < 0).length
    };
}

export default function Analytics({ structuresData }) {
    const [selectedChartType, setSelectedChartType] = useState('equity');

    // All matches combined
    const allMatches = useMemo(() =>
        structuresData.flatMap(s => s.matches || []).sort((a, b) => (a.exitOrder || 0) - (b.exitOrder || 0)),
        [structuresData]
    );

    const portfolioStats = useMemo(() => calculatePortfolioStats(structuresData), [structuresData]);
    const dailySummary = useMemo(() => calculateDailySummary(structuresData), [structuresData]);
    const rankedStructures = useMemo(() => rankStructures(structuresData), [structuresData]);

    // Advanced metrics
    const advancedMetrics = useMemo(() => {
        const returns = allMatches.map(m => m.netPnLDollars || 0);
        const dailyReturns = dailySummary.map(d => d.pnl);

        return {
            sharpeRatio: calculateSharpeRatio(returns),
            sortinoRatio: calculateSortinoRatio(returns),
            ...calculateMaxDrawdown(dailySummary),
            ...calculateStreaks(allMatches),
            expectancy: calculateExpectancy(allMatches),
            ...analyzeDays(dailySummary)
        };
    }, [allMatches, dailySummary]);

    // Win rate breakdown
    const winLossAnalysis = useMemo(() => {
        const wins = allMatches.filter(m => (m.netPnLDollars || 0) > 0);
        const losses = allMatches.filter(m => (m.netPnLDollars || 0) < 0);

        return {
            winCount: wins.length,
            lossCount: losses.length,
            winRate: allMatches.length > 0 ? (wins.length / allMatches.length) * 100 : 0,
            avgWin: wins.length > 0 ? wins.reduce((s, m) => s + m.netPnLDollars, 0) / wins.length : 0,
            avgLoss: losses.length > 0 ? Math.abs(losses.reduce((s, m) => s + m.netPnLDollars, 0) / losses.length) : 0,
            largestWin: wins.length > 0 ? Math.max(...wins.map(m => m.netPnLDollars)) : 0,
            largestLoss: losses.length > 0 ? Math.min(...losses.map(m => m.netPnLDollars)) : 0,
            totalWins: wins.reduce((s, m) => s + m.netPnLDollars, 0),
            totalLosses: Math.abs(losses.reduce((s, m) => s + m.netPnLDollars, 0)),
            profitFactor: losses.length > 0
                ? wins.reduce((s, m) => s + m.netPnLDollars, 0) / Math.abs(losses.reduce((s, m) => s + m.netPnLDollars, 0))
                : wins.length > 0 ? Infinity : 0
        };
    }, [allMatches]);

    // Portfolio Tick Capture Analysis
    const tickCaptureAnalysis = useMemo(() => {
        const wins = allMatches.filter(m => (m.pnlDollars || 0) > 0);
        const losses = allMatches.filter(m => (m.pnlDollars || 0) < 0);

        if (wins.length === 0) {
            return {
                avgTicksWon: 0,
                avgTicksLost: 0,
                distribution: {},
                totalWins: 0
            };
        }

        // Calculate ticks for each trade
        const winTicks = wins.map(m => Math.round(m.pnl / TICK_SIZE));
        const lossTicks = losses.map(m => Math.abs(Math.round(m.pnl / TICK_SIZE)));

        const avgTicksWon = winTicks.reduce((s, t) => s + t, 0) / wins.length;
        const avgTicksLost = losses.length > 0 ? lossTicks.reduce((s, t) => s + t, 0) / losses.length : 0;

        // Distribution by tick count (1, 2, 3, 4, 5+)
        const distribution = {};
        for (const ticks of winTicks) {
            const bucket = ticks >= 5 ? '5+' : String(ticks);
            distribution[bucket] = (distribution[bucket] || 0) + 1;
        }

        // Convert to percentages
        const distPercent = {};
        for (const [bucket, count] of Object.entries(distribution)) {
            distPercent[bucket] = {
                count,
                percent: (count / wins.length) * 100
            };
        }

        return {
            avgTicksWon,
            avgTicksLost,
            distribution: distPercent,
            totalWins: wins.length
        };
    }, [allMatches]);

    const formatDollars = (value) => {
        if (value === undefined || value === null) return '$0.00';
        const prefix = value >= 0 ? '+' : '';
        return prefix + '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatRatio = (value) => {
        if (value === Infinity) return '∞';
        if (value === undefined || value === null || isNaN(value)) return '-';
        return value.toFixed(2);
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
                {/* Key Performance Indicators */}
                <div className="analytics-section">
                    <h2 className="section-title">
                        <Target size={20} />
                        Key Performance Indicators
                    </h2>

                    <div className="kpi-grid">
                        <div className="kpi-card primary">
                            <div className={`kpi-value ${portfolioStats.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                                {formatDollars(portfolioStats.totalPnL)}
                            </div>
                            <div className="kpi-label">Net P&L</div>
                        </div>
                        <div className="kpi-card">
                            <div className={`kpi-value ${winLossAnalysis.winRate >= 50 ? 'positive' : 'negative'}`}>
                                {winLossAnalysis.winRate.toFixed(1)}%
                            </div>
                            <div className="kpi-label">Win Rate ({winLossAnalysis.winCount}W / {winLossAnalysis.lossCount}L)</div>
                        </div>
                        <div className="kpi-card">
                            <div className={`kpi-value ${winLossAnalysis.profitFactor >= 1 ? 'positive' : 'negative'}`}>
                                {formatRatio(winLossAnalysis.profitFactor)}
                            </div>
                            <div className="kpi-label">Profit Factor</div>
                        </div>
                        <div className="kpi-card">
                            <div className={`kpi-value ${advancedMetrics.expectancy >= 0 ? 'positive' : 'negative'}`}>
                                {formatDollars(advancedMetrics.expectancy)}
                            </div>
                            <div className="kpi-label">Expectancy / Trade</div>
                        </div>
                        <div className="kpi-card">
                            <div className={`kpi-value ${advancedMetrics.sharpeRatio >= 0.5 ? 'positive' : advancedMetrics.sharpeRatio >= 0 ? '' : 'negative'}`}>
                                {formatRatio(advancedMetrics.sharpeRatio)}
                            </div>
                            <div className="kpi-label">Sharpe Ratio</div>
                        </div>
                        <div className="kpi-card">
                            <div className={`kpi-value ${advancedMetrics.sortinoRatio >= 1 ? 'positive' : advancedMetrics.sortinoRatio >= 0 ? '' : 'negative'}`}>
                                {formatRatio(advancedMetrics.sortinoRatio)}
                            </div>
                            <div className="kpi-label">Sortino Ratio</div>
                        </div>
                        <div className="kpi-card warning">
                            <div className="kpi-value negative">
                                -${advancedMetrics.maxDD.toFixed(2)}
                            </div>
                            <div className="kpi-label">Max Drawdown</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-value negative">
                                -{portfolioStats.rtCostRatio.toFixed(1)}%
                            </div>
                            <div className="kpi-label">RT Cost Drag</div>
                        </div>
                    </div>
                </div>

                {/* Win/Loss Analysis */}
                <div className="analytics-section">
                    <h2 className="section-title">
                        <Zap size={20} />
                        Win/Loss Analysis
                    </h2>

                    <div className="win-loss-grid">
                        <div className="wl-card wins">
                            <div className="wl-header">
                                <TrendingUp size={18} />
                                <span>Winning Trades</span>
                            </div>
                            <div className="wl-stats">
                                <div className="wl-stat">
                                    <span className="label">Count</span>
                                    <span className="value positive">{winLossAnalysis.winCount}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Total</span>
                                    <span className="value positive">{formatDollars(winLossAnalysis.totalWins)}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Average</span>
                                    <span className="value positive">{formatDollars(winLossAnalysis.avgWin)}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Largest</span>
                                    <span className="value positive">{formatDollars(winLossAnalysis.largestWin)}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Max Streak</span>
                                    <span className="value positive">{advancedMetrics.maxWinStreak}</span>
                                </div>
                            </div>
                        </div>

                        <div className="wl-card losses">
                            <div className="wl-header">
                                <TrendingDown size={18} />
                                <span>Losing Trades</span>
                            </div>
                            <div className="wl-stats">
                                <div className="wl-stat">
                                    <span className="label">Count</span>
                                    <span className="value negative">{winLossAnalysis.lossCount}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Total</span>
                                    <span className="value negative">-${winLossAnalysis.totalLosses.toFixed(2)}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Average</span>
                                    <span className="value negative">-${winLossAnalysis.avgLoss.toFixed(2)}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Largest</span>
                                    <span className="value negative">{formatDollars(winLossAnalysis.largestLoss)}</span>
                                </div>
                                <div className="wl-stat">
                                    <span className="label">Max Streak</span>
                                    <span className="value negative">{advancedMetrics.maxLossStreak}</span>
                                </div>
                            </div>
                        </div>

                        <div className="wl-card streak">
                            <div className="wl-header">
                                <Clock size={18} />
                                <span>Current Streak</span>
                            </div>
                            <div className={`streak-display ${advancedMetrics.currentStreak >= 0 ? 'positive' : 'negative'}`}>
                                {advancedMetrics.currentStreak >= 0
                                    ? `🔥 ${advancedMetrics.currentStreak} Wins`
                                    : `❄️ ${Math.abs(advancedMetrics.currentStreak)} Losses`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tick Capture Analysis */}
                {tickCaptureAnalysis.totalWins > 0 && (
                    <div className="analytics-section">
                        <h2 className="section-title">
                            <Zap size={20} />
                            Tick Capture Analysis
                        </h2>

                        <div className="tick-capture-grid">
                            <div className="tick-summary-cards">
                                <div className="tick-summary-card positive">
                                    <div className="tick-value">{tickCaptureAnalysis.avgTicksWon.toFixed(1)}</div>
                                    <div className="tick-label">Avg Ticks Won</div>
                                </div>
                                <div className="tick-summary-card negative">
                                    <div className="tick-value">{tickCaptureAnalysis.avgTicksLost.toFixed(1)}</div>
                                    <div className="tick-label">Avg Ticks Lost</div>
                                </div>
                                <div className="tick-summary-card ratio">
                                    <div className="tick-value">
                                        {tickCaptureAnalysis.avgTicksLost > 0
                                            ? (tickCaptureAnalysis.avgTicksWon / tickCaptureAnalysis.avgTicksLost).toFixed(2)
                                            : '∞'}
                                    </div>
                                    <div className="tick-label">Win/Loss Tick Ratio</div>
                                </div>
                            </div>

                            <div className="tick-distribution">
                                <h3 className="subsection-title">Win Distribution by Ticks</h3>
                                <div className="tick-bars">
                                    {['1', '2', '3', '4', '5+'].map(bucket => {
                                        const data = tickCaptureAnalysis.distribution[bucket];
                                        const percent = data?.percent || 0;
                                        const count = data?.count || 0;
                                        return (
                                            <div key={bucket} className="tick-bar-item">
                                                <div className="tick-bar-label">{bucket} tick{bucket !== '1' ? 's' : ''}</div>
                                                <div className="tick-bar-container">
                                                    <div
                                                        className="tick-bar-fill"
                                                        style={{ width: `${Math.min(percent, 100)}%` }}
                                                    />
                                                    <span className="tick-bar-percent">{percent.toFixed(0)}%</span>
                                                </div>
                                                <div className="tick-bar-count">{count} trades</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Day Analysis */}
                <div className="analytics-section">
                    <h2 className="section-title">
                        <Calendar size={20} />
                        Day Analysis
                    </h2>

                    <div className="day-analysis-grid">
                        {advancedMetrics.best && (
                            <div className="day-card best">
                                <div className="day-label">Best Day</div>
                                <div className="day-date">{advancedMetrics.best.date}</div>
                                <div className="day-pnl positive">{formatDollars(advancedMetrics.best.pnl)}</div>
                                <div className="day-meta">{advancedMetrics.best.trades} trades</div>
                            </div>
                        )}
                        {advancedMetrics.worst && (
                            <div className="day-card worst">
                                <div className="day-label">Worst Day</div>
                                <div className="day-date">{advancedMetrics.worst.date}</div>
                                <div className="day-pnl negative">{formatDollars(advancedMetrics.worst.pnl)}</div>
                                <div className="day-meta">{advancedMetrics.worst.trades} trades</div>
                            </div>
                        )}
                        <div className="day-card average">
                            <div className="day-label">Average Day</div>
                            <div className={`day-pnl ${advancedMetrics.avgDay >= 0 ? 'positive' : 'negative'}`}>
                                {formatDollars(advancedMetrics.avgDay)}
                            </div>
                            <div className="day-meta">
                                {advancedMetrics.profitDays} green / {advancedMetrics.lossDays} red days
                            </div>
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
                            Performance Charts
                        </h2>
                        <div className="chart-type-selector">
                            <button
                                className={selectedChartType === 'equity' ? 'active' : ''}
                                onClick={() => setSelectedChartType('equity')}
                            >
                                Equity Curve
                            </button>
                            <button
                                className={selectedChartType === 'daily' ? 'active' : ''}
                                onClick={() => setSelectedChartType('daily')}
                            >
                                Daily P&L
                            </button>
                            <button
                                className={selectedChartType === 'structures' ? 'active' : ''}
                                onClick={() => setSelectedChartType('structures')}
                            >
                                By Structure
                            </button>
                        </div>
                    </div>

                    {selectedChartType === 'equity' && (
                        <DailyPnLChart data={dailySummary} showCumulative />
                    )}

                    {selectedChartType === 'daily' && (
                        <DailyPnLChart data={dailySummary} />
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

                {/* Quick Stats */}
                <div className="analytics-section">
                    <h3 className="section-title" style={{ fontSize: '0.9rem' }}>
                        <AlertTriangle size={16} />
                        Risk Metrics
                    </h3>
                    <div className="risk-stats">
                        <div className="risk-stat">
                            <span>Max Drawdown</span>
                            <span className="negative">-${advancedMetrics.maxDD.toFixed(2)}</span>
                        </div>
                        <div className="risk-stat">
                            <span>Avg Win / Avg Loss</span>
                            <span className={winLossAnalysis.avgWin > winLossAnalysis.avgLoss ? 'positive' : 'negative'}>
                                {winLossAnalysis.avgLoss > 0 ? (winLossAnalysis.avgWin / winLossAnalysis.avgLoss).toFixed(2) : '∞'}
                            </span>
                        </div>
                        <div className="risk-stat">
                            <span>Profit Days %</span>
                            <span className={(advancedMetrics.profitDays / (advancedMetrics.profitDays + advancedMetrics.lossDays || 1)) >= 0.5 ? 'positive' : 'negative'}>
                                {((advancedMetrics.profitDays / (advancedMetrics.profitDays + advancedMetrics.lossDays || 1)) * 100).toFixed(0)}%
                            </span>
                        </div>
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
