import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FurnitureType } from '../types.ts';
import { FURNITURE_DATA, FIXTURE_DATA } from '../constants.ts';

// Dynamic procedural texture manager for high realism
class TextureManager {
  private static textures: Record<string, THREE.Texture> = {};

  static getWoodTexture(): THREE.Texture {
    if (!this.textures.wood) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Elegant natural honey-oak base tone for high-end designer furniture
      ctx.fillStyle = '#ccaa85';
      ctx.fillRect(0, 0, 512, 512);
      
      // Gentle background tone bands for authentic wood species variation
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = '#bf9d78';
        ctx.globalAlpha = 0.2;
        ctx.fillRect(0, i * 51.2, 512, 25 + Math.random() * 20);
      }
      
      // Layer 1: Long flowing organic wood grain waves
      ctx.strokeStyle = '#85623e';
      ctx.lineWidth = 1.25;
      ctx.globalAlpha = 0.35;
      for (let i = -60; i < 572; i += 12) {
        ctx.beginPath();
        let x = 0;
        ctx.moveTo(x, i);
        while (x <= 512) {
          const y = i + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.005) * 20 + (Math.sin(i * 0.08) * 6);
          ctx.lineTo(x, y);
          x += 16;
        }
        ctx.stroke();
      }
      
      // Layer 2: Micro-hairline secondary grain fibers for extreme wood detail
      ctx.strokeStyle = '#684a2d';
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.2;
      for (let i = -20; i < 532; i += 6) {
        ctx.beginPath();
        let x = 0;
        ctx.moveTo(x, i);
        while (x <= 512) {
          const y = i + Math.sin(x * 0.02) * 5 + Math.cos(x * 0.003) * 14;
          ctx.lineTo(x, y);
          x += 24;
        }
        ctx.stroke();
      }
      
      // Layer 3: Natural concentric oak knots for an authentic organic wood appearance
      const knots = [[140, 110], [390, 250], [210, 430]];
      ctx.strokeStyle = '#5c3f25';
      ctx.lineWidth = 1.0;
      for (const [kx, ky] of knots) {
        ctx.globalAlpha = 0.25;
        // Outer rings warped organically around the knot
        for (let r = 8; r < 60; r += 10) {
          ctx.beginPath();
          ctx.ellipse(kx, ky, r, r * 0.48, Math.PI / 15, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Darkened core center of the knot
        ctx.fillStyle = '#452b14';
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 6, 3, Math.PI / 15, 0, Math.PI * 2);
        ctx.fill();
      }
      
      const tex = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in tex) {
        (tex as any).colorSpace = THREE.SRGBColorSpace;
      } else {
        (tex as any).encoding = 3001; // THREE.sRGBEncoding
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      this.textures.wood = tex;
    }
    return this.textures.wood;
  }

  static getFabricTexture(color: string = '#f8fafc'): THREE.Texture {
    const key = `fabric_${color}`;
    if (!this.textures[key]) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Solid base tone
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      
      // Design highlight/shadow weave overlay parameters
      const shadowColor = '#000000';
      const highlightColor = '#ffffff';
      ctx.lineWidth = 0.8;
      
      // Horizontal weft threads
      for (let y = 0; y < 256; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.strokeStyle = shadowColor;
        ctx.globalAlpha = 0.08;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, y + 2);
        ctx.lineTo(256, y + 2);
        ctx.strokeStyle = highlightColor;
        ctx.globalAlpha = 0.05;
        ctx.stroke();
      }
      
      // Vertical warp threads
      for (let x = 0; x < 256; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.strokeStyle = shadowColor;
        ctx.globalAlpha = 0.08;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + 2, 0);
        ctx.lineTo(x + 2, 256);
        ctx.strokeStyle = highlightColor;
        ctx.globalAlpha = 0.05;
        ctx.stroke();
      }
      
      // Soft organic irregular linen slubs (thickening threads for natural fabric look)
      ctx.strokeStyle = highlightColor;
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 20; i++) {
        const y = Math.random() * 256;
        const xStart = Math.random() * 120;
        const length = 45 + Math.random() * 90;
        ctx.lineWidth = 1.3 + Math.random() * 0.7;
        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xStart + length, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
      
      ctx.strokeStyle = shadowColor;
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * 256;
        const yStart = Math.random() * 120;
        const length = 45 + Math.random() * 90;
        ctx.lineWidth = 1.3 + Math.random() * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, yStart);
        ctx.lineTo(x + (Math.random() - 0.5) * 2, yStart + length);
        ctx.stroke();
      }
      
      const tex = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in tex) {
        (tex as any).colorSpace = THREE.SRGBColorSpace;
      } else {
        (tex as any).encoding = 3001; // THREE.sRGBEncoding
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      this.textures[key] = tex;
    }
    return this.textures[key];
  }

  static getSteelTexture(): THREE.Texture {
    if (!this.textures.steel) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Soft brushed titanium / stainless steel slate metal base
      ctx.fillStyle = '#8e9aa8';
      ctx.fillRect(0, 0, 256, 256);
      
      // Layer 1: Fine industrial micro-brushed vertical scratches
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 350; i++) {
        const x = Math.random() * 256;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
      
      // Layer 2: Subtle horizontal carbon burnishing
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 150; i++) {
        const y = Math.random() * 256;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      
      // Layer 3: Noise speckles to simulate real surface imperfections
      ctx.fillStyle = '#f1f5f9';
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 5000; i++) {
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.0, 1.0);
      }
      
      const tex = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in tex) {
        (tex as any).colorSpace = THREE.SRGBColorSpace;
      } else {
        (tex as any).encoding = 3001; // THREE.sRGBEncoding
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      this.textures.steel = tex;
    }
    return this.textures.steel;
  }
}

