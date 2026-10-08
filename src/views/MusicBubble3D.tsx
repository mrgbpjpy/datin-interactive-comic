import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const SYMBOLS = [
  'BOOM',
  'BAP',
  'BARS',
  '♩',
  '♪',
  '♫',
  '♬',
  '🎵',
  '🎶',
];

const COUNT = 12;

type Particle = {
  text: string;
  x: number;
  y: number;
  speed: number;
  opacity: number;
  size: number;
};

function randomParticle(startRandom = true): Particle {
  return {
    text: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    x: startRandom ? -1.5 + Math.random() * 2.5 : -1.5,
    y: (Math.random() - 0.5) * 0.8,
    speed: 0.3 + Math.random() * 0.4,
    opacity: 1,
    size: 0.14 + Math.random() * 0.08,
  };
}

function FloatingSymbol({
  particle,
}: {
  particle: Particle;
}) {
  const textRef = useRef<any>(null);

  useFrame((_, delta) => {
    particle.x += particle.speed * delta;

    // Fade before reaching the bubble edge.
    particle.opacity = THREE.MathUtils.clamp(
      (1.25 - particle.x) / 0.45,
      0,
      1,
    );

    if (particle.x > 1.25) {
      Object.assign(particle, randomParticle(false));
    }

    if (textRef.current) {
      textRef.current.position.x = particle.x;
      textRef.current.position.y = particle.y;

      const material = textRef.current.material;

      if (material) {
        material.opacity = particle.opacity;
      }
    }
  });

  return (
    <Text
      ref={textRef}
      position={[particle.x, particle.y, 0.03]}
      fontSize={particle.size}
      color="#111111"
      anchorX="center"
      anchorY="middle"
      material-transparent
      material-depthWrite={false}
    >
      {particle.text}
    </Text>
  );
}

export function MusicBubble3D() {
  const { camera } = useThree();

  const particles = useMemo(
    () => Array.from({ length: COUNT }, () => randomParticle()),
    [],
  );

  return (
    <group
      position={[0.8, 0.6, -3]}
      quaternion={camera.quaternion}
    >
      {/* White speech bubble */}
      <mesh>
        <planeGeometry args={[3.2, 1.4]} />
        <meshBasicMaterial
          color="white"
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Bubble border */}
      <lineSegments position={[0, 0, 0.01]}>
        <edgesGeometry
          args={[new THREE.PlaneGeometry(3.2, 1.4)]}
        />
        <lineBasicMaterial color="black" />
      </lineSegments>

      {/* Animated musical words and symbols */}
      {particles.map((particle, index) => (
        <FloatingSymbol
          key={index}
          particle={particle}
        />
      ))}
    </group>
  );
}