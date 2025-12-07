import React, { useState, useMemo } from 'react';
import { Search, Activity, AlertCircle } from 'lucide-react';
import StructureCard from './StructureCard';
import { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT } from '../utils/fifoCalculator';
import { calculateSharpeRatio, calculateSortinoRatio } from '../utils/insightsGenerator';

export default function Dashboard({ structuresData, onStructureClick }) {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('pnl');
    const [filterType, setFilterType] = useState('all');

    // Calculate summary stats with advanced metrics
    const summaryStats = useMemo(() => {
        const totalPnLDollars = structuresData.reduce((sum, s) => sum + (s.realizedPnLDollars || 0), 0);
        const totalGrossDollars = structuresData.reduce((sum, s) => sum + (s.grossPnLDollars || 0), 0);
        const totalRTCost = structuresData.reduce((sum, s) => sum + (s.totalRTCost || 0), 0);
        // Total RT Legs = rtCost ÷ $1.65 (so totalRTLegs × $1.65 = totalRTCost)
        const totalRTLegs = Math.round(totalRTCost / 1.65);

        // All matches across all structures
        const allMatches = structuresData.flatMap(s => s.matches || []);

        // Extract returns for ratio calculations
        const returns = allMatches.map(m => m.netPnLDollars || 0);

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

        // Sharpe and Sortino - pass returns array
        const sharpeRatio = calculateSharpeRatio(returns);
        const sortinoRatio = calculateSortinoRatio(returns);

        // Open positions summary
        const structuresWithOpen = structuresData.filter(s => s.netPosition !== 0);
        const totalOpenLong = structuresData.reduce((sum, s) => sum + (s.openLongQty || 0), 0);
        const totalOpenShort = structuresData.reduce((sum, s) => sum + (s.openShortQty || 0), 0);

        return {
            totalPnLDollars,
            totalGrossDollars,
            totalRTCost,
            totalRTLegs,
            totalTrades: allMatches.length,
            winRate,
            scratchRate,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            scratchTrades: scratchTrades.length,
            profitFactor,
            sharpeRatio,
            sortinoRatio,
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
        } else if (filterType === 'closed') {
            result = result.filter(s => s.netPosition === 0);
        } else if (filterType === 'long') {
            result = result.filter(s => s.netPosition > 0);
        } else if (filterType === 'short') {
            result = result.filter(s => s.netPosition < 0);
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
            case 'month':
                // Sort by month extracted from structure name (e.g., "Sep26", "Dec26")
                const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                result.sort((a, b) => {
                    const getMonthYear = (name) => {
                        const match = name.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})/i);
                        if (match) {
                            const monthIdx = monthOrder.findIndex(m => m.toLowerCase() === match[1].toLowerCase());
                            const year = parseInt(match[2], 10);
                            return year * 12 + monthIdx;
                        }
                        return 999; // Unknown month goes last
                    };
                    return getMonthYear(a.name) - getMonthYear(b.name);
                });
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



            {/* Summary Stats - Hero Row + Secondary Row */}
            <div className="dashboard-stats">
                {/* Hero Row: Net P&L and RT Costs */}
                <div className="hero-stats-row">
                    <div className="stat-card hero-primary">
                        <div className={`stat-value ${summaryStats.totalPnLDollars >= 0 ? 'positive' : 'negative'}`}>
                            {formatDollars(summaryStats.totalPnLDollars)}
                        </div>
                        <div className="stat-label">Net P&L</div>
                        <div className="stat-subtitle">
                            Gross: {formatDollars(summaryStats.totalGrossDollars)}
                        </div>
                    </div>
                    <div className="stat-card hero-secondary">
                        <div className="stat-value negative">
                            -${summaryStats.totalRTCost.toFixed(2)}
                        </div>
                        <div className="stat-label">RT Costs</div>
                        <div className="stat-subtitle">
                            {summaryStats.totalRTLegs} legs total
                        </div>
                    </div>
                </div>

                {/* Performance Row: Win, Loss, Scratch, Avg */}
                <div className="performance-stats-row">
                    <div className="stat-card compact">
                        <div className={`stat-value ${summaryStats.winRate >= 50 ? 'positive' : 'negative'}`}>
                            {summaryStats.winRate.toFixed(1)}%
                        </div>
                        <div className="stat-label">Win Rate</div>
                    </div>
                    <div className="stat-card compact">
                        <div className="stat-value" style={{ color: 'var(--neon-orange)' }}>
                            {summaryStats.scratchRate.toFixed(1)}%
                        </div>
                        <div className="stat-label">Scratch%</div>
                    </div>
                    <div className="stat-card compact">
                        <div className="stat-value">
                            <span style={{ color: 'var(--pnl-positive)' }}>{summaryStats.winningTrades}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            <span style={{ color: 'var(--pnl-negative)' }}>{summaryStats.losingTrades}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/</span>
                            <span style={{ color: 'var(--neon-orange)' }}>{summaryStats.scratchTrades}</span>
                        </div>
                        <div className="stat-label">W/L/S</div>
                    </div>
                    <div className="stat-card compact">
                        <div className={`stat-value ${(summaryStats.totalPnLDollars / (summaryStats.totalTrades || 1)) >= 0 ? 'positive' : 'negative'}`}>
                            {formatDollars(summaryStats.totalPnLDollars / (summaryStats.totalTrades || 1))}
                        </div>
                        <div className="stat-label">Avg P&L/Trade</div>
                    </div>
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

                <div className="quick-filter-buttons">
                    <button
                        className={`quick-filter-btn open ${filterType === 'open' ? 'active' : ''}`}
                        onClick={() => setFilterType(filterType === 'open' ? 'all' : 'open')}
                        title="View all open positions"
                    >
                        ⚠️ Open
                    </button>
                    <button
                        className={`quick-filter-btn closed ${filterType === 'closed' ? 'active' : ''}`}
                        onClick={() => {
                            if (filterType !== 'closed') {
                                setFilterType('closed');
                                setSortBy('month');
                            } else {
                                setFilterType('all');
                            }
                        }}
                        title="View closed (flat) positions"
                    >
                        ✓ Closed
                    </button>
                    <button
                        className={`quick-filter-btn long ${filterType === 'long' ? 'active' : ''}`}
                        onClick={() => setFilterType(filterType === 'long' ? 'all' : 'long')}
                        title="View long positions only"
                    >
                        ▲ Long
                    </button>
                    <button
                        className={`quick-filter-btn short ${filterType === 'short' ? 'active' : ''}`}
                        onClick={() => setFilterType(filterType === 'short' ? 'all' : 'short')}
                        title="View short positions only"
                    >
                        ▼ Short
                    </button>
                </div>

                <select
                    className="filter-select"
                    value={['long', 'short', 'open', 'closed'].includes(filterType) ? 'all' : filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="all">All Types</option>
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
                    <option value="month">Sort: Month (Ascending)</option>
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
