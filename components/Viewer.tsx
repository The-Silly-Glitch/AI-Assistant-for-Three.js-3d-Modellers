/// <reference types="@react-three/fiber" />
import React, { useRef, useImperativeHandle, forwardRef, Suspense, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import type { SceneGraph, SceneObject } from '../types';
import { GeometryType } from '../types';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const renderGeometry = (geometry: SceneObject['geometry']) => {
  const { type, args } = geometry;
  switch (type) {
    case GeometryType.Box:
      return <boxGeometry args={args as [number, number, number]} />;
    case GeometryType.Sphere:
      return <sphereGeometry args={args as [number, number, number]} />;
    case GeometryType.Plane:
      return <planeGeometry args={args as [number, number]} />;
    case GeometryType.Cylinder:
      return <cylinderGeometry args={args as [number, number, number, number]} />;
    case GeometryType.Cone:
      return <coneGeometry args={args as [number, number, number]} />;
    case GeometryType.Torus:
      return <torusGeometry args={args as [number, number, number, number]} />;
    default:
      console.warn(`Unsupported geometry type: ${type}`);
      return <boxGeometry />;
  }
};

const TexturedMaterial = ({ material, isSelected }: { material: SceneObject['material'], isSelected: boolean }) => {
    // This component is only rendered when material.map exists, so useLoader is safe.
    const sourceTexture = useLoader(THREE.TextureLoader, material.map as string);

    // By cloning the texture, we ensure that each material gets its own instance.
    // This solves a subtle bug where a single texture instance shared across multiple
    // materials (e.g., when applying from history) doesn't update correctly on all of them.
    const texture = useMemo(() => {
        // sourceTexture will be a valid texture object here because Suspense handles loading
        const newTexture = sourceTexture.clone();
        newTexture.needsUpdate = true; // Cloned textures need this flag set.
        newTexture.wrapS = THREE.RepeatWrapping;
        newTexture.wrapT = THREE.RepeatWrapping;
        return newTexture;
    }, [sourceTexture]);

    return (
        <meshStandardMaterial
            color={'#ffffff'}
            metalness={material.metalness ?? 0.5}
            roughness={material.roughness ?? 0.5}
            emissive={isSelected ? '#ffff00' : '#000000'}
            emissiveIntensity={isSelected ? 0.75 : 0}
            map={texture}
        />
    );
};

const MaterialWithTexture = ({ material, isSelected }: { material: SceneObject['material'], isSelected: boolean }) => {
    // If a texture map URL exists, render the component that will load it.
    // This respects the rules of hooks, as the hook is in a component that's conditionally rendered.
    if (material.map) {
        return <TexturedMaterial material={material} isSelected={isSelected} />;
    }

    // Otherwise, render a standard material without a texture.
    return (
        <meshStandardMaterial
            color={material.color}
            metalness={material.metalness ?? 0.5}
            roughness={material.roughness ?? 0.5}
            emissive={isSelected ? '#ffff00' : '#000000'}
            emissiveIntensity={isSelected ? 0.75 : 0}
            map={null}
        />
    );
};


interface MeshComponentProps {
  object: SceneObject;
  isSelected: boolean;
  onClick: (shiftKey: boolean) => void;
}

const MeshComponent = ({ object, isSelected, onClick }: MeshComponentProps) => {
  return (
    <mesh
      castShadow
      receiveShadow
      position={object.position}
      rotation={object.rotation as [number, number, number] | undefined}
      scale={object.scale as [number, number, number] | undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e.shiftKey);
      }}
    >
      {renderGeometry(object.geometry)}
      <MaterialWithTexture material={object.material} isSelected={isSelected} />
    </mesh>
  );
};

interface ViewerProps {
  sceneGraph: SceneGraph;
  selectedObjectIds: string[];
  setSelectedObjectId: (id: string | null, shiftKey: boolean) => void;
}

const Viewer = forwardRef<any, ViewerProps>(({ sceneGraph, selectedObjectIds, setSelectedObjectId }, ref) => {
  const sceneContentRef = useRef<THREE.Group>(null);

  const saveArrayBuffer = (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportGLB = () => {
    if (!sceneContentRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      sceneContentRef.current,
      (result) => {
        if (result instanceof ArrayBuffer) {
          saveArrayBuffer(result, 'gemini-scene.glb');
        }
      },
      (error) => {
        console.error('An error occurred during GLTF export:', error);
      },
      { binary: true }
    );
  };
  
  useImperativeHandle(ref, () => ({
    exportGLB,
  }));

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 50, position: [5, 5, 5] }}
      className="bg-gray-800"
    >
      <Suspense fallback={null}>
        <Stage environment="city" intensity={0.6} shadows={{ type: 'contact', opacity: 0.5, blur: 2 }}>
          <group ref={sceneContentRef} onPointerMissed={() => setSelectedObjectId(null, false)}>
            {sceneGraph.map((obj) => (
              <MeshComponent
                key={obj.id}
                object={obj}
                isSelected={selectedObjectIds.includes(obj.id)}
                onClick={(shiftKey) => setSelectedObjectId(obj.id, shiftKey)}
              />
            ))}
          </group>
        </Stage>
      </Suspense>
      <OrbitControls makeDefault />
    </Canvas>
  );
});

export default Viewer;