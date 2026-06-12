import { get, set } from 'idb-keyval';
import { STORAGE_KEY } from './constants.js';

export async function saveItems(items) {
  try {
    const json = JSON.stringify(items);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }

  try {
    await set(STORAGE_KEY, items);
  } catch (e) {
    console.warn('IndexedDB save failed:', e);
  }
}

export async function loadItems() {
  // Try localStorage first (fast, synchronous)
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
      const items = JSON.parse(json);
      if (Array.isArray(items) && items.length > 0) {
        return items;
      }
    }
  } catch (e) {
    console.warn('localStorage load failed:', e);
  }

  // Fallback to IndexedDB
  try {
    const items = await get(STORAGE_KEY);
    if (Array.isArray(items) && items.length > 0) {
      return items;
    }
  } catch (e) {
    console.warn('IndexedDB load failed:', e);
  }

  return [];
}
