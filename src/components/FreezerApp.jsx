import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Plus, Search, Snowflake, X, Check, Trash2, Undo2, Download, Upload, AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'vriezer-items';

const CATEGORIES = [
  { name: 'Vlees', days: 120, icon: '🥩' },
  { name: 'Vis', days: 90, icon: '🐟' },
  { name: 'Groenten', days: 240, icon: '🥦' },
  { name: 'Fruit', days: 240, icon: '🍓' },
  { name: 'Brood & Gebak', days: 90, icon: '🍞' },
  { name: 'Zuivel', days: 60, icon: '🧀' },
  { name: 'Kant-en-klaar', days: 90, icon: '🍲' },
  { name: 'Sauzen & Kruiden', days: 180, icon: '🌶️' },
  { name: 'Overig', days: 120, icon: '📦' },
];

const LOCATIONS = ['Vriezer boven', 'Vriezer onder', 'Lade 1', 'Lade 2', 'Lade 3'];

function getDaysUntilExpiry(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

function getStatusColor(days) {
  if (days < 0) return 'bg-red-100 border-red-300 text-red-800';
  if (days <= 7) return 'bg-orange-100 border-orange-300 text-orange-800';
  if (days <= 30) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-green-50 border-green-200 text-green-800';
}

function getStatusBadge(days) {
  if (days < 0) return { text: 'Verlopen', cls: 'bg-red-500 text-white' };
  if (days === 0) return { text: 'Vandaag op', cls: 'bg-red-500 text-white' };
  if (days <= 7) return { text: `${days}d`, cls: 'bg-orange-500 text-white' };
  if (days <= 30) return { text: `${days}d`, cls: 'bg-yellow-500 text-white' };
  return { text: `${days}d`, cls: 'bg-green-500 text-white' };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function loadFromStorage() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const data = JSON.parse(json);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn('Load failed:', e);
  }
  return [];
}

function saveToStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function SwipeableItem({ item, onUse, onDiscard, onEdit, children }) {
  const x = useMotionValue(0);
  const backgroundLeft = useTransform(x, [0, 100], ['rgba(34,197,94,0)', 'rgba(34,197,94,0.2)']);
  const backgroundRight = useTransform(x, [-100, 0], ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0)']);
  const leftIconOpacity = useTransform(x, [0, 60, 100], [0, 0.5, 1]);
  const rightIconOpacity = useTransform(x, [-100, -60, 0], [1, 0.5, 0]);

  return (
    <div className="relative overflow-hidden rounded-xl mb-3">
      <motion.div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none" style={{ background: backgroundLeft }}>
        <motion.div style={{ opacity: leftIconOpacity }}>
          <Check className="w-8 h-8 text-green-600" />
        </motion.div>
        <div />
      </motion.div>
      <motion.div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none" style={{ background: backgroundRight }}>
        <div />
        <motion.div style={{ opacity: rightIconOpacity }}>
          <Trash2 className="w-8 h-8 text-red-600" />
        </motion.div>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={(e, info) => {
          if (info.offset.x > 100) onUse(item);
          else if (info.offset.x < -100) onDiscard(item);
        }}
        style={{ x }}
        className="relative cursor-grab active:cursor-grabbing"
        onClick={() => onEdit(item)}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function FreezerApp() {
  const [items, setItems] = useState(() => loadFromStorage());
  const [history, setHistory] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [portionModal, setPortionModal] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);

  const [formData, setFormData] = useState({
    name: '', category: 'Vlees', totalWeight: '', portions: 1, location: LOCATIONS[0], note: '', frozen: new Date().toISOString().split('T')[0], expiry: ''
  });

  // Save to localStorage whenever items change
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  // Auto-calculate expiry when category or frozen date changes
  useEffect(() => {
    const cat = CATEGORIES.find(c => c.name === formData.category);
    if (cat && formData.frozen) {
      const d = new Date(formData.frozen);
      d.setDate(d.getDate() + cat.days);
      setFormData(f => ({ ...f, expiry: d.toISOString().split('T')[0] }));
    }
  }, [formData.category, formData.frozen]);

  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-19), JSON.stringify(items)]);
  }, [items]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = JSON.parse(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setItems(prev);
    showToast('Ongedaan gemaakt', 'info');
  }, [history, showToast]);

  const addItem = () => {
    if (!formData.name.trim()) { showToast('Vul een naam in', 'error'); return; }
    if (!formData.expiry) { showToast('Vul een houdbaarheidsdatum in', 'error'); return; }
    pushHistory();
    const newItem = {
      ...formData,
      id: Date.now(),
      totalWeight: Number(formData.totalWeight) || 0,
      portions: Math.max(1, Number(formData.portions)),
      portionsLeft: Math.max(1, Number(formData.portions)),
    };
    setItems(prev => [...prev, newItem]);
    setShowAdd(false);
    resetForm();
    showToast(`${newItem.name} toegevoegd`, 'success');
  };

  const updateItem = () => {
    if (!formData.name.trim()) { showToast('Vul een naam in', 'error'); return; }
    if (!formData.expiry) { showToast('Vul een houdbaarheidsdatum in', 'error'); return; }
    pushHistory();
    setItems(prev => prev.map(it => it.id === editItem.id ? {
      ...it, ...formData,
      totalWeight: Number(formData.totalWeight) || 0,
      portions: Math.max(1, Number(formData.portions)),
      portionsLeft: Math.min(it.portionsLeft, Math.max(1, Number(formData.portions))),
    } : it));
    setEditItem(null);
    setShowAdd(false);
    resetForm();
    showToast('Item bijgewerkt', 'success');
  };

  const useItem = (item) => {
    if (item.portionsLeft > 1) {
      setPortionModal({ item, action: 'use' });
    } else {
      pushHistory();
      setItems(prev => prev.filter(i => i.id !== item.id));
      showToast(`${item.name} gebruikt ✓`, 'success');
    }
  };

  const usePortions = (item, count) => {
    pushHistory();
    const newLeft = item.portionsLeft - count;
    if (newLeft <= 0) {
      setItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, portionsLeft: newLeft } : i));
    }
    showToast(`${count}x ${item.name} gebruikt ✓`, 'success');
    setPortionModal(null);
  };

  const discardItem = (item) => {
    setConfirmModal({
      title: 'Weggooien',
      msg: `Weet je zeker dat je "${item.name}" wilt weggooien?`,
      onConfirm: () => {
        pushHistory();
        setItems(prev => prev.filter(i => i.id !== item.id));
        showToast(`${item.name} weggegooid`, 'error');
        setConfirmModal(null);
      }
    });
  };

  const clearAllItems = () => {
    pushHistory();
    setItems([]);
    setClearConfirm(false);
    showToast('Alle items gewist', 'info');
  };

  const resetForm = () => {
    setFormData({ name: '', category: 'Vlees', totalWeight: '', portions: 1, location: LOCATIONS[0], note: '', frozen: new Date().toISOString().split('T')[0], expiry: '' });
  };

  const startEdit = (item) => {
    setEditItem(item);
    setFormData({
      name: item.name, category: item.category, totalWeight: item.totalWeight || '',
      portions: item.portions, location: item.location, note: item.note || '',
      frozen: item.frozen, expiry: item.expiry,
    });
    setShowAdd(true);
  };

  const exportData = () => {
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vriezer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Backup gedownload', 'success');
  };

  const shareData = async () => {
    const json = JSON.stringify(items, null, 2);
    if (navigator.share) {
      try {
        const file = new File([json], 'vriezer-backup.json', { type: 'application/json' });
        await navigator.share({ title: 'Vriezer Backup', files: [file] });
        showToast('Backup gedeeld', 'success');
      } catch { showToast('Delen geannuleerd', 'info'); }
    } else {
      await navigator.clipboard.writeText(json);
      showToast('JSON naar klembord gekopieerd', 'success');
    }
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error();
        pushHistory();
        const cleaned = data.map((it, i) => ({
          id: it.id || Date.now() + i,
          name: it.name || 'Onbekend',
          category: it.category || 'Overig',
          totalWeight: Number(it.totalWeight) || 0,
          portions: Math.max(1, Number(it.portions) || 1),
          portionsLeft: Math.max(1, Number(it.portionsLeft) || 1),
          location: it.location || LOCATIONS[0],
          note: it.note || '',
          frozen: it.frozen || new Date().toISOString().split('T')[0],
          expiry: it.expiry || new Date().toISOString().split('T')[0],
        }));
        setItems(cleaned);
        showToast(`${cleaned.length} items geïmporteerd`, 'success');
      } catch { showToast('Ongeldig bestand', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter logic
  const expiredCount = items.filter(i => getDaysUntilExpiry(i.expiry) < 0).length;
  const sevenDayCount = items.filter(i => { const d = getDaysUntilExpiry(i.expiry); return d >= 0 && d <= 7; }).length;
  const thirtyDayCount = items.filter(i => { const d = getDaysUntilExpiry(i.expiry); return d > 7 && d <= 30; }).length;

  // Auto-reset filter if category becomes empty
  useEffect(() => {
    if (filter === 'expired' && expiredCount === 0) setFilter('all');
    if (filter === '7days' && sevenDayCount === 0) setFilter('all');
    if (filter === '30days' && thirtyDayCount === 0) setFilter('all');
  }, [filter, expiredCount, sevenDayCount, thirtyDayCount]);

  const filtered = items
    .filter(item => {
      const days = getDaysUntilExpiry(item.expiry);
      if (filter === 'expired') return days < 0;
      if (filter === '7days') return days >= 0 && days <= 7;
      if (filter === '30days') return days > 7 && days <= 30;
      return true;
    })
    .filter(item => {
      if (!search) return true;
      const s = search.toLowerCase();
      return item.name.toLowerCase().includes(s) || item.note?.toLowerCase().includes(s) || item.location?.toLowerCase().includes(s);
    })
    .sort((a, b) => getDaysUntilExpiry(a.expiry) - getDaysUntilExpiry(b.expiry));

  const totalWeight = items.reduce((sum, i) => sum + ((i.totalWeight || 0) / (i.portions || 1)) * (i.portionsLeft || 1), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 pb-24 pt-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Snowflake className="w-7 h-7 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-800">Vriesvak</h1>
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button onClick={undo} className="p-2 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50" aria-label="Ongedaan maken">
                <Undo2 className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <button onClick={() => setShowBackup(true)} className="p-2 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50" aria-label="Backup">
              <Download className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Totaal gewicht */}
        <div className="text-sm text-slate-500 mb-3 px-1">
          Totaal: {Math.round(totalWeight)}g ({(totalWeight / 1000).toFixed(1)} kg) · {items.length} items
        </div>

        {/* Zoekbalk */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Zoeken op naam, notitie of locatie..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Alles ({items.length})
          </button>
          {expiredCount > 0 && (
            <button onClick={() => setFilter('expired')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'expired' ? 'bg-red-500 text-white' : 'bg-white border border-red-200 text-red-600'}`}>
              Verlopen ({expiredCount})
            </button>
          )}
          {sevenDayCount > 0 && (
            <button onClick={() => setFilter('7days')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === '7days' ? 'bg-orange-500 text-white' : 'bg-white border border-orange-200 text-orange-600'}`}>
              Binnen 7 dagen ({sevenDayCount})
            </button>
          )}
          {thirtyDayCount > 0 && (
            <button onClick={() => setFilter('30days')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === '30days' ? 'bg-yellow-500 text-white' : 'bg-white border border-yellow-200 text-yellow-600'}`}>
              Binnen 30 dagen ({thirtyDayCount})
            </button>
          )}
        </div>

        {/* Swipe hint */}
        {items.length > 0 && (
          <p className="text-xs text-slate-400 text-center mb-2">← swipe rechts = gebruikt · swipe links = weggooien →</p>
        )}

        {/* Items lijst */}
        <div className="space-y-0">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Snowflake className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{items.length === 0 ? 'Je vriezer is leeg' : 'Geen items gevonden'}</p>
              {items.length === 0 && <p className="text-xs mt-1">Tik op + om items toe te voegen</p>}
            </div>
          )}
          <AnimatePresence>
            {filtered.map(item => {
              const days = getDaysUntilExpiry(item.expiry);
              const badge = getStatusBadge(days);
              const statusCls = getStatusColor(days);
              const weightPerPortion = item.totalWeight && item.portions ? Math.round(item.totalWeight / item.portions) : 0;
              const cat = CATEGORIES.find(c => c.name === item.category);

              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} layout>
                  <SwipeableItem item={item} onUse={useItem} onDiscard={discardItem} onEdit={startEdit}>
                    <div className={`p-3.5 rounded-xl border ${statusCls} shadow-sm`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="text-xl flex-shrink-0">{cat?.icon || '📦'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{item.name}</p>
                            <p className="text-xs opacity-70 truncate">
                              {item.location}{item.note ? ` · ${item.note}` : ''}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {item.portions > 1 && (
                                <span className="text-xs bg-white bg-opacity-60 px-1.5 py-0.5 rounded-md font-medium">
                                  {item.portionsLeft}/{item.portions} porties
                                </span>
                              )}
                              {weightPerPortion > 0 && (
                                <span className="text-xs opacity-60">
                                  {weightPerPortion}g/portie · {Math.round(weightPerPortion * item.portionsLeft)}g totaal
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
                          <span className="text-xs opacity-50">{formatDate(item.expiry)}</span>
                        </div>
                      </div>
                    </div>
                  </SwipeableItem>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* FAB toevoegen */}
        <button
          onClick={() => { resetForm(); setEditItem(null); setShowAdd(true); }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-40"
          aria-label="Item toevoegen"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Toevoegen / Bewerken modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => { setShowAdd(false); setEditItem(null); }}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl" role="dialog">
              <div className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800">{editItem ? 'Bewerken' : 'Toevoegen'}</h2>
                  <button onClick={() => { setShowAdd(false); setEditItem(null); }} className="p-1 rounded-full hover:bg-slate-100">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="name" className="text-xs font-medium text-slate-600 mb-1 block">Naam *</label>
                    <input id="name" type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Bijv. Kipfilet" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>

                  <div>
                    <label htmlFor="category" className="text-xs font-medium text-slate-600 mb-1 block">Categorie</label>
                    <select id="category" value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                      {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name} (ca. {c.days} dagen)</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="weight" className="text-xs font-medium text-slate-600 mb-1 block">Totaalgewicht (g)</label>
                      <input id="weight" type="number" value={formData.totalWeight} onChange={e => setFormData(f => ({ ...f, totalWeight: e.target.value }))} placeholder="1000" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label htmlFor="portions" className="text-xs font-medium text-slate-600 mb-1 block">Aantal porties</label>
                      <input id="portions" type="number" min="1" value={formData.portions} onChange={e => setFormData(f => ({ ...f, portions: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>

                  {formData.totalWeight && formData.portions > 1 && (
                    <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                      → {Math.round(Number(formData.totalWeight) / Number(formData.portions))}g per portie
                    </p>
                  )}

                  <div>
                    <label htmlFor="location" className="text-xs font-medium text-slate-600 mb-1 block">Locatie</label>
                    <select id="location" value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                      {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="frozen" className="text-xs font-medium text-slate-600 mb-1 block">Ingevroren op</label>
                      <input id="frozen" type="date" value={formData.frozen} onChange={e => setFormData(f => ({ ...f, frozen: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label htmlFor="expiry" className="text-xs font-medium text-slate-600 mb-1 block">Houdbaar tot *</label>
                      <input id="expiry" type="date" value={formData.expiry} onChange={e => setFormData(f => ({ ...f, expiry: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="note" className="text-xs font-medium text-slate-600 mb-1 block">Notitie</label>
                    <input id="note" type="text" value={formData.note} onChange={e => setFormData(f => ({ ...f, note: e.target.value }))} placeholder="Optioneel" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>

                <button onClick={editItem ? updateItem : addItem} className="w-full mt-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition">
                  {editItem ? 'Opslaan' : 'Toevoegen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portie modal */}
      <AnimatePresence>
        {portionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" onClick={() => setPortionModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl" role="dialog">
              <h3 className="font-bold text-slate-800 mb-2">Hoeveel porties gebruikt?</h3>
              <p className="text-sm text-slate-500 mb-4">{portionModal.item.name} — {portionModal.item.portionsLeft} portie(s) over</p>
              <div className="space-y-2">
                <button onClick={() => usePortions(portionModal.item, 1)} className="w-full py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition">
                  1 portie gebruiken
                </button>
                {portionModal.item.portionsLeft > 2 && (
                  <button onClick={() => usePortions(portionModal.item, Math.floor(portionModal.item.portionsLeft / 2))} className="w-full py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition">
                    {Math.floor(portionModal.item.portionsLeft / 2)} porties gebruiken
                  </button>
                )}
                <button onClick={() => usePortions(portionModal.item, portionModal.item.portionsLeft)} className="w-full py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition">
                  Alle {portionModal.item.portionsLeft} porties gebruiken
                </button>
              </div>
              <button onClick={() => setPortionModal(null)} className="w-full mt-3 py-2 text-slate-400 text-sm">Annuleren</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bevestiging modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl" role="dialog">
              <h3 className="font-bold text-slate-800 mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-slate-600 mb-4">{confirmModal.msg}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Annuleren</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition">Weggooien</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup modal */}
      <AnimatePresence>
        {showBackup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" onClick={() => setShowBackup(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl" role="dialog">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800">Backup & Herstel</h3>
                <button onClick={() => setShowBackup(false)} className="p-1 rounded-full hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4">Maak regelmatig een backup zodat je data niet verloren gaat.</p>

              <div className="space-y-2.5">
                <button onClick={exportData} className="w-full flex items-center gap-3 py-3 px-4 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition">
                  <Download className="w-4 h-4" /> Download backup (JSON)
                </button>
                <button onClick={shareData} className="w-full flex items-center gap-3 py-3 px-4 bg-purple-50 border border-purple-200 rounded-xl text-sm font-medium text-purple-700 hover:bg-purple-100 transition">
                  <Upload className="w-4 h-4" /> Delen / kopiëren
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 py-3 px-4 bg-green-50 border border-green-200 rounded-xl text-sm font-medium text-green-700 hover:bg-green-100 transition">
                  <Upload className="w-4 h-4" /> Importeer backup
                </button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={importData} className="hidden" />

                <hr className="my-3 border-slate-200" />

                {!clearConfirm ? (
                  <button onClick={() => setClearConfirm(true)} className="w-full flex items-center gap-3 py-3 px-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-100 transition">
                    <Trash2 className="w-4 h-4" /> Wis alle items
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <p className="text-sm font-medium text-red-700">Weet je het zeker?</p>
                    </div>
                    <p className="text-xs text-red-600 mb-3">Alle {items.length} items worden verwijderd. Dit kun je ongedaan maken met de undo-knop.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setClearConfirm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 bg-white hover:bg-slate-50">Annuleren</button>
                      <button onClick={clearAllItems} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600">Ja, wis alles</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium z-50 ${toast.type === 'success' ? 'bg-green-500 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-700 text-white'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
