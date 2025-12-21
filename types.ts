
export type FurnitureType = 'BUNKER_BED' | 'STUDY_TABLE' | 'BERO' | 'CHAIR' | 'SHOWER' | 'FAN';
export type AppMode = 'edit' | 'view' | 'pov';

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface FurnitureDefinition {
  id: FurnitureType;
  name: string;
  icon: string;
  dimensions: Dimensions;
  color: string;
  maxQuantity: number;
}

export interface PlacedItem {
  instanceId: string;
  type: FurnitureType;
  position: [number, number, number];
  rotation: number; // Y-axis rotation in radians
}

export interface RoomConfig {
  width: number;
  depth: number;
  height: number;
}

export interface AppState {
  room: RoomConfig;
  placedItems: PlacedItem[];
  selectedId: string | null;
  showGrid: boolean;
  is2D: boolean;
  mode: AppMode;
}
