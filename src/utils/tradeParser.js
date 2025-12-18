/**
 * Trade Parser Utility
 * Robust parser that handles various formats and field misalignments
 */

import { getCalendarSpan } from './structureConfig';

// Known structure patterns for intelligent detection (order matters - more specific first)
const STRUCTURE_PATTERNS = [
    // Calendars
    /SO3\s+\w+\d{2}[-–]\w+\d{2}\s+Calendar/i,
    // Butterflies
    /SO3\s+\w+\d{2}\s+3mo\s+Butterfly/i,
    // Condors
    /SO3\s+\w+\d{2}\s+3mo\s+Condor/i,
    // Fly Condors (must come before D-Fly)
    /SON\s+\w+\d{2}\s+Fly\s+Condor/i,
    // 3 D-Flies (must come before D-Fly)
    /SON\s+\w+\d{2}\s+3\s+D-?Fly/i,
    // 3 Flies (must come before general Fly)
    /SON\s+\w+\d{2}\s+3\s+Fly/i,
    // D-Flies
    /SON\s+\w+\d{2}\s+D-?[Ff]ly/i,
    // Outrights - SO3, SA3, ER3 followed by tenor OR just price (SA3 Dec25, SO3 Mar26)
    /S[OA]3\s+\w+\d{2}(?!\s*[-–]\w+\d{2})/i,
    /ER3\s+\w+\d{2}/i,
];

// Exchange patterns - more permissive
const EXCHANGE_PATTERN = /^(ICE[_\-]?[A-Z]*|CME[_\-]?[A-Z]*|NYMEX|COMEX|ASE|EUREX|[A-Z]{2,6}[_\-][A-Z]+)\*?$/i;

// Date patterns
const DATE_PATTERNS = [
    // "Monday, 16 June, 2025"
    /\w+day,?\s+(\d{1,2})\s+(\w+),?\s+(\d{4})/i,
    // "16 June 2025"
    /(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    // "2025-06-16"
    /(\d{4})-(\d{2})-(\d{2})/,
    // "06/16/2025" or "16/06/2025"
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/
];

// Time patterns
const TIME_PATTERNS = [
    /(\d{1,2})[.:·](\d{2})[.:·](\d{2})(?:[.:·](\d+))?/,
    /(\d{1,2}):(\d{2}):(\d{2})/,
    /(\d{1,2}):(\d{2})/
];

// Side patterns
const BUY_PATTERNS = /^(B|BUY|BOUGHT|LONG)$/i;
const SELL_PATTERNS = /^(S|SELL|SOLD|SHORT)$/i;

/**
 * Intelligent field detection using patterns
 */
function detectFieldType(value) {
    const trimmed = value.trim();

    // Check if it's a price (negative or positive decimal)
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
        const num = parseFloat(trimmed);
        // Quantities are usually small integers, prices have decimals
        if (Number.isInteger(num) && num > 0 && num < 1000) {
            return { type: 'quantity', value: num };
        }
        return { type: 'price', value: num };
    }

    // Check for side
    if (BUY_PATTERNS.test(trimmed)) return { type: 'side', value: 'BUY' };
    if (SELL_PATTERNS.test(trimmed)) return { type: 'side', value: 'SELL' };

    // Check for exchange
    if (EXCHANGE_PATTERN.test(trimmed)) return { type: 'exchange', value: trimmed.replace('*', '') };

    // Check for structure (multi-word patterns)
    for (const pattern of STRUCTURE_PATTERNS) {
        if (pattern.test(trimmed)) return { type: 'structure', value: trimmed };
    }

    // Check for date (DD-MM-YY format)
    if (/^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}$/.test(trimmed)) {
        return { type: 'date', value: trimmed };
    }
    for (const pattern of DATE_PATTERNS) {
        if (pattern.test(trimmed)) return { type: 'date', value: trimmed };
    }

    // Check for time (various formats including with milliseconds)
    if (/^\d{1,2}[.:]?\d{2}[.:]?\d{2}/.test(trimmed)) {
        return { type: 'time', value: trimmed };
    }
    for (const pattern of TIME_PATTERNS) {
        if (pattern.test(trimmed)) return { type: 'time', value: trimmed };
    }

    // Could be part of structure name (various prefixes and structure types)
    if (/^(SO3|SON|SA3|ER3|Calendar|Butterfly|Condor|Fly|D-?Fly)/i.test(trimmed)) {
        return { type: 'structure_part', value: trimmed };
    }

    return { type: 'unknown', value: trimmed };
}

