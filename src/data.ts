let nextId = 100;

export const generateId = (): string => `id_${nextId++}_${Date.now()}`;

export const CATEGORY_ICONS = [
  '🛒', '🚜', '💻', '🏠', '💊', '📚', '🎉', '🚗',
  '🏗️', '📱', '🍕', '👕', '🏡', '💼', '🎯', '⚕️',
  '✈️', '🎓', '🐄', '🎵', '📷', '⚽', '🎨', '🔧',
];
