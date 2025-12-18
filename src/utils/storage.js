/**
 * LocalStorage persistence layer for trades
 */

const STORAGE_KEY = 'tradeLogger_trades';
const SETTINGS_KEY = 'tradeLogger_settings';

/**
 * Save trades to localStorage
 * Clears storage when given empty array
 */
export function saveTrades(trades) {
    try {
        if (!trades || trades.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        }
        const serialized = JSON.stringify(trades.map(t => ({
            ...t,
            // Defensive: handle case where date might be invalid
            date: t.date?.toISOString?.() || new Date().toISOString()
        })));
        localStorage.setItem(STORAGE_KEY, serialized);
        return true;
    } catch (error) {
        console.error('Failed to save trades:', error);
        return false;
    }
}

/**
 * Load trades from localStorage
 */
export function loadTrades() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];

        const parsed = JSON.parse(data);
        return parsed.map(t => ({
            ...t,
            date: new Date(t.date),
            timestamp: new Date(t.date).getTime()
        }));
    } catch (error) {
        console.error('Failed to load trades:', error);
        return [];
    }
}

/**
 * Clear all trades
 */
export function clearTrades() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Failed to clear trades:', error);
        return false;
    }
}

/**
 * Export trades as JSON file
 */
export function exportTrades(trades) {
    const data = JSON.stringify(trades, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export trades as CSV with proper escaping
 */
export function exportTradesCSV(trades) {
    // Helper to escape CSV fields with commas, quotes, or newlines
    const escapeCSV = (value) => {
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headers = ['Date', 'Time', 'Exchange', 'Structure', 'Side', 'Quantity', 'Price'];
    const rows = trades.map(t => [
        t.date.toISOString().split('T')[0],
        t.time,
        escapeCSV(t.exchange),
        escapeCSV(t.structure),
        t.side,
        t.quantity,
        t.price
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Save settings
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('Failed to save settings:', error);
        return false;
    }
}

/**
 * Load settings
 */
export function loadSettings() {
    try {
        const data = localStorage.getItem(SETTINGS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Failed to load settings:', error);
        return {};
    }
}
