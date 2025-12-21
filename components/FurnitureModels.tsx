
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

  const mat = useMemo(() => {
    const baseColor = hasCollision ? '#ef4444' : (selected ? '#3B82F6' : data.color);
    if (isRealistic) {
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: type === 'BERO' ? 0.9 : 0.2,
        roughness: type === 'BUNKER_BED' ? 0.4 : 0.6,
        envMapIntensity: 1.5,
        clearcoat: 0.2,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.2,
      roughness: 0.8,
    });
  }, [data.color, selected, hasCollision, isRealistic, type]);

  const ceramicMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    envMapIntensity: 2,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.2,
    transmission: 0.9,
    roughness: 0.05,
    thickness: 0.1,
  }), []);

  const chromeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 1,
    roughness: 0.1,
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
        </group>
      );

    case 'FAN':
      return (
        <group position={[0, 2.7, 0]}>
          <mesh material={chromeMat}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rot, i) => (
            <mesh key={i} rotation={[0, rot, 0]} position={[0.45, -0.05, 0]} material={isRealistic ? chromeMat : mat}>
              <boxGeometry args={[0.9, 0.015, 0.18]} />
            </mesh>
          ))}
        </group>
      );

    case 'BUNKER_BED':
      return (
        <group>
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2, 0.9, (z * (depth - 0.05)) / 2]} castShadow receiveShadow material={mat}>
              <boxGeometry args={[0.05, 1.8, 0.05]} />
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0]} receiveShadow material={mat}><boxGeometry args={[width, 0.06, depth]} /></mesh>
          <mesh position={[0, 1.4, 0]} receiveShadow material={mat}><boxGeometry args={[width, 0.06, depth]} /></mesh>
          <mesh position={[0, 0.5, 0]} castShadow material={new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 })}>
            <boxGeometry args={[width - 0.1, 0.16, depth - 0.1]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow material={new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 })}>
            <boxGeometry args={[width - 0.1, 0.16, depth - 0.1]} />
          </mesh>
        </group>
      );

    case 'STUDY_TABLE':
      return (
        <group position={[0, 0.75, 0]}>
          <mesh castShadow receiveShadow material={mat}><boxGeometry args={[width, 0.04, depth]} /></mesh>
          <mesh position={[0, -0.1, -depth / 2 + 0.01]} material={chromeMat}><boxGeometry args={[width * 0.9, 0.02, 0.02]} /></mesh>
        </group>
      );

    case 'BERO':
      return (
        <group>
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow material={mat}><boxGeometry args={[width, 1.9, depth]} /></mesh>
          <mesh position={[0, 1.1, depth/2 + 0.01]} material={chromeMat}><boxGeometry args={[0.04, 0.15, 0.02]} /></mesh>
        </group>
      );

    case 'CHAIR':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={mat}><boxGeometry args={[width, 0.06, depth]} /></mesh>
          <mesh position={[0, 0.7, -depth / 2 + 0.03]} castShadow material={mat}><boxGeometry args={[width, 0.5, 0.05]} /></mesh>
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
          <mesh position={[0, 0.05, 0]} material={ceramicMat}><boxGeometry args={[width, 0.1, depth]} /></mesh>
          <mesh position={[-width / 2 + 0.01, 1, 0]} material={glassMat}><boxGeometry args={[0.02, 2.0, depth]} /></mesh>
          <mesh position={[width / 2 - 0.01, 1, 0]} material={glassMat}><boxGeometry args={[0.02, 2.0, depth]} /></mesh>
          <mesh position={[0, 1.8, -depth / 2 + 0.05]} material={chromeMat}><cylinderGeometry args={[0.02, 0.02, 0.1]} /></mesh>
        </group>
      );

    default:
      return null;
  }
};
