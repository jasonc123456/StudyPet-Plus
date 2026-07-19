'use client';

import { useMemo } from 'react';

import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Box3, Group, Vector3 } from 'three';

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
  // Models are meshopt-compressed (EXT_meshopt_compression) to keep the
  // per-load download tiny — the decoder must be registered or they won't parse.
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  const scene = useMemo(() => gltf.scene.clone(true) as Group, [gltf.scene]);
  const centeredScene = useMemo(() => {
    const clone = scene.clone(true) as Group;
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    const size = new Vector3();

    box.getCenter(center);
    box.getSize(size);

    clone.position.set(-center.x, -box.min.y, -center.z);

    return {
      object: clone,
      height: size.y || 1,
    };
  }, [scene]);

  return (
    <group
      position={[0, -centeredScene.height * 0.08, 0]}
      scale={STAGE_MODEL_SCALE[stage]}
    >
      <primitive object={centeredScene.object} />
    </group>
  );
}
