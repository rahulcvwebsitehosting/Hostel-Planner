
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, ContactShadows, Environment, AdaptiveDpr, AdaptiveEvents, Text, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI } from "@google/genai";
import { INITIAL_ROOM, FURNITURE_DATA, GRID_SIZE, THEMES } from './constants.ts';
import { FurnitureType, PlacedItem, AppState, RoomConfig, AppMode } from './types.ts';
import { FurnitureModel } from './components/FurnitureModels.tsx';
// Fix: Added 'Bot' to the lucide-react import list
import { Plus, Trash2, Save, Home, Eye, Footprints, Settings2, Move, Loader2, Maximize2, Send, X, MessageSquare, CheckCircle2, RotateCw, Bot } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'hostel_planner_v32_suggestions_fix';
const Y_EPSILON = 0.002; 
const WALL_THICKNESS = 0.15;
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  suggestion?: PlacedItem[];
}

const FixedFixtures = memo(({ mode }: { mode: AppMode }) => {
  if (mode === 'edit') return null;
  const isPov = mode === 'pov';
  const isRealistic = mode === 'view' || mode === 'pov';
  
  return (
    <group>
      {isPov && (
        <>
          <group position={[-1.8, 0, 0]}><FurnitureModel type="FAN" isRealistic={true} /></group>
          <group position={[1.8, 0, 0]}><FurnitureModel type="FAN" isRealistic={true} /></group>
          <mesh position={[0, 2.8, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[7.3, 4.8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      <group position={[-3.1, 0, -2.4]}><FurnitureModel type="SHOWER" isRealistic={isRealistic} /></group>
      <group position={[3.2, 0, -2.5]} rotation={[0, -Math.PI/2, 0]}><FurnitureModel type="TOILET" isRealistic={isRealistic} /></group>
      <group position={[2.2, 0, -2.5]} rotation={[0, -Math.PI/2, 0]}><FurnitureModel type="WASHBASIN" isRealistic={isRealistic} /></group>
    </group>
  );
});

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
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[FURNITURE_DATA[item.type].dimensions.width + 0.1, FURNITURE_DATA[item.type].dimensions.depth + 0.1]} />
          <meshBasicMaterial color={hasCollision ? "#ef4444" : "#3B82F6"} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
});

const POVControls = ({ joystickVector }: { joystickVector: { x: number, y: number } }) => {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const isPointerDown = useRef(false);
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') moveState.current.forward = true;
      if (e.code === 'KeyS') moveState.current.backward = true;
      if (e.code === 'KeyA') moveState.current.left = true;
      if (e.code === 'KeyD') moveState.current.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') moveState.current.forward = false;
      if (e.code === 'KeyS') moveState.current.backward = false;
      if (e.code === 'KeyA') moveState.current.left = false;
      if (e.code === 'KeyD') moveState.current.right = false;
    };
    
    const onPointerDown = () => { isPointerDown.current = true; };
    const onPointerUp = () => { isPointerDown.current = false; };
    const onMove = (e: PointerEvent) => {
      if (document.pointerLockElement || isPointerDown.current) {
        euler.setFromQuaternion(camera.quaternion);
        const sensitivity = 0.003;
        euler.y -= e.movementX * sensitivity;
        euler.x -= e.movementY * sensitivity;
        euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
        camera.quaternion.setFromEuler(euler);
      }
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    gl.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onMove);
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onMove);
    };
  }, [gl, camera, euler]);

  useFrame((state, delta) => {
    const friction = 12.0;
    const speed = 1.4;
    const d = Math.min(delta, 0.1);
    velocity.current.x -= velocity.current.x * friction * d;
    velocity.current.z -= velocity.current.z * friction * d;
    direction.current.z = Number(moveState.current.forward) - Number(moveState.current.backward) || -joystickVector.y;
    direction.current.x = Number(moveState.current.right) - Number(moveState.current.left) || joystickVector.x;
    direction.current.normalize();
    if (moveState.current.forward || moveState.current.backward || moveState.current.left || moveState.current.right || Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1) {
      velocity.current.z -= direction.current.z * speed * 50.0 * d;
      velocity.current.x -= direction.current.x * speed * 50.0 * d;
    }
    camera.translateX(-velocity.current.x * d);
    camera.translateZ(velocity.current.z * d);
    const walkPhase = state.clock.elapsedTime * 8;
    camera.position.y = 1.65 + Math.sin(walkPhase) * (velocity.current.length() * 0.015);
    camera.position.x = Math.max(-3.4, Math.min(3.4, camera.position.x));
    camera.position.z = Math.max(-4.2, Math.min(1.5, camera.position.z));
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
    <div className="fixed bottom-12 left-12 w-28 h-28 bg-white/10 backdrop-blur-3xl rounded-full border border-white/20 z-[60] flex items-center justify-center touch-none select-none shadow-2xl"
      onPointerMove={handleTouch} onPointerUp={reset} onPointerLeave={reset}>
      <div className="w-14 h-14 bg-blue-600/80 rounded-full shadow-lg flex items-center justify-center pointer-events-none"
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: 'model', text: "Architectural Lead ready. I specialize in high-density hostel planning (Bunk Beds = 2 residents). I'll ensure clear pathways and ergonomic zoning." }]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({ ...prev, ...parsed, mode: 'edit' }));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const getEffectiveDims = useCallback((type: FurnitureType, rotation: number) => {
    const itemData = FURNITURE_DATA[type];
    if (!itemData) return { w: 0, d: 0 };
    const dims = itemData.dimensions;
    const isRotated = Math.round(Math.abs(Math.sin(rotation))) === 1;
    return { w: isRotated ? dims.depth : dims.width, d: isRotated ? dims.width : dims.depth };
  }, []);

  const clampPosition = useCallback((pos: [number, number, number], type: FurnitureType, rotation: number): [number, number, number] => {
    const { w, d } = getEffectiveDims(type, rotation);
    const roomHalfWidth = 3.65;
    const roomFrontZ = 1.765;
    const roomBackZ = -3.015;
    const limitX = roomHalfWidth - (w / 2) - WALL_THICKNESS;
    const limitZFront = roomFrontZ - (d / 2) - WALL_THICKNESS;
    const limitZBack = roomBackZ + (d / 2) + WALL_THICKNESS;
    return [Math.max(-limitX, Math.min(limitX, pos[0])), 0, Math.max(limitZBack, Math.min(limitZFront, pos[2]))];
  }, [getEffectiveDims]);

  const checkCollisions = useCallback((items: PlacedItem[]) => {
    const collidingIds = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const dimA = getEffectiveDims(a.type, a.rotation), dimB = getEffectiveDims(b.type, b.rotation);
        const boxA = new THREE.Box2(new THREE.Vector2(a.position[0] - dimA.w/2, a.position[2] - dimA.d/2), new THREE.Vector2(a.position[0] + dimA.w/2, a.position[2] + dimA.d/2));
        const boxB = new THREE.Box2(new THREE.Vector2(b.position[0] - dimB.w/2, b.position[2] - dimB.d/2), new THREE.Vector2(b.position[0] + dimB.w/2, b.position[2] + dimB.d/2));
        if (boxA.intersectsBox(boxB)) { collidingIds.add(a.instanceId); collidingIds.add(b.instanceId); }
      }
    }
    setCollisions(collidingIds);
  }, [getEffectiveDims]);

  useEffect(() => { checkCollisions(state.placedItems); }, [state.placedItems, checkCollisions]);

  const applyLayoutSuggestion = useCallback((suggestion: PlacedItem[]) => {
    const finalized = suggestion.map(item => ({
      ...item,
      instanceId: generateId(),
      position: clampPosition(item.position, item.type, item.rotation)
    }));
    
    setState(prev => ({ 
      ...prev, 
      placedItems: finalized, 
      selectedId: null,
      mode: 'edit'
    }));

    setChatMessages(prev => [...prev, { 
      role: 'model', 
      text: "Spatial plan synchronized. The room is now zoned for your requested occupancy." 
    }]);
  }, [clampPosition]);

  const processAIChat = async (userMsg: string) => {
    if (isAutoPlanning) return;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAutoPlanning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a professional Interior Architect specializing in Hostel Micro-Apartments.
ROOM CONTEXT:
- Main Floor: 7.3m wide (X: -3.65 to 3.65) x 3.53m deep (Z: -1.765 to 1.765).
- Bathroom Zone: Z < -1.765 (DO NOT PLACE FURNITURE HERE).
FURNITURE DIMENSIONS (W x D):
- BUNKER_BED: 0.85m x 1.93m (Sleeps 2). Height is 1.8m.
- STUDY_TABLE: 0.79m x 0.45m (Wall-mounted).
- BERO: 1.06m x 0.51m (Shared by 2).
- CHAIR: 0.45m x 0.45m.

ARCHITECTURAL PRINCIPLES:
1. CIRCULATION: Maintain a 1.0m wide central pathway (X between -0.5 and 0.5).
2. ZONING: 
   - Side-Wall Alignment: Beds should be against side walls (X near -3.2 or 3.2).
   - Linear Desk Arrangement: Study tables should be aligned against walls or back-to-back.
3. DENSITY (6 PEOPLE EXAMPLE):
   - 3 Bunk Beds required.
   - 3 Beros required (1 per 2 people).
   - 6 Tables & 6 Chairs required.
4. SPATIAL AWARENESS: No item can overlap. Check (Width/2) and (Depth/2) from item centers to ensure they stay within (-3.6, -1.7) to (3.6, 1.7).

OUTPUT FORMAT:
<text>Professional summary of the layout logic (Zoning, Circulation, Privacy).</text>
<json>[{"type": "ID", "position": [x, 0, z], "rotation": radians}, ...]</json>`;
      
      const response = await ai.models.generateContent({ 
        model: "gemini-3-pro-preview", 
        contents: `Request: ${userMsg}. Constraints: ${prompt}`,
        config: { thinkingConfig: { thinkingBudget: 16384 } } 
      });
      
      const rawText = response.text || '';
      const aiText = rawText.match(/<text>([\s\S]*?)<\/text>/)?.[1].trim() || "Spatial proposal ready for review.";
      
      let suggestion: PlacedItem[] | undefined = undefined;
      const jsonMatch = rawText.match(/<json>([\s\S]*?)<\/json>/) || rawText.match(/(\[[\s\S]*?\])/);
      
      if (jsonMatch) {
        try {
          const content = jsonMatch[1] || jsonMatch[0];
          const items = JSON.parse(content.trim());
          if (Array.isArray(items)) {
            suggestion = items.map((item: any) => {
              let pos: [number, number, number] = [0, 0, 0];
              if (Array.isArray(item.position)) {
                pos = [item.position[0] || 0, 0, item.position[2] || 0];
              } else if (item.position && typeof item.position === 'object') {
                pos = [item.position.x || 0, 0, item.position.z || 0];
              }
              
              return { 
                instanceId: generateId(), 
                type: item.type as FurnitureType, 
                position: pos, 
                rotation: item.rotation || 0 
              };
            });
          }
        } catch (err) {
          console.error("Layout parsing failed", err);
        }
      }

      setChatMessages(prev => [...prev, { role: 'model', text: aiText, suggestion }]);
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found.") && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
      console.error(e);
      setChatMessages(prev => [...prev, { role: 'model', text: "I encountered a spatial error. Please try another request." }]);
    } finally { setIsAutoPlanning(false); }
  };

  const handleDrag = useCallback((id: string, pos: [number, number, number]) => {
    setState(prev => ({
      ...prev,
      placedItems: prev.placedItems.map(item =>
        item.instanceId === id ? { ...item, position: clampPosition(pos, item.type, item.rotation) } : item
      )
    }));
  }, [clampPosition]);

  const addItem = (type: FurnitureType) => {
    if (state.mode !== 'edit') return;
    const newItem: PlacedItem = { instanceId: generateId(), type, position: clampPosition([1.5, 0, 0], type, 0), rotation: 0 };
    setState(prev => ({ ...prev, placedItems: [...prev.placedItems, newItem], selectedId: newItem.instanceId }));
  };

  const removeItem = () => setState(prev => ({ ...prev, placedItems: prev.placedItems.filter(i => i.instanceId !== state.selectedId), selectedId: null }));
  const rotateItem = () => setState(prev => ({ ...prev, placedItems: prev.placedItems.map(i => i.instanceId === prev.selectedId ? { ...i, rotation: i.rotation + Math.PI/2, position: clampPosition(i.position, i.type, i.rotation + Math.PI/2) } : i) }));

  const enterPOV = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.requestPointerLock();
    setShowPOVOverlay(false);
  };

  return (
    <div className="flex h-screen bg-neutral-950 flex-col md:flex-row overflow-hidden font-sans select-none text-white">
      {isAutoPlanning && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-500">
          <Loader2 size={48} className="animate-spin text-blue-500 mb-6" />
          <h2 className="text-xl font-bold tracking-widest uppercase text-white/80">Planning Layout</h2>
          <p className="text-white/40 text-xs mt-2">Solving architectural constraints for high-density occupancy...</p>
        </div>
      )}

      <aside className={`w-full md:w-80 bg-white border-r border-neutral-200 flex flex-col z-20 shadow-2xl transition-transform duration-500 ${state.mode !== 'edit' ? '-translate-x-full md:absolute' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-xl shadow-blue-500/20"><Home size={20}/></div>
          <h1 className="text-lg font-bold text-neutral-900 leading-none">StudioPlanner</h1>
        </div>
        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-neutral-800 custom-scrollbar">
          <section className="bg-neutral-900 rounded-2xl p-5 shadow-2xl text-white">
             <button onClick={() => setIsChatOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all text-xs">
               <MessageSquare size={16} /> ARCHITECT CHAT
             </button>
          </section>
          <section>
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 text-center">Manual Inventory</h2>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(FURNITURE_DATA) as FurnitureType[]).map(type => (
                <button key={type} onClick={() => addItem(type)} className="group flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-white hover:border-blue-500 transition-all">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{FURNITURE_DATA[type].icon}</span>
                    <div className="text-left">
                      <div className="font-bold text-xs text-neutral-800">{FURNITURE_DATA[type].name}</div>
                      <div className="text-[8px] text-neutral-400 uppercase">{Math.round(FURNITURE_DATA[type].dimensions.width*100)}x{Math.round(FURNITURE_DATA[type].dimensions.depth*100)}cm</div>
                    </div>
                  </div>
                  <Plus size={14} className="text-neutral-300 group-hover:text-blue-600" />
                </button>
              ))}
            </div>
          </section>
          {state.selectedId && (
            <section className="animate-in slide-in-from-bottom-2 p-4 bg-blue-600 rounded-2xl shadow-xl text-white flex gap-2">
                <button onClick={rotateItem} className="flex-1 flex flex-col items-center gap-1 p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><RotateCw size={18} /><span className="text-[8px] font-black uppercase">Rotate</span></button>
                <button onClick={removeItem} className="flex-1 flex flex-col items-center gap-1 p-2.5 bg-red-500/80 rounded-xl hover:bg-red-500 transition-all"><Trash2 size={18} /><span className="text-[8px] font-black uppercase">Delete</span></button>
            </section>
          )}
        </div>
        <div className="p-6 border-t border-neutral-100">
          <button onClick={() => { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); alert("Spatial Draft Saved."); }} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"><Save size={16}/> COMMIT DRAFT</button>
        </div>
      </aside>

      <main className="flex-1 relative bg-black">
        <div className={`absolute right-0 top-0 bottom-0 w-full md:w-[26rem] bg-neutral-900/98 backdrop-blur-3xl z-50 border-l border-white/10 flex flex-col transition-all duration-500 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-blue-500" />
              <h3 className="font-bold text-white text-sm">Architectural Lead</h3>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] p-4 rounded-2xl text-[12px] shadow-lg leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-white/80'}`}>
                  {msg.text}
                </div>
                {msg.suggestion && msg.suggestion.length > 0 && (
                  <button 
                    onClick={() => applyLayoutSuggestion(msg.suggestion!)}
                    className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-xl active:scale-95 group"
                  >
                    <CheckCircle2 size={14} className="group-hover:scale-110 transition-transform" /> 
                    Apply Architectural Suggestion
                  </button>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-6 bg-black/40 border-t border-white/5">
            <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) { processAIChat(chatInput); setChatInput(''); } }} className="relative">
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="e.g. Plan layout for 6 residents..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs focus:outline-none focus:border-blue-500" 
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors">
                <Send size={16}/>
              </button>
            </form>
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex bg-neutral-900/80 backdrop-blur-3xl rounded-2xl p-1 shadow-2xl border border-white/10">
          <button onClick={() => setState(p => ({ ...p, mode: 'edit' }))} className={`px-6 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black transition-all ${state.mode === 'edit' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Settings2 size={14} /> DRAFT</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'view' }))} className={`px-6 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black transition-all ${state.mode === 'view' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Eye size={14} /> RENDER</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'pov' }))} className={`px-6 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black transition-all ${state.mode === 'pov' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Footprints size={14} /> WALK</button>
        </div>

        {state.mode === 'pov' && (
          <>
            {showPOVOverlay && (
              <div onClick={enterPOV} className="absolute inset-0 z-[70] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center cursor-pointer animate-in zoom-in-95 duration-500">
                <Maximize2 size={80} className="text-blue-500 mb-6 animate-pulse" />
                <h2 className="text-2xl font-black text-white tracking-widest uppercase text-center px-6">Explore Your Space<br/>Drag to Look • WASD to Move</h2>
                <p className="text-white/30 text-[10px] font-black mt-6 tracking-[0.4em]">CLICK TO INITIALIZE</p>
              </div>
            )}
            <Joystick onMove={setJoystickVector} />
          </>
        )}

        <Canvas shadows gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          {state.mode === 'pov' ? (
            <><PerspectiveCamera makeDefault position={[0, 1.65, 2.5]} fov={60} /><POVControls joystickVector={joystickVector} /></>
          ) : (
            <><PerspectiveCamera makeDefault position={state.is2D ? [0, 15, 0] : [10, 10, 10]} fov={state.is2D ? 25 : 45} /><OrbitControls enabled={!isDraggingAny} enableRotate={!state.is2D} maxPolarAngle={Math.PI / 2.1} minDistance={2} maxDistance={40} target={[0, 0, 0]} /></>
          )}
          
          <ambientLight intensity={state.mode === 'edit' ? 0.8 : 0.3} />
          <directionalLight position={[15, 30, 15]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
          
          <Environment resolution={256}>
            <Lightformer intensity={3} rotation-x={Math.PI / 2} position={[0, 5, -5]} scale={[10, 10, 1]} />
            <Lightformer intensity={3} rotation-x={Math.PI / 2} position={[0, 5, 5]} scale={[10, 10, 1]} />
          </Environment>

          <RoomStructure theme={theme} showGrid={state.showGrid && state.mode === 'edit'} config={state.room} onDeselect={() => setState(p => ({ ...p, selectedId: null }))} mode={state.mode} />
          <FixedFixtures mode={state.mode} />
          
          {state.placedItems.map((item) => (
            <DraggableFurniture 
              key={item.instanceId} 
              item={item} 
              selected={state.selectedId === item.instanceId} 
              hasCollision={collisions.has(item.instanceId)} 
              mode={state.mode} 
              onSelect={() => setState(p => ({ ...p, selectedId: item.instanceId }))} 
              onDrag={(pos) => handleDrag(item.instanceId, pos)} 
              onDragStart={() => setIsDraggingAny(true)} 
              onDragEnd={() => setIsDraggingAny(false)} 
            />
          ))}
          
          <ContactShadows resolution={1024} scale={20} blur={2.5} opacity={0.5} far={10} color="#000" />
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
  const bathDepth = 1.25, balconyDepth = 1.0;
  const wallThickness = 0.15;
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.9, metalness: 0.1 }), [theme.wall]);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.8, metalness: 0.05 }), [theme.floor]);

  return (
    <group onPointerMissed={onDeselect}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow material={floorMat}><planeGeometry args={[width, depth]} /></mesh>
      <mesh position={[0, -0.01, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, bathDepth]} /><meshStandardMaterial color="#cbd5e1" roughness={0.4} /></mesh>
      <mesh position={[0, -0.01, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow><planeGeometry args={[width, balconyDepth]} /><meshStandardMaterial color="#334155" roughness={1} /></mesh>
      
      {mode === 'edit' && (
        <group position={[0, 0.05, 0]}>
          <Text position={[-width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.15} color="#1e293b" fillOpacity={0.3}>BATHROOM</Text>
          <Text position={[width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.15} color="#1e293b" fillOpacity={0.3}>TOILET</Text>
        </group>
      )}

      {showGrid && (<Grid infiniteGrid fadeDistance={20} fadeStrength={5} sectionSize={1} cellSize={GRID_SIZE} sectionColor={theme.accent} cellColor={theme.grid} position={[0, 0.01, 0]} />)}
      
      <group>
        <mesh position={[- (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.07, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.07, height, wallThickness]} /></mesh>
        <mesh position={[-width/2, height/2, -bathDepth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[wallThickness, height, depth + bathDepth]} /></mesh>
        <mesh position={[width/2, height/2, -bathDepth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[wallThickness, height, depth + bathDepth]} /></mesh>
        <mesh position={[- (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[2.9, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[2.9, height, wallThickness]} /></mesh>
        <mesh position={[- (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.25, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.25, height, wallThickness]} /></mesh>
        <mesh position={[0, 0.6, -depth/2 - bathDepth - balconyDepth]}><boxGeometry args={[width, 1.2, 0.02]} /><meshStandardMaterial color="#94a3b8" transparent opacity={0.4} /></mesh>
      </group>
    </group>
  );
});
