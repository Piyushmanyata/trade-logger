/**
 * Structure Configuration
 * Contains RT (round-trip) costs and other metadata for each structure
 * 
 * RT COST FORMULA:
 * - Entry: rtLegs × quantity × $1.65
 * - Exit: rtLegs × quantity × $1.65 (same legs as entry)
 * - Total per round-trip: rtLegs × 2 × quantity × $1.65
 */

// Trading constants (can be customized via settings)
export let TICK_VALUE = 16.5; // $16.5 per tick
export let TICK_SIZE = 0.005; // 0.005 price units per tick
export let RT_COST_PER_LOT = 1.65; // $1.65 per leg per lot

/**
 * Update trading constants
 */
export function updateTradingConstants(tickValue, tickSize, rtCost) {
    if (tickValue !== undefined) TICK_VALUE = tickValue;
    if (tickSize !== undefined) TICK_SIZE = tickSize;
    if (rtCost !== undefined) RT_COST_PER_LOT = rtCost;
}

/**
 * Calendar span categories based on month difference
 */
export const CALENDAR_SPANS = {
    '3mo': { label: '3 Month Calendar', rtLegs: 1 },
    '6mo': { label: '6 Month Calendar', rtLegs: 1 },
    '9mo': { label: '9 Month Calendar', rtLegs: 1 },
    '12mo': { label: '12 Month Calendar', rtLegs: 1 },
};

/**
 * RT (Round-Trip) legs per structure on ENTRY
 * Exit always costs 1 additional RT per lot
 */
export const STRUCTURE_RT_LEGS = {
    // SO3 3mo Calendars (1 RT entry)
    'SO3 Mar26-Jun26 Calendar': 1,
    'SO3 Jun26-Sep26 Calendar': 1,
    'SO3 Sep26-Dec26 Calendar': 1,
    'SO3 Dec26-Mar27 Calendar': 1,
    'SO3 Mar27-Jun27 Calendar': 1,
    'SO3 Jun27-Sep27 Calendar': 1,
    'SO3 Sep27-Dec27 Calendar': 1,
    'SO3 Dec27-Mar28 Calendar': 1,

    // SO3 6mo Calendars (1 RT entry)
    'SO3 Mar26-Sep26 Calendar': 1,
    'SO3 Jun26-Dec26 Calendar': 1,
    'SO3 Sep26-Mar27 Calendar': 1,
    'SO3 Dec26-Jun27 Calendar': 1,
    'SO3 Mar27-Sep27 Calendar': 1,
    'SO3 Jun27-Dec27 Calendar': 1,

    // SO3 9mo Calendars (1 RT entry)
    'SO3 Mar26-Dec26 Calendar': 1,
    'SO3 Jun26-Mar27 Calendar': 1,
    'SO3 Sep26-Jun27 Calendar': 1,
    'SO3 Dec26-Sep27 Calendar': 1,
    'SO3 Mar27-Dec27 Calendar': 1,
    'SO3 Jun27-Mar28 Calendar': 1,
    'SO3 Sep27-Jun28 Calendar': 1,

    // SO3 3mo Butterflies (2 RT entry)
    'SO3 Mar26 3mo Butterfly': 2,
    'SO3 Jun26 3mo Butterfly': 2,
    'SO3 Sep26 3mo Butterfly': 2,
    'SO3 Dec26 3mo Butterfly': 2,
    'SO3 Mar27 3mo Butterfly': 2,
    'SO3 Jun27 3mo Butterfly': 2,
    'SO3 Sep27 3mo Butterfly': 2,
    'SO3 Sep25 3mo Butterfly': 2,

    // SON D-Flies (4 RT entry)
    'SON Mar26 D-Fly': 4,
    'SON Jun26 D-Fly': 4,
    'SON Sep26 D-Fly': 4,
    'SON Dec26 D-Fly': 4,
    'SON Mar27 D-Fly': 4,
    'SON Jun27 D-Fly': 4,

    // SON 3 Flies (2 RT entry)
    'SON Mar26 3 Fly': 2,
    'SON Jun26 3 Fly': 2,
    'SON Sep26 3 Fly': 2,
    'SON Dec26 3 Fly': 2,
    'SON Mar27 3 Fly': 2,
    'SON Jun27 3 Fly': 2,
    'SON Sep27 3 Fly': 2,

    // SON 3 D-Flies (4 RT entry)
    'SON Mar26 3 D-Fly': 4,
    'SON Jun26 3 D-Fly': 4,
    'SON Sep26 3 D-Fly': 4,
    'SON Dec26 3 D-Fly': 4,

    // SON Fly Condors (6 RT entry)
    'SON Sep26 Fly Condor': 6,
    'SON Dec26 Fly Condor': 6,
    'SON Mar27 Fly Condor': 6,
    'SON Jun27 Fly Condor': 6,

    // SO3 3mo Condors (2 RT entry)
    'SO3 Sep26 3mo Condor': 2,
    'SO3 Dec26 3mo Condor': 2,
    'SO3 Mar27 3mo Condor': 2,
    'SO3 Jun27 3mo Condor': 2,

    // Outrights (0.5 RT entry)
    'SA3 Dec25': 0.5,
    'ER3 Dec25': 0.5,
};

