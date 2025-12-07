import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function StructureCard({ structure, onClick }) {
    const {
        name,
        realizedPnLDollars,
        grossPnLDollars,
        totalRTCost,
        netPosition,
        stats,
        metadata
    } = structure;

    const isProfitable = realizedPnLDollars > 0;
    const isLoss = realizedPnLDollars < 0;
    const isFlat = realizedPnLDollars === 0;
    const hasOpenPosition = netPosition !== 0;

    const formatPrice = (value) => {
        if (value === 0 || value === undefined || value === null) return '-';
        return value.toFixed(4);
    };

    const formatDollars = (value) => {
        if (value === undefined || value === null) return '$0.00';
        return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div
            className={`structure-card ${isProfitable ? 'positive' : ''} ${isLoss ? 'negative' : ''} ${hasOpenPosition ? 'has-open' : ''}`}
            onClick={() => onClick(structure)}
        >
            <div className="structure-name">
                {metadata?.type && (
                    <span className="structure-type-badge">{metadata.type}</span>
                )}
                {name}
            </div>

            {/* OPEN POSITION ALERT - Prominent Display */}
            {hasOpenPosition && (
                <div className="open-position-alert">
                    <span className={netPosition > 0 ? 'long' : 'short'}>
                        {netPosition > 0 ? '▲ LONG' : '▼ SHORT'} {Math.abs(netPosition)} lots
                    </span>
                    <span className="avg-price">
                        @ {formatPrice(netPosition > 0 ? structure.avgLongPrice : structure.avgShortPrice)}
                    </span>
                </div>
            )}

            {/* Dollar P&L - Main Display */}
            <div className={`structure-pnl ${isProfitable ? 'positive' : ''} ${isLoss ? 'negative' : ''}`}>
                {isProfitable && <TrendingUp size={24} style={{ marginRight: '8px' }} />}
                {isLoss && <TrendingDown size={24} style={{ marginRight: '8px' }} />}
                {isFlat && <Activity size={24} style={{ marginRight: '8px', opacity: 0.5 }} />}
                {formatDollars(realizedPnLDollars)}
            </div>

            {/* Gross and RT Cost Breakdown */}
            {(grossPnLDollars !== 0 || totalRTCost > 0) && (
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: 'var(--spacing-md)',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '12px'
                }}>
                    <span>Gross: {formatDollars(grossPnLDollars)}</span>
                    <span>RT: -{formatDollars(totalRTCost)}</span>
                </div>
            )}

            <div className="structure-stats">
                <span>
                    <span className="label">Win%</span>
                    <span className="value" style={{ color: (stats?.winRate || 0) >= 50 ? 'var(--pnl-positive)' : (stats?.winRate || 0) > 0 ? 'var(--pnl-negative)' : 'inherit' }}>
                        {stats?.winRate?.toFixed(0) || 0}%
                    </span>
                </span>
                <span>
                    <span className="label">Ticks</span>
                    <span className="value">
                        <span style={{ color: 'var(--pnl-positive)' }}>+{stats?.tickCapture?.avgTicksWon?.toFixed(1) || '0.0'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--pnl-negative)' }}>-{stats?.tickCapture?.avgTicksLost?.toFixed(1) || '0.0'}</span>
                    </span>
                </span>
                <span>
                    <span className="label">W/L/S</span>
                    <span className="value">
                        <span style={{ color: 'var(--pnl-positive)' }}>{stats?.winningTrades || 0}</span>
                        /
                        <span style={{ color: 'var(--pnl-negative)' }}>{stats?.losingTrades || 0}</span>
                        /
                        <span style={{ color: 'var(--neon-orange)' }}>{stats?.scratchTrades || 0}</span>
                    </span>
                </span>
                <span>
                    <span className="label">RT Legs</span>
                    <span className="value">{stats?.totalRTLegs || Math.round((structure.totalRTCost || 0) / 1.65) || 0}</span>
                </span>
            </div>
        </div>
    );
}
