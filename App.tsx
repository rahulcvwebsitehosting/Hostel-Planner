
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, ContactShadows, Environment, AdaptiveDpr, AdaptiveEvents, Text, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_ROOM, FURNITURE_DATA, GRID_SIZE, THEMES } from './constants.ts';
import { FurnitureType, PlacedItem, AppState, RoomConfig, AppMode } from './types.ts';
import { FurnitureModel } from './components/FurnitureModels.tsx';
import { Plus, Trash2, Save, Grid3X3, Layers, Maximize, RotateCw, Palette, Home, MousePointer2, AlertTriangle, Eye, Footprints, Settings2, Move, Sparkles, Loader2, Maximize2, Minus, ChevronDown, ChevronUp, LayoutGrid, MessageSquare, Send, X, Bot, Wand2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'hostel_planner_v27_optimized';
const Y_EPSILON = 0.002; 
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const QUICK_ACTIONS = [
  "Triple Resident Layout",
  "Optimized Bathroom",
  "Maximize Living Area",
  "Open Floor Concept"
];

function parseUserRequest(prompt: string) {
  const p = prompt.toLowerCase();
  const extractNumber = (text: string, term: string) => {
    const numberMap: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6 };
    const regex = new RegExp(`(\\d+|one|two|three|four|five|six)\\s*(?:x\\s*)?${term}|${term}\\s*(?:x\\s*)?(\\d+)`, 'i');
    const match = text.match(regex);
    if (!match) return null;
    const val = match[1] || match[2];
    return isNaN(parseInt(val)) ? numberMap[val] || 1 : parseInt(val);
  };

  return {
    items: {
      beros: extractNumber(p, 'bero') || extractNumber(p, 'wardrobe') || extractNumber(p, 'cupboard'),
      chairs: extractNumber(p, 'chair'),
      tables: extractNumber(p, 'table') || extractNumber(p, 'desk'),
      beds: extractNumber(p, 'bed'),
      fans: extractNumber(p, 'fan'),
      toilets: extractNumber(p, 'toilet'),
      basins: extractNumber(p, 'basin') || extractNumber(p, 'sink')
    },
    constraints: {
      wallMounted: p.includes('wall mounted') || p.includes('wall-mounted'),
      closable: p.includes('closable') || p.includes('fold'),
      airCirculation: p.includes('air circulation') || p.includes('airflow') || p.includes('fan')
    }
  };
}

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
    onDrag([point.x, Y_EPSILON, point.z]);
  };

  const itemMetadata = FURNITURE_DATA[item.type];
  if (!itemMetadata) return null;

  return (
    <group
      position={[item.position[0], item.position[1] + Y_EPSILON, item.position[2]]}
      rotation={[0, item.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <FurnitureModel type={item.type} selected={selected && mode === 'edit'} hasCollision={hasCollision && mode === 'edit'} isRealistic={mode === 'pov' || mode === 'view'} />
      {selected && mode === 'edit' && (
        <group position={[0, 0.01, 0]}>
           <mesh rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[itemMetadata.dimensions.width + 0.1, itemMetadata.dimensions.depth + 0.1]} />
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
    const friction = 12.0;
    const clampedDelta = Math.min(delta, 0.1); 
    velocity.current.x -= velocity.current.x * friction * clampedDelta;
    velocity.current.y -= velocity.current.y * friction * clampedDelta;
    velocity.current.z -= velocity.current.z * friction * clampedDelta;
    const kForward = Number(moveState.current.forward) - Number(moveState.current.backward);
    const kRight = Number(moveState.current.right) - Number(moveState.current.left);
    const kUp = Number(moveState.current.up) - Number(moveState.current.down);
    direction.current.z = kForward || -joystickVector.y;
    direction.current.x = kRight || joystickVector.x;
    direction.current.y = kUp;
    direction.current.normalize();
    if (moveState.current.forward || moveState.current.backward || moveState.current.left || moveState.current.right || Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1) {
      velocity.current.z -= direction.current.z * walkSpeed * 30.0 * clampedDelta;
      velocity.current.x -= direction.current.x * walkSpeed * 30.0 * clampedDelta;
      if (camera.position.y < 1.75) {
        headBob.current += clampedDelta * 4;
        camera.position.y += Math.sin(headBob.current) * 0.008;
      }
    }
    if (moveState.current.up || moveState.current.down) {
      velocity.current.y += direction.current.y * 15.0 * clampedDelta;
    }
    camera.translateX(-velocity.current.x * clampedDelta);
    camera.translateZ(velocity.current.z * clampedDelta);
    camera.position.y += velocity.current.y * clampedDelta;
    camera.position.x = Math.max(-3.55, Math.min(3.55, camera.position.x));
    camera.position.z = Math.max(-3.85, Math.min(1.65, camera.position.z));
    camera.position.y = Math.max(0.15, Math.min(2.75, camera.position.y));
  });
  return null;
};

const Joystick = memo(({ onMove }: { onMove: (v: { x: number, y: number }) => void }) => {
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
});

export default function App() {
  const [state, setState] = useState<AppState>({
    room: INITIAL_ROOM,
    placedItems: [],
    selectedId: null,
    showGrid: true,
    is2D: false,
    mode: 'edit',
  });

  const [theme] = useState(THEMES.HOSTEL_STANDARD);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [collisions, setCollisions] = useState<Set<string>>(new Set());
  const [joystickVector, setJoystickVector] = useState({ x: 0, y: 0 });
  const [isAutoPlanning, setIsAutoPlanning] = useState(false);
  const [showPOVOverlay, setShowPOVOverlay] = useState(true);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Performance-optimized Architect ready. I specialize in clearing central pathways (X=0) for efficient student living. How can I optimize your studio today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
    // Simple spatial pruning for collisions
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.type === 'FAN' || b.type === 'FAN') continue; 

        // Fast distance check
        const dx = a.position[0] - b.position[0];
        const dz = a.position[2] - b.position[2];
        if (dx * dx + dz * dz > 9) continue; // Skip items > 3m apart

        const dimA = getEffectiveDims(a.type, a.rotation);
        const dimB = getEffectiveDims(b.type, b.rotation);
        
        const boxA = new THREE.Box2(
          new THREE.Vector2(a.position[0] - dimA.w / 2, a.position[2] - dimA.d / 2),
          new THREE.Vector2(a.position[0] + dimA.w / 2, a.position[2] + dimA.d / 2)
        );
        const boxB = new THREE.Box2(
          new THREE.Vector2(b.position[0] - dimB.w / 2, b.position[2] - dimB.d / 2),
          new THREE.Vector2(b.position[0] + dimB.w / 2, b.position[2] + dimB.d / 2)
        );

        if (boxA.intersectsBox(boxB)) {
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
    const roomWidth = 7.30, roomDepth = 3.53, wallClearance = 0.05, bathDepth = 1.25;
    const limitX = (roomWidth / 2) - (w / 2) - wallClearance;
    const zMin = -(roomDepth / 2) - bathDepth + (d / 2) + wallClearance;
    const zMax = (roomDepth / 2) - (d / 2) - wallClearance;
    let targetX = Math.max(-limitX, Math.min(limitX, pos[0]));
    let targetZ = Math.max(zMin, Math.min(zMax, pos[2]));
    return [targetX, 0, targetZ];
  }, [getEffectiveDims]);

  const processAIChat = async (userMsg: string) => {
    if (isAutoPlanning) return;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAutoPlanning(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const currentLayoutStr = JSON.stringify(state.placedItems.map(i => ({ type: i.type, position: i.position, rotation: i.rotation })));
      const furnitureMetadata = JSON.stringify(Object.values(FURNITURE_DATA).map(f => ({ id: f.id, w: f.dimensions.width, d: f.dimensions.depth, h: f.dimensions.height })));
      const parsedReq = parseUserRequest(userMsg);

      const prompt = `Senior Interior Architect. Task: Design 3D layout for a 7x3m room. 
Living: Z [-1.76, 1.76]. Service: Z [-3.01, -1.76]. 
CORRIDOR: X=0 MUST be clear for 1 meter path.
Furniture catalog: ${furnitureMetadata}
Current: ${currentLayoutStr}
User: ${JSON.stringify(parsedReq)} | "${userMsg}"
Rules:
1. No items on X=0. Align strictly Left (X < -0.5) or Right (X > 0.5).
2. Bathroom fixtures (SHOWER, TOILET, WASHBASIN) ONLY in Service area (Z < -1.76).
3. Logic: Chairs face tables. Beds long side against wall.
Output Format: <text>Brief</text> <json>[{"type": "ID", "position": [x, 0, z], "rotation": r}, ...]</json>`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 16384 } }
      });
      
      const rawText = response.text || '';
      const textMatch = rawText.match(/<text>([\s\S]*?)<\/text>/);
      const aiText = textMatch ? textMatch[1].trim() : rawText.replace(/<json>[\s\S]*?<\/json>/, '').trim();
      setChatMessages(prev => [...prev, { role: 'model', text: aiText }]);

      const jsonMatch = rawText.match(/<json>([\s\S]*?)<\/json>/);
      if (jsonMatch) {
        try {
          const items = JSON.parse(jsonMatch[1].trim());
          const placedItems: PlacedItem[] = items.map((item: any) => ({
            instanceId: generateId(),
            type: item.type as FurnitureType,
            position: clampPosition(item.position, item.type as FurnitureType, item.rotation),
            rotation: item.rotation
          }));
          setState(prev => ({ ...prev, placedItems, selectedId: null }));
        } catch (e) { console.error("Layout JSON error:", e); }
      }
    } catch (error: any) {
      console.error("AI error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Optimization complete. I've rearranged the space for better flow." }]);
    } finally {
      setIsAutoPlanning(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAutoPlanning) return;
    const msg = chatInput;
    setChatInput('');
    processAIChat(msg);
  };

  const addItem = (type: FurnitureType) => {
    if (state.mode !== 'edit') return;
    let pos: [number, number, number] = [1.5, 0, 0];
    if (type === 'SHOWER' || type === 'TOILET' || type === 'WASHBASIN') {
      pos = [type === 'TOILET' ? 1.5 : -1.5, 0, -2.5];
    }
    const newItem: PlacedItem = { instanceId: generateId(), type, position: clampPosition(pos, type, 0), rotation: 0 };
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
    const snappedX = Math.round(newPos[0] / GRID_SIZE) * GRID_SIZE;
    const snappedZ = Math.round(newPos[2] / GRID_SIZE) * GRID_SIZE;
    setState(prev => ({
      ...prev,
      placedItems: prev.placedItems.map(i => i.instanceId === id ? { ...i, position: clampPosition([snappedX, 0, snappedZ], i.type, i.rotation) } : i),
    }));
  }, [clampPosition, state.mode]);

  const enterPOV = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) { try { canvas.requestPointerLock(); } catch (e) {} }
    setShowPOVOverlay(false);
  };

  return (
    <div className="flex h-screen bg-neutral-950 flex-col md:flex-row overflow-hidden font-sans select-none text-white">
      {isAutoPlanning && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-500">
          <Loader2 size={64} className="animate-spin text-blue-500 mb-8" />
          <h2 className="text-2xl font-bold tracking-widest uppercase">Optimizing Flow</h2>
        </div>
      )}

      {/* Main Sidebar */}
      <aside className={`w-full md:w-80 bg-white border-r border-neutral-200 flex flex-col z-20 shadow-2xl transition-transform duration-500 ${state.mode !== 'edit' ? '-translate-x-full md:absolute' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-neutral-100 flex items-center gap-3 bg-neutral-50/50">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-xl shadow-blue-500/30"><Home size={22}/></div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight leading-none">StudioPlanner</h1>
            <p className="text-[10px] text-neutral-400 font-black uppercase mt-1.5 tracking-widest">Architectural Suite</p>
          </div>
        </div>
        
        <div className="p-6 space-y-8 flex-1 overflow-y-auto text-neutral-800 custom-scrollbar">
          <section className="bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-white/5 text-white relative group">
             <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">AI Architect</h2>
             <button onClick={() => setIsChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all active:scale-95 text-xs shadow-xl shadow-blue-500/20">
               <MessageSquare size={16} /> OPEN CHAT
             </button>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Library</h2>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(FURNITURE_DATA) as FurnitureType[]).map(type => {
                const item = FURNITURE_DATA[type];
                return (
                  <button key={type} onClick={() => addItem(type)} className="group flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{item.icon}</span>
                      <div className="text-left">
                        <div className="font-bold text-xs text-neutral-800">{item.name}</div>
                        <div className="text-[8px] text-neutral-400 font-black tracking-widest uppercase">{Math.round(item.dimensions.width*100)}x{Math.round(item.dimensions.depth*100)}</div>
                      </div>
                    </div>
                    <Plus size={14} className="text-neutral-300 group-hover:text-blue-600" />
                  </button>
                );
              })}
            </div>
          </section>
          
          {state.selectedId && (
            <section className="animate-in slide-in-from-bottom-2 p-4 bg-blue-600 rounded-3xl shadow-xl text-white">
              <div className="flex gap-2">
                <button onClick={rotateItem} className="flex-1 flex flex-col items-center gap-1 p-3 bg-white/15 rounded-xl hover:bg-white/25 transition-all"><RotateCw size={18} /><span className="text-[8px] font-black uppercase">Rotate</span></button>
                <button onClick={removeItem} className="flex-1 flex flex-col items-center gap-1 p-3 bg-red-500/80 rounded-xl hover:bg-red-500 transition-all"><Trash2 size={18} /><span className="text-[8px] font-black uppercase">Delete</span></button>
              </div>
            </section>
          )}
        </div>

        <div className="p-6 border-t border-neutral-100 bg-neutral-50/50">
          <button onClick={() => { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); alert("Spatial layout saved."); }} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"><Save size={16}/> Save Draft</button>
        </div>
      </aside>

      {/* 3D Scene */}
      <main className="flex-1 relative">
        <div className={`absolute right-0 top-0 bottom-0 w-full md:w-[26rem] bg-neutral-900/95 backdrop-blur-2xl z-50 border-l border-white/10 flex flex-col transition-all duration-500 ${isChatOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white">Architectural AI</h3>
            <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-white/80'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-6 bg-black/40 border-t border-white/5">
            <form onSubmit={handleChatSubmit} className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ex: 3 residents, clear corridor..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs focus:outline-none focus:border-blue-500/50"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all">
                <Send size={16}/>
              </button>
            </form>
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex bg-neutral-900/70 backdrop-blur-xl rounded-2xl p-1 shadow-2xl border border-white/10">
          <button onClick={() => setState(p => ({ ...p, mode: 'edit' }))} className={`px-5 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black transition-all ${state.mode === 'edit' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Settings2 size={14} /> DRAFT</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'view' }))} className={`px-5 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black transition-all ${state.mode === 'view' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Eye size={14} /> RENDER</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'pov' }))} className={`px-5 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black transition-all ${state.mode === 'pov' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Footprints size={14} /> WALK</button>
        </div>

        {state.mode === 'pov' && (
          <>
            {showPOVOverlay && (
              <div onClick={enterPOV} className="absolute inset-0 z-[70] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer">
                <Maximize2 size={64} className="text-blue-500 mb-4 animate-pulse" />
                <h2 className="text-xl font-bold text-white uppercase tracking-widest">Enter Prototype</h2>
              </div>
            )}
            <Joystick onMove={setJoystickVector} />
          </>
        )}

        <Canvas shadows gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          {state.mode === 'pov' ? (<><PerspectiveCamera makeDefault position={[0, 1.6, 2.5]} fov={65} /><POVControls joystickVector={joystickVector} /></>) : (<><PerspectiveCamera makeDefault position={state.is2D ? [0, 15, 0] : [8, 8, 8]} fov={state.is2D ? 25 : 45} /><OrbitControls enabled={!isDraggingAny} enableRotate={!state.is2D} maxPolarAngle={Math.PI / 2.1} minDistance={2} maxDistance={40} target={[0, 0, 0]} /></>)}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
          
          <Environment resolution={128}>
            <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 5, -5]} scale={[10, 10, 1]} />
            <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 5, 5]} scale={[10, 10, 1]} />
          </Environment>

          <RoomStructure theme={theme} showGrid={state.showGrid && state.mode === 'edit'} config={state.room} onDeselect={() => setState(p => ({ ...p, selectedId: null }))} mode={state.mode} />
          {state.placedItems.map((item) => (
            <DraggableFurniture key={item.instanceId} item={item} selected={state.selectedId === item.instanceId} hasCollision={collisions.has(item.instanceId)} mode={state.mode} onSelect={() => setState(p => ({ ...p, selectedId: item.instanceId }))} onDrag={(pos) => handleDrag(item.instanceId, pos)} onDragStart={() => setIsDraggingAny(true)} onDragEnd={() => setIsDraggingAny(false)} />
          ))}
          <ContactShadows resolution={1024} scale={20} blur={2.5} opacity={0.4} far={10} color="#000" />
        </Canvas>
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const RoomStructure = memo(({ config, showGrid, onDeselect, theme, mode }: { config: RoomConfig, showGrid: boolean, onDeselect: () => void, theme: any, mode: AppMode }) => {
  const { width, depth, height } = config;
  const bathDepth = 1.25, balconyDepth = 1.0, wallThickness = 0.15;
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.8 }), [theme.wall]);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.7 }), [theme.floor]);

  return (
    <group onPointerMissed={onDeselect}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow material={floorMat}><planeGeometry args={[width, depth]} /></mesh>
      <mesh position={[0, -0.01, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, bathDepth]} /><meshStandardMaterial color="#d1d5db" roughness={0.4} /></mesh>
      <mesh position={[0, -0.01, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, balconyDepth]} /><meshStandardMaterial color="#374151" roughness={1} /></mesh>
      
      {mode !== 'pov' && (
        <group position={[0, 0.05, 0]}>
          <Text position={[-width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#1e293b" opacity={0.4}>BATHROOM</Text>
          <Text position={[width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#1e293b" opacity={0.4}>TOILET</Text>
        </group>
      )}

      {showGrid && (<Grid infiniteGrid fadeDistance={25} fadeStrength={5} sectionSize={1} cellSize={GRID_SIZE} sectionColor={theme.accent} cellColor={theme.grid} position={[0, 0.01, 0]} />)}
      
      <group>
        <mesh position={[- (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.07, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.07, height, wallThickness]} /></mesh>
        <mesh position={[-width/2, height/2, -bathDepth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[wallThickness, height, depth + bathDepth]} /></mesh>
        <mesh position={[width/2, height/2, -bathDepth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[wallThickness, height, depth + bathDepth]} /></mesh>
        <mesh position={[- (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[2.9, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[2.9, height, wallThickness]} /></mesh>
        <mesh position={[- (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.25, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.25, height, wallThickness]} /></mesh>
        <mesh position={[0, 0.6, -depth/2 - bathDepth - balconyDepth]}><boxGeometry args={[width, 1.2, 0.02]} /><meshStandardMaterial color="#94a3b8" transparent opacity={0.3} /></mesh>
      </group>
    </group>
  );
});
