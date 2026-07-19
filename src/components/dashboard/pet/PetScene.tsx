'use client';

import { Suspense } from 'react';

import { Canvas } from '@react-three/fiber';

import { PetModel } from '@/components/dashboard/pet/PetModel';
import type { PetMood } from '@/hooks/usePetProgress';
import type { PetStage } from '@/lib/pet-progress';

type PetSceneProps = {
  stage: PetStage;
  mood: PetMood;
  xpProgress?: number;
  xpBurstKey?: number;
  className?: string;
};

function SceneLights() {
  return (
    <>
      <ambientLight intensity={1} color="#fff8fe" />
      <directionalLight position={[5, 7, 6]} intensity={1.2} color="#ffffff" />
      <directionalLight
        position={[-3, 4, 3]}
        intensity={0.45}
        color="#d8f3ff"
      />
    </>
  );
}

function SceneGround() {
  return (
    <>
      <mesh position={[0, -1.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.4, 80]} />
        <meshStandardMaterial
          color="#fef7ff"
          emissive="#fde7ff"
          emissiveIntensity={0.18}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, -1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.9, 80]} />
        <meshStandardMaterial
          color="#d9c0ff"
          emissive="#d8f7ff"
          emissiveIntensity={0.35}
          transparent
          opacity={0.18}
          roughness={0.4}
        />
      </mesh>
    </>
  );
}

function PetSceneCanvas({ stage }: Pick<PetSceneProps, 'stage'>) {
  return (
    <Canvas
      camera={{ position: [0, 1.2, 5.6], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#f7fbff', 7, 11]} />
      <Suspense fallback={null}>
        <SceneLights />
        <group
          position={[
            0,
            stage === 'adult' || stage === 'beast' ? -1.05 : -0.7,
            0,
          ]}
          rotation={[0.08, -0.3, 0]}
        >
          <SceneGround />
          <PetModel stage={stage} />
        </group>
      </Suspense>
    </Canvas>
  );
}

export function PetScene({
  className,
  stage,
  mood,
  xpProgress: _xpProgress,
  xpBurstKey: _xpBurstKey = 0,
}: PetSceneProps) {
  return (
    <div
      className={className}
      data-mood={mood}
      style={{
        background:
          'radial-gradient(circle at 50% 24%, rgba(255,255,255,0.96), rgba(252,240,252,0.9) 34%, rgba(233,247,255,0.88) 70%, rgba(236,239,248,0.94) 100%)',
      }}
    >
      <PetSceneCanvas stage={stage} />
    </div>
  );
}
