
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, ContactShadows, Environment, AdaptiveDpr, AdaptiveEvents, Text, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_ROOM, FURNITURE_DATA, GRID_SIZE, THEMES } from './constants.ts';
import { FurnitureType, PlacedItem, AppState, RoomConfig, AppMode } from './types.ts';
import { FurnitureModel } from './components/FurnitureModels.tsx';
import { Plus, Trash2, Save, Grid3X3, Layers, Maximize, RotateCw, Palette, Home, MousePointer2, AlertTriangle, Eye, Footprints, Settings2, Move, Sparkles, Loader2, Maximize2, Minus, ChevronDown, ChevronUp, LayoutGrid, MessageSquare, Send, X, Bot, Wand2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'hostel_planner_v24_architect';
const Y_EPSILON = 0.002; 
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const QUICK_ACTIONS = [
  "Triple Resident Layout",
  "Maximize Airflow",
  "Deep Study Config",
  "Balanced Circulation",
  "Open Central Path"
];

// Enhanced parsing to detect specific spatial needs
function parseUserRequest(prompt: string) {
  const p = prompt.toLowerCase();
  const extractNumber = (text: string, term: string) => {
    const numberMap: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6 };
    // Matches "3 beds", "3x beds", "three beds", "bed x3", etc.
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
      fans: extractNumber(p, 'fan')
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
      velocity.current.y += direction.current.y * 15.0 * delta;
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
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Master Architect Mode active. I am now strictly programmed to enforce 1-meter walking paths, logical pairing (chairs to tables), and precise wall alignment for beds. How can I transform your studio today?" }
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
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.type === 'FAN' || b.type === 'FAN') continue; 

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

      const prompt = `You are a professional Senior Architect. Your objective is to design efficient, architecturally sound furniture layouts for a hostel room.

ROOM COORDINATES (Meters):
- Room Center: [0, 0, 0]
- Living Area Boundaries: X: [-3.65, 3.65], Z: [-1.76, 1.76]
- Bathroom/Service Area: X: [-3.65, 3.65], Z: [-3.01, -1.76]
- Total Room Depth: -3.01 to 1.76

FURNITURE CATALOG: ${furnitureMetadata}
CURRENT STATE: ${currentLayoutStr}
USER DETECTED INTENT: ${JSON.stringify(parsedReq)}
USER PROMPT: "${userMsg}"

STRICT SPATIAL RULES:
1. LIVING ZONE PRIORITY: 
   - All furniture except 'SHOWER' must be placed within Z: [-1.76 to 1.76].
   - Never place beds or tables in the bathroom area (Z < -1.76).
2. CIRCULATION (1M PATH):
   - You MUST maintain a clear, continuous 1-meter wide walking path from the entrance (Z=1.76) to the bathroom door (Z=-1.76). 
   - The easiest way is to keep X=0 (the center column) clear.
3. LOGICAL RELATIONSHIPS:
   - CHAIRS: Every chair MUST be paired with a STUDY_TABLE. Place it ~0.45m in front of the table, facing it.
   - BEDS: Long side of the bed must touch a wall (X=+/-3.65 or Z=1.76).
   - WALL-MOUNTED: Tables must be flush against side walls (X=+/- 3.65).
4. HIGH DENSITY (3+ PEOPLE):
   - For 3+ residents, use both side walls (left/right) for beds and desks to maximize floor space.
5. AIRFLOW:
   - Distribute requested FANS evenly along the Z-axis (at X=0, Y=0).
6. NO REFUSAL:
   - Do not say "I'm having trouble". Provide the absolute best layout possible for the requested item count.

OUTPUT FORMAT (MANDATORY):
<text>Professional architectural brief explaining the zoning, the 1m clearance path, and the resident distribution.</text>
<json>[{"type": "ID", "position": [x, 0, z], "rotation": r}, ...]</json>`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
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
      setChatMessages(prev => [...prev, { role: 'model', text: "The spatial complexity of your request is high. I've attempted to optimize the 7x3m space as much as physically possible." }]);
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
    let pos: [number, number, number] = [0, 0, 0];
    if (type === 'SHOWER') pos = [-3.2, 0, -2.5];
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
          <div className="relative mb-8">
            <Loader2 size={64} className="animate-spin text-blue-500" />
            <Bot size={24} className="absolute inset-0 m-auto text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-widest uppercase mb-2">Spatial Simulation</h2>
          <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Running architectural analysis...</p>
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
          <section className="bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-white/5 text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Sparkles size={48}/></div>
             <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">AI Architect Assistant</h2>
             <p className="text-[11px] text-white/50 mb-5 leading-relaxed">Design high-density layouts (3+ people) with guaranteed circulation paths and airflow.</p>
             <button onClick={() => setIsChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all active:scale-95 text-xs shadow-xl shadow-blue-500/20">
               <MessageSquare size={16} /> TALK TO ARCHITECT
             </button>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2"><LayoutGrid size={12}/> Material Library</h2>
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(FURNITURE_DATA) as FurnitureType[]).map(type => {
                const item = FURNITURE_DATA[type];
                return (
                  <button key={type} onClick={() => addItem(type)} className="group w-full flex items-center justify-between p-4 rounded-2xl border-2 border-neutral-50 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center space-x-4">
                      <span className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">{item.icon}</span>
                      <div className="text-left">
                        <div className="font-bold text-sm text-neutral-800 tracking-tight">{item.name}</div>
                        <div className="text-[10px] text-neutral-400 uppercase font-black tracking-widest mt-0.5">{Math.round(item.dimensions.width*100)}x{Math.round(item.dimensions.depth*100)}cm</div>
                      </div>
                    </div>
                    <Plus size={16} className="text-neutral-300 group-hover:text-blue-600 transition-colors" />
                  </button>
                );
              })}
            </div>
          </section>
          
          {state.selectedId && (
            <section className="animate-in slide-in-from-bottom-4 p-5 bg-blue-600 rounded-[2rem] shadow-2xl text-white">
              <h3 className="text-[10px] font-black uppercase flex items-center gap-2 mb-4 tracking-widest">Transform Object</h3>
              <div className="flex gap-3">
                <button onClick={rotateItem} className="flex-1 flex flex-col items-center gap-2 p-4 bg-white/15 rounded-2xl hover:bg-white/25 transition-all active:scale-95"><RotateCw size={20} /><span className="text-[9px] font-black uppercase tracking-widest">Rotate</span></button>
                <button onClick={removeItem} className="flex-1 flex flex-col items-center gap-2 p-4 bg-red-500/80 rounded-2xl hover:bg-red-500 transition-all active:scale-95 shadow-lg"><Trash2 size={20} /><span className="text-[9px] font-black uppercase tracking-widest">Delete</span></button>
              </div>
            </section>
          )}
        </div>

        <div className="p-6 border-t border-neutral-100 bg-neutral-50/50">
          <button onClick={() => { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); alert("Spatial layout saved."); }} className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2"><Save size={18}/> Commit Changes</button>
        </div>
      </aside>

      {/* 3D Scene */}
      <main className="flex-1 relative">
        {/* Chat Overlay */}
        <div className={`absolute right-0 top-0 bottom-0 w-full md:w-[28rem] bg-neutral-900/90 backdrop-blur-3xl z-50 border-l border-white/10 flex flex-col transition-all duration-700 ease-in-out ${isChatOpen ? 'translate-x-0 opacity-100 shadow-[-50px_0_100px_rgba(0,0,0,0.5)]' : 'translate-x-full opacity-0 pointer-events-none'}`}>
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-2xl shadow-blue-500/20"><Bot size={24}/></div>
              <div>
                <h3 className="font-bold text-base tracking-tight text-white">Architectural AI</h3>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"/>
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Engine Online</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-3 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                <div className={`max-w-[90%] p-5 rounded-[1.5rem] text-[13px] leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 border border-white/10 text-white/80 rounded-tl-none backdrop-blur-md'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-8 bg-black/40 border-t border-white/5 space-y-6">
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar no-scrollbar">
              {QUICK_ACTIONS.map((action) => (
                <button 
                  key={action} 
                  onClick={() => processAIChat(action)}
                  className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[9px] font-black text-white/50 hover:bg-white/10 hover:text-white transition-all active:scale-95 whitespace-nowrap uppercase tracking-widest"
                >
                  {action}
                </button>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="relative group">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ex: 3 beds, 3 desks, 3 chairs, 3 wardrobes..."
                className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-5 pr-16 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20 shadow-inner group-focus-within:bg-white/10"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isAutoPlanning}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 rounded-2xl hover:bg-blue-500 transition-all disabled:opacity-30 disabled:scale-90 shadow-xl shadow-blue-500/20"
              >
                {isAutoPlanning ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
              </button>
            </form>
          </div>
        </div>

        {/* HUD Controls */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 flex bg-neutral-900/70 backdrop-blur-3xl rounded-3xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in fade-in slide-in-from-top-4 duration-700">
          <button onClick={() => setState(p => ({ ...p, mode: 'edit' }))} className={`px-6 py-3 rounded-2xl flex items-center gap-3 text-xs font-black transition-all ${state.mode === 'edit' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'hover:bg-white/10 text-white/60'}`}><Settings2 size={16} /> DRAFT</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'view' }))} className={`px-6 py-3 rounded-2xl flex items-center gap-3 text-xs font-black transition-all ${state.mode === 'view' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'hover:bg-white/10 text-white/60'}`}><Eye size={16} /> RENDER</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'pov' }))} className={`px-6 py-3 rounded-2xl flex items-center gap-3 text-xs font-black transition-all ${state.mode === 'pov' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'hover:bg-white/10 text-white/60'}`}><Footprints size={16} /> WALK</button>
        </div>

        {state.mode === 'pov' && (
          <>
            {showPOVOverlay && (
              <div onClick={enterPOV} className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-xl flex items-center justify-center cursor-pointer group animate-in zoom-in-95 duration-700">
                <div className="text-center bg-white/5 p-20 rounded-[5rem] border border-white/10 shadow-3xl group-hover:scale-105 transition-all duration-700 hover:bg-white/10">
                  <div className="relative mb-8">
                    <Maximize2 size={96} className="mx-auto text-blue-500 animate-pulse" />
                    <Bot size={32} className="absolute inset-0 m-auto text-white/40" />
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-white">Enter Prototype</h2>
                  <p className="text-white/30 text-[10px] font-black tracking-[0.5em] uppercase">Click to initialize first-person control</p>
                </div>
              </div>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 z-40 pointer-events-none opacity-30">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white" />
              <div className="absolute left-1/2 top-0 w-[2px] h-full bg-white" />
            </div>
            <Joystick onMove={setJoystickVector} />
          </>
        )}

        <div className="absolute top-8 right-8 z-40 flex flex-col space-y-4">
          {!isChatOpen && (
            <button 
              onClick={() => setIsChatOpen(true)} 
              className="p-5 bg-blue-600 text-white rounded-3xl shadow-2xl hover:scale-110 transition-all animate-bounce flex flex-col items-center gap-2 group border border-blue-400/50"
            >
              <Bot size={28}/>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">AI Architect</span>
            </button>
          )}
          {state.mode === 'edit' && (<button onClick={() => setState(p => ({ ...p, showGrid: !p.showGrid }))} className={`p-5 rounded-3xl shadow-2xl transition-all border-2 ${state.showGrid ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white border-neutral-200 text-neutral-400'}`}><Grid3X3 size={28}/></button>)}
          <button onClick={() => setState(p => ({ ...p, is2D: !p.is2D }))} className={`p-5 rounded-3xl shadow-2xl transition-all border-2 ${state.is2D ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white border-neutral-200 text-neutral-400'}`}>{state.is2D ? <Maximize size={28}/> : <Layers size={28}/>}</button>
        </div>

        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
          <AdaptiveDpr pixelated /><AdaptiveEvents />
          {state.mode === 'pov' ? (<><PerspectiveCamera makeDefault position={[0, 1.6, 2.5]} fov={65} /><POVControls joystickVector={joystickVector} /></>) : (<><PerspectiveCamera makeDefault position={state.is2D ? [0, 15, 0] : [10, 10, 10]} fov={state.is2D ? 25 : 45} /><OrbitControls enabled={!isDraggingAny} enableRotate={!state.is2D} maxPolarAngle={Math.PI / 2.1} makeDefault minDistance={2} maxDistance={50} target={[0, 0, 0]} /></>)}
          <ambientLight intensity={state.mode === 'pov' ? 0.3 : 0.8} />
          <directionalLight position={[15, 25, 15]} intensity={1.8} castShadow shadow-mapSize={[4096, 4096]} />
          {(state.mode === 'pov' || state.mode === 'view') && (<group><pointLight position={[0, 2.5, 0]} intensity={5} color="#fffcf0" distance={15} decay={2} castShadow /><pointLight position={[3, 2, -4]} intensity={3} color="#fffcf0" distance={8} decay={2} /><pointLight position={[-3, 2, -4]} intensity={3} color="#fffcf0" distance={8} decay={2} /></group>)}
          
          <Environment resolution={256}>
            <group rotation={[Math.PI / 4, 0, 0]}>
              <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
              <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -4]} scale={[10, 10, 1]} />
              <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, 0]} scale={[10, 10, 1]} />
              <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, 4]} scale={[10, 10, 1]} />
              <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, 9]} scale={[10, 10, 1]} />
              <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[20, 0.5, 1]} />
              <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[20, 0.5, 1]} />
              <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 1, 1]} />
            </group>
          </Environment>

          <RoomStructure theme={theme} showGrid={state.showGrid && state.mode === 'edit'} config={state.room} onDeselect={() => setState(p => ({ ...p, selectedId: null }))} mode={state.mode} />
          {state.placedItems.map((item) => (
            <DraggableFurniture key={item.instanceId} item={item} selected={state.selectedId === item.instanceId} hasCollision={collisions.has(item.instanceId)} mode={state.mode} onSelect={() => setState(p => ({ ...p, selectedId: item.instanceId }))} onDrag={(pos) => handleDrag(item.instanceId, pos)} onDragStart={() => setIsDraggingAny(true)} onDragEnd={() => setIsDraggingAny(false)} />
          ))}
          <ContactShadows resolution={2048} scale={50} blur={2} opacity={0.6} far={20} color="#000" />
        </Canvas>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

