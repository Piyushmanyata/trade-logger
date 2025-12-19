import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, BarChart2, Settings } from 'lucide-react';
import TradeInput from './components/TradeInput';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import StructureDetail from './components/StructureDetail';
import SettingsPanel from './components/SettingsPanel';
import { loadTrades, saveTrades, clearTrades, exportTradesCSV } from './utils/storage';
import { groupTradesByStructure } from './utils/tradeParser';
import { calculateFIFOPnL, calculatePnLStats } from './utils/fifoCalculator';
import './index.css';

function App() {
  const [trades, setTrades] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load trades from storage on mount
  useEffect(() => {
    const savedTrades = loadTrades();
    if (savedTrades.length > 0) {
      setTrades(savedTrades);
    }
  }, []);

  // Save trades to storage when they change
  useEffect(() => {
    // Always save - saveTrades handles empty arrays by clearing storage
    saveTrades(trades);
  }, [trades]);

  // Process structures with P&L calculations
  const structuresData = useMemo(() => {
    const groups = groupTradesByStructure(trades);

    return Object.values(groups).map(group => {
      const pnlData = calculateFIFOPnL(group.trades, group.name);
      const stats = calculatePnLStats(pnlData.matches);

      return {
        name: group.name,
        metadata: group.metadata,
        trades: group.trades,
        ...pnlData,
        stats
      };
    });
  }, [trades]);

  const handleTradesAdded = (newTrades) => {
    const tradesArray = Array.isArray(newTrades) ? newTrades : [newTrades];

    // Merge with existing, avoiding exact duplicates and logical duplicates in single pass
    // Create combined lookup set for both ID and logical key
    const existingLookup = new Set([
      ...trades.map(t => t.id),
      ...trades.map(t => `${t.timestamp}-${t.structure}-${t.side}-${t.quantity}-${t.price}`)
    ]);

    const trulyNew = tradesArray.filter(t => {
      const logicalKey = `${t.timestamp}-${t.structure}-${t.side}-${t.quantity}-${t.price}`;
      return !existingLookup.has(t.id) && !existingLookup.has(logicalKey);
    });

    if (trulyNew.length > 0) {
      // Don't sort by timestamp - keep in entry order
      const merged = [...trades, ...trulyNew];
      setTrades(merged);
    }
  };

  const handleDeleteTrade = (tradeId) => {
    const updated = trades.filter(t => t.id !== tradeId);
    setTrades(updated);
    // Note: useEffect will handle saving to localStorage

    // Refresh selected structure if it still exists
    if (selectedStructure) {
      const updatedStructure = structuresData.find(s => s.name === selectedStructure.name);
      if (!updatedStructure || updatedStructure.trades.length === 0) {
        setSelectedStructure(null);
      }
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all trades? This cannot be undone.')) {
      setTrades([]);
      clearTrades();
      setSelectedStructure(null);
    }
  };

  const handleExport = () => {
    exportTradesCSV(trades);
  };

  const handleStructureClick = (structure) => {
    setSelectedStructure(structure);
  };

  // Update selected structure when trades change
  const currentSelectedStructure = useMemo(() => {
    if (!selectedStructure) return null;
    return structuresData.find(s => s.name === selectedStructure.name) || null;
  }, [selectedStructure, structuresData]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">Trade Logger</div>
          <nav className="nav">
            <button
              className={`nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button
              className={`nav-btn ${activeView === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveView('analytics')}
            >
              <BarChart2 size={18} />
              Analytics
            </button>
            <button
              className="nav-btn settings-btn"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={18} />
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <TradeInput
          onTradesAdded={handleTradesAdded}
          tradesCount={trades.length}
          onClearAll={handleClearAll}
          onExport={handleExport}
          existingTrades={trades}
        />

        {activeView === 'dashboard' && (
          <Dashboard
            structuresData={structuresData}
            onStructureClick={handleStructureClick}
          />
        )}

        {activeView === 'analytics' && (
          <Analytics structuresData={structuresData} />
        )}
      </main>

      {currentSelectedStructure && (
        <StructureDetail
          structure={currentSelectedStructure}
          onClose={() => setSelectedStructure(null)}
          onDeleteTrade={handleDeleteTrade}
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} existingTrades={trades} />
      )}
    </div>
  );
}

export default App;
