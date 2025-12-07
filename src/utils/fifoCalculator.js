/**
 * FIFO P&L Calculator
 * Calculates realized and unrealized P&L using First-In-First-Out matching
 * 
 * MATCHING LOGIC:
 * - Trades are matched in ENTRY ORDER (array position), NOT by timestamp
 * - If you enter a long, then enter a short, they MATCH immediately
 * - This reflects real trading where you close positions as you enter opposing trades
 * 
 * RT COST FORMULA:
 * - Entry: rtLegs × quantity × $1.65
 * - Exit: rtLegs × quantity × $1.65 (same legs as entry)
 * - Total: rtLegs × 2 × quantity × $1.65
 */

import {
    getStructureRTLegs,
    pricePnLToDollars,
    calculateRTCost,
    getTotalRTLegs,
    TICK_VALUE,
    TICK_SIZE,
    RT_COST_PER_LOT
} from './structureConfig';

/**
 * Calculate FIFO P&L for a single structure's trades
 * @param {Array} trades - Array of trades for a single structure, in ENTRY ORDER
 * @param {string} structureName - Name of the structure for RT cost lookup
 * @returns {Object} P&L calculations including realized, unrealized, and match history
 */
export function calculateFIFOPnL(trades, structureName = '') {
    // IMPORTANT: Process trades in entry order (array order), NOT sorted by timestamp
    // This is because user enters trades in the order they execute them

    // Get RT legs for this structure (entry cost)
    const rtLegs = structureName ? getStructureRTLegs(structureName) : 1;
    const totalRtLegsPerRoundTrip = getTotalRTLegs(rtLegs); // entry + 1 for exit

    // Queues for open positions
    const longQueue = []; // Buys waiting to be sold
    const shortQueue = []; // Sells waiting to be covered

    // Match history for tracking
    const matches = [];

    // Running totals (in price units)
    let realizedPnL = 0;
    let totalBuyQty = 0;
    let totalSellQty = 0;
    let totalBuyCost = 0;
    let totalSellProceeds = 0;

    // Dollar totals
    let realizedPnLDollars = 0;
    let totalRTCost = 0;
    let grossPnLDollars = 0;

    // Track entry order for each trade
    let entryIndex = 0;

    for (const trade of trades) {
        const { side, quantity, price, timestamp, date } = trade;
        let remainingQty = quantity;
        entryIndex++;

        if (side === 'BUY') {
            totalBuyQty += quantity;
            totalBuyCost += quantity * price;

            // Try to match against short queue first (covering shorts)
            while (remainingQty > 0 && shortQueue.length > 0) {
                const oldestShort = shortQueue[0];
                const matchQty = Math.min(remainingQty, oldestShort.quantity);

                // Realize P&L: Short sold at shortPrice, bought back at buyPrice
                // Profit if buyPrice < shortPrice
                const pnl = matchQty * (oldestShort.price - price);
                realizedPnL += pnl;

                // Calculate dollar P&L with correct RT cost (entry + exit)
                const grossDollars = pricePnLToDollars(pnl);
                const rtCost = calculateRTCost(matchQty, rtLegs);
                const netDollars = grossDollars - rtCost;

                grossPnLDollars += grossDollars;
                totalRTCost += rtCost;
                realizedPnLDollars += netDollars;

                matches.push({
                    openTrade: { ...oldestShort },
                    closeTrade: { ...trade },
                    matchQty,
                    pnl,
                    pnlDollars: grossDollars,
                    rtCost,
                    netPnLDollars: netDollars,
                    rtLegsEntry: rtLegs,
                    rtLegsTotal: totalRtLegsPerRoundTrip,
                    type: 'COVER_SHORT',
                    closedAt: timestamp,
                    closeDate: date,
                    entryOrder: oldestShort.entryOrder,
                    exitOrder: entryIndex
                });

                remainingQty -= matchQty;
                oldestShort.quantity -= matchQty;

                if (oldestShort.quantity === 0) {
                    shortQueue.shift();
                }
            }

            // Add remaining to long queue
            if (remainingQty > 0) {
                longQueue.push({
                    ...trade,
                    quantity: remainingQty,
                    originalQty: quantity,
                    entryOrder: entryIndex
                });
            }
        } else {
            // SELL
            totalSellQty += quantity;
            totalSellProceeds += quantity * price;

            // Try to match against long queue first (closing longs)
            while (remainingQty > 0 && longQueue.length > 0) {
                const oldestLong = longQueue[0];
                const matchQty = Math.min(remainingQty, oldestLong.quantity);

                // Realize P&L: Bought at buyPrice, sold at sellPrice
                // Profit if sellPrice > buyPrice
                const pnl = matchQty * (price - oldestLong.price);
                realizedPnL += pnl;

                // Calculate dollar P&L with correct RT cost (entry + exit)
                const grossDollars = pricePnLToDollars(pnl);
                const rtCost = calculateRTCost(matchQty, rtLegs);
                const netDollars = grossDollars - rtCost;

                grossPnLDollars += grossDollars;
                totalRTCost += rtCost;
                realizedPnLDollars += netDollars;

                matches.push({
                    openTrade: { ...oldestLong },
                    closeTrade: { ...trade },
                    matchQty,
                    pnl,
                    pnlDollars: grossDollars,
                    rtCost,
                    netPnLDollars: netDollars,
                    rtLegsEntry: rtLegs,
                    rtLegsTotal: totalRtLegsPerRoundTrip,
                    type: 'CLOSE_LONG',
                    closedAt: timestamp,
                    closeDate: date,
                    entryOrder: oldestLong.entryOrder,
                    exitOrder: entryIndex
                });

                remainingQty -= matchQty;
                oldestLong.quantity -= matchQty;

                if (oldestLong.quantity === 0) {
                    longQueue.shift();
                }
            }

            // Add remaining to short queue (new short position)
            if (remainingQty > 0) {
                shortQueue.push({
                    ...trade,
                    quantity: remainingQty,
                    originalQty: quantity,
                    entryOrder: entryIndex
                });
            }
        }
    }

    // Calculate unrealized P&L and position metrics
    const openLongQty = longQueue.reduce((sum, p) => sum + p.quantity, 0);
    const openShortQty = shortQueue.reduce((sum, p) => sum + p.quantity, 0);
    const netPosition = openLongQty - openShortQty;

    const avgLongPrice = openLongQty > 0
        ? longQueue.reduce((sum, p) => sum + p.price * p.quantity, 0) / openLongQty
        : 0;
    const avgShortPrice = openShortQty > 0
        ? shortQueue.reduce((sum, p) => sum + p.price * p.quantity, 0) / openShortQty
        : 0;

    const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
    const avgSellPrice = totalSellQty > 0 ? totalSellProceeds / totalSellQty : 0;

    const closedQty = matches.reduce((sum, m) => sum + m.matchQty, 0);

    return {
        // P&L in price units
        realizedPnL,
        unrealizedPnL: 0, // Would need mark price for this

        // P&L in dollars
        realizedPnLDollars,
        grossPnLDollars,
        totalRTCost,

        // Position info
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

        // Structure info
        rtLegs,
        totalRtLegsPerRoundTrip,

        // Match history
        matches,
        longQueue: [...longQueue],
        shortQueue: [...shortQueue]
    };
}

