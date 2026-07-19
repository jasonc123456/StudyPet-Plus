'use client';

import { useMemo } from 'react';

import { Center, useGLTF } from '@react-three/drei';
import type { Group } from 'three';

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
  const gltf = useGLTF(path);
  const scene = useMemo(() => gltf.scene.clone(true) as Group, [gltf.scene]);

  return (
    <Center>
      <primitive object={scene} scale={STAGE_MODEL_SCALE[stage]} />
    </Center>
  );
}

useGLTF.preload('/models/egg.glb');
useGLTF.preload('/models/hatchling.glb');
useGLTF.preload('/models/baby.glb');
useGLTF.preload('/models/toddler.glb');
useGLTF.preload('/models/teen.glb');
useGLTF.preload('/models/adult.glb');
useGLTF.preload('/models/beast.glb');
