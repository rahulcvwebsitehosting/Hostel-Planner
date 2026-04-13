
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FurnitureType } from '../types.ts';
import { FURNITURE_DATA, FIXTURE_DATA } from '../constants.ts';

interface ModelProps {
  type: FurnitureType | 'FAN' | 'TOILET' | 'WASHBASIN' | 'SHOWER';
  selected?: boolean;
  hasCollision?: boolean;
  isRealistic?: boolean;
}

export const FurnitureModel: React.FC<ModelProps> = ({ type, selected, hasCollision, isRealistic }) => {
  const data = (FURNITURE_DATA[type as string] || FIXTURE_DATA[type as string]);
  if (!data) return null;

  const { width, height, depth } = data.dimensions;

  // Base material logic
  const baseMat = useMemo(() => {
    const baseColor = hasCollision ? '#ef4444' : (selected ? '#3B82F6' : data.color);
    if (isRealistic) {
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: type === 'BERO' || type === 'BUNKER_BED' ? 0.7 : 0.1,
        roughness: 0.4,
        envMapIntensity: 1.2,
        clearcoat: 0.1,
        clearcoatRoughness: 0.2,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.2,
      roughness: 0.8,
    });
  }, [data.color, selected, hasCollision, isRealistic, type]);

  // Mattress PBR Material
  const mattressMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f8fafc',
    roughness: 0.95,
    metalness: 0,
    sheen: 1.0,
    sheenColor: '#ffffff',
    sheenRoughness: 0.5,
  }), []);

  // Wood PBR Material
  const woodMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#d4a373',
    roughness: 0.6,
    metalness: 0,
    clearcoat: 0.1,
  }), []);

  // Ceramic PBR Material
  const ceramicMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    envMapIntensity: 2.5,
    reflectivity: 0.8,
  }), []);

  // Glass PBR Material
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#e2e8f0',
    transparent: true,
    opacity: 0.15,
    transmission: 0.95,
    roughness: 0.05,
    thickness: 0.2,
    ior: 1.5,
  }), []);

  // Chrome PBR Material
  const chromeMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#cbd5e1',
    metalness: 1.0,
    roughness: 0.05,
    reflectivity: 1.0,
    envMapIntensity: 2.0,
  }), []);

  switch (type) {
    case 'TOILET':
      return (
        <group>
          <mesh position={[0, 0.55, -0.2]} castShadow material={ceramicMat}>
            <boxGeometry args={[width, 0.4, 0.25]} />
          </mesh>
          <mesh position={[0, 0.2, 0.1]} castShadow material={ceramicMat}>
            <cylinderGeometry args={[0.22, 0.18, 0.45, 24]} />
          </mesh>
          <mesh position={[0, 0.43, 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={ceramicMat}>
            <ringGeometry args={[0.12, 0.22, 24]} />
          </mesh>
          {/* Flush handle */}
          <mesh position={[0.15, 0.65, -0.05]} material={chromeMat}>
            <sphereGeometry args={[0.02, 12, 12]} />
          </mesh>
        </group>
      );

    case 'WASHBASIN':
      return (
        <group>
          <mesh position={[0, 0.8, 0]} castShadow material={ceramicMat}>
            <boxGeometry args={[width, 0.18, depth]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} material={ceramicMat}>
            <cylinderGeometry args={[0.07, 0.11, 0.8, 16]} />
          </mesh>
          <mesh position={[0, 0.9, -0.15]} material={chromeMat}>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 8]} />
          </mesh>
          {/* Faucet head */}
          <mesh position={[0, 0.95, -0.12]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
            <cylinderGeometry args={[0.01, 0.01, 0.05, 8]} />
          </mesh>
        </group>
      );

    case 'FAN':
      return (
        <group position={[0, 2.7, 0]}>
          <mesh material={chromeMat}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rot, i) => (
            <mesh key={i} rotation={[0, rot, 0]} position={[0.45, -0.05, 0]} material={isRealistic ? chromeMat : baseMat}>
              <boxGeometry args={[0.9, 0.015, 0.18]} />
            </mesh>
          ))}
        </group>
      );

    case 'BUNKER_BED':
      return (
        <group>
          {/* Main Frame */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2, 0.9, (z * (depth - 0.05)) / 2]} castShadow receiveShadow material={baseMat}>
              <boxGeometry args={[0.05, 1.8, 0.05]} />
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0]} receiveShadow material={baseMat}><boxGeometry args={[width, 0.06, depth]} /></mesh>
          <mesh position={[0, 1.4, 0]} receiveShadow material={baseMat}><boxGeometry args={[width, 0.06, depth]} /></mesh>
          
          {/* Mattresses */}
          <mesh position={[0, 0.5, 0]} castShadow material={mattressMat}>
            <boxGeometry args={[width - 0.06, 0.16, depth - 0.06]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow material={mattressMat}>
            <boxGeometry args={[width - 0.06, 0.16, depth - 0.06]} />
          </mesh>
          
          {/* Pillows */}
          <mesh position={[0, 0.6, depth/2 - 0.2]} castShadow material={mattressMat}>
            <boxGeometry args={[width - 0.2, 0.08, 0.3]} />
          </mesh>
          <mesh position={[0, 1.6, depth/2 - 0.2]} castShadow material={mattressMat}>
            <boxGeometry args={[width - 0.2, 0.08, 0.3]} />
          </mesh>
        </group>
      );

    case 'STUDY_TABLE':
      return (
        <group position={[0, 0.75, 0]}>
          {/* Table Top with Wood Texture feel */}
          <mesh castShadow receiveShadow material={isRealistic ? woodMat : baseMat}>
            <boxGeometry args={[width, 0.04, depth]} />
          </mesh>
          {/* Metal supports */}
          <mesh position={[0, -0.1, -depth / 2 + 0.01]} material={chromeMat}>
            <boxGeometry args={[width * 0.9, 0.02, 0.02]} />
          </mesh>
          <mesh position={[-width/2 + 0.05, -0.3, -depth/2 + 0.05]} material={chromeMat}>
            <cylinderGeometry args={[0.01, 0.01, 0.6]} />
          </mesh>
          <mesh position={[width/2 - 0.05, -0.3, -depth/2 + 0.05]} material={chromeMat}>
            <cylinderGeometry args={[0.01, 0.01, 0.6]} />
          </mesh>
        </group>
      );

    case 'BERO':
      return (
        <group>
          {/* Main Body */}
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow material={baseMat}>
            <boxGeometry args={[width, 1.9, depth]} />
          </mesh>
          {/* Door line */}
          <mesh position={[0, 0.95, depth/2 + 0.001]}>
             <planeGeometry args={[0.005, 1.85]} />
             <meshStandardMaterial color="#000000" />
          </mesh>
          {/* Handle */}
          <mesh position={[0.06, 1.1, depth/2 + 0.01]} material={chromeMat}>
            <boxGeometry args={[0.04, 0.15, 0.02]} />
          </mesh>
        </group>
      );

    case 'CHAIR':
      const seatMat = isRealistic ? new THREE.MeshPhysicalMaterial({ color: data.color, roughness: 0.8, metalness: 0 }) : baseMat;
      return (
        <group>
          {/* Seat */}
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={seatMat}>
            <boxGeometry args={[width, 0.06, depth]} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, 0.7, -depth / 2 + 0.03]} castShadow material={seatMat}>
            <boxGeometry args={[width, 0.5, 0.05]} />
          </mesh>
          {/* Legs */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2.3, 0.22, (z * (depth - 0.05)) / 2.3]} material={chromeMat}>
              <boxGeometry args={[0.04, 0.45, 0.04]} />
            </mesh>
          ))}
        </group>
      );

    case 'SHOWER':
      return (
        <group>
          {/* Tray */}
          <mesh position={[0, 0.05, 0]} material={ceramicMat}><boxGeometry args={[width, 0.1, depth]} /></mesh>
          {/* Glass Panels */}
          <mesh position={[-width / 2 + 0.01, 1, 0]} material={glassMat}><boxGeometry args={[0.02, 2.0, depth]} /></mesh>
          <mesh position={[width / 2 - 0.01, 1, 0]} material={glassMat}><boxGeometry args={[0.02, 2.0, depth]} /></mesh>
          {/* Faucet and head */}
          <mesh position={[0, 1.8, -depth / 2 + 0.05]} material={chromeMat}><cylinderGeometry args={[0.02, 0.02, 0.1]} /></mesh>
          <mesh position={[0, 1.85, -depth / 2 + 0.15]} rotation={[Math.PI/2, 0, 0]} material={chromeMat}>
            <cylinderGeometry args={[0.08, 0.08, 0.02, 32]} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
};