/**
 * Calculate cumulative P&L over time for charting
 * Ordered by entry/exit order, not timestamp
 */
export function calculateCumulativePnL(matches) {
    if (!matches || matches.length === 0) return [];

    // Sort by exit order (when the position was closed)
    const sorted = [...matches].sort((a, b) => (a.exitOrder || 0) - (b.exitOrder || 0));
    let cumulative = 0;
    let cumulativeDollars = 0;

    return sorted.map((match, idx) => {
        cumulative += match.pnl;
        cumulativeDollars += match.netPnLDollars || 0;
        return {
            index: idx + 1,
            date: match.closeDate,
            timestamp: match.closedAt,
            pnl: match.pnl,
            pnlDollars: match.netPnLDollars || 0,
            cumulative,
            cumulativeDollars,
            type: match.type
        };
    });
}

/**
 * Calculate P&L by date for aggregated view
 */
export function calculateDailyPnL(matches) {
    if (!matches || matches.length === 0) return [];

    const dailyMap = {};

    for (const match of matches) {
        const dateKey = match.closeDate?.toISOString?.()?.split('T')[0] || 'unknown';
        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = {
                date: dateKey,
                pnl: 0,
                pnlDollars: 0,
                rtCost: 0,
                trades: 0
            };
        }
        dailyMap[dateKey].pnl += match.pnl;
        dailyMap[dateKey].pnlDollars += match.netPnLDollars || 0;
        dailyMap[dateKey].rtCost += match.rtCost || 0;
        dailyMap[dateKey].trades += 1;
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Add cumulative
    let cumulative = 0;
    let cumulativeDollars = 0;
    return daily.map(day => {
        cumulative += day.pnl;
        cumulativeDollars += day.pnlDollars;
        return { ...day, cumulative, cumulativeDollars };
    });
}

