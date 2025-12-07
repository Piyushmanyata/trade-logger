import React from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Legend, ComposedChart, Area
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
export function TradeDistributionChart({ matches }) {
    if (!matches || matches.length === 0) {
        return null;
    }

    // Group trades by P&L buckets
    const buckets = {};
    const bucketSize = 50; // $50 buckets

    matches.forEach(m => {
        const pnl = m.netPnLDollars || 0;
        const bucket = Math.floor(pnl / bucketSize) * bucketSize;
        const key = bucket >= 0 ? `$${bucket} to $${bucket + bucketSize}` : `$${bucket} to $${bucket + bucketSize}`;
        if (!buckets[bucket]) {
            buckets[bucket] = { bucket, label: key, count: 0, isPositive: bucket >= 0 };
        }
        buckets[bucket].count++;
    });

    const chartData = Object.values(buckets).sort((a, b) => a.bucket - b.bucket);

    return (
        <div className="chart-container">
            <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Trade Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} angle={-45} textAnchor="end" height={60} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                        dataKey="count"
                        name="Trades"
                        fill="var(--neon-cyan)"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Equity curve chart
 */
export function EquityCurveChart({ matches, startingBalance = 0 }) {
    if (!matches || matches.length === 0) {
        return null;
    }

    const sorted = [...matches].sort((a, b) => a.closedAt - b.closedAt);
    let balance = startingBalance;

    const chartData = sorted.map((m, idx) => {
        balance += m.netPnLDollars || 0;
        return {
            trade: idx + 1,
            date: m.closeDate?.toLocaleDateString() || '',
            balance,
            pnl: m.netPnLDollars || 0
        };
    });

    // Add starting point
    chartData.unshift({ trade: 0, date: 'Start', balance: startingBalance, pnl: 0 });

    const maxBalance = Math.max(...chartData.map(d => d.balance));
    const minBalance = Math.min(...chartData.map(d => d.balance));

    return (
        <div className="chart-container">
            <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Equity Curve</h3>
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                    <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--neon-cyan)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--neon-cyan)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="trade" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis
                        stroke="var(--text-muted)"
                        fontSize={12}
                        tickFormatter={(v) => `$${v}`}
                        domain={[minBalance - 50, maxBalance + 50]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={startingBalance} stroke="var(--text-muted)" strokeDasharray="3 3" />
                    <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="var(--neon-cyan)"
                        fill="url(#equityGradient)"
                        strokeWidth={2}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
