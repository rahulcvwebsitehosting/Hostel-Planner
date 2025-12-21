
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, ContactShadows, Environment, AdaptiveDpr, AdaptiveEvents, Text } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_ROOM, FURNITURE_DATA, GRID_SIZE, THEMES } from './constants.ts';
import { FurnitureType, PlacedItem, AppState, RoomConfig, AppMode } from './types.ts';
import { FurnitureModel } from './components/FurnitureModels.tsx';
import { Plus, Trash2, Save, Grid3X3, Layers, Maximize, RotateCw, Palette, Home, MousePointer2, AlertTriangle, Eye, Footprints, Settings2, Move, Sparkles, Loader2, Maximize2, Minus, ChevronDown, ChevronUp, LayoutGrid, MessageSquare, Send, X, Bot, Wand2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'hostel_planner_v18_final_polish';
const Y_EPSILON = 0.002; 
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const QUICK_ACTIONS = [
  "Arrange for 2 students",
  "Maximize floor space",
  "Study-focused layout",
  "Symmetric arrangement",
  "Move beds to the corners"
];

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
  
  // Chatbot states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Hello! I'm your AI Interior Architect. I can help you optimize this space for living and studying. What are you looking to achieve today?" }
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
    const roomWidth = 7.30, roomDepth = 3.53, wallClearance = 0.05;
    
    const limitX = (roomWidth / 2) - (w / 2) - wallClearance;
    const limitZ = (roomDepth / 2) - (d / 2) - wallClearance;

    let targetX = Math.max(-limitX, Math.min(limitX, pos[0]));
    let targetZ = Math.max(-limitZ, Math.min(limitZ, pos[2]));
    
    return [targetX, 0, targetZ];
  }, [getEffectiveDims]);

  const processAIChat = async (userMsg: string) => {
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAutoPlanning(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const currentLayoutStr = JSON.stringify(state.placedItems.map(i => ({
        type: i.type,
        position: i.position,
        rotation: i.rotation
      })));

      const furnitureMetadata = JSON.stringify(Object.values(FURNITURE_DATA).map(f => ({
        id: f.id,
        w: f.dimensions.width,
        d: f.dimensions.depth
      })));

      const prompt = `You are a professional Interior Architect.
ROOM: 7.3m Wide x 3.53m Deep.
Z-LIMITS: |Z| < 1.76 (Z < -1.76 is Bathroom).
FURNITURE DIMS: ${furnitureMetadata}

CURRENT STATE: ${currentLayoutStr}
USER REQUEST: "${userMsg}"

TASK:
1. Provide professional design advice in <text> tags.
2. Provide a FULL NEW ARRAY of furniture in <json> tags if a layout change is requested. Use instanceId as generateId() style on your end or simply omit for me to handle.
3. Ensure chairs face tables (0.5m offset).
4. Maintain walking paths.

FORMAT:
<text>Architectural feedback...</text>
<json>[{"type": "FURNITURE_ID", "position": [x, 0, z], "rotation": r}, ...]</json>`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 8192 },
        }
      });
      
      const rawText = response.text || '';
      const textMatch = rawText.match(/<text>([\s\S]*?)<\/text>/);
      const aiText = textMatch ? textMatch[1].trim() : rawText.replace(/<json>[\s\S]*?<\/json>/, '').trim();
      setChatMessages(prev => [...prev, { role: 'model', text: aiText }]);

      const jsonMatch = rawText.match(/<json>([\s\S]*?)<\/json>/);
      if (jsonMatch) {
        try {
          const items = JSON.parse(jsonMatch[1].trim());
          const validTypes = Object.keys(FURNITURE_DATA);
          const placedItems: PlacedItem[] = items
            .filter((item: any) => validTypes.includes(item.type))
            .map((item: any) => ({
              instanceId: generateId(),
              type: item.type as FurnitureType,
              position: clampPosition(item.position, item.type as FurnitureType, item.rotation),
              rotation: item.rotation
            }));
          setState(prev => ({ ...prev, placedItems, selectedId: null }));
        } catch (e) {
          console.error("Layout JSON error:", e);
        }
      }
    } catch (error: any) {
      console.error("AI Architect error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "I've hit a spatial reasoning limit. Could you rephrase or try a simpler request?" }]);
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

  const enterPOV = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) { try { canvas.requestPointerLock(); } catch (e) {} }
    setShowPOVOverlay(false);
  };

  return (
    <div className="flex h-screen bg-neutral-950 flex-col md:flex-row overflow-hidden font-sans select-none text-white">
      {isAutoPlanning && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6">
          <Loader2 size={56} className="animate-spin text-blue-500 mb-8" />
          <h2 className="text-2xl font-bold tracking-widest uppercase mb-2">Calculating Spatial Solutions</h2>
          <p className="text-white/40 text-[10px] uppercase tracking-[0.4em]">Optimizing ergonomics & circulation...</p>
        </div>
      )}

      {/* Main Sidebar */}
      <aside className={`w-full md:w-80 bg-white border-r border-neutral-200 flex flex-col z-20 shadow-2xl transition-transform duration-500 ${state.mode !== 'edit' ? '-translate-x-full md:absolute' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-neutral-100 flex items-center gap-3 bg-neutral-50">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-500/30"><Home size={20}/></div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight leading-none">DormPlanner</h1>
            <p className="text-[10px] text-neutral-500 font-black uppercase mt-1 tracking-widest">Architect Studio</p>
          </div>
        </div>
        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-neutral-800">
          <section className="bg-neutral-900 rounded-2xl p-5 shadow-xl border border-white/5 text-white">
             <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12}/> AI ARCHITECT</h2>
             </div>
             <p className="text-[11px] text-white/40 mb-4 leading-relaxed">Let the architect handle the placement for you.</p>
             <button onClick={() => setIsChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all active:scale-95 text-xs shadow-lg shadow-blue-500/20">
               <MessageSquare size={16} /> START CONSULTING
             </button>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette size={12}/> Environmental Style</h2>
            <div className="flex gap-2">{Object.entries(THEMES).map(([key, t]) => (<button key={key} onClick={() => setTheme(t)} className={`flex-1 h-10 rounded-lg border-2 transition-all ${theme === t ? 'border-blue-500 scale-95 shadow-inner' : 'border-neutral-200'}`} style={{ backgroundColor: t.floor }} />))}</div>
          </section>

          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Components</h2>
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
              <h3 className="text-[10px] font-black uppercase flex items-center gap-2 mb-3">Placement Tools</h3>
              <div className="flex gap-2">
                <button onClick={rotateItem} className="flex-1 flex flex-col items-center p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all"><RotateCw size={18} /><span className="text-[10px] font-black mt-1 uppercase">Rotate</span></button>
                <button onClick={removeItem} className="flex-1 flex flex-col items-center p-3 bg-red-500 rounded-xl hover:bg-red-400 transition-all"><Trash2 size={18} /><span className="text-[10px] font-black mt-1 uppercase">Delete</span></button>
              </div>
            </section>
          )}
        </div>
        <div className="p-6 border-t border-neutral-100 flex flex-col gap-2">
          <button onClick={() => { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); alert("Spatial arrangement saved!"); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-xl transition-all">Save Project</button>
        </div>
      </aside>

      {/* 3D Scene */}
      <main className="flex-1 relative">
        {/* Chat Sidebar Overlay */}
        <div className={`absolute right-0 top-0 bottom-0 w-full md:w-96 bg-neutral-900/95 backdrop-blur-3xl z-50 border-l border-white/10 flex flex-col transition-all duration-500 ease-in-out ${isChatOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-neutral-900/40">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20"><Bot size={22}/></div>
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white">Architectural AI</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"/>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Cognitive Core Active</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={20}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none backdrop-blur-md'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isAutoPlanning && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 backdrop-blur-md">
                   <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-100" />
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-200" />
                   </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 bg-black/40 border-t border-white/10 space-y-4">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button 
                  key={action} 
                  onClick={() => processAIChat(action)}
                  className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                >
                  {action}
                </button>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message your architect..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20 shadow-inner"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isAutoPlanning}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 disabled:scale-95 shadow-lg shadow-blue-500/20"
              >
                {isAutoPlanning ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
              </button>
            </form>
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex bg-neutral-900/60 backdrop-blur-2xl rounded-2xl p-1 shadow-2xl border border-white/10">
          <button onClick={() => setState(p => ({ ...p, mode: 'edit' }))} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black transition-all ${state.mode === 'edit' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/10 text-white'}`}><Settings2 size={14} /> DRAFT</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'view' }))} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black transition-all ${state.mode === 'view' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/10 text-white'}`}><Eye size={14} /> RENDER</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'pov' }))} className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black transition-all ${state.mode === 'pov' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/10 text-white'}`}><Footprints size={14} /> WALK</button>
        </div>

        {state.mode === 'pov' && (
          <>
            {showPOVOverlay && (
              <div onClick={enterPOV} className="absolute inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center cursor-pointer group">
                <div className="text-center bg-white/10 p-16 rounded-[4rem] border border-white/20 shadow-2xl group-hover:scale-105 transition-all duration-500">
                  <Maximize2 size={80} className="mx-auto text-blue-400 mb-6 animate-pulse" />
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">Enter Space</h2>
                  <p className="text-white/40 text-sm font-medium tracking-widest uppercase">Click to Walkthrough</p>
                </div>
              </div>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 z-40 pointer-events-none opacity-40">
              <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-white shadow-sm" />
              <div className="absolute left-1/2 top-0 w-[1.5px] h-full bg-white shadow-sm" />
            </div>
            <Joystick onMove={setJoystickVector} />
          </>
        )}

        <div className="absolute top-6 right-6 z-40 flex flex-col space-y-3">
          {!isChatOpen && (
            <button 
              onClick={() => setIsChatOpen(true)} 
              className="p-4 bg-blue-600 text-white rounded-2xl shadow-2xl hover:scale-110 transition-all animate-bounce flex flex-col items-center gap-1 group"
            >
              <MessageSquare size={24}/>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Chat</span>
            </button>
          )}
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
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
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