import React, { useState, useMemo } from 'react';
import {
    X, ArrowRightLeft, Calendar, Clock, Target, BarChart3,
    History, List, Trash2, TrendingUp, TrendingDown
} from 'lucide-react';
import { CumulativePnLChart, TradeDistributionChart, EquityCurveChart } from './Charts';
import { calculatePerformanceMetrics } from '../utils/insightsGenerator';
import { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT } from '../utils/fifoCalculator';

export default function StructureDetail({ structure, onClose, onDeleteTrade }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [confirmDelete, setConfirmDelete] = useState(null);

    const {
        name,
        realizedPnLDollars,
        grossPnLDollars,
        totalRTCost,
        netPosition,
        openLongQty,
        openShortQty,
        avgLongPrice,
        avgShortPrice,
        avgBuyPrice,
        avgSellPrice,
        totalBuyQty,
        totalSellQty,
        closedQty,
        stats,
        matches,
        trades,
        longQueue,
        shortQueue,
        rtLegs,
        totalRtLegsPerRoundTrip,
        metadata
    } = structure;

    const metrics = useMemo(() => calculatePerformanceMetrics(structure), [structure]);
    const hasOpenPosition = netPosition !== 0;
    const isProfitable = realizedPnLDollars > 0;

    // Calculate total RTs for this structure
    const totalRoundTrips = closedQty || 0; // Each closed lot is one round-trip
    const totalRTLegsUsed = totalRoundTrips * (totalRtLegsPerRoundTrip || rtLegs + 1);

    const formatNumber = (num, decimals = 4) => {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return num.toFixed(decimals);
    };

    const formatDollars = (value) => {
        if (value === undefined || value === null || isNaN(value)) return '$0.00';
        const prefix = value >= 0 ? (value > 0 ? '+' : '') : '';
        return prefix + '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDuration = (hours) => {
        if (!hours || hours < 0) return '-';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours < 24) return `${hours.toFixed(1)}h`;
        return `${(hours / 24).toFixed(1)}d`;
    };

    const handleDeleteTrade = (tradeId) => {
        if (onDeleteTrade) {
            onDeleteTrade(tradeId);
            setConfirmDelete(null);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content structure-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-info">
                        <h2 className="modal-title">{name}</h2>
                        <div className="header-meta">
                            {metadata?.type && <span className="badge">{metadata.type}</span>}
                            {metadata?.calendarSpan && <span className="badge">{metadata.calendarSpan}</span>}
                            <span className="rt-info">
                                {totalRoundTrips} RTs ({totalRTLegsUsed} legs) • ${totalRTCost?.toFixed(2) || '0.00'} cost
                            </span>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* PROMINENT OPEN POSITION ALERT */}
                    {hasOpenPosition && (
                        <div className="open-position-detail-alert">
                            <div className="position-header">
                                <strong>⚠️ OPEN POSITION</strong>
                            </div>
                            <div className="position-info">
                                {openLongQty > 0 && (
                                    <div className="position-item long">
                                        <span className="direction">▲ LONG</span>
                                        <span className="qty">{openLongQty} lots</span>
                                        <span className="price">@ {formatNumber(avgLongPrice)}</span>
                                    </div>
                                )}
                                {openShortQty > 0 && (
                                    <div className="position-item short">
                                        <span className="direction">▼ SHORT</span>
                                        <span className="qty">{openShortQty} lots</span>
                                        <span className="price">@ {formatNumber(avgShortPrice)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="tabs">
                        <button
                            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <Target size={16} />
                            Overview
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'entries' ? 'active' : ''}`}
                            onClick={() => setActiveTab('entries')}
                        >
                            <List size={16} />
                            Entries/Exits ({trades?.length || 0})
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('charts')}
                        >
                            <BarChart3 size={16} />
                            Charts
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                            onClick={() => setActiveTab('matches')}
                        >
                            <History size={16} />
                            Matched ({matches?.length || 0})
                        </button>
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="overview-tab">
                            <div className="metrics-hero">
                                <div className={`hero-stat ${isProfitable ? 'positive' : 'negative'}`}>
                                    <div className="hero-value">{formatDollars(realizedPnLDollars)}</div>
                                    <div className="hero-label">Net P&L</div>
                                </div>
                            </div>

                            <div className="metrics-grid">
                                <div className="metric-card">
                                    <div className="metric-value">{formatDollars(grossPnLDollars)}</div>
                                    <div className="metric-label">Gross P&L</div>
                                </div>
                                <div className="metric-card negative">
                                    <div className="metric-value">-${(totalRTCost || 0).toFixed(2)}</div>
                                    <div className="metric-label">RT Costs ({metrics.rtCostRatio?.toFixed(1) || 0}%)</div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-value" style={{ color: (stats?.winRate || 0) >= 50 ? 'var(--pnl-positive)' : 'var(--pnl-negative)' }}>
                                        {formatNumber(stats?.winRate, 1)}%
                                    </div>
                                    <div className="metric-label">Win Rate</div>
                                </div>
                                <div className="metric-card">
                                    <div className="metric-value">
                                        {stats?.profitFactor === Infinity ? '∞' : formatNumber(stats?.profitFactor, 2)}
                                    </div>
                                    <div className="metric-label">Profit Factor</div>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="detail-section">
                                <h3><BarChart3 size={16} /> Performance</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <span className="label">Avg Win</span>
                                        <span className="value positive">{formatDollars(stats?.avgWinDollars)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Avg Loss</span>
                                        <span className="value negative">{formatDollars(stats?.avgLossDollars)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">P&L per Lot</span>
                                        <span className="value">{formatDollars(metrics.pnlPerLot)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Total RTs</span>
                                        <span className="value">{totalRoundTrips}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Total Entries</span>
                                        <span className="value">{trades?.length || 0}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Net Position</span>
                                        <span className="value" style={{ color: netPosition > 0 ? 'var(--pnl-positive)' : netPosition < 0 ? 'var(--pnl-negative)' : 'inherit' }}>
                                            {netPosition > 0 ? '+' : ''}{netPosition}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Price Summary */}
                            <div className="detail-section">
                                <h3><Calendar size={16} /> Price Summary</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <span className="label">Avg Buy</span>
                                        <span className="value">{formatNumber(avgBuyPrice)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Avg Sell</span>
                                        <span className="value">{formatNumber(avgSellPrice)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Bought</span>
                                        <span className="value positive">{totalBuyQty} lots</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Sold</span>
                                        <span className="value negative">{totalSellQty} lots</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Entries/Exits Tab - ALL RAW TRADES */}
                    {activeTab === 'entries' && (
                        <div className="entries-tab">
                            <div className="entries-header">
                                <h3>All Entries & Exits</h3>
                                <div className="entries-summary">
                                    <span className="buys">{totalBuyQty} bought</span>
                                    <span className="sells">{totalSellQty} sold</span>
                                </div>
                            </div>

                            <div className="entries-list">
                                {trades?.slice().reverse().map((trade, idx) => (
                                    <div key={trade.id || idx} className={`entry-item ${trade.side === 'BUY' ? 'buy' : 'sell'}`}>
                                        <div className="entry-icon">
                                            {trade.side === 'BUY' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                        </div>
                                        <div className="entry-main">
                                            <div className="entry-type">
                                                <span className={`side-badge ${trade.side.toLowerCase()}`}>
                                                    {trade.side}
                                                </span>
                                                <span className="entry-qty">{trade.quantity} lots</span>
                                                <span className="entry-price">@ {formatNumber(trade.price)}</span>
                                            </div>
                                            <div className="entry-meta">
                                                {trade.date?.toLocaleString?.() || trade.dateStr} • {trade.exchange}
                                            </div>
                                        </div>
                                        <div className="entry-actions">
                                            {confirmDelete === trade.id ? (
                                                <div className="confirm-delete">
                                                    <button
                                                        className="confirm-btn yes"
                                                        onClick={() => handleDeleteTrade(trade.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                    <button
                                                        className="confirm-btn no"
                                                        onClick={() => setConfirmDelete(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => setConfirmDelete(trade.id)}
                                                    title="Delete this trade"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!trades || trades.length === 0) && (
                                    <div className="empty-entries">
                                        No trades in this structure
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Charts Tab */}
                    {activeTab === 'charts' && (
                        <div className="charts-tab">
                            <CumulativePnLChart matches={matches} title="P&L by Trade" />
                            <div style={{ marginTop: '24px' }}>
                                <EquityCurveChart matches={matches} />
                            </div>
                            <div style={{ marginTop: '24px' }}>
                                <TradeDistributionChart matches={matches} />
                            </div>
                        </div>
                    )}

                    {/* Matched Trades Tab */}
                    {activeTab === 'matches' && (
                        <div className="trades-tab">
                            <div className="trades-header">
                                <h3>Matched Round-Trips ({matches?.length || 0})</h3>
                                {matches?.length > 0 && (
                                    <div className="trades-summary">
                                        <span className="wins">{stats?.winningTrades || 0} wins</span>
                                        <span className="losses">{stats?.losingTrades || 0} losses</span>
                                    </div>
                                )}
                            </div>

                            <div className="trades-list">
                                {matches?.slice().reverse().map((match, idx) => (
                                    <div key={idx} className={`trade-item ${(match.netPnLDollars || 0) >= 0 ? 'win' : 'loss'}`}>
                                        <div className="trade-main">
                                            <div className="trade-type">
                                                <ArrowRightLeft size={14} />
                                                <span>{match.type === 'CLOSE_LONG' ? 'Closed Long' : 'Covered Short'}</span>
                                                <span className="qty">{match.matchQty} lots</span>
                                            </div>
                                            <div className="trade-prices">
                                                <span className="entry">{formatNumber(match.openTrade.price)}</span>
                                                <span className="arrow">→</span>
                                                <span className="exit">{formatNumber(match.closeTrade.price)}</span>
                                            </div>
                                        </div>
                                        <div className="trade-pnl">
                                            <div className={`pnl-value ${(match.netPnLDollars || 0) >= 0 ? 'positive' : 'negative'}`}>
                                                {formatDollars(match.netPnLDollars)}
                                            </div>
                                            <div className="pnl-breakdown">
                                                Gross: {formatDollars(match.pnlDollars)} | RT: -${(match.rtCost || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!matches || matches.length === 0) && (
                                    <div className="empty-trades">
                                        No matched trades yet
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
