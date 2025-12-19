/**
 * Generate performance insights for structures (focused on actionable metrics)
 */

/**
 * Calculate Sharpe Ratio from trade returns
 * Sharpe = Average Return / Std Dev of Returns (using 0 as risk-free rate)
 */
export function calculateSharpeRatio(returns) {
    if (!returns || returns.length < 2) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return avgReturn > 0 ? Infinity : 0;
    return avgReturn / stdDev;
}

/**
 * Calculate Sortino Ratio (only penalizes downside deviation)
 * Sortino = Average Return / Downside Deviation
 * MAR (Minimum Acceptable Return) = 0
 */
export function calculateSortinoRatio(returns) {
    if (!returns || returns.length < 2) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return avgReturn > 0 ? Infinity : 0;
    // Downside deviation: sqrt of average of squared negative returns
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    const downsideDev = Math.sqrt(downsideVariance);
    if (downsideDev === 0) return avgReturn > 0 ? Infinity : 0;
    return avgReturn / downsideDev;
}

/**
 * Calculate trading performance metrics
 */
export function calculatePerformanceMetrics(structureData) {
    const {
        realizedPnLDollars,
        grossPnLDollars,
        totalRTCost,
        stats,
        matches,
        trades
    } = structureData;

    const metrics = {
        // Efficiency
        rtCostRatio: grossPnLDollars > 0 ? (totalRTCost / grossPnLDollars * 100) : 0,

        // Consistency
        winRate: stats?.winRate || 0,
        profitFactor: stats?.profitFactor || 0,

        // Risk metrics
        avgWinLossRatio: stats?.avgLossDollars > 0
            ? (stats?.avgWinDollars || 0) / stats.avgLossDollars
            : stats?.avgWinDollars > 0 ? Infinity : 0,

        // Volume metrics
        avgTradeSize: matches?.length > 0
            ? matches.reduce((sum, m) => sum + m.matchQty, 0) / matches.length
            : 0,

        // Time metrics
        avgHoldTimeHours: matches?.length > 0
            ? matches.reduce((sum, m) => sum + (m.closedAt - m.openTrade.timestamp), 0) / matches.length / (1000 * 60 * 60)
            : 0,

        // Profitability per unit
        pnlPerLot: matches?.length > 0
            ? realizedPnLDollars / matches.reduce((sum, m) => sum + m.matchQty, 0)
            : 0,

        // Trading activity
        totalTrades: matches?.length || 0,
        tradingDays: new Set(trades?.map(t => t.dateStr)).size || 0
    };

    return metrics;
}

/**
 * Rank structures by performance (dollar P&L)
 */
export function rankStructures(structuresData) {
    return [...structuresData].sort((a, b) => {
        // Primary sort by realized P&L (dollars)
        const aPnL = a.realizedPnLDollars !== undefined ? a.realizedPnLDollars : a.realizedPnL;
        const bPnL = b.realizedPnLDollars !== undefined ? b.realizedPnLDollars : b.realizedPnL;
        if (bPnL !== aPnL) {
            return bPnL - aPnL;
        }
        // Secondary sort by win rate
        const aWinRate = a.stats?.winRate || 0;
        const bWinRate = b.stats?.winRate || 0;
        return bWinRate - aWinRate;
    });
}

/**
 * Calculate overall portfolio statistics
 */
export function calculatePortfolioStats(allStructuresData) {
    const totalPnL = allStructuresData.reduce((sum, s) => sum + (s.realizedPnLDollars || 0), 0);
    const totalGross = allStructuresData.reduce((sum, s) => sum + (s.grossPnLDollars || 0), 0);
    const totalRT = allStructuresData.reduce((sum, s) => sum + (s.totalRTCost || 0), 0);
    const totalTrades = allStructuresData.reduce((sum, s) => sum + (s.matches?.length || 0), 0);
    const totalVolume = allStructuresData.reduce((sum, s) => sum + (s.closedQty || 0), 0);

    const winners = allStructuresData.filter(s => (s.realizedPnLDollars || 0) > 0);
    const losers = allStructuresData.filter(s => (s.realizedPnLDollars || 0) < 0);

    // Calculate aggregate win rate from all trades
    const allMatches = allStructuresData.flatMap(s => s.matches || []);
    const winningTrades = allMatches.filter(m => (m.netPnLDollars || 0) > 0).length;
    const overallWinRate = allMatches.length > 0 ? (winningTrades / allMatches.length) * 100 : 0;

    // Best and worst performers
    const ranked = rankStructures(allStructuresData);
    const bestPerformer = ranked[0];
    const worstPerformer = ranked[ranked.length - 1];

    // P&L by structure type
    const pnlByType = {};
    allStructuresData.forEach(s => {
        const type = s.metadata?.type || 'Unknown';
        if (!pnlByType[type]) {
            pnlByType[type] = { pnl: 0, count: 0, trades: 0 };
        }
        pnlByType[type].pnl += s.realizedPnLDollars || 0;
        pnlByType[type].count++;
        pnlByType[type].trades += s.matches?.length || 0;
    });

    return {
        totalPnL,
        totalGross,
        totalRT,
        rtCostRatio: totalGross > 0 ? (totalRT / totalGross * 100) : 0,
        totalTrades,
        totalVolume,
        winningStructures: winners.length,
        losingStructures: losers.length,
        overallWinRate,
        pnlPerTrade: totalTrades > 0 ? totalPnL / totalTrades : 0,
        pnlPerLot: totalVolume > 0 ? totalPnL / totalVolume : 0,
        bestPerformer,
        worstPerformer,
        pnlByType
    };
}

/**
 * Calculate daily trading summary  
 */
export function calculateDailySummary(allStructuresData) {
    const dailyMap = {};

    for (const structure of allStructuresData) {
        for (const match of (structure.matches || [])) {
            const dateKey = match.closeDate?.toISOString().split('T')[0] || 'unknown';
            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = {
                    date: dateKey,
                    pnl: 0,
                    trades: 0,
                    volume: 0,
                    rtCost: 0
                };
            }
            dailyMap[dateKey].pnl += match.netPnLDollars || 0;
            dailyMap[dateKey].trades++;
            dailyMap[dateKey].volume += match.matchQty;
            dailyMap[dateKey].rtCost += match.rtCost || 0;
        }
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Add cumulative P&L
    let cumulative = 0;
    return daily.map(day => {
        cumulative += day.pnl;
        return { ...day, cumulative };
    });
}
