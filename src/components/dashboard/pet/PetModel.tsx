'use client';

import { useEffect, useState } from 'react';

import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Box3,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  Vector3,
} from 'three';

import type { PetStage } from '@/lib/pet-progress';

type PetModelProps = {
  stage: PetStage;
};

const STAGE_MODEL_PATHS: Record<PetStage, string> = {
  egg: '/models/egg.glb',
  hatchling: '/models/hatchling.glb',
  baby: '/models/baby.glb',
  toddler: '/models/toddler.glb',
  teen: '/models/teen.glb',
  adult: '/models/adult.glb',
  beast: '/models/beast.glb',
};

const STAGE_MODEL_SCALE: Record<PetStage, number> = {
  egg: 1.26,
  hatchling: 1.2,
  baby: 1.16,
  toddler: 1.08,
  teen: 1.02,
  adult: 0.98,
  beast: 0.94,
};

export function PetModel({ stage }: PetModelProps) {
  const path = STAGE_MODEL_PATHS[stage];
  const [centeredScene, setCenteredScene] = useState<{
    object: Group;
    height: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    // Models are meshopt-compressed (EXT_meshopt_compression).
    loader.setMeshoptDecoder(MeshoptDecoder);

    setCenteredScene(null);

    loader.load(path, (gltf) => {
      if (!active) return;

      const clone = gltf.scene.clone(true) as Group;
      const box = new Box3().setFromObject(clone);
      const center = new Vector3();
      const size = new Vector3();

      box.getCenter(center);
      box.getSize(size);

      clone.position.set(-center.x, -box.min.y, -center.z);

      setCenteredScene({
        object: clone,
        height: size.y || 1,
      });
    });

    return () => {
      active = false;
      setCenteredScene((current) => {
        if (current?.object) {
          disposeObject3D(current.object);
        }

        return null;
      });
    };
  }, [path]);

  if (!centeredScene) return null;

  return (
    <group
      position={[0, -centeredScene.height * 0.08, 0]}
      scale={STAGE_MODEL_SCALE[stage]}
    >
      <primitive object={centeredScene.object} />
    </group>
  );
}

function disposeObject3D(root: Object3D) {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if ('geometry' in mesh && mesh.geometry) {
      (mesh.geometry as BufferGeometry).dispose();
    }

    if ('material' in mesh && mesh.material) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((material) => {
        disposeMaterial(material as Material & Record<string, unknown>);
      });
    }
  });
}

function disposeMaterial(material: Material & Record<string, unknown>) {
  const textureKeys = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'emissiveMap'];

  textureKeys.forEach((key) => {
    const value = material[key];
    if (value && typeof value === 'object' && 'dispose' in value) {
      (value as { dispose: () => void }).dispose();
    }
  });

  material.dispose();
}
