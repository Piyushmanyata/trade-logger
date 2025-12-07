import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Save, X } from 'lucide-react';
import {
    STRUCTURE_RT_LEGS,
    getCustomStructures,
    addCustomStructure,
    removeCustomStructure,
    TICK_VALUE,
    TICK_SIZE,
    RT_COST_PER_LOT
} from '../utils/structureConfig';

export default function SettingsPanel({ onClose }) {
    const [customStructures, setCustomStructures] = useState({});
    const [newStructure, setNewStructure] = useState({ name: '', rtLegs: 1, type: 'Calendar' });
    const [showAddForm, setShowAddForm] = useState(false);

    // Structure types for dropdown
    const structureTypes = [
        'Calendar',
        '3 Fly',
        'D-Fly',
        '3 D-Fly',
        'Fly Condor',
        '3mo Butterfly',
        '3mo Condor',
        'Outright',
        'Custom'
    ];

    // Load custom structures on mount
    useEffect(() => {
        setCustomStructures(getCustomStructures());
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

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>
                        <SettingsIcon size={24} />
                        Settings & Structure Management
                    </h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="settings-content">
                    {/* Trading Constants */}
                    <section className="settings-section">
                        <h3>Trading Constants</h3>
                        <div className="constants-grid">
                            <div className="constant-item">
                                <span className="label">Tick Value</span>
                                <span className="value">${TICK_VALUE}</span>
                            </div>
                            <div className="constant-item">
                                <span className="label">Tick Size</span>
                                <span className="value">{TICK_SIZE}</span>
                            </div>
                            <div className="constant-item">
                                <span className="label">RT Cost per Leg</span>
                                <span className="value">${RT_COST_PER_LOT}</span>
                            </div>
                        </div>
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
                                        <label>RT Legs (Entry)</label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={newStructure.rtLegs}
                                            onChange={e => setNewStructure({ ...newStructure, rtLegs: parseFloat(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Type</label>
                                        <select
                                            value={newStructure.type}
                                            onChange={e => setNewStructure({ ...newStructure, type: e.target.value })}
                                        >
                                            {structureTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
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
                                    <strong>RT Legs:</strong> Entry legs for this structure. Exit uses same legs.
                                    <br />
                                    Total RT cost = rtLegs × 2 × quantity × ${RT_COST_PER_LOT}
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

                    {/* Built-in Structures Reference */}
                    <section className="settings-section">
                        <h3>Built-in Structures (Reference)</h3>
                        <div className="builtin-structures">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Entry Legs</th>
                                        <th>Total (Entry + Exit)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td>Calendar</td><td>1</td><td>2</td></tr>
                                    <tr><td>3 Fly</td><td>2</td><td>4</td></tr>
                                    <tr><td>3mo Butterfly</td><td>2</td><td>4</td></tr>
                                    <tr><td>3mo Condor</td><td>2</td><td>4</td></tr>
                                    <tr><td>Fly Condor</td><td>3</td><td>6</td></tr>
                                    <tr><td>D-Fly</td><td>4</td><td>8</td></tr>
                                    <tr><td>3 D-Fly</td><td>4</td><td>8</td></tr>
                                    <tr><td>Outright</td><td>0.5</td><td>1</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
