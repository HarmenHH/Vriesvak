import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Plus, Search, X, Snowflake, Package, Trash2,
  Calendar, ChevronDown, Filter
} from 'lucide-react';
import { CATEGORIES, EMOJI_OPTIONS, SWIPE_THRESHOLD } from '../utils/constants.js';
import { generateId, formatDate, getDaysInFreezer, sortItems } from '../utils/helpers.js';
import { saveItems, loadItems } from '../utils/persistence.js';

// --- Swipe Item Component ---
function SwipeItem({ item, onDelete }) {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, 0],
    ['#dc2626', '#ef4444', '#ffffff']
  );
  const opacity = useTransform(
    x,
    [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, 0],
    [1, 0.8, 0]
  );

  const category = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
  const days = getDaysInFreezer(item.dateAdded);

  function handleDragEnd(_, info) {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onDelete(item.id);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl mb-3">
      {/* Delete background */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6 rounded-xl"
        style={{ backgroundColor: background }}
      >
        <motion.div style={{ opacity }}>
          <Trash2 className="w-6 h-6 text-white" />
        </motion.div>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        className="relative bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        style={{ x }}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-3">
          {/* Emoji */}
          <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-slate-50">
            {item.emoji || category.emoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate">{item.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${category.color}`}>
                {category.label}
              </span>
              <span className="text-xs text-slate-400">
                {days === 0 ? 'Vandaag' : `${days}d`}
              </span>
            </div>
          </div>

          {/* Quantity */}
          {item.quantity > 1 && (
            <div className="bg-blue-50 text-blue-700 text-sm font-bold px-2.5 py-1 rounded-lg">
              ×{item.quantity}
            </div>
          )}

          {/* Swipe hint */}
          <div className="text-slate-200">
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Add Item Modal ---
function AddItemModal({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('overig');
  const [emoji, setEmoji] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dateAdded, setDateAdded] = useState(new Date().toISOString().split('T')[0]);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedCat = CATEGORIES.find(c => c.id === category);
    onAdd({
      id: generateId(),
      name: name.trim(),
      category,
      emoji: emoji || selectedCat.emoji,
      quantity: Math.max(1, quantity),
      dateAdded
    });
    onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg bg-white rounded-t-2xl p-6 pb-8 max-h-[90vh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

        <h2 className="text-xl font-bold text-slate-800 mb-4">Item toevoegen</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Naam</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Bijv. Kipfilet"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Categorie</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    if (!emoji) setEmoji(cat.emoji);
                  }}
                  className={`flex flex-col items-center p-2 rounded-xl border-2 transition ${
                    category === cat.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-xs mt-0.5 text-slate-600">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Icoon (optioneel)</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition ${
                    emoji === em ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-slate-50'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity and Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Aantal</label>
              <div className="flex items-center rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-4 py-3 text-lg font-bold text-slate-400 hover:text-slate-600"
                >
                  −
                </button>
                <span className="flex-1 text-center font-semibold text-slate-800">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-4 py-3 text-lg font-bold text-slate-400 hover:text-slate-600"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Datum</label>
              <input
                type="date"
                value={dateAdded}
                onChange={e => setDateAdded(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/25"
          >
            Toevoegen
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// --- Main FreezerApp Component ---
export default function FreezerApp() {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [loaded, setLoaded] = useState(false);

  // Load items on mount
  useEffect(() => {
    loadItems().then(loaded => {
      setItems(loaded);
      setLoaded(true);
    });
  }, []);

  // Save items when they change
  useEffect(() => {
    if (loaded) {
      saveItems(items);
    }
  }, [items, loaded]);

  const addItem = useCallback((item) => {
    setItems(prev => [item, ...prev]);
  }, []);

  const deleteItem = useCallback((id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Filter and sort
  const filteredItems = sortItems(
    items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    }),
    sortBy
  );

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 pt-12 pb-4 safe-top">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Snowflake className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-800">Vriezer</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
              {totalItems} items
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-100 border-none outline-none text-sm focus:ring-2 focus:ring-blue-200 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              activeCategory === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Alles
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                activeCategory === cat.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-400">
            {filteredItems.length} resultaten
          </span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs bg-transparent text-slate-500 font-medium outline-none"
          >
            <option value="newest">Nieuwste eerst</option>
            <option value="oldest">Oudste eerst</option>
            <option value="alpha">A-Z</option>
          </select>
        </div>
      </header>

      {/* Item List */}
      <main className="flex-1 overflow-y-auto px-4 py-4 touch-pan-y">
        <AnimatePresence mode="popLayout">
          {filteredItems.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
            >
              <SwipeItem item={item} onDelete={deleteItem} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {filteredItems.length === 0 && loaded && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Package className="w-12 h-12 mb-3 text-slate-300" />
            {items.length === 0 ? (
              <>
                <p className="font-medium">Je vriezer is leeg</p>
                <p className="text-sm mt-1">Tik op + om items toe te voegen</p>
              </>
            ) : (
              <>
                <p className="font-medium">Geen resultaten</p>
                <p className="text-sm mt-1">Probeer een andere zoekterm</p>
              </>
            )}
          </div>
        )}

        {/* Bottom spacing for FAB */}
        <div className="h-20" />
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition active:scale-90 z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Add Modal */}
      <AnimatePresence>
        {showAdd && <AddItemModal onAdd={addItem} onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
}