interface ModelProps {
  type: FurnitureType | 'FAN' | 'TOILET' | 'WASHBASIN' | 'SHOWER';
  selected?: boolean;
  hasCollision?: boolean;
  isRealistic?: boolean;
}

// 1. Interactive Spinning Fan Model
const FanModel: React.FC<{ isRealistic: boolean; chromeMat: THREE.Material; baseMat: THREE.Material }> = ({ isRealistic, chromeMat, baseMat }) => {
  const fanRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (fanRef.current) {
      // Rotate fan blades rapidly and smoothly
      fanRef.current.rotation.y += delta * 14;
    }
  });

  return (
    <group position={[0, 2.7, 0]}>
      {/* Downrod */}
      <mesh material={chromeMat} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 16]} />
      </mesh>
      {/* Motor Housing */}
      <mesh position={[0, -0.2, 0]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.12, 24]} />
      </mesh>
      {/* Rotating Blades Assembly */}
      <group ref={fanRef} position={[0, -0.26, 0]}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rot, i) => (
          <group key={i} rotation={[0, rot, 0]}>
            {/* Blade arm */}
            <mesh position={[0.1, 0, 0]} material={chromeMat}>
              <boxGeometry args={[0.1, 0.01, 0.03]} />
            </mesh>
            {/* Angled aerodynamic blade */}
            <mesh position={[0.5, -0.005, 0]} rotation={[0.06, 0, 0]} material={isRealistic ? chromeMat : baseMat} castShadow>
              <boxGeometry args={[0.7, 0.008, 0.13]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// 2. Interactive Shower Model with Tap-activated Water particle system
const ShowerModel: React.FC<{ isRealistic: boolean; ceramicMat: THREE.Material; glassMat: THREE.Material; chromeMat: THREE.Material }> = ({ isRealistic, ceramicMat, glassMat, chromeMat }) => {
  const [waterActive, setWaterActive] = useState(false);
  const particleGroupRef = useRef<THREE.Group>(null);
  const particleCount = 40;

  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < particleCount; i++) {
      arr.push({
        y: Math.random() * 1.8,
        speed: 1.8 + Math.random() * 1.5,
        offset: Math.random() * 0.16,
        angle: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (waterActive && particleGroupRef.current) {
      const children = particleGroupRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const mesh = children[i] as THREE.Mesh;
        const pData = particles[i];
        mesh.position.y -= delta * pData.speed;
        if (mesh.position.y < 0.08) {
          mesh.position.y = 1.8;
          mesh.position.x = Math.cos(pData.angle) * pData.offset;
          mesh.position.z = Math.sin(pData.angle) * pData.offset;
        }
      }
    }
  });

  return (
    <group onPointerDown={(e) => { e.stopPropagation(); setWaterActive(!waterActive); }}>
      {/* Tray */}
      <mesh position={[0, 0.05, 0]} material={ceramicMat} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.1, 0.9]} />
      </mesh>
      {/* Glass Enclosure Panels */}
      <mesh position={[-0.44, 1, 0]} material={glassMat} castShadow>
        <boxGeometry args={[0.02, 1.9, 0.9]} />
      </mesh>
      <mesh position={[0.44, 1, 0]} material={glassMat} castShadow>
        <boxGeometry args={[0.02, 1.9, 0.9]} />
      </mesh>
      <mesh position={[0, 1, -0.44]} material={glassMat} castShadow>
        <boxGeometry args={[0.9, 1.9, 0.02]} />
      </mesh>
      {/* Polished borders */}
      <mesh position={[-0.44, 1.95, 0]} material={chromeMat}>
        <boxGeometry args={[0.03, 0.03, 0.9]} />
      </mesh>
      <mesh position={[0.44, 1.95, 0]} material={chromeMat}>
        <boxGeometry args={[0.03, 0.03, 0.9]} />
      </mesh>
      <mesh position={[0, 1.95, -0.44]} material={chromeMat}>
        <boxGeometry args={[0.91, 0.03, 0.03]} />
      </mesh>
      {/* Shower head setup */}
      <mesh position={[0, 1.5, -0.38]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 12]} />
      </mesh>
      <mesh position={[0, 1.88, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 12]} />
      </mesh>
      <mesh position={[0, 1.85, -0.1]} rotation={[Math.PI / 6, 0, 0]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.04, 24]} />
      </mesh>
      {/* Interactive Valve Tap */}
      <mesh position={[0, 1.1, -0.38]} material={chromeMat} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 0.12]} />
      </mesh>
      {isRealistic && (
        <mesh position={[0, 1.18, -0.36]}>
          <sphereGeometry args={[0.012, 10, 10]} />
          <meshBasicMaterial color={waterActive ? "#34d399" : "#ef4444"} />
        </mesh>
      )}
      {/* Falling Water droplets */}
      <group ref={particleGroupRef} visible={waterActive}>
        {particles.map((p, i) => (
          <mesh key={i} position={[0, 0, 0]}>
            <sphereGeometry args={[0.007, 6, 6]} />
            <meshPhysicalMaterial color="#38bdf8" roughness={0.1} transmission={0.9} thickness={0.1} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// 3. Interactive Toilet Model with Swirling Flush animation and Lever Rotation
const ToiletModel: React.FC<{ ceramicMat: THREE.Material; chromeMat: THREE.Material }> = ({ ceramicMat, chromeMat }) => {
  const [flushing, setFlushing] = useState(false);
  const handleRef = useRef<THREE.Mesh>(null);
  const waterSwirlRef = useRef<THREE.Mesh>(null);

  const handleFlush = (e: any) => {
    e.stopPropagation();
    if (flushing) return;
    setFlushing(true);
    setTimeout(() => setFlushing(false), 2500);
  };

  useFrame((state, delta) => {
    if (handleRef.current) {
      const targetZ = flushing ? -Math.PI / 4.5 : 0;
      handleRef.current.rotation.z = THREE.MathUtils.lerp(handleRef.current.rotation.z, targetZ, delta * 9);
    }
    if (waterSwirlRef.current) {
      if (flushing) {
        waterSwirlRef.current.visible = true;
        waterSwirlRef.current.rotation.z += delta * 14;
        const wave = 0.82 + Math.sin(state.clock.getElapsedTime() * 22) * 0.14;
        waterSwirlRef.current.scale.set(wave, wave, 1);
      } else {
        waterSwirlRef.current.visible = false;
      }
    }
  });

  return (
    <group onClick={handleFlush}>
      {/* Cistern/Tank */}
      <mesh position={[0, 0.55, -0.2]} castShadow material={ceramicMat}>
        <boxGeometry args={[0.4, 0.4, 0.24]} />
      </mesh>
      {/* Bowl */}
      <mesh position={[0, 0.2, 0.1]} castShadow material={ceramicMat}>
        <cylinderGeometry args={[0.22, 0.18, 0.45, 24]} />
      </mesh>
      {/* Seat Cover Rim */}
      <mesh position={[0, 0.43, 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={ceramicMat}>
        <ringGeometry args={[0.12, 0.22, 24]} />
      </mesh>
      {/* Flush Handle Lever */}
      <mesh ref={handleRef} position={[0.15, 0.65, -0.06]} material={chromeMat} castShadow>
        <boxGeometry args={[0.06, 0.014, 0.014]} />
      </mesh>
      {/* Standing Water */}
      <mesh position={[0, 0.38, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.13, 24]} />
        <meshPhysicalMaterial color="#38bdf8" roughness={0.05} transmission={0.9} thickness={0.1} />
      </mesh>
      {/* Flush Swirling water overlay */}
      <mesh ref={waterSwirlRef} position={[0, 0.381, 0.1]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.02, 0.12, 24]} />
        <meshPhysicalMaterial color="#0ea5e9" roughness={0.1} transmission={0.9} thickness={0.08} transparent opacity={0.7} />
      </mesh>
    </group>
  );
};

// 4. Interactive Washbasin Model with faucet-activated streaming water
const WashbasinModel: React.FC<{ isRealistic: boolean; ceramicMat: THREE.Material; chromeMat: THREE.Material }> = ({ isRealistic, ceramicMat, chromeMat }) => {
  const [running, setRunning] = useState(false);
  const streamRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (streamRef.current) {
      if (running) {
        streamRef.current.visible = true;
        const scale = 1.0 + Math.sin(state.clock.getElapsedTime() * 32) * 0.12;
        streamRef.current.scale.set(scale, 1, scale);
      } else {
        streamRef.current.visible = false;
      }
    }
  });

  const cabinetWoodMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#84563c', // Warm oak to match the wood door and vanity in reference image
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.3,
  }), []);

  return (
    <group onClick={(e) => { e.stopPropagation(); setRunning(!running); }}>
      {/* Basin Rim */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow material={ceramicMat}>
        <boxGeometry args={[0.5, 0.18, 0.4]} />
      </mesh>
      {/* Inner basin depression */}
      <mesh position={[0, 0.82, 0]} material={new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.1 })}>
        <boxGeometry args={[0.42, 0.15, 0.32]} />
      </mesh>
      
      {/* Wooden Storage Cabinet (Vanity) under the basin matching reference photo */}
      <group position={[0, 0.36, 0]}>
        <mesh castShadow material={cabinetWoodMat}>
          <boxGeometry args={[0.48, 0.52, 0.38]} />
        </mesh>
        {/* Horizontal drawer slit line */}
        <mesh position={[0, 0.08, 0.192]}>
          <boxGeometry args={[0.46, 0.005, 0.004]} />
          <meshBasicMaterial color="#2d1d14" />
        </mesh>
        {/* Sleek metallic handle */}
        <mesh position={[0, 0.11, 0.196]} material={chromeMat}>
          <boxGeometry args={[0.2, 0.015, 0.015]} />
        </mesh>
      </group>

      {/* Faucet mixer body */}
      <mesh position={[0, 0.9, -0.15]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.013, 0.013, 0.12, 8]} />
      </mesh>
      {/* Faucet spout */}
      <mesh position={[0, 0.95, -0.11]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.013, 0.013, 0.06, 8]} />
      </mesh>
      {/* Lever control */}
      <mesh position={[0, 0.96, -0.16]} rotation={[0.3, 0, 0]} material={chromeMat}>
        <boxGeometry args={[0.01, 0.04, 0.01]} />
      </mesh>
      {isRealistic && (
        <mesh position={[0, 0.98, -0.16]}>
          <sphereGeometry args={[0.007, 8, 8]} />
          <meshBasicMaterial color={running ? "#34d399" : "#ef4444"} />
        </mesh>
      )}
      {/* Water stream running down to basin */}
      <mesh ref={streamRef} position={[0, 0.84, -0.09]} visible={false}>
        <cylinderGeometry args={[0.008, 0.01, 0.15, 8]} />
        <meshPhysicalMaterial color="#38bdf8" roughness={0.1} transmission={0.9} thickness={0.05} opacity={0.7} transparent />
      </mesh>
    </group>
  );
};

