
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, ContactShadows, Environment, AdaptiveDpr, AdaptiveEvents, Text, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI } from "@google/genai";
import { INITIAL_ROOM, FURNITURE_DATA, GRID_SIZE, THEMES } from './constants.ts';
import { FurnitureType, PlacedItem, AppState, RoomConfig, AppMode } from './types.ts';
import { FurnitureModel } from './components/FurnitureModels.tsx';
// Fix: Added 'Bot' to the lucide-react import list
import { Plus, Trash2, Save, Home, Eye, Footprints, Settings2, Move, Loader2, Maximize2, Send, X, MessageSquare, CheckCircle2, RotateCw, Bot, Wind } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'hostel_planner_v32_suggestions_fix';
const Y_EPSILON = 0.002; 
const WALL_THICKNESS = 0.15;
const generateId = () => Math.random().toString(36).substring(2, 11);

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
  const animRef = useRef<THREE.Group>(null);

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

  // Initialize with small scale to trigger entrance popping
  useEffect(() => {
    if (animRef.current) {
      animRef.current.scale.set(0.15, 0.15, 0.15);
    }
  }, []);

  useFrame((state, delta) => {
    if (animRef.current) {
      // Smooth scale spring up
      animRef.current.scale.x = THREE.MathUtils.lerp(animRef.current.scale.x, 1, delta * 8.5);
      animRef.current.scale.y = THREE.MathUtils.lerp(animRef.current.scale.y, 1, delta * 8.5);
      animRef.current.scale.z = THREE.MathUtils.lerp(animRef.current.scale.z, 1, delta * 8.5);

      // Selected floating effect
      if (selected && mode === 'edit') {
        const floatY = Math.sin(state.clock.getElapsedTime() * 4.5) * 0.05 + 0.05;
        animRef.current.position.y = THREE.MathUtils.lerp(animRef.current.position.y, floatY, delta * 8);
      } else {
        animRef.current.position.y = THREE.MathUtils.lerp(animRef.current.position.y, 0, delta * 8);
      }
    }
  });

  return (
    <group
      position={[item.position[0], item.position[1] + Y_EPSILON, item.position[2]]}
      rotation={[0, item.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <group ref={animRef}>
        <FurnitureModel type={item.type} selected={selected && mode === 'edit'} hasCollision={hasCollision && mode === 'edit'} isRealistic={mode === 'pov' || mode === 'view'} />
        {selected && mode === 'edit' && (
          <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[FURNITURE_DATA[item.type].dimensions.width + 0.1, FURNITURE_DATA[item.type].dimensions.depth + 0.1]} />
            <meshBasicMaterial color={hasCollision ? "#ef4444" : "#3B82F6"} transparent opacity={0.3} />
          </mesh>
        )}
      </group>
    </group>
  );
});

