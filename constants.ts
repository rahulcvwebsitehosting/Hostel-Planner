
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
    grid: '#cbd5e1',
    floorRoughness: 0.1,
    floorMetalness: 0.05,
    wallRoughness: 0.9,
  },
  CONCRETE: {
    wall: '#94a3b8', 
    floor: '#475569', 
    accent: '#6366f1',
    grid: '#334155',
    floorRoughness: 0.5,
    floorMetalness: 0.2,
    wallRoughness: 0.7,
  },
  WARM_DORM: {
    wall: '#fafaf9', 
    floor: '#d6d3d1', 
    accent: '#f59e0b',
    grid: '#78716c',
    floorRoughness: 0.8,
    floorMetalness: 0,
    wallRoughness: 1.0,
  }
};

export const FURNITURE_DATA: Record<string, FurnitureDefinition> = {
  BUNKER_BED: {
    id: 'BUNKER_BED',
    name: 'Bunker Bed',
    icon: '🛏️',
    dimensions: { width: 0.85, depth: 1.93, height: 1.8 },
    color: '#334155', 
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
  }
};

// Fixtures that are default but not in the library
export const FIXTURE_DATA: Record<string, any> = {
  TOILET: { dimensions: { width: 0.4, depth: 0.7, height: 0.8 }, color: '#ffffff' },
  WASHBASIN: { dimensions: { width: 0.5, depth: 0.4, height: 0.85 }, color: '#f8fafc' },
  SHOWER: { dimensions: { width: 0.9, depth: 0.9, height: 1.8 }, color: '#cbd5e1' },
  FAN: { dimensions: { width: 1.2, depth: 1.2, height: 0.2 }, color: '#f8fafc' }
};

export const GRID_SIZE = 0.05;