// 5. High-fidelity Swivel Swivel Chair Model
const SwivelChairModel: React.FC<{ width: number; depth: number; seatMat: THREE.Material; baseMat: THREE.Material; chromeMat: THREE.Material }> = ({ width, depth, seatMat, baseMat, chromeMat }) => {
  return (
    <group>
      {/* Seat Upholstery with Fabric weave */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={seatMat}>
        <boxGeometry args={[width, 0.06, depth]} />
      </mesh>
      {/* Backrest */}
      <group position={[0, 0.7, -depth / 2 + 0.02]}>
        <mesh position={[0, 0, 0]} castShadow material={seatMat}>
          <boxGeometry args={[width * 0.95, 0.5, 0.04]} />
        </mesh>
        <mesh position={[0, -0.22, -0.04]} rotation={[0.2, 0, 0]} material={baseMat}>
          <boxGeometry args={[0.05, 0.12, 0.03]} />
        </mesh>
      </group>
      {/* Armrests */}
      <group position={[-width/2 - 0.015, 0.58, 0]}>
        <mesh position={[0, 0, 0]} material={baseMat} castShadow>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
        </mesh>
        <mesh position={[0.04, 0.08, 0.05]} material={baseMat} castShadow>
          <boxGeometry args={[0.1, 0.02, 0.22]} />
        </mesh>
      </group>
      <group position={[width/2 + 0.015, 0.58, 0]}>
        <mesh position={[0, 0, 0]} material={baseMat} castShadow>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
        </mesh>
        <mesh position={[-0.04, 0.08, 0.05]} material={baseMat} castShadow>
          <boxGeometry args={[0.1, 0.02, 0.22]} />
        </mesh>
      </group>
      {/* Base Stem Cylinder */}
      <mesh position={[0, 0.26, 0]} material={chromeMat} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.32, 12]} />
      </mesh>
      {/* Five-Star Support legs and wheel casters */}
      <group position={[0, 0.1, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const rotAngle = (i * Math.PI * 2) / 5;
          return (
            <group key={i} rotation={[0, rotAngle, 0]}>
              <mesh position={[0.12, 0.01, 0]} rotation={[0, 0, -0.1]} material={chromeMat} castShadow>
                <boxGeometry args={[0.24, 0.02, 0.04]} />
              </mesh>
              {/* Wheel Caster */}
              <mesh position={[0.22, -0.06, 0]} rotation={[0, 0, Math.PI / 2]} material={baseMat} castShadow>
                <cylinderGeometry args={[0.038, 0.038, 0.02, 8]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
};

// 6. Interactive Bero/Wardrobe with Pivoting swing doors
const BeroWardrobeModel: React.FC<{ selected?: boolean; baseMat: THREE.Material; chromeMat: THREE.Material }> = ({ selected, baseMat, chromeMat }) => {
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(!!selected);
  }, [selected]);

  useFrame((state, delta) => {
    const targetLeft = isOpen ? -Math.PI / 2.15 : 0;
    const targetRight = isOpen ? Math.PI / 2.15 : 0;
    if (leftDoorRef.current) {
      leftDoorRef.current.rotation.y = THREE.MathUtils.lerp(leftDoorRef.current.rotation.y, targetLeft, delta * 6);
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.rotation.y = THREE.MathUtils.lerp(rightDoorRef.current.rotation.y, targetRight, delta * 6);
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
      {/* Outer Wardrobe Casing */}
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow material={baseMat}>
        <boxGeometry args={[1.06, 1.9, 0.51]} />
      </mesh>
      {/* Shelving panels inside */}
      <mesh position={[0, 0.5, 0.02]} material={baseMat} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.44]} />
      </mesh>
      <mesh position={[0, 1.0, 0.02]} material={baseMat} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.44]} />
      </mesh>
      <mesh position={[0, 1.5, 0.02]} material={baseMat} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.02, 0.44]} />
      </mesh>
      {/* Hanging Clothes Rail details */}
      <group position={[0, 1.66, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={chromeMat}>
          <cylinderGeometry args={[0.01, 0.01, 0.98]} />
        </mesh>
        {[-0.3, -0.1, 0.1, 0.3].map((pos, i) => (
          <group key={i} position={[pos, -0.12, 0]}>
            <mesh material={new THREE.MeshStandardMaterial({ color: ['#ef4444', '#10b981', '#f59e0b', '#3b82f6'][i] })} castShadow>
              <boxGeometry args={[0.025, 0.22, 0.3]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Swinging Left Door pivoting at edge */}
      <group ref={leftDoorRef} position={[-0.51, 0.95, 0.255]}>
        <mesh position={[0.255, 0, 0.01]} castShadow material={baseMat}>
          <boxGeometry args={[0.51, 1.84, 0.02]} />
        </mesh>
        <mesh position={[0.45, 0.15, 0.03]} material={chromeMat} castShadow>
          <boxGeometry args={[0.015, 0.15, 0.018]} />
        </mesh>
      </group>
      {/* Swinging Right Door pivoting at edge */}
      <group ref={rightDoorRef} position={[0.51, 0.95, 0.255]}>
        <mesh position={[-0.255, 0, 0.01]} castShadow material={baseMat}>
          <boxGeometry args={[0.51, 1.84, 0.02]} />
        </mesh>
        <mesh position={[-0.45, 0.15, 0.03]} material={chromeMat} castShadow>
          <boxGeometry args={[0.015, 0.15, 0.018]} />
        </mesh>
      </group>
    </group>
  );
};

// 7. Interactive Study Table with openable interactive Laptop and Steaming Coffee Mug
const StudyTableProductModel: React.FC<{ isRealistic: boolean; woodMat: THREE.Material; chromeMat: THREE.Material }> = ({ isRealistic, woodMat, chromeMat }) => {
  const [lidOpen, setLidOpen] = useState(true);
  const lidRef = useRef<THREE.Group>(null);
  const steamRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (lidRef.current) {
      const targetAngle = lidOpen ? -Math.PI / 1.7 : 0;
      lidRef.current.rotation.x = THREE.MathUtils.lerp(lidRef.current.rotation.x, targetAngle, delta * 6.5);
    }
    if (steamRef.current) {
      steamRef.current.children.forEach((mesh) => {
        mesh.position.y += delta * 0.14;
        mesh.scale.multiplyScalar(1 - delta * 0.45);
        if (mesh.position.y > 0.14) {
          mesh.position.y = 0.02;
          mesh.position.x = (Math.random() - 0.5) * 0.02;
          mesh.position.z = (Math.random() - 0.5) * 0.02;
          mesh.scale.setScalar(1);
        }
      });
    }
  });

  return (
    <group position={[0, 0.75, 0]}>
      {/* Polished timber table top */}
      <mesh castShadow receiveShadow material={woodMat}>
        <boxGeometry args={[0.79, 0.04, 0.45]} />
      </mesh>
      {/* Struts */}
      <mesh position={[0, -0.1, -0.21]} material={chromeMat}>
        <boxGeometry args={[0.71, 0.02, 0.02]} />
      </mesh>
      <mesh position={[-0.34, -0.25, -0.2]} material={chromeMat}>
        <boxGeometry args={[0.02, 0.5, 0.02]} />
      </mesh>
      <mesh position={[0.34, -0.25, -0.2]} material={chromeMat}>
        <boxGeometry args={[0.02, 0.5, 0.02]} />
      </mesh>

      {isRealistic && (
        <group position={[0, 0.02, 0.04]}>
          {/* Laptop unit */}
          <group onClick={(e) => { e.stopPropagation(); setLidOpen(!lidOpen); }}>
            <mesh position={[0, 0.005, 0]} castShadow>
              <boxGeometry args={[0.26, 0.01, 0.18]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.006, 0.01]} castShadow>
              <boxGeometry args={[0.24, 0.002, 0.1]} />
              <meshStandardMaterial color="#1e293b" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.006, -0.06]}>
              <boxGeometry args={[0.07, 0.002, 0.04]} />
              <meshStandardMaterial color="#475569" roughness={0.4} />
            </mesh>
            <group ref={lidRef} position={[0, 0.01, 0.09]}>
              <mesh position={[0, 0.09, 0.005]} castShadow>
                <boxGeometry args={[0.26, 0.18, 0.008]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.09, -0.002]}>
                <planeGeometry args={[0.24, 0.16]} />
                <meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={lidOpen ? 1.6 : 0} roughness={0.1} />
              </mesh>
            </group>
          </group>

          {/* Steaming Mug */}
          <group position={[0.24, 0, -0.1]}>
            <mesh castShadow position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.08, 16]} />
              <meshPhysicalMaterial color="#ef4444" roughness={0.1} clearcoat={1.0} />
            </mesh>
            <mesh position={[0.035, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.02, 0.006, 8, 16]} />
              <meshPhysicalMaterial color="#ef4444" roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.026, 16]} />
              <meshStandardMaterial color="#3b2214" roughness={0.6} />
            </mesh>
            <group ref={steamRef} position={[0, 0.08, 0]}>
              {[1, 2, 3].map((id) => (
                <mesh key={id} position={[(Math.random() - 0.5) * 0.02, 0.02 * id, (Math.random() - 0.5) * 0.02]}>
                  <sphereGeometry args={[0.004, 6, 6]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
                </mesh>
              ))}
            </group>
          </group>

          {/* Open notebook and pencil details */}
          <group position={[-0.23, 0.001, -0.04]} rotation={[0, 0.12, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.18, 0.005, 0.24]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
            </mesh>
            <mesh position={[0.004, 0.003, 0]}>
              <boxGeometry args={[0.15, 0.001, 0.22]} />
              <meshStandardMaterial color="#ffffff" roughness={1.0} />
            </mesh>
            {[-0.1, -0.05, 0, 0.05, 0.1].map((p, i) => (
              <mesh key={i} position={[-0.09, 0.003, p]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.007, 0.002, 6, 10]} />
                <meshBasicMaterial color="#94a3b8" />
              </mesh>
            ))}
          </group>
        </group>
      )}
    </group>
  );
};