const POVControls = ({ joystickVector, isFlying }: { joystickVector: { x: number, y: number }, isFlying: boolean }) => {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, up: false, down: false });
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
      if (e.code === 'Space') moveState.current.up = true;
      if (e.code === 'ShiftLeft') moveState.current.down = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') moveState.current.forward = false;
      if (e.code === 'KeyS') moveState.current.backward = false;
      if (e.code === 'KeyA') moveState.current.left = false;
      if (e.code === 'KeyD') moveState.current.right = false;
      if (e.code === 'Space') moveState.current.up = false;
      if (e.code === 'ShiftLeft') moveState.current.down = false;
    };
    
    const lastPos = useRef({ x: 0, y: 0 });

    const onPointerDown = (e: PointerEvent) => { 
      isPointerDown.current = true; 
      lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { isPointerDown.current = false; };
    const onMove = (e: PointerEvent) => {
      if (document.pointerLockElement || isPointerDown.current) {
        const movementX = document.pointerLockElement ? e.movementX : (e.clientX - lastPos.current.x);
        const movementY = document.pointerLockElement ? e.movementY : (e.clientY - lastPos.current.y);
        
        lastPos.current = { x: e.clientX, y: e.clientY };

        euler.setFromQuaternion(camera.quaternion);
        const sensitivity = 0.003;
        euler.y -= movementX * sensitivity;
        euler.x -= movementY * sensitivity;
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
    const friction = isFlying ? 8.0 : 12.0;
    const speed = isFlying ? 2.5 : 1.4;
    const d = Math.min(delta, 0.1);

    velocity.current.x -= velocity.current.x * friction * d;
    velocity.current.y -= velocity.current.y * friction * d;
    velocity.current.z -= velocity.current.z * friction * d;

    direction.current.z = Number(moveState.current.forward) - Number(moveState.current.backward) || -joystickVector.y;
    direction.current.x = Number(moveState.current.right) - Number(moveState.current.left) || joystickVector.x;
    direction.current.y = Number(moveState.current.up) - Number(moveState.current.down);
    
    direction.current.normalize();

    if (moveState.current.forward || moveState.current.backward || moveState.current.left || moveState.current.right || 
        moveState.current.up || moveState.current.down || 
        Math.abs(joystickVector.x) > 0.1 || Math.abs(joystickVector.y) > 0.1) {
      velocity.current.z -= direction.current.z * speed * 50.0 * d;
      velocity.current.x -= direction.current.x * speed * 50.0 * d;
      velocity.current.y += direction.current.y * speed * 50.0 * d;
    }

    const prevX = camera.position.x;
    const prevZ = camera.position.z;

    if (isFlying) {
      // In Fly mode, we move relative to the camera's full rotation
      camera.translateZ(velocity.current.z * d);
      camera.translateX(-velocity.current.x * d);
      // Explicit Y movement (Space/Shift)
      camera.position.y += velocity.current.y * d;
    } else {
      // In Walk mode, we translate but lock Y
      camera.translateX(-velocity.current.x * d);
      camera.translateZ(velocity.current.z * d);
      
      const walkPhase = state.clock.elapsedTime * 8;
      const bobAmount = velocity.current.length() > 0.1 ? Math.sin(walkPhase) * (velocity.current.length() * 0.015) : 0;
      camera.position.y = 1.65 + bobAmount;
    }

    // Wall collision checking:
    // 1. Partition wall is at Z = -1.765. Solid parts are at |X| > 0.70.
    const partitionZ = -1.765;
    const wallMargin = 0.12; // safety margin
    if (Math.abs(camera.position.x) > 0.70) {
      if (prevZ > partitionZ + wallMargin && camera.position.z < partitionZ + wallMargin) {
        camera.position.z = partitionZ + wallMargin;
      } else if (prevZ < partitionZ - wallMargin && camera.position.z > partitionZ - wallMargin) {
        camera.position.z = partitionZ - wallMargin;
      }
    }

    // Sideways collision for partition wall:
    if (Math.abs(camera.position.z - partitionZ) < wallMargin && Math.abs(camera.position.x) > 0.70) {
      if (Math.abs(prevX) <= 0.70) {
        camera.position.x = Math.sign(camera.position.x) * 0.70;
      }
    }

    // Room boundaries clamping
    camera.position.x = Math.max(-3.4, Math.min(3.4, camera.position.x));
    camera.position.z = Math.max(-3.9, Math.min(1.5, camera.position.z));
    camera.position.y = Math.max(0.1, Math.min(2.7, camera.position.y));
  });
  return null;
};