/**
 * Calculate P&L statistics for a structure
 * A SCRATCH is a trade where gross P&L = 0 (same entry/exit price)
 * Scratches are NOT counted as losses, only as cost (RT fees)
 */
export function calculatePnLStats(matches) {
    if (!matches || matches.length === 0) {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            scratchTrades: 0,
            winRate: 0,
            scratchRate: 0,
            avgWin: 0,
            avgLoss: 0,
            avgWinDollars: 0,
            avgLossDollars: 0,
            maxWin: 0,
            maxLoss: 0,
            maxWinDollars: 0,
            maxLossDollars: 0,
            profitFactor: 0,
            totalVolume: 0,
            totalRTs: 0,
            tickCapture: {
                avgTicksWon: 0,
                avgTicksLost: 0,
                distribution: {},
                winsByTicks: {}
            }
        };
    }

    // Classify trades: Win (gross > 0), Loss (gross < 0), Scratch (gross = 0)
    // A scratch has pnlDollars = 0 (same price in and out), but pays RT cost
    const wins = matches.filter(m => (m.pnlDollars || 0) > 0);
    const scratches = matches.filter(m => (m.pnlDollars || 0) === 0);
    const losses = matches.filter(m => (m.pnlDollars || 0) < 0);

    const totalWins = wins.reduce((sum, m) => sum + m.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, m) => sum + m.pnl, 0));

    const totalWinsDollars = wins.reduce((sum, m) => sum + (m.netPnLDollars || 0), 0);
    const totalLossesDollars = Math.abs(losses.reduce((sum, m) => sum + (m.netPnLDollars || 0), 0));

    const totalLots = matches.reduce((sum, m) => sum + m.matchQty, 0);
    // Total RT legs = sum of (matchQty × rtLegsTotal) = rtCost ÷ $1.65
    const totalRTCostFromMatches = matches.reduce((sum, m) => sum + (m.rtCost || 0), 0);
    const totalRTLegs = Math.round(totalRTCostFromMatches / 1.65); // Actual RT legs charged

    // Win rate excludes scratches from denominator for fair comparison
    const decisiveTrades = wins.length + losses.length;

    // Calculate tick capture distribution for winning trades
    const tickCapture = calculateTickCapture(wins, losses, TICK_SIZE);

    return {
        totalTrades: matches.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        scratchTrades: scratches.length,
        winRate: decisiveTrades > 0 ? (wins.length / decisiveTrades) * 100 : 0,
        scratchRate: matches.length > 0 ? (scratches.length / matches.length) * 100 : 0,
        avgWin: wins.length > 0 ? totalWins / wins.length : 0,
        avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
        avgWinDollars: wins.length > 0 ? totalWinsDollars / wins.length : 0,
        avgLossDollars: losses.length > 0 ? totalLossesDollars / losses.length : 0,
        maxWin: wins.length > 0 ? Math.max(...wins.map(m => m.pnl)) : 0,
        maxLoss: losses.length > 0 ? Math.min(...losses.map(m => m.pnl)) : 0,
        maxWinDollars: wins.length > 0 ? Math.max(...wins.map(m => m.netPnLDollars || 0)) : 0,
        maxLossDollars: losses.length > 0 ? Math.min(...losses.map(m => m.netPnLDollars || 0)) : 0,
        profitFactor: totalLossesDollars > 0 ? totalWinsDollars / totalLossesDollars : totalWinsDollars > 0 ? Infinity : 0,
        totalLots,
        totalRTLegs,
        tickCapture
    };
}

