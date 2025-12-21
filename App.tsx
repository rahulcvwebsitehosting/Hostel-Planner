
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, ContactShadows, Environment, AdaptiveDpr, AdaptiveEvents, Text } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_ROOM, FURNITURE_DATA, GRID_SIZE, THEMES } from './constants';
import { FurnitureType, PlacedItem, AppState, RoomConfig, AppMode } from './types';
import { FurnitureModel } from './components/FurnitureModels';
import { Plus, Trash2, Save, Grid3X3, Layers, Maximize, RotateCw, Palette, Home, MousePointer2, AlertTriangle, Eye, Footprints, Settings2, Move, Sparkles, Loader2, Maximize2, Minus, ChevronDown, ChevronUp } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'hostel_planner_v15_final';
const generateId = () => Math.random().toString(36).substr(2, 9);

interface DraggableProps {
  item: PlacedItem;
  selected: boolean;
  hasCollision: boolean;
  mode: AppMode;
  onSelect: () => void;
  onDrag: (pos: [number, number, number]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const DraggableFurniture = memo(({ item, selected, hasCollision, mode, onSelect, onDrag, onDragStart, onDragEnd }: DraggableProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const handlePointerDown = (e: any) => {
    if (mode !== 'edit') return;
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    onDragStart();
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: any) => {
    if (mode !== 'edit') return;
    setIsDragging(false);
    onDragEnd();
    e.target.releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging || mode !== 'edit') return;
    e.stopPropagation();
    const point = new THREE.Vector3();
    e.ray.intersectPlane(floorPlane, point);
    onDrag([point.x, 0, point.z]);
  };

  const itemMetadata = FURNITURE_DATA[item.type];
  if (!itemMetadata) return null;

  return (
    <group
      position={item.position}
      rotation={[0, item.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <FurnitureModel type={item.type} selected={selected && mode === 'edit'} hasCollision={hasCollision && mode === 'edit'} isRealistic={mode === 'pov' || mode === 'view'} />
      {selected && mode === 'edit' && (
        <group position={[0, 0.01, 0]}>
           <mesh rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[itemMetadata.dimensions.width + 0.05, itemMetadata.dimensions.depth + 0.05]} />
              <meshBasicMaterial color={hasCollision ? "#ef4444" : "#3B82F6"} transparent opacity={0.3} />
           </mesh>
        </group>
      )}
    </group>
  );
});

const POVControls = ({ joystickVector }: { joystickVector: { x: number, y: number } }) => {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, up: false, down: false });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const headBob = useRef(0);
  const isPointerDown = useRef(false);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
        case 'Space': moveState.current.up = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': moveState.current.down = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
        case 'Space': moveState.current.up = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': moveState.current.down = false; break;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement || isPointerDown.current) {
        const sens = 0.002;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= e.movementX * sens;
        euler.x -= e.movementY * sens;
        euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
        camera.quaternion.setFromEuler(euler);
      }
    };
    const onPointerDown = () => { isPointerDown.current = true; };
    const onPointerUp = () => { isPointerDown.current = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    gl.domElement.addEventListener('pointermove', onPointerMove);
    gl.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gl.domElement.removeEventListener('pointermove', onPointerMove);
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, camera, euler]);

  useFrame((state, delta) => {
    const walkSpeed = 0.8; 
    const flySpeed = 0.7;
    const friction = 12.0;
    velocity.current.x -= velocity.current.x * friction * delta;
    velocity.current.y -= velocity.current.y * friction * delta;
    velocity.current.z -= velocity.current.z * friction * delta;
    const kForward = Number(moveState.current.forward) - Number(moveState.current.backward);
    const kRight = Number(moveState.current.right) - Number(moveState.current.left);
    const kUp = Number(moveState.current.up) - Number(moveState.current.down);
    direction.current.z = kForward || -joystickVector.y;
    direction.current.x = kRight || joystickVector.x;
    direction.current.y = kUp;
    direction.current.normalize();
    if (moveState.current.forward || moveState.current.backward || moveState.current.left || moveState.current.right || Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1) {
      velocity.current.z -= direction.current.z * walkSpeed * 30.0 * delta;
      velocity.current.x -= direction.current.x * walkSpeed * 30.0 * delta;
      if (camera.position.y < 1.75) {
        headBob.current += delta * 4;
        camera.position.y += Math.sin(headBob.current) * 0.008;
      }
    }
    if (moveState.current.up || moveState.current.down) {
      velocity.current.y += direction.current.y * flySpeed * 25.0 * delta;
    }
    camera.translateX(-velocity.current.x * delta);
    camera.translateZ(velocity.current.z * delta);
    camera.position.y += velocity.current.y * delta;
    camera.position.x = Math.max(-3.55, Math.min(3.55, camera.position.x));
    camera.position.z = Math.max(-3.85, Math.min(1.65, camera.position.z));
    camera.position.y = Math.max(0.15, Math.min(2.75, camera.position.y));
  });
  return null;
};