const Joystick = memo(({ onMove }: { onMove: (v: { x: number, y: number }) => void }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const handlePointerDown = (e: any) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const distance = Math.sqrt(dx*dx + dy*dy);
    const maxRadius = 40;
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    setPos({ x: dx, y: dy });
    onMove({ x: dx / maxRadius, y: dy / maxRadius });
  };

  const reset = (e?: any) => {
    isDragging.current = false;
    if (e && e.currentTarget && e.pointerId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  return (
    <div className="fixed bottom-12 left-12 w-28 h-28 bg-white/10 backdrop-blur-3xl rounded-full border border-white/20 z-[60] flex items-center justify-center touch-none select-none shadow-2xl"
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={reset} onPointerCancel={reset}>
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
  const [isFlying, setIsFlying] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: 'model', text: "Architectural Lead ready. I specialize in high-density hostel planning (Bunk Beds = 2 residents). I'll ensure clear pathways and ergonomic zoning." }]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

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
    const roomBackZ = -1.765; // Corrected to restrict equipment/furniture to the Main Room (not going through partition wall)
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
      
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMsg, prompt })
      });
      
      if (!res.ok) {
        throw new Error("Server Error");
      }
      
      const data = await res.json();
      const rawText = data.text || '';
      const aiText = rawText.match(/<text>([\s\S]*?)<\/text>/)?.[1].trim() || "Spatial proposal ready for review.";
      
      let suggestion: PlacedItem[] | undefined = undefined;
      // Match markdown json blocks or raw json blocks
      const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/) || rawText.match(/<json>([\s\S]*?)<\/json>/) || rawText.match(/(\[[\s\S]*?\])/);
      
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
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-600/90 backdrop-blur-xl border border-emerald-500/20 text-white font-bold tracking-wide text-xs px-6 py-3.5 rounded-full shadow-[0_15px_40px_rgba(16,185,129,0.3)] flex items-center gap-2.5 uppercase">
            <CheckCircle2 size={16} className="text-emerald-200 animate-pulse" />
            {toast}
          </div>
        </div>
      )}
      {isAutoPlanning && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-500">
          <Loader2 size={48} className="animate-spin text-blue-500 mb-6" />
          <h2 className="text-xl font-bold tracking-widest uppercase text-white/80">Planning Layout</h2>
          <p className="text-white/40 text-xs mt-2">Solving architectural constraints for high-density occupancy...</p>
        </div>
      )}

      <aside className={`fixed inset-x-0 bottom-0 h-[45vh] md:h-full md:relative md:w-80 bg-white border-t md:border-t-0 md:border-r border-neutral-200 flex flex-col z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl transition-transform duration-500 ${state.mode !== 'edit' ? 'translate-y-full md:translate-y-0 md:-translate-x-full' : 'translate-y-0'}`}>
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
          <button onClick={() => { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); showToast("Spatial Draft Committed"); }} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"><Save size={16}/> COMMIT DRAFT</button>
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

        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex bg-neutral-900/80 backdrop-blur-3xl rounded-2xl p-1 shadow-2xl border border-white/10 w-max max-w-[90vw]">
          <button onClick={() => setState(p => ({ ...p, mode: 'edit' }))} className={`px-3 md:px-6 py-2.5 rounded-xl flex items-center gap-1 md:gap-2 text-[10px] font-black transition-all ${state.mode === 'edit' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Settings2 size={14} /> DRAFT</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'view' }))} className={`px-3 md:px-6 py-2.5 rounded-xl flex items-center gap-1 md:gap-2 text-[10px] font-black transition-all ${state.mode === 'view' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Eye size={14} /> RENDER</button>
          <button onClick={() => setState(p => ({ ...p, mode: 'pov' }))} className={`px-3 md:px-6 py-2.5 rounded-xl flex items-center gap-1 md:gap-2 text-[10px] font-black transition-all ${state.mode === 'pov' ? 'bg-blue-600 text-white' : 'text-white/40'}`}><Footprints size={14} /> WALK</button>
        </div>

        {state.mode === 'pov' && (
          <>
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex bg-neutral-900/80 backdrop-blur-3xl rounded-2xl p-1 shadow-2xl border border-white/10">
              <button 
                onClick={() => setIsFlying(false)} 
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[9px] font-black transition-all ${!isFlying ? 'bg-blue-600 text-white' : 'text-white/40'}`}
              >
                <Footprints size={12} /> WALK
              </button>
              <button 
                onClick={() => setIsFlying(true)} 
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[9px] font-black transition-all ${isFlying ? 'bg-blue-600 text-white' : 'text-white/40'}`}
              >
                <Wind size={12} /> FLY
              </button>
            </div>
            {showPOVOverlay && (
              <div onClick={enterPOV} className="absolute inset-0 z-[70] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center cursor-pointer animate-in zoom-in-95 duration-500">
                <Maximize2 size={80} className="text-blue-500 mb-6 animate-pulse" />
                <h2 className="text-2xl font-black text-white tracking-widest uppercase text-center px-6">Explore Your Space</h2>
                <div className="grid grid-cols-2 gap-8 mt-10">
                  <div className="text-center">
                    <p className="text-blue-500 text-[10px] font-black mb-2 tracking-widest uppercase">Movement</p>
                    <p className="text-white/60 text-xs">WASD • Joystick</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-500 text-[10px] font-black mb-2 tracking-widest uppercase">Look</p>
                    <p className="text-white/60 text-xs">Mouse • Drag</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-500 text-[10px] font-black mb-2 tracking-widest uppercase">Fly Up</p>
                    <p className="text-white/60 text-xs">Space</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-500 text-[10px] font-black mb-2 tracking-widest uppercase">Fly Down</p>
                    <p className="text-white/60 text-xs">Shift</p>
                  </div>
                </div>
                <p className="text-white/30 text-[10px] font-black mt-12 tracking-[0.4em]">CLICK TO INITIALIZE</p>
              </div>
            )}
            <Joystick onMove={setJoystickVector} />
          </>
        )}

        <Canvas gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
          <color attach="background" args={["#000000"]} />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          {state.mode === 'pov' ? (
            <><PerspectiveCamera makeDefault position={[0, 1.65, 2.5]} fov={60} /><POVControls joystickVector={joystickVector} isFlying={isFlying} /></>
          ) : (
            <>
              <PerspectiveCamera 
                makeDefault 
                position={state.is2D ? [0, 15, 0] : [9, 13, 11]} 
                fov={state.is2D ? 25 : 22} 
              />
              <OrbitControls 
                enabled={!isDraggingAny} 
                enableRotate={!state.is2D} 
                minPolarAngle={Math.PI / 4.5}
                maxPolarAngle={Math.PI / 2.15} 
                minDistance={5} 
                maxDistance={35} 
                target={[0, 0.5, -0.8]} 
              />
            </>
          )}
          
          <ambientLight intensity={state.mode === 'edit' ? 2.2 : 2.0} />
          <directionalLight position={[8, 16, 12]} intensity={0.6} />
          
          <Environment resolution={256}>
            <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -5]} scale={[10, 10, 1]} />
            <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, 5]} scale={[10, 10, 1]} />
            <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 2, 0]} scale={[10, 5, 1]} />
            <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[5, 2, 0]} scale={[10, 5, 1]} />
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
        </Canvas>
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const EntranceDoor = memo(({ wallThickness, height, gapWidth, zPosition, isRealistic, mode }: { wallThickness: number, height: number, gapWidth: number, zPosition: number, isRealistic: boolean, mode: AppMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const doorRef = useRef<THREE.Group>(null);
  
  useEffect(() => {
    if (mode === 'pov') {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [mode]);

  useFrame((state, delta) => {
    if (doorRef.current) {
      const targetAngle = isOpen ? -Math.PI / 1.85 : 0;
      doorRef.current.rotation.y = THREE.MathUtils.lerp(doorRef.current.rotation.y, targetAngle, delta * 5.5);
    }
  });

  const woodTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    // Warm rich oak/walnut base matching luxury wood door in the reference
    ctx.fillStyle = '#84563c';
    ctx.fillRect(0, 0, 256, 512);
    ctx.strokeStyle = '#53321e';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 512; i += 8) {
      ctx.beginPath();
      let x = 0;
      ctx.moveTo(x, i);
      while (x <= 256) {
        ctx.lineTo(x, i + Math.sin(x * 0.03) * 6);
        x += 15;
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  const doorMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: woodTexture,
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.3,
  }), [woodTexture]);

  const casingMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: woodTexture,
    roughness: 0.4,
    metalness: 0.02,
    clearcoat: 0.15,
  }), [woodTexture]);

  const handleMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#e2a85c', // Polished warm brass
    metalness: 1.0,
    roughness: 0.1,
    clearcoat: 1.0,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f8fafc',
    transparent: true,
    opacity: 0.5,
    transmission: 0.85,
    roughness: 0.2,
    thickness: 0.02,
  }), []);

  // Compute door leaf dimensions to create a physical glass slit cutout:
  const doorWidth = gapWidth - 0.02;
  const doorHeight = height - 0.05;
  const slitWidth = 0.16;
  const sidePanelWidth = (doorWidth - slitWidth) / 2; // (1.14 - 0.16) / 2 = 0.49
  const slitHeight = doorHeight - 0.7; // leaves 0.3 at bottom and 0.4 at top

  return (
    <group position={[-gapWidth / 2, 0, zPosition]}>
      {/* Wooden Door Frame (Casing) - surrounding the gap */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow material={casingMat}>
        <boxGeometry args={[0.06, height, wallThickness + 0.03]} />
      </mesh>
      <mesh position={[gapWidth, height / 2, 0]} castShadow receiveShadow material={casingMat}>
        <boxGeometry args={[0.06, height, wallThickness + 0.03]} />
      </mesh>
      <mesh position={[gapWidth / 2, height - 0.03, 0]} castShadow receiveShadow material={casingMat}>
        <boxGeometry args={[gapWidth + 0.06, 0.06, wallThickness + 0.03]} />
      </mesh>

      {/* Rotating Door Leaf */}
      <group ref={doorRef} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
        {/* Left Wood Panel */}
        <mesh position={[sidePanelWidth / 2 + 0.01, doorHeight / 2, 0]} castShadow receiveShadow material={doorMat}>
          <boxGeometry args={[sidePanelWidth, doorHeight, 0.04]} />
        </mesh>
        {/* Right Wood Panel */}
        <mesh position={[sidePanelWidth + slitWidth + sidePanelWidth / 2 + 0.01, doorHeight / 2, 0]} castShadow receiveShadow material={doorMat}>
          <boxGeometry args={[sidePanelWidth, doorHeight, 0.04]} />
        </mesh>
        {/* Bottom Rail */}
        <mesh position={[sidePanelWidth + slitWidth / 2 + 0.01, 0.15, 0]} castShadow receiveShadow material={doorMat}>
          <boxGeometry args={[slitWidth, 0.3, 0.04]} />
        </mesh>
        {/* Top Rail */}
        <mesh position={[sidePanelWidth + slitWidth / 2 + 0.01, doorHeight - 0.2, 0]} castShadow receiveShadow material={doorMat}>
          <boxGeometry args={[slitWidth, 0.4, 0.04]} />
        </mesh>
        {/* Central Frosted Glass Slit */}
        <mesh position={[sidePanelWidth + slitWidth / 2 + 0.01, 0.3 + slitHeight / 2, 0]} castShadow material={glassMat}>
          <boxGeometry args={[slitWidth, slitHeight, 0.015]} />
        </mesh>

        {/* Golden Door Handle Assembly (Front & Back) */}
        <group position={[doorWidth - 0.12, doorHeight / 2, 0.03]}>
          <mesh material={handleMat} castShadow>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 12]} />
          </mesh>
          <mesh position={[0, 0, -0.03]} material={handleMat}>
            <cylinderGeometry args={[0.006, 0.006, 0.04, 12]} rotation={[Math.PI / 2, 0, 0]} />
          </mesh>
        </group>
        <group position={[doorWidth - 0.12, doorHeight / 2, -0.03]}>
          <mesh material={handleMat} castShadow>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 12]} />
          </mesh>
          <mesh position={[0, 0, 0.03]} material={handleMat}>
            <cylinderGeometry args={[0.006, 0.006, 0.04, 12]} rotation={[Math.PI / 2, 0, 0]} />
          </mesh>
        </group>
      </group>
    </group>
  );
});

