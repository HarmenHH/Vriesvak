export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  const months = [
    'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'dec'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function getDaysInFreezer(dateString) {
  const now = new Date();
  const added = new Date(dateString);
  const diff = now - added;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function sortItems(items, sortBy = 'newest') {
  const sorted = [...items];
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
    case 'alpha':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
    default:
      return sorted;
  }
}