const RoomStructure = memo(({ config, showGrid, onDeselect, theme, mode }: { config: RoomConfig, showGrid: boolean, onDeselect: () => void, theme: any, mode: AppMode }) => {
  const { width, depth, height } = config;
  const bathDepth = 1.25, balconyDepth = 1.0, wallThickness = 0.15;
  return (
    <group onPointerMissed={onDeselect}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, depth]} /><meshStandardMaterial color={theme.floor} roughness={0.6} metalness={0.1} /></mesh>
      <mesh position={[0, -0.01, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, bathDepth]} /><meshStandardMaterial color="#d1d5db" roughness={0.3} metalness={0.2} /></mesh>
      <mesh position={[0, -0.01, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, balconyDepth]} /><meshStandardMaterial color="#374151" roughness={0.9} /></mesh>
      {mode !== 'pov' && (
        <group position={[0, 0.05, 0]}>
          <Text position={[-width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#1e293b" fillOpacity={0.5} fontWeight="bold">BATHROOM</Text>
          <Text position={[width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#1e293b" fillOpacity={0.5} fontWeight="bold">TOILET</Text>
          <Text position={[0, 0, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.2} color="#fff" fillOpacity={0.7} fontWeight="bold">BALCONY</Text>
        </group>
      )}
      {showGrid && (<Grid infiniteGrid fadeDistance={40} fadeStrength={5} sectionSize={1} cellSize={GRID_SIZE} sectionColor={theme.accent} cellColor={theme.grid} position={[0, 0.01, 0]} />)}
      <group>
        <mesh position={[- (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow><boxGeometry args={[3.07, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[ (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow><boxGeometry args={[3.07, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[-width/2, height/2, -bathDepth/2]} receiveShadow castShadow><boxGeometry args={[wallThickness, height, depth + bathDepth]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[width/2, height/2, -bathDepth/2]} receiveShadow castShadow><boxGeometry args={[wallThickness, height, depth + bathDepth]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[- (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow><boxGeometry args={[2.9, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[ (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow><boxGeometry args={[2.9, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[- (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow><boxGeometry args={[3.25, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[ (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow><boxGeometry args={[3.25, height, wallThickness]} /><meshStandardMaterial color={theme.wall} roughness={0.8} /></mesh>
        <mesh position={[0, 0.6, -depth/2 - bathDepth - balconyDepth]}><boxGeometry args={[width, 1.2, 0.04]} /><meshPhysicalMaterial color="#94a3b8" transmission={0.9} thickness={0.1} roughness={0.1} transparent opacity={0.4} /></mesh>
      </group>
    </group>
  );
});
