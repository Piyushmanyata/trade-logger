import React, { useState, useMemo } from 'react';
import { Search, Activity, AlertCircle } from 'lucide-react';
import StructureCard from './StructureCard';
import { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT } from '../utils/fifoCalculator';

/**
 * Calculate Sharpe Ratio from trade returns
 * Sharpe = (Average Return - Risk Free Rate) / Std Dev of Returns
 * We use 0 as risk-free rate for simplicity
 */
function calculateSharpeRatio(matches) {
    if (!matches || matches.length < 2) return 0;

    const returns = matches.map(m => m.netPnLDollars || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    const squaredDiffs = returns.map(r => Math.pow(r - avgReturn, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return avgReturn > 0 ? Infinity : 0;
    return avgReturn / stdDev;
}

/**
 * Calculate Sortino Ratio (only considers downside deviation)
 * Sortino = (Average Return - Target) / Downside Deviation
 * Target = 0 (we want positive returns)
 */
function calculateSortinoRatio(matches) {
    if (!matches || matches.length < 2) return 0;

    const returns = matches.map(m => m.netPnLDollars || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // Only consider negative returns for downside deviation
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return avgReturn > 0 ? Infinity : 0;

    const squaredNegDiffs = negativeReturns.map(r => Math.pow(r, 2));
    const downsideVariance = squaredNegDiffs.reduce((a, b) => a + b, 0) / returns.length;
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev === 0) return avgReturn > 0 ? Infinity : 0;
    return avgReturn / downsideDev;
}

export default function Dashboard({ structuresData, onStructureClick }) {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('pnl');
    const [filterType, setFilterType] = useState('all');

    // Calculate summary stats with advanced metrics
    const summaryStats = useMemo(() => {
        const totalPnLDollars = structuresData.reduce((sum, s) => sum + (s.realizedPnLDollars || 0), 0);
        const totalGrossDollars = structuresData.reduce((sum, s) => sum + (s.grossPnLDollars || 0), 0);
        const totalRTCost = structuresData.reduce((sum, s) => sum + (s.totalRTCost || 0), 0);
        const totalRTs = structuresData.reduce((sum, s) => sum + (s.stats?.totalRTs || s.closedQty || 0), 0);

        // All matches across all structures
        const allMatches = structuresData.flatMap(s => s.matches || []);

        // Classify: Win (gross > 0), Loss (gross < 0), Scratch (gross = 0)
        const winningTrades = allMatches.filter(m => (m.pnlDollars || 0) > 0);
        const losingTrades = allMatches.filter(m => (m.pnlDollars || 0) < 0);
        const scratchTrades = allMatches.filter(m => (m.pnlDollars || 0) === 0);

        // Win rate excludes scratches from denominator
        const decisiveTrades = winningTrades.length + losingTrades.length;
        const winRate = decisiveTrades > 0
            ? (winningTrades.length / decisiveTrades) * 100
            : 0;
        const scratchRate = allMatches.length > 0
            ? (scratchTrades.length / allMatches.length) * 100
            : 0;

        // Profit Factor = Total Wins / Total Losses
        const totalWins = winningTrades.reduce((sum, m) => sum + (m.netPnLDollars || 0), 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, m) => sum + (m.netPnLDollars || 0), 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);

        // Sharpe and Sortino
        const sharpeRatio = calculateSharpeRatio(allMatches);
        const sortinoRatio = calculateSortinoRatio(allMatches);

        // Open positions summary
        const structuresWithOpen = structuresData.filter(s => s.netPosition !== 0);
        const totalOpenLong = structuresData.reduce((sum, s) => sum + (s.openLongQty || 0), 0);
        const totalOpenShort = structuresData.reduce((sum, s) => sum + (s.openShortQty || 0), 0);

        return {
            totalPnLDollars,
            totalGrossDollars,
            totalRTCost,
            totalRTs,
            totalTrades: allMatches.length,
            winRate,
            scratchRate,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            scratchTrades: scratchTrades.length,
            profitFactor,
            sharpeRatio,
            sortinoRatio,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            openPositionsCount: structuresWithOpen.length,
            totalOpenLong,
            totalOpenShort,
            totalStructures: structuresData.length
        };
    }, [structuresData]);

    // Get unique structure types for filter
    const structureTypes = useMemo(() => {
        const types = new Set();
        structuresData.forEach(s => {
            if (s.metadata?.type) types.add(s.metadata.type);
        });
        return Array.from(types).sort();
    }, [structuresData]);

    // Filter and sort structures
    const filteredStructures = useMemo(() => {
        let result = [...structuresData];

        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(searchLower));
        }

        if (filterType === 'open') {
            result = result.filter(s => s.netPosition !== 0);
        } else if (filterType !== 'all') {
            result = result.filter(s => s.metadata?.type === filterType);
        }

        switch (sortBy) {
            case 'pnl':
                result.sort((a, b) => (b.realizedPnLDollars || 0) - (a.realizedPnLDollars || 0));
                break;
            case 'pnl-asc':
                result.sort((a, b) => (a.realizedPnLDollars || 0) - (b.realizedPnLDollars || 0));
                break;
            case 'trades':
                result.sort((a, b) => (b.matches?.length || 0) - (a.matches?.length || 0));
                break;
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'winrate':
                result.sort((a, b) => (b.stats?.winRate || 0) - (a.stats?.winRate || 0));
                break;
            case 'position':
                result.sort((a, b) => Math.abs(b.netPosition || 0) - Math.abs(a.netPosition || 0));
                break;
            default:
                break;
        }

        return result;
    }, [structuresData, search, sortBy, filterType]);

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
                <Activity size={80} />
                <h3>No Trades Yet</h3>
                <p>Paste your fills above to get started</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>
                    Tick Value: ${TICK_VALUE} | Tick Size: {TICK_SIZE} | RT Cost: ${RT_COST_PER_LOT}/leg
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Trading Constants Info */}
            <div style={{
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--glass-bg)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                display: 'flex',
                gap: '24px',
                flexWrap: 'wrap'
            }}>
                <span><strong>Tick Value:</strong> ${TICK_VALUE}</span>
                <span><strong>Tick Size:</strong> {TICK_SIZE}</span>
                <span><strong>RT Cost:</strong> ${RT_COST_PER_LOT}/leg × 2 per RT</span>
            </div>

            {/* PROMINENT OPEN POSITIONS BANNER */}
            {summaryStats.openPositionsCount > 0 && (
                <div className="open-positions-banner">
                    <AlertCircle size={20} />
                    <strong>Open Positions:</strong>
                    <span className="long">{summaryStats.totalOpenLong} Long</span>
                    <span className="divider">|</span>
                    <span className="short">{summaryStats.totalOpenShort} Short</span>
                    <span className="divider">|</span>
                    <span>{summaryStats.openPositionsCount} structures</span>
                    <button
                        className="view-open-btn"
                        onClick={() => setFilterType('open')}
                    >
                        View Open Only
                    </button>
                </div>
            )}

            {/* Summary Stats - Enhanced Metrics */}
            <div className="summary-stats">
                <div className="stat-card">
                    <div className={`stat-value ${summaryStats.totalPnLDollars >= 0 ? 'positive' : 'negative'}`}>
                        {formatDollars(summaryStats.totalPnLDollars)}
                    </div>
                    <div className="stat-label">Net P&L</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                        {formatDollars(summaryStats.totalGrossDollars)}
                    </div>
                    <div className="stat-label">Gross P&L</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value negative" style={{ fontSize: '1.5rem' }}>
                        -${summaryStats.totalRTCost.toFixed(2)}
                    </div>
                    <div className="stat-label">Total RT Costs</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{summaryStats.totalRTs}</div>
                    <div className="stat-label">Total RTs</div>
                </div>
                <div className="stat-card">
                    <div className={`stat-value ${summaryStats.winRate >= 50 ? 'positive' : 'negative'}`}>
                        {summaryStats.winRate.toFixed(1)}%
                    </div>
                    <div className="stat-label">Win Rate</div>
                </div>
                <div className="stat-card">
                    <div className={`stat-value ${summaryStats.profitFactor >= 1 ? 'positive' : 'negative'}`}>
                        {formatRatio(summaryStats.profitFactor)}
                    </div>
                    <div className="stat-label">Profit Factor</div>
                </div>
                <div className="stat-card">
                    <div className={`stat-value ${summaryStats.sharpeRatio >= 0 ? 'positive' : 'negative'}`}>
                        {formatRatio(summaryStats.sharpeRatio)}
                    </div>
                    <div className="stat-label">Sharpe Ratio</div>
                </div>
                <div className="stat-card">
                    <div className={`stat-value ${summaryStats.sortinoRatio >= 0 ? 'positive' : 'negative'}`}>
                        {formatRatio(summaryStats.sortinoRatio)}
                    </div>
                    <div className="stat-label">Sortino Ratio</div>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search
                        size={16}
                        style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }}
                    />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search structures..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: '36px' }}
                    />
                </div>

                <select
                    className="filter-select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="all">All Types</option>
                    <option value="open">⚠️ Open Positions Only</option>
                    {structureTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>

                <select
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="pnl">Sort: P&L (High to Low)</option>
                    <option value="pnl-asc">Sort: P&L (Low to High)</option>
                    <option value="position">Sort: Position Size</option>
                    <option value="winrate">Sort: Win Rate</option>
                    <option value="trades">Sort: Trade Count</option>
                    <option value="name">Sort: Name</option>
                </select>
            </div>

            {/* Structure Cards */}
            <div className="structures-grid">
                {filteredStructures.map(structure => (
                    <StructureCard
                        key={structure.name}
                        structure={structure}
                        onClick={onStructureClick}
                    />
                ))}
            </div>

            {filteredStructures.length === 0 && (
                <div className="empty-state" style={{ padding: '40px' }}>
                    <h3>No structures match your filters</h3>
                </div>
            )}
        </div>
    );
}