/**
 * Parse date string with multiple format support
 * Priority: DD-MM-YY (European) > DD-MM-YYYY > ISO > US
 */
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Clean up the date string
    const cleaned = dateStr.trim();

    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];

    // Try "Monday, 16 June, 2025" or "16 June 2025"
    const match1 = cleaned.match(/(\d{1,2})\s+(\w+),?\s+(\d{4})/);
    if (match1) {
        const [, day, month, year] = match1;
        const monthIndex = monthNames.findIndex(m => m.startsWith(month.toLowerCase()));
        if (monthIndex >= 0) {
            return new Date(parseInt(year), monthIndex, parseInt(day));
        }
    }

    // Try ISO "2025-06-16"
    const matchISO = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (matchISO) {
        const [, year, month, day] = matchISO;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Try DD-MM-YY or DD-MM-YYYY or D-M-YY (European format with dash, slash, or dot)
    // This is the most common format in the data: 16-6-25, 1-7-25, 23-10-25
    const matchEuro = cleaned.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
    if (matchEuro) {
        let [, day, month, year] = matchEuro;

        // Parse year: 2-digit years are 2000s (25 -> 2025)
        let fullYear = parseInt(year);
        if (fullYear < 100) {
            fullYear = 2000 + fullYear;
        }

        // Parse month and day
        const monthInt = parseInt(month);
        const dayInt = parseInt(day);

        // European format: DD-MM-YY
        // Validate: month should be 1-12
        if (monthInt >= 1 && monthInt <= 12 && dayInt >= 1 && dayInt <= 31) {
            return new Date(fullYear, monthInt - 1, dayInt);
        }
    }

    // Fallback to Date constructor
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parse time string and apply to date
 * Handles: HH.MM.SS, HH:MM:SS, HH:MM:SS.mmm (with milliseconds)
 */
function parseTime(timeStr, date) {
    if (!timeStr || !date) return date;

    // Clean up: remove trailing spaces, replace various separators with :
    let cleaned = timeStr.trim();

    // Handle format like "15:11:15.718 " - extract just time part, ignore milliseconds for Date
    // Remove milliseconds portion after seconds (e.g., .718)
    cleaned = cleaned.replace(/(\d{2})\.\d+\s*$/, '$1');

    // Replace . with : for dot-separated times like 16.38.25
    cleaned = cleaned.replace(/[.:·]/g, ':');

    const parts = cleaned.split(':').map(p => parseInt(p) || 0);

    if (parts.length >= 2) {
        date.setHours(parts[0]);
        date.setMinutes(parts[1]);
        if (parts.length >= 3) {
            date.setSeconds(parts[2]);
        }
    }

    return date;
}

/**
 * Normalize structure name for consistent grouping
 * Handles case variations and whitespace issues
 */
function normalizeStructureName(structure) {
    if (!structure) return '';
    let normalized = structure.trim();

    // Normalize D-Fly/D-fly/D Fly/d-fly variations
    normalized = normalized.replace(/D[-\s]?[Ff]ly/gi, 'D-Fly');

    // Normalize 3 D-Fly/3D-Fly/3 D Fly variations (must come before 3 Fly)
    normalized = normalized.replace(/3\s*D[-\s]?[Ff]ly/gi, '3 D-Fly');

    // Normalize 3 Fly/3-Fly/3Fly (but not "3 D-Fly" or followed by Condor)
    normalized = normalized.replace(/3\s+[Ff]ly(?!\s*Condor)(?!\s*D)/gi, '3 Fly');

    // Normalize Fly Condor
    normalized = normalized.replace(/[Ff]ly\s*[Cc]ondor/gi, 'Fly Condor');

    // Normalize 3mo Butterfly
    normalized = normalized.replace(/3mo\s*[Bb]utterfly/gi, '3mo Butterfly');

    // Normalize 3mo Condor
    normalized = normalized.replace(/3mo\s*[Cc]ondor/gi, '3mo Condor');

    // Normalize Calendar
    normalized = normalized.replace(/[Cc]alendar/g, 'Calendar');

    // Normalize Butterfly (standalone)
    normalized = normalized.replace(/[Bb]utterfly/g, 'Butterfly');

    // Normalize Condor (standalone)
    normalized = normalized.replace(/[Cc]ondor/g, 'Condor');

    // Normalize dash between tenors (Mar26-Jun26, etc.)
    normalized = normalized.replace(/(\w{3}\d{2})\s*[–—-]\s*(\w{3}\d{2})/g, '$1-$2');

    return normalized;
}

/**
 * Robust parsing of a single line - handles field misalignment
 */
function parseTradeRow(row) {
    if (!row || !row.trim()) return null;

    // Split by tabs first, then try other delimiters
    let parts = row.split('\t').map(p => p.trim()).filter(p => p);

    // If only 1-2 parts, try splitting by multiple spaces
    if (parts.length < 3) {
        parts = row.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
    }

    // Still not enough parts, try comma
    if (parts.length < 3) {
        parts = row.split(',').map(p => p.trim()).filter(p => p);
    }

    if (parts.length < 4) return null;

    // Intelligently detect each field
    const detected = parts.map(p => detectFieldType(p));

    // Build trade object from detected fields
    let trade = {
        date: null,
        time: null,
        exchange: null,
        structure: null,
        side: null,
        quantity: null,
        price: null
    };

    // Collect structure parts
    let structureParts = [];

    for (const field of detected) {
        switch (field.type) {
            case 'date':
                if (!trade.date) trade.date = field.value;
                break;
            case 'time':
                if (!trade.time) trade.time = field.value;
                break;
            case 'exchange':
                if (!trade.exchange) trade.exchange = field.value;
                break;
            case 'structure':
                trade.structure = field.value;
                break;
            case 'structure_part':
                structureParts.push(field.value);
                break;
            case 'side':
                if (!trade.side) trade.side = field.value;
                break;
            case 'quantity':
                if (!trade.quantity) trade.quantity = field.value;
                break;
            case 'price':
                // Price is usually last, can have multiple numbers
                trade.price = field.value;
                break;
        }
    }

    // Reconstruct structure from parts if needed
    if (!trade.structure && structureParts.length > 0) {
        trade.structure = structureParts.join(' ');
    }

    // Validate required fields
    if (!trade.structure || trade.side === null) {
        // Try positional parsing as fallback
        return parseTradeRowPositional(parts);
    }

    // Parse and validate date
    const parsedDate = parseDate(trade.date);
    if (!parsedDate) return null;

    // Apply time
    parseTime(trade.time, parsedDate);

    // Normalize
    const normalizedStructure = normalizeStructureName(trade.structure);

    // Ensure quantity
    if (!trade.quantity || trade.quantity <= 0) {
        trade.quantity = 1; // Default to 1 if not detected
    }

    return {
        id: `${parsedDate.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
        date: parsedDate,
        dateStr: parsedDate.toISOString().split('T')[0],
        time: trade.time || '',
        exchange: trade.exchange || 'UNKNOWN',
        structure: normalizedStructure,
        originalStructure: trade.structure,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price || 0,
        timestamp: parsedDate.getTime()
    };
}

/**
 * Fallback: positional parsing (original behavior)
 */
function parseTradeRowPositional(parts) {
    if (parts.length < 7) return null;

    const [dateStr, timeStr, exchange, structure, side, qtyStr, priceStr] = parts;

    const parsedDate = parseDate(dateStr);
    if (!parsedDate) return null;

    parseTime(timeStr, parsedDate);

    const normalizedStructure = normalizeStructureName(structure);
    const normalizedSide = BUY_PATTERNS.test(side) ? 'BUY' : SELL_PATTERNS.test(side) ? 'SELL' : null;

    if (!normalizedSide) return null;

    const quantity = parseInt(qtyStr) || 0;
    const price = parseFloat(priceStr) || 0;

    if (quantity === 0) return null;

    return {
        id: `${parsedDate.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
        date: parsedDate,
        dateStr: parsedDate.toISOString().split('T')[0],
        time: timeStr,
        exchange: (exchange || '').replace('*', '').trim(),
        structure: normalizedStructure,
        originalStructure: structure,
        side: normalizedSide,
        quantity,
        price,
        timestamp: parsedDate.getTime()
    };
}

/**
 * Parse multiple lines of trade data with error tracking
 */
export function parseTrades(input) {
    if (!input || typeof input !== 'string') return { trades: [], errors: [] };

    const lines = input.split('\n').filter(line => line.trim());
    const trades = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
        try {
            const trade = parseTradeRow(lines[i]);
            if (trade) {
                trades.push(trade);
            } else {
                errors.push({ line: i + 1, content: lines[i].substring(0, 50), reason: 'Could not parse' });
            }
        } catch (e) {
            errors.push({ line: i + 1, content: lines[i].substring(0, 50), reason: e.message });
        }
    }

    // Sort by timestamp
    trades.sort((a, b) => a.timestamp - b.timestamp);

    return { trades, errors };
}

/**
 * Create a trade object from manual entry
 */
export function createManualTrade(data) {
    const { date, time, exchange, structure, side, quantity, price } = data;

    // Validate required fields
    if (!structure || !side || !quantity) {
        throw new Error('Structure, side, and quantity are required');
    }

    // Parse date
    let parsedDate = date instanceof Date ? date : new Date(date);
    if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
    }

    // Apply time if provided
    if (time) {
        const [hours, minutes] = time.split(':');
        parsedDate.setHours(parseInt(hours) || 0);
        parsedDate.setMinutes(parseInt(minutes) || 0);
    }

    const normalizedStructure = normalizeStructureName(structure);
    const normalizedSide = side.toUpperCase() === 'BUY' || side.toUpperCase() === 'B' ? 'BUY' : 'SELL';

    return {
        id: `${parsedDate.getTime()}-${Math.random().toString(36).substring(2, 11)}`,
        date: parsedDate,
        dateStr: parsedDate.toISOString().split('T')[0],
        time: time || parsedDate.toTimeString().split(' ')[0],
        exchange: exchange || 'MANUAL',
        structure: normalizedStructure,
        originalStructure: structure,
        side: normalizedSide,
        quantity: parseInt(quantity) || 1,
        price: parseFloat(price) || 0,
        timestamp: parsedDate.getTime()
    };
}