/**
 * Calculate tick capture distribution for trades
 * Shows what percentage of winning trades captured 1 tick, 2 ticks, etc.
 * IMPORTANT: Uses GROSS price movement only (entry price vs exit price), not quantity-weighted
 */
function calculateTickCapture(wins, losses, tickSize) {
    if (wins.length === 0 && losses.length === 0) {
        return {
            avgTicksWon: 0,
            avgTicksLost: 0,
            distribution: {},
            winsByTicks: {},
            lossesByTicks: {}
        };
    }

    /**
     * Calculate ticks from price movement only (not quantity-weighted)
     * - For CLOSE_LONG: ticks = (exitPrice - entryPrice) / tickSize
     * - For COVER_SHORT: ticks = (entryPrice - exitPrice) / tickSize
     */
    const getTicksFromMatch = (match) => {
        const entryPrice = match.openTrade?.price || 0;
        const exitPrice = match.closeTrade?.price || 0;

        // For longs: profit when exit > entry, for shorts: profit when entry > exit
        // The type tells us the direction
        if (match.type === 'CLOSE_LONG') {
            return (exitPrice - entryPrice) / tickSize;
        } else if (match.type === 'COVER_SHORT') {
            return (entryPrice - exitPrice) / tickSize;
        }
        // Fallback: use pnl / matchQty / tickSize (price diff per unit)
        const matchQty = match.matchQty || 1;
        return (match.pnl || 0) / matchQty / tickSize;
    };

    // Calculate ticks for each winning trade (based on price movement only)
    const winTicks = wins.map(m => {
        const ticks = Math.round(getTicksFromMatch(m));
        return { ticks, grossDollars: m.pnlDollars || 0 };
    });

    // Calculate ticks for each losing trade (absolute value)
    const lossTicks = losses.map(m => {
        const ticks = Math.abs(Math.round(getTicksFromMatch(m)));
        return { ticks, grossDollars: Math.abs(m.pnlDollars || 0) };
    });

    // Average ticks won/lost
    const totalTicksWon = winTicks.reduce((sum, w) => sum + w.ticks, 0);
    const totalTicksLost = lossTicks.reduce((sum, l) => sum + l.ticks, 0);
    const avgTicksWon = wins.length > 0 ? totalTicksWon / wins.length : 0;
    const avgTicksLost = losses.length > 0 ? totalTicksLost / losses.length : 0;

    // Group wins by tick capture (1, 2, 3, 4, 5+)
    const winsByTicks = {};
    for (const w of winTicks) {
        const bucket = w.ticks >= 5 ? '5+' : String(w.ticks);
        if (!winsByTicks[bucket]) {
            winsByTicks[bucket] = { count: 0, totalGrossPnL: 0 };
        }
        winsByTicks[bucket].count++;
        winsByTicks[bucket].totalGrossPnL += w.grossDollars;
    }

    // Calculate percentages for win distribution
    const distribution = {};
    for (const [ticks, data] of Object.entries(winsByTicks)) {
        distribution[ticks] = {
            count: data.count,
            percent: (data.count / wins.length) * 100,
            totalGrossPnL: data.totalGrossPnL,
            avgGrossPnL: data.totalGrossPnL / data.count
        };
    }

    // Group losses by tick loss
    const lossesByTicks = {};
    for (const l of lossTicks) {
        const bucket = l.ticks >= 5 ? '5+' : String(l.ticks);
        if (!lossesByTicks[bucket]) {
            lossesByTicks[bucket] = { count: 0, totalGrossPnL: 0 };
        }
        lossesByTicks[bucket].count++;
        lossesByTicks[bucket].totalGrossPnL += l.grossDollars;
    }

    // Calculate top 3 tick captures (sorted by percentage)
    const top3 = Object.entries(distribution)
        .sort((a, b) => b[1].percent - a[1].percent)
        .slice(0, 3)
        .map(([ticks, data]) => ({
            ticks,
            count: data.count,
            percent: data.percent
        }));

    return {
        avgTicksWon,
        avgTicksLost,
        distribution,
        winsByTicks,
        lossesByTicks,
        top3
    };
}

// Export constants for use in components
export { TICK_VALUE, TICK_SIZE, RT_COST_PER_LOT };
