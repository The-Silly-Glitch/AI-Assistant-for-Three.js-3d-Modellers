
export type Vector3 = [number, number, number];

export enum GeometryType {
  Box = 'box',
  Sphere = 'sphere',
  Plane = 'plane',
  Cylinder = 'cylinder',
  Cone = 'cone',
  Torus = 'torus',
}

export interface SceneObject {
  id: string;
  type: 'mesh';
  geometry: {
    type: GeometryType;
    args: number[];
  };
  material: {
    color: string;
    metalness?: number;
    roughness?: number;
    map?: string; // ADDED: To store the texture data URL
  };
  position: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
}

export type SceneGraph = SceneObject[];