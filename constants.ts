
import { FurnitureDefinition, RoomConfig } from './types.ts';

// Dimensions converted from cm to meters (1 unit = 1 meter)
export const INITIAL_ROOM: RoomConfig = {
  width: 7.30, // 730 cm
  depth: 3.53, // 353 cm
  height: 2.8, // standard ceiling height
};

export const THEMES = {
  HOSTEL_STANDARD: {
    wall: '#f1f5f9', // Slate 100
    floor: '#e2e8f0', // Slate 200
    accent: '#3B82F6',
    grid: '#94a3b8'
  },
  CONCRETE: {
    wall: '#e5e7eb', // Gray 200
    floor: '#94a3b8', // Slate 400
    accent: '#6366f1',
    grid: '#475569'
  },
  WARM_DORM: {
    wall: '#fafaf9', // Stone 50
    floor: '#d6d3d1', // Stone 300
    accent: '#f59e0b',
    grid: '#78716c'
  }
};

export const FURNITURE_DATA: Record<string, FurnitureDefinition> = {
  BUNKER_BED: {
    id: 'BUNKER_BED',
    name: 'Bunker Bed',
    icon: '🛏️',
    dimensions: { width: 0.85, depth: 1.93, height: 1.8 },
    color: '#334155', // Steel blue-grey frame
    maxQuantity: 99,
  },
  STUDY_TABLE: {
    id: 'STUDY_TABLE',
    name: 'Wall-Mounted Table',
    icon: '🏢',
    dimensions: { width: 0.79, depth: 0.45, height: 0.03 },
    color: '#94a3b8',
    maxQuantity: 99,
  },
  BERO: {
    id: 'BERO',
    name: 'Steel Bero',
    icon: '🚪',
    dimensions: { width: 1.06, depth: 0.51, height: 1.9 },
    color: '#475569',
    maxQuantity: 99,
  },
  CHAIR: {
    id: 'CHAIR',
    name: 'Hostel Chair',
    icon: '💺',
    dimensions: { width: 0.45, depth: 0.45, height: 0.85 },
    color: '#1e293b',
    maxQuantity: 99,
  },
  SHOWER: {
    id: 'SHOWER',
    name: 'Shower Enclosure',
    icon: '🚿',
    dimensions: { width: 0.9, depth: 0.9, height: 1.8 },
    color: '#cbd5e1',
    maxQuantity: 99,
  },
};

export const GRID_SIZE = 0.05; // 5 cm snapping for more precision