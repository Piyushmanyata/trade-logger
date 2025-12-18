import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Save, X, RefreshCw } from 'lucide-react';
import {
    STRUCTURE_RT_LEGS,
    getCustomStructures,
    addCustomStructure,
    removeCustomStructure,
    TICK_VALUE,
    TICK_SIZE,
    RT_COST_PER_LOT,
    updateTradingConstants,
    getTradingConfig
} from '../utils/structureConfig';
import { saveSettings, loadSettings } from '../utils/storage';

export default function SettingsPanel({ onClose, existingTrades = [] }) {
    const [customStructures, setCustomStructures] = useState({});
    const [newStructure, setNewStructure] = useState({ name: '', rtLegs: 1, type: 'Calendar' });
    const [showAddForm, setShowAddForm] = useState(false);

    // Editable trading constants
    const [tradingConfig, setTradingConfig] = useState({
        tickValue: TICK_VALUE,
        tickSize: TICK_SIZE,
        rtCostPerLot: RT_COST_PER_LOT
    });
    const [configChanged, setConfigChanged] = useState(false);

    // Structure types for dropdown with RT leg defaults
    const structureTypes = [
        { name: 'Calendar', rtLegs: 1, description: '1 spread leg' },
        { name: '3 Fly', rtLegs: 2, description: '2 spread legs' },
        { name: 'D-Fly', rtLegs: 4, description: '4 spread legs' },
        { name: '3 D-Fly', rtLegs: 4, description: '4 spread legs' },
        { name: 'Fly Condor', rtLegs: 3, description: '3 spread legs' },
        { name: '3mo Butterfly', rtLegs: 2, description: '2 spread legs' },
        { name: '3mo Condor', rtLegs: 2, description: '2 spread legs' },
        { name: 'Outright', rtLegs: 0.5, description: '0.5 legs (single)' },
        { name: 'Custom', rtLegs: 1, description: 'Define your own' }
    ];

    // Get unique structures from existing trades
    const uniqueStructuresFromTrades = [...new Set(existingTrades.map(t => t.structure))].sort();

    // Load custom structures and settings on mount
    useEffect(() => {
        setCustomStructures(getCustomStructures());
        const savedSettings = loadSettings();
        if (savedSettings?.tradingConfig) {
            setTradingConfig(savedSettings.tradingConfig);
        }
    }, []);

    const handleAddStructure = () => {
        if (!newStructure.name.trim()) return;

        addCustomStructure(newStructure.name.trim(), newStructure.rtLegs);
        setCustomStructures(getCustomStructures());
        setNewStructure({ name: '', rtLegs: 1, type: 'Calendar' });
        setShowAddForm(false);
    };

    const handleRemoveStructure = (name) => {
        if (window.confirm(`Remove "${name}" from custom structures?`)) {
            removeCustomStructure(name);
            setCustomStructures(getCustomStructures());
        }
    };

    const handleTypeChange = (typeName) => {
        const typeConfig = structureTypes.find(t => t.name === typeName);
        setNewStructure(prev => ({
            ...prev,
            type: typeName,
            rtLegs: typeConfig?.rtLegs || 1
        }));
    };

    const handleConfigChange = (field, value) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
            setTradingConfig(prev => ({ ...prev, [field]: numValue }));
            setConfigChanged(true);
        }
    };

    const handleSaveConfig = () => {
        // Update in-memory config
        updateTradingConstants(tradingConfig.tickValue, tradingConfig.tickSize, tradingConfig.rtCostPerLot);
        // Save to localStorage
        saveSettings({ tradingConfig });
        setConfigChanged(false);
        alert('Trading constants saved! Refresh the app for full effect.');
    };

    const handleResetConfig = () => {
        setTradingConfig({ tickValue: 16.5, tickSize: 0.005, rtCostPerLot: 1.65 });
        setConfigChanged(true);
    };

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>
                        <SettingsIcon size={24} />
                        Settings & Configuration
                    </h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="settings-content">
                    {/* Trading Constants - EDITABLE */}
                    <section className="settings-section">
                        <h3>Trading Constants</h3>
                        <p className="section-description">
                            Configure trading parameters for P&L calculations
                        </p>
                        <div className="constants-grid editable">
                            <div className="constant-item">
                                <label>Tick Value ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tradingConfig.tickValue}
                                    onChange={e => handleConfigChange('tickValue', e.target.value)}
                                />
                                <span className="hint">Dollar value per tick movement</span>
                            </div>
                            <div className="constant-item">
                                <label>Tick Size</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={tradingConfig.tickSize}
                                    onChange={e => handleConfigChange('tickSize', e.target.value)}
                                />
                                <span className="hint">Price units per tick (0.005 = half cent)</span>
                            </div>
                            <div className="constant-item">
                                <label>RT Cost per Leg ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tradingConfig.rtCostPerLot}
                                    onChange={e => handleConfigChange('rtCostPerLot', e.target.value)}
                                />
                                <span className="hint">Commission per leg per lot</span>
                            </div>
                        </div>
                        {configChanged && (
                            <div className="config-actions">
                                <button className="save-btn" onClick={handleSaveConfig}>
                                    <Save size={16} />
                                    Save Changes
                                </button>
                                <button className="reset-btn" onClick={handleResetConfig}>
                                    <RefreshCw size={16} />
                                    Reset to Defaults
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Add New Structure */}
                    <section className="settings-section">
                        <div className="section-header">
                            <h3>Custom Structures</h3>
                            {!showAddForm && (
                                <button
                                    className="add-structure-btn"
                                    onClick={() => setShowAddForm(true)}
                                >
                                    <Plus size={16} />
                                    Add Structure
                                </button>
                            )}
                        </div>

                        {showAddForm && (
                            <div className="add-structure-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Structure Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., SON Mar28 3 Fly"
                                            value={newStructure.name}
                                            onChange={e => setNewStructure({ ...newStructure, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Type (Auto-sets RT legs)</label>
                                        <select
                                            value={newStructure.type}
                                            onChange={e => handleTypeChange(e.target.value)}
                                        >
                                            {structureTypes.map(type => (
                                                <option key={type.name} value={type.name}>
                                                    {type.name} ({type.rtLegs} legs)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>RT Legs (Entry)</label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={newStructure.rtLegs}
                                            onChange={e => setNewStructure({ ...newStructure, rtLegs: parseFloat(e.target.value) || 1 })}
                                        />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button className="save-btn" onClick={handleAddStructure}>
                                        <Save size={16} />
                                        Save Structure
                                    </button>
                                    <button className="cancel-btn" onClick={() => setShowAddForm(false)}>
                                        Cancel
                                    </button>
                                </div>
                                <div className="form-hint">
                                    <strong>RT Cost Formula:</strong> Entry Legs × 2 × Quantity × ${tradingConfig.rtCostPerLot}
                                </div>
                            </div>
                        )}

                        {/* Custom Structures List */}
                        {Object.keys(customStructures).length > 0 ? (
                            <div className="structures-list">
                                {Object.entries(customStructures).map(([name, rtLegs]) => (
                                    <div key={name} className="structure-item">
                                        <div className="structure-info">
                                            <span className="structure-name">{name}</span>
                                            <span className="structure-rt">{rtLegs} RT legs</span>
                                        </div>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleRemoveStructure(name)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-custom">No custom structures added yet.</p>
                        )}
                    </section>

                    {/* Structures from Trades */}
                    {uniqueStructuresFromTrades.length > 0 && (
                        <section className="settings-section">
                            <h3>Structures in Your Trades ({uniqueStructuresFromTrades.length})</h3>
                            <div className="structures-from-trades">
                                {uniqueStructuresFromTrades.slice(0, 20).map(structure => (
                                    <span key={structure} className="structure-tag">
                                        {structure}
                                    </span>
                                ))}
                                {uniqueStructuresFromTrades.length > 20 && (
                                    <span className="structure-tag more">
                                        +{uniqueStructuresFromTrades.length - 20} more
                                    </span>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Built-in Structures Reference */}
                    <section className="settings-section">
                        <h3>Built-in Structure Types</h3>
                        <div className="builtin-structures">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Entry Legs</th>
                                        <th>Total RT Legs</th>
                                        <th>Cost per Lot</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {structureTypes.filter(t => t.name !== 'Custom').map(type => (
                                        <tr key={type.name}>
                                            <td>{type.name}</td>
                                            <td>{type.rtLegs}</td>
                                            <td>{type.rtLegs * 2}</td>
                                            <td>${(type.rtLegs * 2 * tradingConfig.rtCostPerLot).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