// Custom structures added by user (stored in localStorage)
let customStructures = {};

/**
 * Load custom structures from localStorage
 */
export function loadCustomStructures() {
    try {
        const saved = localStorage.getItem('tradeLogger_customStructures');
        if (saved) {
            customStructures = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load custom structures:', e);
    }
}

/**
 * Save custom structures to localStorage
 */
export function saveCustomStructures() {
    try {
        localStorage.setItem('tradeLogger_customStructures', JSON.stringify(customStructures));
    } catch (e) {
        console.error('Failed to save custom structures:', e);
    }
}

/**
 * Add a custom structure
 */
export function addCustomStructure(name, rtLegs) {
    customStructures[name] = rtLegs;
    saveCustomStructures();
}

/**
 * Remove a custom structure
 */
export function removeCustomStructure(name) {
    delete customStructures[name];
    saveCustomStructures();
}

/**
 * Get all custom structures
 */
export function getCustomStructures() {
    return { ...customStructures };
}

/**
 * Calculate calendar span in months from tenor names
 */
export function getCalendarSpan(structureName) {
    const months = ['Mar', 'Jun', 'Sep', 'Dec'];
    const tenorMatch = structureName.match(/(Mar|Jun|Sep|Dec)(\d{2})-(Mar|Jun|Sep|Dec)(\d{2})/);

    if (!tenorMatch) return null;

    const [, frontMonth, frontYear, backMonth, backYear] = tenorMatch;
    const frontIdx = months.indexOf(frontMonth);
    const backIdx = months.indexOf(backMonth);
    const yearDiff = parseInt(backYear) - parseInt(frontYear);

    let quarterDiff = backIdx - frontIdx + (yearDiff * 4);
    if (quarterDiff < 0) quarterDiff += 4;

    const monthDiff = quarterDiff * 3;

    if (monthDiff <= 3) return '3mo';
    if (monthDiff <= 6) return '6mo';
    if (monthDiff <= 9) return '9mo';
    return '12mo';
}

/**
 * Get RT legs for a structure (with fuzzy matching for variations)
 */
export function getStructureRTLegs(structureName) {
    // Check custom structures first
    if (customStructures[structureName] !== undefined) {
        return customStructures[structureName];
    }

    // Direct match in predefined structures
    if (STRUCTURE_RT_LEGS[structureName] !== undefined) {
        return STRUCTURE_RT_LEGS[structureName];
    }

    // Fuzzy match - try case-insensitive and with variations
    const normalized = structureName.toLowerCase().trim();

    for (const [key, value] of Object.entries(STRUCTURE_RT_LEGS)) {
        if (key.toLowerCase() === normalized) {
            return value;
        }
    }

    // Check custom structures case-insensitively
    for (const [key, value] of Object.entries(customStructures)) {
        if (key.toLowerCase() === normalized) {
            return value;
        }
    }

    // Pattern-based matching for unknown structures (order matters!)
    if (normalized.includes('fly condor')) return 6;
    if (normalized.includes('3 d-fly') || normalized.includes('3 d fly')) return 4;
    if (normalized.includes('d-fly') || normalized.includes('d fly')) return 4;
    if (normalized.includes('3 fly')) return 2;
    if (normalized.includes('3mo butterfly') || normalized.includes('butterfly')) return 2;
    if (normalized.includes('3mo condor') || normalized.includes('condor')) return 2;
    if (normalized.includes('calendar')) return 1;

    // Default to 1 RT if unknown
    console.warn(`Unknown structure RT for: ${structureName}, defaulting to 1`);
    return 1;
}

/**
 * Calculate the number of ticks from a price difference
 */
export function priceToTicks(priceDiff) {
    return priceDiff / TICK_SIZE;
}

/**
 * Convert price P&L to dollar P&L
 */
export function pricePnLToDollars(pricePnL) {
    const ticks = priceToTicks(pricePnL);
    return ticks * TICK_VALUE;
}

/**
 * Calculate RT cost for a CLOSED trade (entry + exit)
 * Entry and Exit both cost rtLegs per lot (same structure legs)
 * 
 * @param {number} quantity - Number of lots traded
 * @param {number} rtLegs - Number of RT legs for the structure
 * @returns {number} Total RT cost in dollars for the round-trip
 */
export function calculateRTCost(quantity, rtLegs) {
    // Entry RT + Exit RT (same legs for both)
    const totalLegs = rtLegs * 2;
    return quantity * totalLegs * RT_COST_PER_LOT;
}

/**
 * Get the total RT legs for a complete round-trip (entry + exit)
 */
export function getTotalRTLegs(rtLegs) {
    return rtLegs * 2;
}

// Initialize custom structures on load
loadCustomStructures();