const SlidingGlassDoor = memo(({ height, gapWidth, zPosition, isRealistic }: { height: number, gapWidth: number, zPosition: number, isRealistic: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const slideRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (slideRef.current) {
      // Slides left by half of the gap width (overlapping the left fixed panel)
      const targetX = isOpen ? -gapWidth / 2 : 0;
      slideRef.current.position.x = THREE.MathUtils.lerp(slideRef.current.position.x, targetX, delta * 4.5);
    }
  });

  const frameMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#18181b', // Sleek black metal frame
    roughness: 0.2,
    metalness: 0.85,
    clearcoat: 0.2,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#e2e8f0',
    transparent: true,
    opacity: 0.3,
    transmission: 0.9,
    roughness: 0.1,
    thickness: 0.02,
  }), []);

  const trackMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#27272a',
    roughness: 0.3,
    metalness: 0.9,
  }), []);

  const paneWidth = gapWidth / 2;

  return (
    <group position={[-gapWidth / 2, 0, zPosition]} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
      {/* Top Runner Track */}
      <mesh position={[gapWidth / 2, height - 0.025, 0]} material={trackMat} castShadow>
        <boxGeometry args={[gapWidth + 0.04, 0.05, 0.06]} />
      </mesh>
      {/* Bottom Floor Guide Track */}
      <mesh position={[gapWidth / 2, 0.005, 0]} material={trackMat}>
        <boxGeometry args={[gapWidth + 0.04, 0.01, 0.06]} />
      </mesh>

      {/* 1. FIXED GLASS PANEL (Left side of the opening) */}
      <group position={[paneWidth / 2, height / 2, -0.01]}>
        {/* Glass Sheet */}
        <mesh material={glassMat}>
          <boxGeometry args={[paneWidth - 0.05, height - 0.1, 0.01]} />
        </mesh>
        {/* Top/Bottom/Left/Right Frame Borders */}
        <mesh position={[0, (height - 0.05) / 2 - 0.015, 0]} material={frameMat}>
          <boxGeometry args={[paneWidth, 0.03, 0.02]} />
        </mesh>
        <mesh position={[0, -((height - 0.05) / 2 - 0.015), 0]} material={frameMat}>
          <boxGeometry args={[paneWidth, 0.03, 0.02]} />
        </mesh>
        <mesh position={[-(paneWidth / 2 - 0.015), 0, 0]} material={frameMat}>
          <boxGeometry args={[0.03, height - 0.05, 0.02]} />
        </mesh>
        <mesh position={[paneWidth / 2 - 0.015, 0, 0]} material={frameMat}>
          <boxGeometry args={[0.03, height - 0.05, 0.02]} />
        </mesh>
      </group>

      {/* 2. SLIDING GLASS PANEL (Right side of opening, sliding left) */}
      <group ref={slideRef} position={[paneWidth + paneWidth / 2, height / 2, 0.01]}>
        {/* Glass Sheet */}
        <mesh material={glassMat} castShadow>
          <boxGeometry args={[paneWidth - 0.05, height - 0.1, 0.01]} />
        </mesh>
        {/* Frame borders */}
        <mesh position={[0, (height - 0.05) / 2 - 0.015, 0]} material={frameMat} castShadow>
          <boxGeometry args={[paneWidth, 0.03, 0.02]} />
        </mesh>
        <mesh position={[0, -((height - 0.05) / 2 - 0.015), 0]} material={frameMat} castShadow>
          <boxGeometry args={[paneWidth, 0.03, 0.02]} />
        </mesh>
        <mesh position={[-(paneWidth / 2 - 0.015), 0, 0]} material={frameMat} castShadow>
          <boxGeometry args={[0.03, height - 0.05, 0.02]} />
        </mesh>
        <mesh position={[paneWidth / 2 - 0.015, 0, 0]} material={frameMat} castShadow>
          <boxGeometry args={[0.03, height - 0.05, 0.02]} />
        </mesh>

        {/* Handle on the sliding panel */}
        <mesh position={[-(paneWidth / 2 - 0.08), 0, 0.015]} material={frameMat} castShadow>
          <boxGeometry args={[0.02, 0.3, 0.015]} />
        </mesh>
        <mesh position={[-(paneWidth / 2 - 0.08), 0, -0.015]} material={frameMat} castShadow>
          <boxGeometry args={[0.02, 0.3, 0.015]} />
        </mesh>
      </group>
    </group>
  );
});

