
import React from 'react';
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

  const getPBRMaterial = (color: string, options: { metal?: number, rough?: number, clearcoat?: number, sheen?: number } = {}) => {
    const { metal = 0.5, rough = 0.5, clearcoat = 0, sheen = 0 } = options;
    const baseColor = hasCollision ? '#ef4444' : (selected ? '#3B82F6' : color);

    if (isRealistic) {
      return (
        <meshPhysicalMaterial
          color={baseColor}
          metalness={metal}
          roughness={rough}
          clearcoat={clearcoat}
          clearcoatRoughness={0.1}
          sheen={sheen}
          sheenRoughness={0.5}
          envMapIntensity={1.8}
        />
      );
    }

    return (
      <meshStandardMaterial
        color={baseColor}
        metalness={metal * 0.5}
        roughness={rough}
        envMapIntensity={1}
      />
    );
  };

  switch (type) {
    case 'BUNKER_BED':
      const frameMatProps = { metal: 0.8, rough: 0.2, clearcoat: 0.1 };
      const mattressMat = isRealistic ? (
        <meshPhysicalMaterial color="#ffffff" roughness={0.9} sheen={1} sheenRoughness={0.5} envMapIntensity={0.5} />
      ) : (
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      );

      return (
        <group>
          {/* Main frame posts */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2, 0.9, (z * (depth - 0.05)) / 2]} castShadow receiveShadow>
              <boxGeometry args={[0.045, 1.8, 0.045]} />
              {getPBRMaterial(data.color, frameMatProps)}
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
            {getPBRMaterial(data.color, frameMatProps)}
          </mesh>
          <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
            {getPBRMaterial(data.color, frameMatProps)}
          </mesh>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.1, 0.15, depth - 0.1]} />
            {mattressMat}
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.1, 0.15, depth - 0.1]} />
            {mattressMat}
          </mesh>
          <mesh position={[0, 1.7, depth / 2 - 0.025]} castShadow>
            <boxGeometry args={[width - 0.05, 0.12, 0.02]} />
            {getPBRMaterial(data.color, frameMatProps)}
          </mesh>
          <mesh position={[0, 1.7, -depth / 2 + 0.025]} castShadow>
            <boxGeometry args={[width - 0.05, 0.12, 0.02]} />
            {getPBRMaterial(data.color, frameMatProps)}
          </mesh>
        </group>
      );

    case 'STUDY_TABLE':
      const woodColor = '#a8a29e';
      const metalColor = '#475569';
      return (
        <group position={[0, 0.75, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width - 0.05, 0.03, depth - 0.05]} />
            {getPBRMaterial(woodColor, { metal: 0.1, rough: 0.7, clearcoat: 0.4 })}
          </mesh>
          <mesh position={[0, -0.1, -depth / 2 + 0.08]} castShadow>
            <boxGeometry args={[width * 0.6, 0.02, 0.05]} />
            {getPBRMaterial(metalColor, { metal: 1, rough: 0.3 })}
          </mesh>
        </group>
      );

    case 'BERO':
      const bodyMatProps = { metal: 0.9, rough: 0.1, clearcoat: 0.3 };
      return (
        <group>
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.05, 1.9, depth - 0.05]} />
            {getPBRMaterial(data.color, bodyMatProps)}
          </mesh>
          <mesh position={[0, 0.95, depth / 2 - 0.02]} castShadow>
            <boxGeometry args={[0.005, 1.8, 0.01]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      );

    case 'CHAIR':
      const plasticProps = { metal: 0.2, rough: 0.5, sheen: 0.2 };
      const legMatProps = { metal: 1, rough: 0.1 };
      return (
        <group>
          {/* Seat at standard height ~0.45m */}
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
            {getPBRMaterial(data.color, plasticProps)}
          </mesh>
          {/* Backrest sits from seat top to chair height */}
          <mesh position={[0, 0.65, -depth / 2 + 0.03]} castShadow receiveShadow>
            <boxGeometry args={[width - 0.05, 0.4, 0.04]} />
            {getPBRMaterial(data.color, plasticProps)}
          </mesh>
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[(x * (width - 0.05)) / 2.3, 0.22, (z * (depth - 0.05)) / 2.3]} castShadow>
              <boxGeometry args={[0.03, 0.44, 0.03]} />
              {getPBRMaterial('#000000', legMatProps)}
            </mesh>
          ))}
        </group>
      );

    default:
      return null;
  }
};