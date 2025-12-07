import React, { useState, useMemo } from 'react';
import { Search, Activity, AlertCircle } from 'lucide-react';
import StructureCard from './StructureCard';
import { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT } from '../utils/fifoCalculator';

export default function Dashboard({ structuresData, onStructureClick }) {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('pnl');
    const [filterType, setFilterType] = useState('all');

    // Calculate summary stats
    const summaryStats = useMemo(() => {
        const totalPnL = structuresData.reduce((sum, s) => sum + s.realizedPnL, 0);
        const totalPnLDollars = structuresData.reduce((sum, s) => sum + (s.realizedPnLDollars || 0), 0);
        const totalGrossDollars = structuresData.reduce((sum, s) => sum + (s.grossPnLDollars || 0), 0);
        const totalRTCost = structuresData.reduce((sum, s) => sum + (s.totalRTCost || 0), 0);
        const totalTrades = structuresData.reduce((sum, s) => sum + (s.matches?.length || 0), 0);
        const totalVolume = structuresData.reduce((sum, s) => sum + (s.closedQty || 0), 0);
        const winners = structuresData.filter(s => (s.realizedPnLDollars || 0) > 0).length;
        const losers = structuresData.filter(s => (s.realizedPnLDollars || 0) < 0).length;

        // Open positions summary
        const structuresWithOpen = structuresData.filter(s => s.netPosition !== 0);
        const totalOpenLong = structuresData.reduce((sum, s) => sum + (s.openLongQty || 0), 0);
        const totalOpenShort = structuresData.reduce((sum, s) => sum + (s.openShortQty || 0), 0);

        return {
            totalPnL,
            totalPnLDollars,
            totalGrossDollars,
            totalRTCost,
            totalTrades,
            totalVolume,
            winners,
            losers,
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

        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(searchLower));
        }

        // Filter by type (including open positions filter)
        if (filterType === 'open') {
            result = result.filter(s => s.netPosition !== 0);
        } else if (filterType !== 'all') {
            result = result.filter(s => s.metadata?.type === filterType);
        }

        // Sort
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
                <span><strong>RT Cost:</strong> ${RT_COST_PER_LOT}/leg (Entry RT + 1 Exit)</span>
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

            {/* Summary Stats */}
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
                    <div className="stat-value">{summaryStats.totalTrades}</div>
                    <div className="stat-label">Closed Trades</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{summaryStats.totalVolume}</div>
                    <div className="stat-label">Volume (Lots)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value positive">{summaryStats.winners}</div>
                    <div className="stat-label">Winning</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value negative">{summaryStats.losers}</div>
                    <div className="stat-label">Losing</div>
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