const RoomStructure = memo(({ config, showGrid, onDeselect, theme, mode }: { config: RoomConfig, showGrid: boolean, onDeselect: () => void, theme: any, mode: AppMode }) => {
  const { width, depth, height } = config;
  const bathDepth = 1.25, balconyDepth = 1.0;
  const wallThickness = 0.15;
  
  // Custom high fidelity textures for floors and walls
  const wallTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#cbd5e1';
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 4000; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.2, 1.2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  const floorPlankTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    
    // Extremely light desaturated cream/ash-wood base color matching the reference photo
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, 1024, 1024);
    
    // Board Joint lines - extremely soft desaturated beige
    ctx.strokeStyle = '#dfd5c8';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    const plankHeight = 128;
    for (let y = 0; y <= 1024; y += plankHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    
    for (let i = 0; i < 8; i++) {
      const y = i * plankHeight;
      ctx.beginPath();
      const offset = (i % 2) * 256;
      for (let x = offset; x <= 1024; x += 512) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plankHeight);
      }
      ctx.stroke();
    }
    
    // Soft subtle wood grain layers
    ctx.strokeStyle = '#e8dfd3';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (let r = 0; r < 8; r++) {
      const startY = r * plankHeight;
      for (let l = 0; l < 10; l++) {
        ctx.beginPath();
        let x = 0;
        const yShift = startY + Math.random() * plankHeight;
        ctx.moveTo(x, yShift);
        while (x <= 1024) {
          const y = yShift + Math.sin(x * 0.015) * 3 + Math.cos(x * 0.005) * 8;
          if (y >= startY && y <= startY + plankHeight) {
            ctx.lineTo(x, y);
          }
          x += 35;
        }
        ctx.stroke();
      }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);

  const tileTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Light, pristine, architectural off-white tiles
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 512);
    
    // Extremely subtle organic noise
    ctx.fillStyle = '#e2e8f0';
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 150; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }
    
    // Precise, delicate grout lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(512, x); ctx.stroke();
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
    return tex;
  }, []);

  // High fidelity PBR materials with zero-shine matte finishes
  const wallMat = useMemo(() => new THREE.MeshPhysicalMaterial({ 
    color: '#ffffff', // Pure solid white walls matching the CAD presentation look
    roughness: 1.0, 
    metalness: 0.0,
    clearcoat: 0.0,
  }), []);

  const floorMat = useMemo(() => new THREE.MeshPhysicalMaterial({ 
    color: '#ffffff', 
    map: floorPlankTexture,
    roughness: 0.95, // High roughness for a completely matte floor as requested
    metalness: 0.0,
    clearcoat: 0.0,
  }), [floorPlankTexture]);

  const tileMat = useMemo(() => new THREE.MeshPhysicalMaterial({ 
    color: '#ffffff', 
    map: tileTexture,
    roughness: 0.9, // Matte tiles
    metalness: 0.0,
    clearcoat: 0.0,
  }), [tileTexture]);

  return (
    <group onPointerMissed={onDeselect}>
      {/* Main Floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      
      {/* Bathroom Floor */}
      <mesh position={[0, -0.01, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow material={tileMat}>
        <planeGeometry args={[width, bathDepth]} />
      </mesh>
      
      {mode === 'edit' && (
        <group position={[0, 0.05, 0]}>
          <Text position={[-width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.15} color="#1e293b" fillOpacity={0.3}>BATHROOM</Text>
          <Text position={[width/4, 0, -depth/2 - bathDepth/2]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.15} color="#1e293b" fillOpacity={0.3}>TOILET</Text>
        </group>
      )}

      {showGrid && (<Grid infiniteGrid fadeDistance={20} fadeStrength={5} sectionSize={1} cellSize={GRID_SIZE} sectionColor={theme.accent} cellColor={theme.grid} position={[0, 0.01, 0]} />)}
      
      <group>
        {/* Front Wall */}
        <mesh position={[- (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.07, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 3.07/2), height/2, depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.07, height, wallThickness]} /></mesh>
        
        {/* Entrance Door */}
        <EntranceDoor 
          wallThickness={wallThickness} 
          height={height} 
          gapWidth={1.16} 
          zPosition={depth/2} 
          isRealistic={mode === 'view' || mode === 'pov'} 
          mode={mode} 
        />

        {/* Side Walls */}
        <mesh position={[-width/2, height/2, -bathDepth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[wallThickness, height, depth + bathDepth]} /></mesh>
        <mesh position={[width/2, height/2, -bathDepth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[wallThickness, height, depth + bathDepth]} /></mesh>
        
        {/* Partition Wall */}
        <mesh position={[- (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[2.9, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 2.9/2), height/2, -depth/2]} receiveShadow castShadow material={wallMat}><boxGeometry args={[2.9, height, wallThickness]} /></mesh>
        
        {/* Sleek architectural HVAC Ventilation Grille near top left of the partition wall */}
        <group position={[-1.8, height - 0.25, -depth / 2 + wallThickness / 2 + 0.01]}>
          {/* Black recessed backplate */}
          <mesh castShadow>
            <boxGeometry args={[0.8, 0.12, 0.005]} />
            <meshBasicMaterial color="#09090b" />
          </mesh>
          {/* Outer frame */}
          <mesh position={[0, 0, 0.003]} castShadow>
            <boxGeometry args={[0.84, 0.16, 0.004]} />
            <meshPhysicalMaterial color="#e2e8f0" roughness={0.3} />
          </mesh>
          {/* Vanes / Grille lines */}
          {[-0.04, -0.02, 0, 0.02, 0.04].map((y, idx) => (
            <mesh key={idx} position={[0, y, 0.0045]}>
              <boxGeometry args={[0.76, 0.006, 0.002]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
          ))}
        </group>

        {/* Back Wall (Balcony entrance) */}
        <mesh position={[- (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.25, height, wallThickness]} /></mesh>
        <mesh position={[ (width/2 - 3.25/2), height/2, -depth/2 - bathDepth]} receiveShadow castShadow material={wallMat}><boxGeometry args={[3.25, height, wallThickness]} /></mesh>

        {/* Balcony Floor */}
        <mesh position={[0, -0.01, -depth/2 - bathDepth - balconyDepth/2]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
          <planeGeometry args={[width, balconyDepth]} />
          <meshStandardMaterial color="#475569" roughness={1.0} />
        </mesh>
        
        {/* Railing */}
        <mesh position={[0, 0.6, -depth/2 - bathDepth - balconyDepth]} receiveShadow castShadow>
          <boxGeometry args={[width, 1.2, 0.02]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.4} />
        </mesh>
      </group>
    </group>
  );
});
