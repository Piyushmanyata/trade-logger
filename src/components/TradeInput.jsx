import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Plus, ChevronUp, ClipboardPaste, Trash2,
    Download, FileText, X, Check, AlertCircle
} from 'lucide-react';
import { parseTrades, createManualTrade, getKnownStructures } from '../utils/tradeParser';

/**
 * Fuzzy match scoring - higher score = better match
 * Matches partial words anywhere in the string
 */
function fuzzyMatch(query, target) {
    if (!query || !target) return 0;

    const queryLower = query.toLowerCase().trim();
    const targetLower = target.toLowerCase();

    // Exact match
    if (targetLower === queryLower) return 100;

    // Contains full query
    if (targetLower.includes(queryLower)) return 80;

    // Split query into words and check if all exist in target
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    const targetWords = targetLower.split(/\s+/);

    let matchCount = 0;
    for (const qWord of queryWords) {
        for (const tWord of targetWords) {
            if (tWord.includes(qWord)) {
                matchCount++;
                break;
            }
        }
    }

    // All query words found in target
    if (matchCount === queryWords.length) {
        return 60 + (matchCount * 5);
    }

    // Partial word matches
    if (matchCount > 0) {
        return 30 + (matchCount * 10);
    }

    return 0;
}

export default function TradeInput({ onTradesAdded, tradesCount, onClearAll, onExport, existingTrades = [] }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState('paste');
    const [input, setInput] = useState('');
    const [parseStatus, setParseStatus] = useState(null);
    const [parseErrors, setParseErrors] = useState([]);

    // Manual entry form state
    const [manualForm, setManualForm] = useState({
        structure: '',
        side: 'BUY',
        quantity: '1',
        price: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        exchange: 'ICE_L'
    });
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const structureInputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Get known structures for autocomplete
    const knownStructures = useMemo(() =>
        getKnownStructures(existingTrades),
        [existingTrades]
    );

    // Fuzzy search with scoring
    const updateSuggestions = useCallback((query) => {
        if (query.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Score and sort matches
        const scored = knownStructures
            .map(s => ({ structure: s, score: fuzzyMatch(query, s) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        setSuggestions(scored.map(item => item.structure));
        setSelectedIndex(0);
        setShowSuggestions(scored.length > 0);
    }, [knownStructures]);

    // Update suggestions when structure changes
    useEffect(() => {
        updateSuggestions(manualForm.structure);
    }, [manualForm.structure, updateSuggestions]);

    const handleParse = () => {
        if (!input.trim()) {
            setParseStatus({ type: 'error', message: 'Please paste some fills first' });
            return;
        }

        const result = parseTrades(input);

        if (result.trades.length === 0) {
            setParseStatus({ type: 'error', message: 'No valid trades found in input' });
            setParseErrors(result.errors);
            return;
        }

        onTradesAdded(result.trades);
        setParseStatus({
            type: 'success',
            message: `Successfully parsed ${result.trades.length} trades${result.errors.length > 0 ? ` (${result.errors.length} lines skipped)` : ''}`
        });
        setParseErrors(result.errors);
        setInput('');

        setTimeout(() => {
            setParseStatus(null);
            setParseErrors([]);
        }, 5000);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();

        try {
            const trade = createManualTrade(manualForm);
            onTradesAdded([trade]);
            setParseStatus({ type: 'success', message: 'Trade added successfully' });

            // Reset form but keep structure for quick re-entry
            setManualForm(prev => ({
                ...prev,
                quantity: '1',
                price: '',
                time: new Date().toTimeString().slice(0, 5)
            }));

            setTimeout(() => setParseStatus(null), 3000);
        } catch (err) {
            setParseStatus({ type: 'error', message: err.message });
        }
    };

    const selectSuggestion = (structure) => {
        setManualForm(prev => ({ ...prev, structure }));
        setShowSuggestions(false);
        setSelectedIndex(0);
    };

    const updateManualField = (field, value) => {
        setManualForm(prev => ({ ...prev, [field]: value }));
    };

    // Handle keyboard navigation for autocomplete
    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Tab':
            case 'Enter':
                if (showSuggestions && suggestions[selectedIndex]) {
                    e.preventDefault();
                    selectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                break;
        }
    };

    // Compact header when collapsed
    if (!isExpanded) {
        return (
            <div className="trade-input-collapsed">
                <button
                    className="expand-btn"
                    onClick={() => setIsExpanded(true)}
                >
                    <Plus size={18} />
                    Add Trades
                </button>

                <div className="collapsed-info">
                    <span className="trade-count">{tradesCount} trades saved</span>
                    {tradesCount > 0 && (
                        <div className="quick-actions">
                            <button className="icon-btn" onClick={onExport} title="Export">
                                <Download size={16} />
                            </button>
                            <button className="icon-btn danger" onClick={onClearAll} title="Clear All">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="trade-input-expanded glass-card">
            <div className="trade-input-header">
                <div className="input-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
                        onClick={() => setActiveTab('paste')}
                    >
                        <ClipboardPaste size={16} />
                        Paste Fills
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        <FileText size={16} />
                        Manual Entry
                    </button>
                </div>

                <div className="header-actions">
                    <span className="trade-count">{tradesCount} trades</span>
                    <button
                        className="icon-btn"
                        onClick={() => setIsExpanded(false)}
                        title="Collapse"
                    >
                        <ChevronUp size={20} />
                    </button>
                </div>
            </div>

            {/* PASTE TAB */}
            {activeTab === 'paste' && (
                <div className="paste-tab">
                    <textarea
                        className="trade-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Paste your fills here...

Format: Date    Time    Exchange    Structure    Side    Quantity    Price
Example: Monday, 16 June, 2025    16.38.25    ICE_L    SON Sep26 D-Fly    B    1    -0.025

Supports tabs, multiple spaces, or comma-separated values."
                        spellCheck={false}
                    />

                    <div className="paste-actions">
                        <button className="btn btn-primary" onClick={handleParse}>
                            <Check size={16} />
                            Parse & Add Trades
                        </button>
                        {tradesCount > 0 && (
                            <>
                                <button className="btn btn-secondary" onClick={onExport}>
                                    <Download size={16} />
                                    Export
                                </button>
                                <button className="btn btn-danger" onClick={onClearAll}>
                                    <Trash2 size={16} />
                                    Clear All
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MANUAL ENTRY TAB */}
            {activeTab === 'manual' && (
                <form className="manual-form" onSubmit={handleManualSubmit}>
                    <div className="form-row">
                        {/* Structure with autocomplete */}
                        <div className="form-group structure-group">
                            <label>Structure *</label>
                            <div className="autocomplete-wrapper">
                                <input
                                    ref={structureInputRef}
                                    type="text"
                                    value={manualForm.structure}
                                    onChange={(e) => updateManualField('structure', e.target.value)}
                                    onFocus={() => updateSuggestions(manualForm.structure)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type: sep 3 → SON Sep26 3 Fly"
                                    autoComplete="off"
                                    required
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="suggestions-dropdown upward" ref={suggestionsRef}>
                                        {suggestions.map((s, idx) => (
                                            <div
                                                key={idx}
                                                className={`suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
                                                onClick={() => selectSuggestion(s)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                            >
                                                {s}
                                            </div>
                                        ))}
                                        <div className="suggestion-hint">
                                            Press Tab or Enter to select
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Side */}
                        <div className="form-group side-group">
                            <label>Side *</label>
                            <div className="side-buttons">
                                <button
                                    type="button"
                                    className={`side-btn buy ${manualForm.side === 'BUY' ? 'active' : ''}`}
                                    onClick={() => updateManualField('side', 'BUY')}
                                >
                                    BUY
                                </button>
                                <button
                                    type="button"
                                    className={`side-btn sell ${manualForm.side === 'SELL' ? 'active' : ''}`}
                                    onClick={() => updateManualField('side', 'SELL')}
                                >
                                    SELL
                                </button>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div className="form-group qty-group">
                            <label>Qty *</label>
                            <input
                                type="number"
                                min="1"
                                value={manualForm.quantity}
                                onChange={(e) => updateManualField('quantity', e.target.value)}
                                required
                            />
                        </div>

                        {/* Price */}
                        <div className="form-group price-group">
                            <label>Price</label>
                            <input
                                type="number"
                                step="0.001"
                                value={manualForm.price}
                                onChange={(e) => updateManualField('price', e.target.value)}
                                placeholder="-0.025"
                            />
                        </div>

                        {/* Date */}
                        <div className="form-group date-group">
                            <label>Date</label>
                            <input
                                type="date"
                                value={manualForm.date}
                                onChange={(e) => updateManualField('date', e.target.value)}
                            />
                        </div>

                        {/* Time */}
                        <div className="form-group time-group">
                            <label>Time</label>
                            <input
                                type="time"
                                value={manualForm.time}
                                onChange={(e) => updateManualField('time', e.target.value)}
                            />
                        </div>

                        {/* Exchange */}
                        <div className="form-group exchange-group">
                            <label>Exchange</label>
                            <select
                                value={manualForm.exchange}
                                onChange={(e) => updateManualField('exchange', e.target.value)}
                            >
                                <option value="ICE_L">ICE_L</option>
                                <option value="CME">CME</option>
                                <option value="NYMEX">NYMEX</option>
                                <option value="MANUAL">Manual</option>
                            </select>
                        </div>

                        {/* Add Button - INLINE */}
                        <div className="form-group add-group">
                            <label>&nbsp;</label>
                            <button type="submit" className="btn btn-primary add-trade-btn">
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Status Message */}
            {parseStatus && (
                <div className={`status-message ${parseStatus.type}`}>
                    {parseStatus.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {parseStatus.message}
                </div>
            )}

            {/* Parse Errors */}
            {parseErrors.length > 0 && (
                <div className="parse-errors">
                    <div className="errors-header">
                        <AlertCircle size={14} />
                        <span>{parseErrors.length} lines could not be parsed:</span>
                        <button onClick={() => setParseErrors([])}>
                            <X size={14} />
                        </button>
                    </div>
                    <div className="errors-list">
                        {parseErrors.slice(0, 5).map((err, idx) => (
                            <div key={idx} className="error-item">
                                Line {err.line}: {err.content}...
                            </div>
                        ))}
                        {parseErrors.length > 5 && (
                            <div className="error-item">...and {parseErrors.length - 5} more</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