const Joystick = ({ onMove }: { onMove: (v: { x: number, y: number }) => void }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const handleTouch = (e: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx*dx + dy*dy);
    const maxRadius = 40;
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    setPos({ x: dx, y: dy });
    onMove({ x: dx / maxRadius, y: dy / maxRadius });
  };
  const reset = () => { setPos({ x: 0, y: 0 }); onMove({ x: 0, y: 0 }); };
  return (
    <div className="fixed bottom-12 left-12 w-28 h-28 bg-white/5 backdrop-blur-xl rounded-full border border-white/20 z-[60] flex items-center justify-center touch-none select-none shadow-2xl"
      onPointerMove={handleTouch} onPointerUp={reset} onPointerLeave={reset}>
      <div className="w-14 h-14 bg-blue-600/80 rounded-full shadow-lg flex items-center justify-center pointer-events-none ring-4 ring-white/10"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
        <Move size={24} className="text-white" />
      </div>
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<AppState>({
    room: INITIAL_ROOM,
    placedItems: [],
    selectedId: null,
    showGrid: true,
    is2D: false,
    mode: 'edit',
  });

  const [theme, setTheme] = useState(THEMES.HOSTEL_STANDARD);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [collisions, setCollisions] = useState<Set<string>>(new Set());
  const [joystickVector, setJoystickVector] = useState({ x: 0, y: 0 });
  const [isAutoPlanning, setIsAutoPlanning] = useState(false);
  const [showPOVOverlay, setShowPOVOverlay] = useState(true);
  const [showAiSettings, setShowAiSettings] = useState(false);
  
  // Custom layout targets for AI
  const [layoutTargets, setLayoutTargets] = useState<Record<FurnitureType, number>>({
    BUNKER_BED: 2,
    STUDY_TABLE: 2,
    BERO: 2,
    CHAIR: 2,
  });

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.placedItems) {
          parsed.placedItems = parsed.placedItems.filter((i: any) => FURNITURE_DATA[i.type]);
        }
        setState(prev => ({ ...prev, ...parsed, mode: 'edit' }));
      } catch (e) { console.error("Load failed", e); }
    }
  }, []);

  const getEffectiveDims = useCallback((type: FurnitureType, rotation: number) => {
    const itemData = FURNITURE_DATA[type];
    if (!itemData) return { w: 0, d: 0 };
    const dims = itemData.dimensions;
    const isRotated = Math.round(Math.abs(Math.sin(rotation))) === 1;
    return {
      w: isRotated ? dims.depth : dims.width,
      d: isRotated ? dims.width : dims.depth
    };
  }, []);

  const checkCollisions = useCallback((items: PlacedItem[]) => {
    const collidingIds = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dimA = getEffectiveDims(a.type, a.rotation);
        const dimB = getEffectiveDims(b.type, b.rotation);
        if (dimA.w === 0 || dimB.w === 0) continue;
        const overlapX = Math.abs(a.position[0] - b.position[0]) < (dimA.w + dimB.w) / 2 - 0.005;
        const overlapZ = Math.abs(a.position[2] - b.position[2]) < (dimA.d + dimB.d) / 2 - 0.005;
        if (overlapX && overlapZ) {
          collidingIds.add(a.instanceId);
          collidingIds.add(b.instanceId);
        }
      }
    }
    setCollisions(collidingIds);
  }, [getEffectiveDims]);

  useEffect(() => {
    checkCollisions(state.placedItems);
  }, [state.placedItems, checkCollisions]);

  const clampPosition = useCallback((pos: [number, number, number], type: FurnitureType, rotation: number): [number, number, number] => {
    const { w, d } = getEffectiveDims(type, rotation);
    if (w === 0) return pos;
    const roomWidth = 7.30, roomDepth = 3.53, padding = 0.1;
    
    // Limits based on the living room floor (3.53m depth, 7.3m width)
    const limitX = (roomWidth / 2) - (w / 2) - padding;
    const limitZ = (roomDepth / 2) - (d / 2) - padding;

    let targetX = Math.max(-limitX, Math.min(limitX, pos[0]));
    let targetZ = Math.max(-limitZ, Math.min(limitZ, pos[2]));
    
    return [targetX, 0, targetZ];
  }, [getEffectiveDims]);

  const addItem = (type: FurnitureType) => {
    if (state.mode !== 'edit' || !FURNITURE_DATA[type]) return;
    const newItem: PlacedItem = {
      instanceId: generateId(),
      type,
      position: [0, 0, 0],
      rotation: 0,
    };
    setState(prev => ({ ...prev, placedItems: [...prev.placedItems, newItem], selectedId: newItem.instanceId }));
  };

  const removeItem = () => {
    if (!state.selectedId || state.mode !== 'edit') return;
    setState(prev => ({ ...prev, placedItems: prev.placedItems.filter(i => i.instanceId !== state.selectedId), selectedId: null }));
  };

  const rotateItem = () => {
    if (!state.selectedId || state.mode !== 'edit') return;
    setState(prev => {
      const updatedItems = prev.placedItems.map(i => {
        if (i.instanceId === prev.selectedId) {
          const newRotation = i.rotation + Math.PI / 2;
          return { ...i, rotation: newRotation, position: clampPosition(i.position, i.type, newRotation) };
        }
        return i;
      });
      return { ...prev, placedItems: updatedItems };
    });
  };

  const handleDrag = useCallback((id: string, newPos: [number, number, number]) => {
    if (state.mode !== 'edit') return;
    const item = state.placedItems.find(i => i.instanceId === id);
    if (!item) return;
    const snappedX = Math.round(newPos[0] / GRID_SIZE) * GRID_SIZE;
    const snappedZ = Math.round(newPos[2] / GRID_SIZE) * GRID_SIZE;
    setState(prev => ({
      ...prev,
      placedItems: prev.placedItems.map(i => i.instanceId === id ? { ...i, position: clampPosition([snappedX, 0, snappedZ], i.type, i.rotation) } : i),
    }));
  }, [state.placedItems, clampPosition, state.mode]);

  const handleAutoPlan = async () => {
    setIsAutoPlanning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `Task: Create a professional furniture layout for a hostel room.
CRITICAL SPATIAL COORDINATES (METERS):
- LIVING ROOM FLOOR SIZE: Width 7.30m (X from -3.65 to 3.65), Depth 3.53m (Z from -1.76 to 1.76).
- CENTER OF ROOM: [0, 0, 0].
- ENTRANCE WALL (+Z): Located at Z = 1.76. Lockers/Beros usually go here.
- WINDOW WALL (-Z): Located at Z = -1.76. Study tables usually go here.
- SIDE WALLS (+/- X): Located at X = +/- 3.65. Beds usually go here.

- ABSOLUTELY FORBIDDEN ZONES: 
  - Never place furniture where Z < -1.76. This is the BATHROOM and TOILET area.
  - Never place furniture where |X| > 3.65. This is OUTSIDE the building.
  - Never place furniture where Z > 1.76. This is the ENTRANCE hallway.

REQUIRED QUANTITIES:
- BUNKER_BED: ${layoutTargets.BUNKER_BED}
- STUDY_TABLE: ${layoutTargets.STUDY_TABLE}
- BERO (Steel Locker): ${layoutTargets.BERO}
- CHAIR: ${layoutTargets.CHAIR}

PLACEMENT LOGIC:
1. BEDS: Place along side walls (X near +/- 3.1). Keep them parallel to the X-axis walls (Rotation 0 or PI).
2. BEROS: Place near the entrance (+Z area, Z around 1.0 to 1.5).
3. TABLES: Place against the back wall window (-Z area, Z around -1.2 to -1.5).
4. CHAIRS: Place them strictly in front of tables (e.g., if table is at Z=-1.3, place chair at Z=-0.8).
5. CIRCULATION: Ensure there is at least a 1-meter clear path from the entrance (+Z center) through the room.

OUTPUT FORMAT: Return ONLY a JSON array of objects: { "type": string, "position": [number, 0, number], "rotation": number }.
Valid types: "BUNKER_BED", "STUDY_TABLE", "BERO", "CHAIR".`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 2048 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                rotation: { type: Type.NUMBER }
              },
              required: ["type", "position", "rotation"]
            }
          }
        }
      });
      
      const items = JSON.parse(response.text || '[]');
      const validTypes = Object.keys(FURNITURE_DATA);
      
      const placedItems: PlacedItem[] = items
        .filter((item: any) => validTypes.includes(item.type))
        .map((item: any) => {
          const rawPos = item.position as [number, number, number];
          // Force Clamp and validate coordinate integrity
          const clamped = clampPosition(rawPos, item.type as FurnitureType, item.rotation);
          return {
            instanceId: generateId(),
            type: item.type as FurnitureType,
            position: clamped,
            rotation: item.rotation
          };
        });
        
      setState(prev => ({ ...prev, placedItems, selectedId: null }));
    } catch (error: any) {
      console.error("AI Planning failed:", error);
      alert("AI was unable to generate a plan. Using fallback layout.");
      // Fallback: 2-student setup
      const fallback: PlacedItem[] = [
        { instanceId: generateId(), type: 'BUNKER_BED', position: [-3.1, 0, 0], rotation: 0 },
        { instanceId: generateId(), type: 'BUNKER_BED', position: [3.1, 0, 0], rotation: 0 },
        { instanceId: generateId(), type: 'BERO', position: [-2.5, 0, 1.2], rotation: 0 },
        { instanceId: generateId(), type: 'BERO', position: [2.5, 0, 1.2], rotation: 0 },
      ];
      setState(prev => ({ ...prev, placedItems: fallback, selectedId: null }));
    } finally { setIsAutoPlanning(false); }
  };

  const updateTarget = (type: FurnitureType, delta: number) => {
    setLayoutTargets(prev => ({
      ...prev,
      [type]: Math.max(0, Math.min(6, prev[type] + delta))
    }));
  };

  const enterPOV = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) { try { canvas.requestPointerLock(); } catch (e) {} }
    setShowPOVOverlay(false);
  };

  return (
    <div className="flex h-screen bg-neutral-950 flex-col md:flex-row overflow-hidden font-sans select-none text-white">
      {isAutoPlanning && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-white">
          <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
          <h2 className="text-xl font-bold tracking-widest uppercase">Designing with Gemini...</h2>
          <p className="text-white/40 text-[10px] mt-2 uppercase tracking-[0.2em]">Calculating spatial reasoning & constraints</p>
        </div>
      )}
      <aside className={`w-full md:w-80 bg-white border-r border-neutral-200 flex flex-col z-20 shadow-2xl transition-transform duration-500 ${state.mode !== 'edit' ? '-translate-x-full md:absolute' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-neutral-100 flex items-center gap-3 bg-neutral-50">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/30"><Home size={20}/></div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight leading-none">DormPlanner</h1>
            <p className="text-[10px] text-neutral-500 font-black uppercase mt-1 tracking-widest">Architect Studio</p>
          </div>
        </div>
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* AI CONFIG SECTION */}
          <section className="bg-neutral-900 rounded-2xl p-4 shadow-xl">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12}/> AI Layout Config</h2>
                <button onClick={() => setShowAiSettings(!showAiSettings)} className="text-white/40 hover:text-white transition-colors">
                  {showAiSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
             </div>
             
             {showAiSettings && (
               <div className="space-y-3 mb-4 border-b border-white/10 pb-4 animate-in fade-in slide-in-from-top-2">
                 {(Object.keys(FURNITURE_DATA) as FurnitureType[]).map(type => (
                   <div key={type} className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-white/60">{FURNITURE_DATA[type].name}</span>
                     <div className="flex items-center gap-3">
                        <button onClick={() => updateTarget(type, -1)} className="p-1 rounded bg-white/10 hover:bg-white/20"><Minus size={10}/></button>
                        <span className="text-xs font-black min-w-[12px] text-center">{layoutTargets[type]}</span>
                        <button onClick={() => updateTarget(type, 1)} className="p-1 rounded bg-white/10 hover:bg-white/20"><Plus size={10}/></button>
                     </div>
                   </div>
                 ))}
                 <button onClick={() => setLayoutTargets({ BUNKER_BED: 2, STUDY_TABLE: 2, BERO: 2, CHAIR: 2 })} className="w-full py-1.5 text-[10px] font-black text-white/40 hover:text-white transition-colors uppercase">Reset to 2-Student</button>
               </div>
             )}

             <button onClick={handleAutoPlan} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all active:scale-95 text-xs">
               <Sparkles size={16} /> GENERATE PLAN
             </button>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette size={12}/> Color Palette</h2>
            <div className="flex gap-2">{Object.entries(THEMES).map(([key, t]) => (<button key={key} onClick={() => setTheme(t)} className={`flex-1 h-10 rounded-lg border-2 transition-all ${theme === t ? 'border-blue-500 scale-95 shadow-inner' : 'border-neutral-200'}`} style={{ backgroundColor: t.floor }} />))}</div>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Add Elements</h2>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(FURNITURE_DATA) as FurnitureType[]).map(type => {
                const item = FURNITURE_DATA[type];
                return (
                  <button key={type} onClick={() => addItem(type)} className="group w-full flex items-center justify-between p-3 rounded-xl border-2 border-neutral-100 bg-white hover:border-blue-600 hover:bg-blue-50 transition-all">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="text-left"><div className="font-bold text-sm text-neutral-800">{item.name}</div><div className="text-[10px] text-neutral-500 uppercase font-bold tracking-tighter">{Math.round(item.dimensions.width*100)}x{Math.round(item.dimensions.depth*100)}cm</div></div>
                    </div>
                    <Plus size={14} className="text-neutral-300 group-hover:text-blue-600" />
                  </button>
                );
              })}
            </div>
          </section>

          {state.selectedId && (
            <section className="animate-in slide-in-from-bottom-4 p-4 bg-blue-600 rounded-2xl shadow-xl text-white">
              <h3 className="text-[10px] font-black uppercase flex items-center gap-2 mb-3">Selected Item Controls</h3>
              <div className="flex gap-2">
                <button onClick={rotateItem} className="flex-1 flex flex-col items-center p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all"><RotateCw size={18} /><span className="text-[10px] font-black mt-1 uppercase">Rotate</span></button>
                <button onClick={removeItem} className="flex-1 flex flex-col items-center p-3 bg-red-500 rounded-xl hover:bg-red-400 transition-all"><Trash2 size={18} /><span className="text-[10px] font-black mt-1 uppercase">Delete</span></button>
              </div>
            </section>
          )}
        </div>
        <div className="p-6 border-t border-neutral-100"><button onClick={() => { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); alert("Saved!"); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-xl transition-all">Save Project</button></div>
      </aside>
      <main className="flex-1 relative">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex bg-neutral-900/40 backdrop-blur-2xl rounded-2xl p-1 shadow-2xl border border-white/10">
          <button onClick={() => setState(p => ({ ...p, mode: 'edit' }))} className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${state.mode === 'edit' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white'}`}><Settings2 size={14} /> EDIT</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'view' }))} className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${state.mode === 'view' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white'}`}><Eye size={14} /> VIEW</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'pov' }))} className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${state.mode === 'pov' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-white'}`}><Footprints size={14} /> POV</button>
        </div>
        {state.mode === 'pov' && (
          <>
            {showPOVOverlay && (<div onClick={enterPOV} className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center cursor-pointer group"><div className="text-center bg-white/10 p-12 rounded-[3rem] border border-white/20 shadow-2xl group-hover:scale-105 transition-transform"><Maximize2 size={64} className="mx-auto text-blue-400 mb-4 animate-pulse" /><h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Click to Explore</h2><p className="text-white/60 text-sm max-w-xs mx-auto">Click anywhere to enter the room. Drag to look around.</p></div></div>)}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 z-40 pointer-events-none opacity-40"><div className="absolute top-1/2 left-0 w-4 h-[1px] bg-white" /><div className="absolute left-1/2 top-0 w-[1px] h-4 bg-white" /></div>
            <Joystick onMove={setJoystickVector} />
            <div className="absolute bottom-10 right-10 z-50 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-bold text-white/50 border border-white/10 tracking-widest uppercase">WASD: Walk • Space/Shift: Fly</div>
          </>
        )}
        <div className="absolute top-6 right-6 z-50 flex flex-col space-y-2">
          {state.mode === 'edit' && (<button onClick={() => setState(p => ({ ...p, showGrid: !p.showGrid }))} className={`p-4 rounded-2xl shadow-2xl transition-all border-2 ${state.showGrid ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white border-neutral-200 text-neutral-400'}`}><Grid3X3 size={24}/></button>)}
          <button onClick={() => setState(p => ({ ...p, is2D: !p.is2D }))} className={`p-4 rounded-2xl shadow-2xl transition-all border-2 ${state.is2D ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white border-neutral-200 text-neutral-400'}`}>{state.is2D ? <Maximize size={24}/> : <Layers size={24}/>}</button>
        </div>
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
          <AdaptiveDpr pixelated /><AdaptiveEvents />
          {state.mode === 'pov' ? (<><PerspectiveCamera makeDefault position={[0, 1.6, 2.5]} fov={65} /><POVControls joystickVector={joystickVector} /></>) : (<><PerspectiveCamera makeDefault position={state.is2D ? [0, 15, 0] : [10, 10, 10]} fov={state.is2D ? 25 : 45} /><OrbitControls enabled={!isDraggingAny} enableRotate={!state.is2D} maxPolarAngle={Math.PI / 2.1} makeDefault minDistance={2} maxDistance={50} target={[0, 0, 0]} /></>)}
          <ambientLight intensity={state.mode === 'pov' ? 0.3 : 0.8} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
          {(state.mode === 'pov' || state.mode === 'view') && (<group><pointLight position={[0, 2.5, 0]} intensity={4} color="#fffcf0" distance={12} decay={1.5} castShadow /><pointLight position={[3, 2, -4]} intensity={2} color="#fffcf0" distance={6} decay={2} /><pointLight position={[-3, 2, -4]} intensity={2} color="#fffcf0" distance={6} decay={2} /></group>)}
          <Environment preset="apartment" background={state.mode === 'pov'} backgroundBlurriness={0.5} />
          <RoomStructure theme={theme} showGrid={state.showGrid && state.mode === 'edit'} config={state.room} onDeselect={() => setState(p => ({ ...p, selectedId: null }))} mode={state.mode} />
          {state.placedItems.map((item) => (
            <DraggableFurniture key={item.instanceId} item={item} selected={state.selectedId === item.instanceId} hasCollision={collisions.has(item.instanceId)} mode={state.mode} onSelect={() => setState(p => ({ ...p, selectedId: item.instanceId }))} onDrag={(pos) => handleDrag(item.instanceId, pos)} onDragStart={() => setIsDraggingAny(true)} onDragEnd={() => setIsDraggingAny(false)} />
          ))}
          <ContactShadows resolution={1024} scale={40} blur={2.5} opacity={0.6} far={20} color="#000" />
        </Canvas>
      </main>
    </div>
  );
}