/**
 * Get list of known structures for autocomplete
 */
export function getKnownStructures(existingTrades = []) {
    // Start with some common structures
    const structures = new Set([
        'SO3 Mar26-Jun26 Calendar',
        'SO3 Jun26-Sep26 Calendar',
        'SO3 Sep26-Dec26 Calendar',
        'SO3 Mar26 3mo Butterfly',
        'SO3 Jun26 3mo Butterfly',
        'SON Sep26 D-Fly',
        'SON Dec26 D-Fly',
        'SON Mar27 D-Fly',
        'SON Sep26 3 Fly',
        'SON Dec26 3 Fly',
        'SON Sep26 Fly Condor',
    ]);

    // Add structures from existing trades
    existingTrades.forEach(t => {
        if (t.structure) structures.add(t.structure);
    });

    return Array.from(structures).sort();
}

/**
 * Extract structure metadata from structure name
 */
export function parseStructureMetadata(structureName) {
    const metadata = {
        instrument: '',
        tenor: '',
        type: '',
        calendarSpan: null,
        fullName: structureName
    };

    // Extract instrument (SO3, SON, SA3, ER3)
    const instrumentMatch = structureName.match(/^(SO3|SON|SA3|ER3)/);
    if (instrumentMatch) {
        metadata.instrument = instrumentMatch[1];
    }

    // Extract tenor (Mar26, Jun26, Sep26, Dec26, etc.)
    const tenorMatch = structureName.match(/((?:Mar|Jun|Sep|Dec)\d{2})/g);
    if (tenorMatch) {
        metadata.tenor = tenorMatch.join('-');
    }

    // Extract structure type (order matters - check specific before general!)
    if (structureName.includes('Fly Condor')) {
        metadata.type = 'Fly Condor';
    } else if (structureName.includes('3 D-Fly')) {
        metadata.type = '3 D-Fly';
    } else if (structureName.includes('3 Fly')) {
        metadata.type = '3 Fly';
    } else if (structureName.includes('D-Fly')) {
        metadata.type = 'D-Fly';
    } else if (structureName.includes('3mo Butterfly')) {
        metadata.type = '3mo Butterfly';
    } else if (structureName.includes('3mo Condor')) {
        metadata.type = '3mo Condor';
    } else if (structureName.includes('Condor')) {
        metadata.type = 'Condor';
    } else if (structureName.includes('Calendar')) {
        const span = getCalendarSpan(structureName);
        if (span) {
            metadata.calendarSpan = span;
            metadata.type = `${span.replace('mo', ' Month')} Calendar`;
        } else {
            metadata.type = 'Calendar';
        }
    } else if (structureName.startsWith('SA3') || structureName.startsWith('ER3')) {
        // Outrights (single futures contracts)
        metadata.type = 'Outright';
    } else {
        metadata.type = 'Unknown';
    }

    return metadata;
}

/**
 * Group trades by structure
 */
export function groupTradesByStructure(trades) {
    const groups = {};

    for (const trade of trades) {
        if (!groups[trade.structure]) {
            groups[trade.structure] = {
                name: trade.structure,
                metadata: parseStructureMetadata(trade.structure),
                trades: []
            };
        }
        groups[trade.structure].trades.push(trade);
    }

    return groups;
}
