
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FurnitureType } from '../types.ts';
import { FURNITURE_DATA } from '../constants.ts';

interface ModelProps {
  type: FurnitureType;
  selected?: boolean;
  hasCollision?: boolean;
  isRealistic?: boolean;
}

export const FurnitureModel: React.FC<ModelProps> = ({ type, selected, hasCollision, isRealistic }) => {
  const data = FURNITURE_DATA[type];
  if (!data) return null;

  const { width, height, depth } = data.dimensions;

  // Optimizing materials for performance: meshStandardMaterial is faster than meshPhysicalMaterial
  const mat = useMemo(() => {
    const baseColor = hasCollision ? '#ef4444' : (selected ? '#3B82F6' : data.color);
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.4,
      roughness: 0.6,
      envMapIntensity: isRealistic ? 1.2 : 0.8,
    });
  }, [data.color, selected, hasCollision, isRealistic]);

  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
  }), []);

  const ceramicMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.1,
    metalness: 0.1,
  }), []);

  switch (type) {
    case 'TOILET':
      return (
        <group>
          <mesh position={[0, 0.6, -0.2]} castShadow receiveShadow material={ceramicMat}>
            <boxGeometry args={[width, 0.4, 0.2]} />
          </mesh>
          <mesh position={[0, 0.2, 0.1]} castShadow receiveShadow material={ceramicMat}>
            <cylinderGeometry args={[0.2, 0.15, 0.4, 16]} />
          </mesh>
          <mesh position={[0, 0.41, 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={ceramicMat}>
            <ringGeometry args={[0.1, 0.2, 16]} />
          </mesh>
        </group>
      );

    case 'WASHBASIN':
      return (
        <group>
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow material={ceramicMat}>
            <boxGeometry args={[width, 0.15, depth]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow material={ceramicMat}>
            <cylinderGeometry args={[0.08, 0.1, 0.8, 12]} />
          </mesh>
          <group position={[0, 0.88, -0.15]}>
            <mesh castShadow material={mat}>
              <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
            </mesh>
          </group>
        </group>
      );

    case 'FAN':
      return (
        <group position={[0, 2.6, 0]}>
          <mesh castShadow material={mat}>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 12]} />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rot, i) => (
            <mesh key={i} rotation={[0, rot, 0]} position={[0.4, -0.05, 0]} material={mat}>
              <boxGeometry args={[0.8, 0.01, 0.15]} />
            </mesh>
          ))}
        </group>
      );

    case 'BUNKER_BED':
      return (
        <group>
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2, 0.9, (z * (depth - 0.05)) / 2]} castShadow receiveShadow material={mat}>
              <boxGeometry args={[0.045, 1.8, 0.045]} />
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow material={mat}>
            <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
          </mesh>
          <mesh position={[0, 1.4, 0]} castShadow receiveShadow material={mat}>
            <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} castShadow material={ceramicMat}>
            <boxGeometry args={[width - 0.1, 0.15, depth - 0.1]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow material={ceramicMat}>
            <boxGeometry args={[width - 0.1, 0.15, depth - 0.1]} />
          </mesh>
        </group>
      );

    case 'STUDY_TABLE':
      return (
        <group position={[0, 0.75, 0]}>
          <mesh castShadow receiveShadow material={mat}>
            <boxGeometry args={[width - 0.05, 0.03, depth - 0.05]} />
          </mesh>
          <mesh position={[0, -0.1, -depth / 2 + 0.01]} castShadow material={mat}>
            <boxGeometry args={[width * 0.8, 0.02, 0.02]} />
          </mesh>
        </group>
      );

    case 'BERO':
      return (
        <group>
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow material={mat}>
            <boxGeometry args={[width - 0.05, 1.9, depth - 0.05]} />
          </mesh>
          <mesh position={[0, 0.95, depth / 2 - 0.02]} material={mat}>
            <boxGeometry args={[0.005, 1.8, 0.01]} />
          </mesh>
        </group>
      );

    case 'CHAIR':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={mat}>
            <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
          </mesh>
          <mesh position={[0, 0.65, -depth / 2 + 0.03]} castShadow material={mat}>
            <boxGeometry args={[width - 0.05, 0.4, 0.04]} />
          </mesh>
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2.3, 0.22, (z * (depth - 0.05)) / 2.3]} castShadow material={mat}>
              <boxGeometry args={[0.03, 0.44, 0.03]} />
            </mesh>
          ))}
        </group>
      );

    case 'SHOWER':
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow receiveShadow material={ceramicMat}>
            <boxGeometry args={[width, 0.1, depth]} />
          </mesh>
          <mesh position={[-width / 2 + 0.01, 0.95, 0]} castShadow material={glassMat}>
            <boxGeometry args={[0.02, height, depth]} />
          </mesh>
          <mesh position={[0, 0.95, -depth / 2 + 0.01]} castShadow material={glassMat}>
            <boxGeometry args={[width, height, 0.02]} />
          </mesh>
          <mesh position={[width / 2 - 0.01, 0.95, 0]} castShadow material={glassMat}>
            <boxGeometry args={[0.02, height, depth]} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
};
