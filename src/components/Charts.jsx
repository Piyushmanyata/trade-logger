import React from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Legend, ComposedChart, Area, Cell
} from 'recharts';
import { calculateCumulativePnL, calculateDailyPnL } from '../utils/fifoCalculator';

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(18, 18, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '0.85rem'
            }}>
                <p style={{ marginBottom: '8px', fontWeight: 600 }}>{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color, margin: '4px 0' }}>
                        {entry.name}: ${typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

/**
 * Cumulative P&L Chart for a structure
 */
export function CumulativePnLChart({ matches, title = "Cumulative P&L" }) {
    const data = calculateCumulativePnL(matches);

    if (!data || data.length === 0) {
        return (
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No closed trades to display</p>
            </div>
        );
    }

    const chartData = data.map((d, idx) => ({
        trade: `#${idx + 1}`,
        date: d.date?.toLocaleDateString() || '',
        pnl: d.pnlDollars,
        cumulative: d.cumulativeDollars
    }));

    return (
        <div className="chart-container">
            <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>{title}</h3>
            <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="trade" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                    <Bar dataKey="pnl" name="Trade P&L" fill="var(--neon-cyan)" opacity={0.6} />
                    <Line
                        type="monotone"
                        dataKey="cumulative"
                        name="Cumulative"
                        stroke="var(--neon-magenta)"
                        strokeWidth={2}
                        dot={{ fill: 'var(--neon-magenta)', r: 4 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Daily P&L Chart 
 */
export function DailyPnLChart({ data, showCumulative = false }) {
    if (!data || data.length === 0) {
        return (
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No daily data to display</p>
            </div>
        );
    }

    const chartData = data.map(d => ({
        date: d.date,
        pnl: d.pnl,
        cumulative: d.cumulative,
        trades: d.trades
    }));

    return (
        <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />

                    {showCumulative ? (
                        <>
                            <Area
                                type="monotone"
                                dataKey="cumulative"
                                name="Cumulative P&L"
                                fill="var(--neon-cyan)"
                                fillOpacity={0.2}
                                stroke="var(--neon-cyan)"
                                strokeWidth={2}
                            />
                        </>
                    ) : (
                        <Bar
                            dataKey="pnl"
                            name="Daily P&L"
                            fill="var(--neon-cyan)"
                        >
                        </Bar>
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Multi-structure P&L comparison
 */
export function MultiStructurePnLChart({ structuresData }) {
    if (!structuresData || structuresData.length === 0) {
        return (
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No structures to compare</p>
            </div>
        );
    }

    const chartData = structuresData.map(s => ({
        name: s.name.length > 20 ? s.name.substring(0, 18) + '...' : s.name,
        fullName: s.name,
        pnl: s.realizedPnLDollars || 0,
        trades: s.matches?.length || 0,
        winRate: s.stats?.winRate || 0
    }));

    return (
        <div className="chart-container">
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 40)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} width={140} />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div style={{
                                        background: 'rgba(18, 18, 26, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        fontSize: '0.85rem'
                                    }}>
                                        <p style={{ fontWeight: 600, marginBottom: '8px' }}>{data.fullName}</p>
                                        <p style={{ color: data.pnl >= 0 ? 'var(--pnl-positive)' : 'var(--pnl-negative)' }}>
                                            P&L: ${data.pnl.toFixed(2)}
                                        </p>
                                        <p>Trades: {data.trades}</p>
                                        <p>Win Rate: {data.winRate.toFixed(1)}%</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <ReferenceLine x={0} stroke="var(--text-muted)" />
                    <Bar
                        dataKey="pnl"
                        name="P&L"
                        fill="var(--neon-cyan)"
                    >
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Win/Loss distribution chart
 */
/**
 * Tick Capture Chart - Shows distribution of trades by tick capture
 * Uses GROSS price movement (entry vs exit), not quantity-weighted
 */
export function TickCaptureChart({ matches, tickSize = 0.005 }) {
    if (!matches || matches.length === 0) {
        return (
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <p style={{ color: 'var(--text-muted)' }}>No trades to analyze</p>
            </div>
        );
    }

    // Calculate ticks from price movement (not quantity-weighted)
    const getTicksFromMatch = (match) => {
        const entryPrice = match.openTrade?.price || 0;
        const exitPrice = match.closeTrade?.price || 0;

        if (match.type === 'CLOSE_LONG') {
            return (exitPrice - entryPrice) / tickSize;
        } else if (match.type === 'COVER_SHORT') {
            return (entryPrice - exitPrice) / tickSize;
        }
        const matchQty = match.matchQty || 1;
        return (match.pnl || 0) / matchQty / tickSize;
    };

    // Separate wins and losses
    const wins = matches.filter(m => (m.pnlDollars || 0) > 0);
    const losses = matches.filter(m => (m.pnlDollars || 0) < 0);

    // Count by tick bucket for wins
    const winBuckets = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
    wins.forEach(m => {
        const ticks = Math.round(getTicksFromMatch(m));
        const bucket = ticks >= 5 ? '5+' : String(Math.max(1, ticks));
        winBuckets[bucket] = (winBuckets[bucket] || 0) + 1;
    });

    // Count by tick bucket for losses
    const lossBuckets = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
    losses.forEach(m => {
        const ticks = Math.abs(Math.round(getTicksFromMatch(m)));
        const bucket = ticks >= 5 ? '5+' : String(Math.max(1, ticks));
        lossBuckets[bucket] = (lossBuckets[bucket] || 0) + 1;
    });

    const chartData = ['1', '2', '3', '4', '5+'].map(bucket => ({
        ticks: `${bucket} tick${bucket !== '1' ? 's' : ''}`,
        wins: winBuckets[bucket] || 0,
        losses: lossBuckets[bucket] || 0
    }));

    return (
        <div className="chart-container">
            <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Tick Capture Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis dataKey="ticks" type="category" stroke="var(--text-muted)" fontSize={12} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="wins" name="Wins" fill="var(--pnl-positive)" />
                    <Bar dataKey="losses" name="Losses" fill="var(--pnl-negative)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Trade P&L Waterfall - Shows each trade's contribution
 */
export function TradePnLChart({ matches }) {
    if (!matches || matches.length === 0) {
        return null;
    }

    // Take last 20 trades for readability
    const recentMatches = matches.slice(-20);
    const startIndex = Math.max(0, matches.length - 20);

    const chartData = recentMatches.map((m, idx) => ({
        trade: `#${startIndex + idx + 1}`,
        pnl: m.netPnLDollars || 0,
        gross: m.pnlDollars || 0,
        type: m.type === 'CLOSE_LONG' ? 'Long' : 'Short'
    }));

    return (
        <div className="chart-container">
            <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Recent Trades P&L (Last 20)</h3>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="trade" stroke="var(--text-muted)" fontSize={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--text-muted)" />
                    <Bar
                        dataKey="pnl"
                        name="Net P&L"
                        fill="var(--neon-cyan)"
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.pnl >= 0 ? 'var(--pnl-positive)' : 'var(--pnl-negative)'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

