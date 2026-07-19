'use client';

import { Suspense } from 'react';

import { Canvas } from '@react-three/fiber';
import { ContactShadows, Float, OrbitControls } from '@react-three/drei';

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

/**
 * How lively the idle motion + auto-spin feel, driven by the pet's mood.
 * A happy/excited pet bobs and turns a little faster; a tired one barely stirs.
 */
const MOOD_MOTION: Record<
  PetMood,
  { autoRotateSpeed: number; floatSpeed: number; floatIntensity: number }
> = {
  excited: { autoRotateSpeed: 1.4, floatSpeed: 2.2, floatIntensity: 1.1 },
  happy: { autoRotateSpeed: 0.8, floatSpeed: 1.6, floatIntensity: 0.8 },
  sad: { autoRotateSpeed: 0.4, floatSpeed: 1.1, floatIntensity: 0.5 },
  tired: { autoRotateSpeed: 0.25, floatSpeed: 0.8, floatIntensity: 0.4 },
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
      {/* Soft blob shadow so the pet reads as grounded, not floating in space. */}
      <ContactShadows
        position={[0, -1.74, 0]}
        scale={6}
        opacity={0.32}
        blur={2.6}
        far={3.5}
        resolution={512}
        color="#5b3b7a"
      />
    </>
  );
}

function PetSceneCanvas({
  stage,
  mood,
}: Pick<PetSceneProps, 'stage' | 'mood'>) {
  const motion = MOOD_MOTION[mood];

  return (
    <Canvas
      camera={{ position: [0, 1.2, 5.6], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      {/* No solid background color: the canvas stays transparent so the
          gradient backdrop rendered by <PetScene> shows through. */}
      <fog attach="fog" args={['#f7fbff', 8, 12]} />
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
          <Float
            speed={motion.floatSpeed}
            rotationIntensity={0.25}
            floatIntensity={motion.floatIntensity}
            floatingRange={[-0.06, 0.06]}
          >
            <PetModel stage={stage} />
          </Float>
        </group>
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        minDistance={4.2}
        maxDistance={8}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.56}
        autoRotate
        autoRotateSpeed={motion.autoRotateSpeed}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.25, 0]}
      />
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
        cursor: 'grab',
      }}
    >
      <PetSceneCanvas stage={stage} mood={mood} />
    </div>
  );
}