// 8. Modular Bunk Bed with ladder details and beautiful procedural textured quilts
const BunkBedDetailedModel: React.FC<{ width: number; depth: number; baseMat: THREE.Material; mattressMat: THREE.Material }> = ({ width, depth, baseMat, mattressMat }) => {
  return (
    <group>
      {/* High strength iron framework posts */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} position={[(x * (width - 0.04)) / 2, 0.9, (z * (depth - 0.04)) / 2]} castShadow receiveShadow material={baseMat}>
          <boxGeometry args={[0.04, 1.8, 0.04]} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0]} receiveShadow castShadow material={baseMat}>
        <boxGeometry args={[width, 0.06, depth]} />
      </mesh>
      <mesh position={[0, 1.28, 0]} receiveShadow castShadow material={baseMat}>
        <boxGeometry args={[width, 0.06, depth]} />
      </mesh>
      {/* Upper Guard Rails */}
      <mesh position={[0, 1.48, -depth / 2 + 0.02]} castShadow material={baseMat}>
        <boxGeometry args={[width, 0.02, 0.02]} />
      </mesh>
      <mesh position={[0, 1.48, depth / 2 - 0.02]} castShadow material={baseMat}>
        <boxGeometry args={[width, 0.02, 0.02]} />
      </mesh>
      {/* Soft mattresses with fabric canvas repeating textures */}
      <mesh position={[0, 0.46, 0]} castShadow material={mattressMat}>
        <boxGeometry args={[width - 0.04, 0.14, depth - 0.04]} />
      </mesh>
      <mesh position={[0, 1.36, 0]} castShadow material={mattressMat}>
        <boxGeometry args={[width - 0.04, 0.14, depth - 0.04]} />
      </mesh>
      {/* Ergonomic pillows */}
      <mesh position={[0, 0.56, depth / 2 - 0.22]} castShadow material={mattressMat}>
        <boxGeometry args={[width - 0.16, 0.08, 0.3]} />
      </mesh>
      <mesh position={[0, 1.46, depth / 2 - 0.22]} castShadow material={mattressMat}>
        <boxGeometry args={[width - 0.16, 0.08, 0.3]} />
      </mesh>
      {/* Folded colorful blankets */}
      <mesh position={[0, 0.54, -depth / 4]} castShadow material={useMemo(() => new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        map: TextureManager.getFabricTexture('#3b82f6'),
        roughness: 0.9,
        sheen: 0.8,
        sheenColor: '#93c5fd',
        sheenRoughness: 0.4
      }), [depth, width])}>
        <boxGeometry args={[width - 0.03, 0.03, depth / 2]} />
      </mesh>
      <mesh position={[0, 1.44, -depth / 4]} castShadow material={useMemo(() => new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        map: TextureManager.getFabricTexture('#f59e0b'),
        roughness: 0.9,
        sheen: 0.8,
        sheenColor: '#fde047',
        sheenRoughness: 0.4
      }), [depth, width])}>
        <boxGeometry args={[width - 0.03, 0.03, depth / 2]} />
      </mesh>
      {/* Sturdy ladder mount */}
      <group position={[width / 2 - 0.02, 0.7, -0.3]}>
        <mesh position={[-0.08, 0, 0]} material={baseMat} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 1.4]} />
        </mesh>
        <mesh position={[0.08, 0, 0]} material={baseMat} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 1.4]} />
        </mesh>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} material={baseMat} castShadow>
            <cylinderGeometry args={[0.01, 0.01, 0.16]} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