const RoomStructure = memo(({ config, showGrid, onDeselect, theme, mode }: { config: RoomConfig, showGrid: boolean, onDeselect: () => void, theme: any, mode: AppMode }) => {
  const { width, depth, height } = config;
  const bathDepth = 1.25, balconyDepth = 1.0, wallThickness = 0.15;
  return (
    <group onPointerMissed={onDeselect}>
      {/* Living Room Floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, depth]} /><meshStandardMaterial color={theme.floor} roughness={0.6} metalness={0.1} /></mesh>
      
      {/* Bathroom / Toilet Floor */}
      <mesh position={[0, -0.01, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, bathDepth]} /><meshStandardMaterial color="#d1d5db" roughness={0.3} metalness={0.2} /></mesh>
      
      {/* Balcony Floor */}
      <mesh position={[0, -0.01, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, balconyDepth]} /><meshStandardMaterial color="#374151" roughness={0.9} /></mesh>
      
      {mode !== 'pov' && (
        <group position={[0, 0.05, 0]}>
          <Text position={[-width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#1e293b" fillOpacity={0.5} fontWeight="bold">BATHROOM</Text>
          <Text position={[width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#1e293b" fillOpacity={0.5} fontWeight="bold">TOILET</Text>
          <Text position={[0, 0, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#fff" fillOpacity={0.7} fontWeight="bold">BALCONY</Text>
        </group>
      )}

      {showGrid && (<Grid infiniteGrid fadeDistance={40} fadeStrength={5} sectionSize={1} cellSize={GRID_SIZE} sectionColor={theme.accent} cellColor={theme.grid} position={[0, 0.01, 0]} />)}
      
      {/* Walls */}
      <group>
        {/* Front wall (entrance) */}
        <mesh position={[- (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow><boxGeometry args={[3.07, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[ (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow><boxGeometry args={[3.07, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        
        {/* Side walls */}
        <mesh position={[-width/2, height/2, -bathDepth/2]} receiveShadow castShadow><boxGeometry args={[wallThickness, height, depth + bathDepth]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[width/2, height/2, -bathDepth/2]} receiveShadow castShadow><boxGeometry args={[wallThickness, height, depth + bathDepth]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        
        {/* Back wall (bathroom divider) */}
        <mesh position={[- (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow><boxGeometry args={[2.9, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[ (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow><boxGeometry args={[2.9, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        
        {/* External back wall (beyond bathroom) */}
        <mesh position={[- (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow><boxGeometry args={[3.25, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[ (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow><boxGeometry args={[3.25, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        
        {/* Balcony Railing */}
        <mesh position={[0, 0.6, -depth/2 - bathDepth - balconyDepth]}><boxGeometry args={[width, 1.2, 0.04]} /><meshPhysicalMaterial color="#94a3b8" transmission={0.9} thickness={0.1} roughness={0.1} transparent opacity={0.4} /></mesh>
      </group>
    </group>
  );
});
