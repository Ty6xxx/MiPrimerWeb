// Item search utility using rustplusplus static data
const items = require('../data/items.json');
const decayData = require('../data/decay.json');
const recycleData = require('../data/recycle.json');
const craftData = require('../data/craft.json');
const stackData = require('../data/stack.json');
const upkeepData = require('../data/upkeep.json');
const researchData = require('../data/research.json');

// Workbench ID -> name mapping
const WORKBENCH_NAMES = {
  '1524187186': 'Workbench T1',
  '-41896755': 'Workbench T2',
  '-1607980696': 'Workbench T3',
};

/**
 * Fuzzy search items by name or shortname.
 * Returns array of { id, shortname, name, description }
 */
function searchItems(query, limit = 5) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];

  for (const [id, item] of Object.entries(items)) {
    const nameLower = (item.name || '').toLowerCase();
    const shortnameLower = (item.shortname || '').toLowerCase();

    if (shortnameLower === q || nameLower === q) {
      results.unshift({ id, ...item, score: 100 });
    } else if (shortnameLower.includes(q) || nameLower.includes(q)) {
      results.push({ id, ...item, score: 50 });
    }
  }

  // Fuzzy fallback: all words of query must appear in name
  if (results.length === 0) {
    const words = q.split(/\s+/);
    for (const [id, item] of Object.entries(items)) {
      const nameLower = (item.name || '').toLowerCase();
      if (words.every(w => nameLower.includes(w))) {
        results.push({ id, ...item, score: 25 });
      }
    }
  }

  // Sort: exact first, then by name length (shorter = more relevant)
  results.sort((a, b) => b.score - a.score || a.name.length - b.name.length);

  return results.slice(0, limit);
}

/**
 * Get item by ID (any data category)
 */
function getItemById(id) {
  const strId = String(id);
  return items[strId] ? { id: strId, ...items[strId] } : null;
}

/**
 * Format ingredient list for craft data
 */
function formatIngredients(ingredientList) {
  return ingredientList.map(ing => {
    const item = items[String(ing.id)];
    const name = item ? item.name : `ID:${ing.id}`;
    return `${ing.quantity}x ${name}`;
  });
}

/**
 * Get decay info for item - searches all decay categories
 */
function getDecayInfo(itemId) {
  const strId = String(itemId);
  for (const category of Object.values(decayData)) {
    if (category[strId]) return category[strId];
  }
  return null;
}

/**
 * Get recycle info for item
 */
function getRecycleInfo(itemId) {
  return recycleData[String(itemId)] || null;
}

/**
 * Format recycle yield
 */
function formatRecycleYield(yieldList) {
  return yieldList.map(y => {
    const item = items[String(y.id)];
    const name = item ? item.name : `ID:${y.id}`;
    const prob = y.probability < 1 ? ` (${Math.round(y.probability * 100)}%)` : '';
    return `${y.quantity}x ${name}${prob}`;
  });
}

/**
 * Get craft info for item
 */
function getCraftInfo(itemId) {
  return craftData[String(itemId)] || null;
}

/**
 * Get stack info for item
 */
function getStackInfo(itemId) {
  return stackData[String(itemId)] || null;
}

/**
 * Get research info for item
 */
function getResearchInfo(itemId) {
  return researchData[String(itemId)] || null;
}

module.exports = {
  searchItems,
  getItemById,
  getDecayInfo,
  getRecycleInfo,
  getCraftInfo,
  getStackInfo,
  getResearchInfo,
  formatIngredients,
  formatRecycleYield,
  WORKBENCH_NAMES,
};