export const FurnitureModel: React.FC<ModelProps> = ({ type, selected, hasCollision, isRealistic }) => {
  const data = (FURNITURE_DATA[type as string] || FIXTURE_DATA[type as string]);
  if (!data) return null;

  const { width, height, depth } = data.dimensions;

  // Custom high fidelity physical structures loaded via TextureManager
  const woodTexture = useMemo(() => TextureManager.getWoodTexture(), []);
  const mattressTexture = useMemo(() => TextureManager.getFabricTexture('#f8fafc'), []);
  const chairTexture = useMemo(() => TextureManager.getFabricTexture(data.color), []);
  const steelTexture = useMemo(() => TextureManager.getSteelTexture(), []);

  const baseMat = useMemo(() => {
    const baseColor = hasCollision ? '#ef4444' : (selected ? '#3b82f6' : data.color);
    if (isRealistic) {
      const isSteel = type === 'BERO' || type === 'BUNKER_BED' || type === 'CHAIR' || type === 'FAN' || type === 'SHOWER';
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        map: isSteel ? steelTexture : undefined,
        metalness: isSteel ? 0.85 : 0.1,
        roughness: isSteel ? 0.32 : 0.5,
        clearcoat: isSteel ? 0.4 : 0.05,
        clearcoatRoughness: 0.15,
        reflectivity: isSteel ? 0.85 : 0.2,
        envMapIntensity: 1.8,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.15,
      roughness: 0.75,
    });
  }, [data.color, selected, hasCollision, isRealistic, type, steelTexture]);

  const mattressMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: mattressTexture,
    roughness: 0.95,
    metalness: 0,
    sheen: 0.8,
    sheenColor: '#f1f5f9',
    sheenRoughness: 0.4,
  }), [mattressTexture]);

  const woodMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: woodTexture,
    roughness: 0.35,
    metalness: 0.05,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    reflectivity: 0.4,
  }), [woodTexture]);

  const ceramicMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.04,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 0.9,
    envMapIntensity: 2.2,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f1f5f9',
    transparent: true,
    opacity: 0.2,
    transmission: 0.95,
    roughness: 0.08,
    thickness: 0.15,
    ior: 1.5,
  }), []);

  const chromeMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f1f5f9',
    metalness: 1.0,
    roughness: 0.06,
    clearcoat: 1.0,
    reflectivity: 1.0,
    envMapIntensity: 2.0,
  }), []);

  const seatMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: chairTexture,
    roughness: 0.85,
    metalness: 0,
    sheen: 0.5,
  }), [chairTexture]);

  switch (type) {
    case 'TOILET':
      return <ToiletModel ceramicMat={ceramicMat} chromeMat={chromeMat} />;

    case 'WASHBASIN':
      return <WashbasinModel isRealistic={!!isRealistic} ceramicMat={ceramicMat} chromeMat={chromeMat} />;

    case 'FAN':
      return <FanModel isRealistic={!!isRealistic} chromeMat={chromeMat} baseMat={baseMat} />;

    case 'BUNKER_BED':
      return <BunkBedDetailedModel width={width} depth={depth} baseMat={baseMat} mattressMat={mattressMat} />;

    case 'STUDY_TABLE':
      return <StudyTableProductModel isRealistic={!!isRealistic} woodMat={woodMat} chromeMat={chromeMat} />;

    case 'BERO':
      return <BeroWardrobeModel selected={selected} baseMat={baseMat} chromeMat={chromeMat} />;

    case 'CHAIR':
      return <SwivelChairModel width={width} depth={depth} seatMat={seatMat} baseMat={baseMat} chromeMat={chromeMat} />;

    case 'SHOWER':
      return <ShowerModel isRealistic={!!isRealistic} ceramicMat={ceramicMat} glassMat={glassMat} chromeMat={chromeMat} />;

    default:
      return null;
  }
};
