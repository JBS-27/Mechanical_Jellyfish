/* eslint-disable react/immutability -- R3F animation intentionally mutates Three.js objects in useFrame. */
import {
  Edges,
  Environment,
  Lightformer,
  Line,
  OrbitControls,
  Sparkles,
} from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'
import { PARTS, PART_ANCHORS, THEMES, VIEWS } from './data'

const UP = new THREE.Vector3(0, 1, 0)
const TEMP_A = new THREE.Vector3()
const TEMP_B = new THREE.Vector3()
const TEMP_C = new THREE.Vector3()
const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.015)

const clamp = THREE.MathUtils.clamp
const damp = THREE.MathUtils.damp

function smoothstep(min, max, value) {
  const x = clamp((value - min) / Math.max(0.0001, max - min), 0, 1)
  return x * x * (3 - 2 * x)
}

function ThemedMaterial({
  theme,
  mode,
  kind = 'porcelain',
  hoveredPart,
  partId,
  opacity = 1,
  emissiveBoost = 0,
  signalRef,
  side = THREE.FrontSide,
  depthWrite,
  ...props
}) {
  const material = useRef()
  const targetColor = useMemo(() => new THREE.Color(), [])
  const targetEmissive = useMemo(() => new THREE.Color(), [])
  const inkColor = useMemo(() => new THREE.Color(), [])

  const styles = {
    porcelain: {
      color: theme.porcelain,
      emissive: theme.porcelain,
      emissiveIntensity: 0.015,
      roughness: theme.id === 'obsidian' ? 0.16 : 0.22,
      metalness: theme.id === 'obsidian' ? 0.12 : 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transmission: theme.id === 'obsidian' ? 0.08 : 0.16,
      thickness: 0.35,
      ior: 1.48,
    },
    glass: {
      color: theme.glass,
      emissive: theme.glassEdge,
      emissiveIntensity: 0.03,
      roughness: 0.16,
      metalness: 0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      transmission: 0.82,
      thickness: 0.55,
      ior: 1.44,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [120, 420],
    },
    membrane: {
      color: theme.glass,
      emissive: theme.glassEdge,
      emissiveIntensity: 0.045,
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.7,
      clearcoatRoughness: 0.14,
      transmission: 0.72,
      thickness: 0.22,
      ior: 1.38,
      iridescence: 1,
      iridescenceIOR: 1.5,
      iridescenceThicknessRange: [100, 520],
    },
    metal: {
      color: theme.metal,
      emissive: theme.metalDark,
      emissiveIntensity: 0.015,
      roughness: 0.2,
      metalness: 0.96,
      clearcoat: 0.35,
      clearcoatRoughness: 0.12,
      transmission: 0,
      thickness: 0,
    },
    platinum: {
      color: theme.id === 'obsidian' ? '#aaa49b' : '#d8d3c8',
      emissive: theme.nerve,
      emissiveIntensity: 0.03,
      roughness: 0.17,
      metalness: 1,
      clearcoat: 0.42,
      clearcoatRoughness: 0.1,
      transmission: 0,
      thickness: 0,
    },
    core: {
      color: theme.core,
      emissive: theme.core,
      emissiveIntensity: 1.55,
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.2,
      transmission: 0.68,
      thickness: 1.8,
      ior: 1.34,
      attenuationColor: theme.core,
      attenuationDistance: 1.1,
    },
    jewel: {
      color: theme.jewel,
      emissive: theme.core,
      emissiveIntensity: 0.85,
      roughness: 0.08,
      metalness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      transmission: 0.5,
      thickness: 0.5,
      ior: 1.7,
    },
    ink: {
      color: theme.ink,
      emissive: theme.ink,
      emissiveIntensity: 0.02,
      roughness: 0.95,
      metalness: 0,
      clearcoat: 0,
      transmission: 0,
      thickness: 0,
    },
  }

  useFrame((_, delta) => {
    if (!material.current) return
    const source = styles[kind] || styles.porcelain
    const schematic = mode === 'SCHEMATIC'
    const dimmed = hoveredPart && hoveredPart !== partId
    const highlighted = hoveredPart === partId
    const rate = 1 - Math.exp(-delta * 5.8)

    targetColor.set(schematic ? theme.paper : source.color)
    if (schematic && kind !== 'ink') {
      inkColor.set(theme.ink)
      targetColor.lerp(inkColor, kind === 'metal' ? 0.18 : 0.04)
    }
    material.current.color.lerp(targetColor, rate)

    targetEmissive.set(schematic ? theme.ink : source.emissive)
    material.current.emissive.lerp(targetEmissive, rate)
    material.current.emissiveIntensity = damp(
      material.current.emissiveIntensity,
      schematic
        ? 0.015
        : source.emissiveIntensity +
            emissiveBoost +
            (signalRef?.current?.signal || 0) * 1.1 +
            (highlighted ? 0.14 : 0),
      6,
      delta,
    )
    material.current.metalness = damp(material.current.metalness, schematic ? 0 : source.metalness, 5, delta)
    material.current.roughness = damp(material.current.roughness, schematic ? 0.82 : source.roughness, 5, delta)
    material.current.transmission = damp(
      material.current.transmission,
      schematic ? 0 : source.transmission || 0,
      5,
      delta,
    )
    material.current.opacity = damp(material.current.opacity, opacity * (dimmed ? 0.24 : 1), 8, delta)
    material.current.clearcoat = damp(material.current.clearcoat, schematic ? 0 : source.clearcoat || 0, 5, delta)
  })

  const initial = styles[kind] || styles.porcelain
  const isTransparent = opacity < 1 || initial.transmission > 0

  return (
    <meshPhysicalMaterial
      ref={material}
      color={initial.color}
      emissive={initial.emissive}
      emissiveIntensity={initial.emissiveIntensity}
      roughness={initial.roughness}
      metalness={initial.metalness}
      clearcoat={initial.clearcoat}
      clearcoatRoughness={initial.clearcoatRoughness}
      transmission={initial.transmission || 0}
      thickness={initial.thickness || 0}
      ior={initial.ior || 1.45}
      attenuationColor={initial.attenuationColor}
      attenuationDistance={initial.attenuationDistance}
      iridescence={initial.iridescence || 0}
      iridescenceIOR={initial.iridescenceIOR}
      iridescenceThicknessRange={initial.iridescenceThicknessRange}
      transparent={isTransparent}
      opacity={opacity}
      side={side}
      depthWrite={depthWrite ?? !isTransparent}
      clippingPlanes={mode === 'SECTION' ? [SECTION_PLANE] : []}
      clipShadows
      {...props}
    />
  )
}

const ExplodedPart = forwardRef(function ExplodedPart(
  {
    id,
    axis = [0, 1, 0],
    distance = 1,
    order = 0,
    explode,
    intro,
    setHoveredPart,
    setSelectedPart,
    children,
    basePosition = [0, 0, 0],
    rotation = [0, 0, 0],
  },
  forwardedRef,
) {
  const group = useRef()
  const axisVector = useMemo(() => new THREE.Vector3(...axis).normalize(), [axis])
  const base = useMemo(() => new THREE.Vector3(...basePosition), [basePosition])
  useImperativeHandle(forwardedRef, () => group.current)

  useFrame((_, delta) => {
    if (!group.current) return
    const explodeProgress = smoothstep(order, Math.min(1, order + 0.32), explode)
    const assembleStart = (1 - order) * 0.48
    const assembleProgress = smoothstep(assembleStart, assembleStart + 0.28, intro)
    const introSeparation = 1 - assembleProgress
    const separation = Math.max(explodeProgress, introSeparation)
    TEMP_A.copy(base).addScaledVector(axisVector, distance * separation)
    group.current.position.lerp(TEMP_A, 1 - Math.exp(-delta * 8.5))
    group.current.rotation.x = damp(group.current.rotation.x, rotation[0] + separation * axisVector.z * 0.22, 8, delta)
    group.current.rotation.y = damp(group.current.rotation.y, rotation[1] + separation * axisVector.y * 0.14, 8, delta)
    group.current.rotation.z = damp(group.current.rotation.z, rotation[2] - separation * axisVector.x * 0.22, 8, delta)
  })

  return (
    <group
      ref={group}
      position={basePosition}
      rotation={rotation}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHoveredPart(id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        setHoveredPart((current) => (current === id ? null : current))
        document.body.style.cursor = 'default'
      }}
      onClick={(event) => {
        event.stopPropagation()
        setSelectedPart(id)
      }}
      userData={{ partId: id }}
    >
      {children}
    </group>
  )
})

function BellRivets({ theme, mode, hoveredPart }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 48

  useLayoutEffect(() => {
    if (!mesh.current) return
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      dummy.position.set(Math.cos(angle) * 2.52, 0.025, Math.sin(angle) * 2.52)
      dummy.scale.setScalar(index % 6 === 0 ? 1.25 : 0.8)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <instancedMesh ref={mesh} args={[null, null, count]} castShadow>
      <sphereGeometry args={[0.035, 8, 6]} />
      <ThemedMaterial
        theme={theme}
        mode={mode}
        kind="metal"
        partId="exumbrella"
        hoveredPart={hoveredPart}
      />
    </instancedMesh>
  )
}

function SurfaceSetae({ theme, mode, hoveredPart }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 32

  useLayoutEffect(() => {
    if (!mesh.current) return
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.05
      const radius = 0.85 + (index % 5) * 0.34
      const domeY = Math.sqrt(Math.max(0, 1 - (radius * radius) / (2.75 * 2.75))) * 1.35
      dummy.position.set(Math.cos(angle) * radius, domeY, Math.sin(angle) * radius)
      dummy.rotation.set((Math.sin(angle) * Math.PI) / 10, angle, (-Math.cos(angle) * Math.PI) / 10)
      dummy.scale.set(0.5, 0.7 + (index % 4) * 0.12, 0.5)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <cylinderGeometry args={[0.006, 0.012, 0.24, 5]} />
      <ThemedMaterial
        theme={theme}
        mode={mode}
        kind="metal"
        opacity={0.82}
        partId="exumbrella"
        hoveredPart={hoveredPart}
      />
    </instancedMesh>
  )
}

function DelftFlorals({ theme, mode, hoveredPart }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 32

  useLayoutEffect(() => {
    if (!mesh.current) return
    let instance = 0
    for (let ray = 0; ray < 8; ray += 1) {
      const angle = (ray / 8) * Math.PI * 2
      for (let petal = 0; petal < 4; petal += 1) {
        const radius = 0.72 + petal * 0.42
        const y = Math.sqrt(Math.max(0, 1 - (radius * radius) / (2.75 * 2.75))) * 1.51
        dummy.position.set(Math.cos(angle) * radius, y + 0.012, Math.sin(angle) * radius)
        dummy.lookAt(Math.cos(angle) * radius * 2, y * 2.2, Math.sin(angle) * radius * 2)
        dummy.rotateZ((petal % 2 ? -1 : 1) * 0.48)
        dummy.scale.set(0.16 + petal * 0.012, 0.052, 1)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(instance, dummy.matrix)
        instance += 1
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <circleGeometry args={[1, 12]} />
      <ThemedMaterial
        theme={theme}
        mode={mode}
        kind="ink"
        opacity={theme.id === 'delft' ? 0.78 : theme.id === 'codex' ? 0.12 : 0.025}
        side={THREE.DoubleSide}
        depthWrite={false}
        partId="exumbrella"
        hoveredPart={hoveredPart}
      />
    </instancedMesh>
  )
}

function Exumbrella({ theme, mode, hoveredPart, pulseRef }) {
  const plateRefs = useRef([])
  const arc = (Math.PI * 2) / 8

  useFrame((_, delta) => {
    plateRefs.current.forEach((plate, index) => {
      if (!plate) return
      const contraction = pulseRef.current.contraction || 0
      const independent = Math.sin((pulseRef.current.time || 0) * (1.1 + index * 0.025) + index * 0.9) * 0.006
      plate.rotation.y = damp(plate.rotation.y, independent + contraction * 0.004 * (index % 2 ? 1 : -1), 5, delta)
    })
  })

  return (
    <group>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            plateRefs.current[index] = node
          }}
          castShadow
          receiveShadow
          scale={[1, 0.54, 1]}
          rotation={[0, 0, 0]}
        >
          <sphereGeometry
            args={[
              2.75,
              24,
              12,
              index * arc + 0.016,
              arc - 0.032,
              0.07,
              Math.PI / 2.03,
            ]}
          />
          <ThemedMaterial
            theme={theme}
            mode={mode}
            kind="porcelain"
            opacity={0.88}
            side={THREE.DoubleSide}
            depthWrite={false}
            partId="exumbrella"
            hoveredPart={hoveredPart}
          />
          <Edges
            threshold={24}
            color={mode === 'SCHEMATIC' ? theme.ink : theme.porcelainEdge}
            opacity={mode === 'SCHEMATIC' ? 0.68 : 0.13}
            transparent
          />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <torusGeometry args={[2.5, 0.018, 5, 128]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          opacity={0.72}
          partId="exumbrella"
          hoveredPart={hoveredPart}
        />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2
        return (
          <mesh
            key={`rib-${index}`}
            position={[Math.cos(angle) * 1.35, 0.56, Math.sin(angle) * 1.35]}
            rotation={[0, -angle, Math.PI / 2 - 0.12]}
          >
            <torusGeometry args={[1.25, 0.013, 5, 36, 1.16]} />
            <ThemedMaterial
              theme={theme}
              mode={mode}
              kind={theme.id === 'delft' ? 'ink' : 'metal'}
              opacity={theme.id === 'delft' ? 0.7 : 0.25}
              partId="exumbrella"
              hoveredPart={hoveredPart}
            />
          </mesh>
        )
      })}
      <BellRivets theme={theme} mode={mode} hoveredPart={hoveredPart} />
      <SurfaceSetae theme={theme} mode={mode} hoveredPart={hoveredPart} />
      <DelftFlorals theme={theme} mode={mode} hoveredPart={hoveredPart} />
    </group>
  )
}

function Mesoglea({ theme, mode, hoveredPart, pulseRef }) {
  const core = useRef()
  useFrame((_, delta) => {
    if (!core.current) return
    const recoil = pulseRef.current.recoil || 0
    const breath = Math.sin((pulseRef.current.time || 0) * 0.55) * 0.008
    const target = 1 + recoil * 0.045 + breath
    core.current.scale.x = damp(core.current.scale.x, target, 4, delta)
    core.current.scale.z = damp(core.current.scale.z, target, 4, delta)
    core.current.scale.y = damp(core.current.scale.y, 0.48 - recoil * 0.02, 4, delta)
  })

  return (
    <group>
      <mesh ref={core} scale={[1, 0.48, 1]} position={[0, 0.12, 0]}>
        <sphereGeometry args={[2.35, 48, 18, 0, Math.PI * 2, 0.02, Math.PI / 2.02]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="core"
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
          partId="mesoglea"
          hoveredPart={hoveredPart}
        />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2
        const radius = index % 2 ? 1.58 : 1.1
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * radius,
              0.44 + (index % 2 ? 0.15 : 0.27),
              Math.sin(angle) * radius,
            ]}
            rotation={[Math.PI / 2, 0, -angle]}
            scale={[1, 1, 0.7]}
          >
            <torusGeometry args={[0.19, 0.014, 5, 6]} />
            <ThemedMaterial
              theme={theme}
              mode={mode}
              kind="metal"
              opacity={0.58}
              partId="mesoglea"
              hoveredPart={hoveredPart}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function Subumbrella({ theme, mode, hoveredPart, pulseRef }) {
  const springs = useRef()
  const pivots = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (springs.current) springs.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (!pivots.current) return
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2
      dummy.position.set(
        Math.cos(angle) * 2.05 + Math.sin(angle) * -0.2,
        0.02,
        Math.sin(angle) * 2.05 + Math.cos(angle) * -0.2,
      )
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      pivots.current.setMatrixAt(index, dummy.matrix)
    }
    pivots.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  useFrame(() => {
    if (!springs.current) return
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2
      const contraction = pulseRef.current.contraction || 0
      const left = Math.sin(angle) > 0
      const asymmetry = left ? pulseRef.current.left : pulseRef.current.right
      dummy.position.set(Math.cos(angle) * 2.05, -0.025, Math.sin(angle) * 2.05)
      dummy.rotation.set(
        0,
        -angle + Math.sin((pulseRef.current.time || 0) + index) * 0.003,
        index % 2 ? 0.13 : -0.13,
      )
      dummy.scale.set(1, 1, 1 - contraction * 0.19 * asymmetry)
      dummy.updateMatrix()
      springs.current.setMatrixAt(index, dummy.matrix)
    }
    springs.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={[0, -0.08, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.08, 0.115, 12, 96]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          opacity={0.9}
          partId="subumbrella"
          hoveredPart={hoveredPart}
        />
      </mesh>
      <instancedMesh ref={springs} args={[null, null, 16]} castShadow>
        <boxGeometry args={[0.075, 0.06, 0.43]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="subumbrella"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh ref={pivots} args={[null, null, 16]}>
        <sphereGeometry args={[0.043, 8, 6]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          partId="subumbrella"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
    </group>
  )
}

function Gear({
  theme,
  mode,
  hoveredPart,
  radius,
  teeth,
  ratio,
  direction,
  position,
  phase = 0,
  pulseRef,
}) {
  const group = useRef()
  const teethMesh = useRef()
  const angularVelocity = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!teethMesh.current) return
    for (let index = 0; index < teeth; index += 1) {
      const angle = (index / teeth) * Math.PI * 2
      dummy.position.set(Math.cos(angle) * (radius + 0.055), 0, Math.sin(angle) * (radius + 0.055))
      dummy.rotation.set(0, -angle, 0)
      dummy.updateMatrix()
      teethMesh.current.setMatrixAt(index, dummy.matrix)
    }
    teethMesh.current.instanceMatrix.needsUpdate = true
  }, [dummy, radius, teeth])

  useFrame((_, delta) => {
    if (!group.current) return
    const drive = pulseRef.current.motor || 0
    angularVelocity.current = damp(
      angularVelocity.current,
      drive > 0.01 ? 0.35 + drive * 3.45 : 0,
      drive > 0.01 ? 4 : 1.8,
      delta,
    )
    group.current.rotation.y +=
      delta * (pulseRef.current.timeScale ?? 1) * angularVelocity.current * ratio * direction
    group.current.position.y = position[1] + Math.sin((pulseRef.current.time || 0) * 2 + ratio) * 0.003
  })

  return (
    <group ref={group} position={position} rotation={[0, phase, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, 0.095, Math.max(24, teeth * 2)]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="pulseMotor"
          hoveredPart={hoveredPart}
        />
        <Edges color={theme.metalDark} opacity={0.48} transparent />
      </mesh>
      <instancedMesh ref={teethMesh} args={[null, null, teeth]} castShadow>
        <boxGeometry args={[0.12, 0.105, 0.095]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="pulseMotor"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[radius * 0.23, radius * 0.23, 0.13, 18]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          partId="pulseMotor"
          hoveredPart={hoveredPart}
        />
      </mesh>
      {Array.from({ length: Math.max(3, Math.round(teeth / 6)) }, (_, index) => {
        const angle = (index / Math.max(3, Math.round(teeth / 6))) * Math.PI * 2
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius * 0.58, 0.056, Math.sin(angle) * radius * 0.58]}
          >
            <cylinderGeometry args={[0.035, 0.035, 0.125, 10]} />
            <ThemedMaterial
              theme={theme}
              mode={mode}
              kind="platinum"
              partId="pulseMotor"
              hoveredPart={hoveredPart}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function PulseMotor({ theme, mode, hoveredPart, pulseRef }) {
  return (
    <group position={[0, -0.2, 0]}>
      <Gear
        theme={theme}
        mode={mode}
        hoveredPart={hoveredPart}
        radius={0.43}
        teeth={18}
        ratio={1}
        direction={1}
        position={[0, 0, 0]}
        pulseRef={pulseRef}
      />
      {Array.from({ length: 4 }, (_, index) => {
        const angle = (index / 4) * Math.PI * 2
        return (
          <Gear
            key={index}
            theme={theme}
            mode={mode}
            hoveredPart={hoveredPart}
            radius={0.26}
            teeth={12}
            ratio={1.5}
            direction={-1}
            position={[Math.cos(angle) * 0.69, 0.015, Math.sin(angle) * 0.69]}
            phase={angle * 1.5 + Math.PI / 12}
            pulseRef={pulseRef}
          />
        )
      })}
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2
        return (
          <mesh
            key={`shaft-${index}`}
            position={[Math.cos(angle) * 1.22, 0.02, Math.sin(angle) * 1.22]}
            rotation={[0, -angle, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.025, 0.025, 1.25, 8]} />
            <ThemedMaterial
              theme={theme}
              mode={mode}
              kind="platinum"
              partId="pulseMotor"
              hoveredPart={hoveredPart}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function Canal({ index, theme, mode, hoveredPart, pulseRef }) {
  const packet = useRef()
  const angle = (index / 8) * Math.PI * 2
  const curve = useMemo(() => {
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(angle) * 0.42, 0.04, Math.sin(angle) * 0.42),
      new THREE.Vector3(Math.cos(angle) * 1.1, 0.13, Math.sin(angle) * 1.1).addScaledVector(tangent, 0.1),
      new THREE.Vector3(Math.cos(angle) * 1.75, 0.08, Math.sin(angle) * 1.75).addScaledVector(tangent, -0.08),
      new THREE.Vector3(Math.cos(angle) * 2.42, -0.02, Math.sin(angle) * 2.42),
    ])
  }, [angle])

  useFrame(() => {
    if (!packet.current) return
    const phase = ((pulseRef.current.time || 0) * 0.17 + index * 0.067 + pulseRef.current.phase * 0.2) % 1
    packet.current.position.copy(curve.getPointAt(phase))
    const glow = 0.75 + (pulseRef.current.contraction || 0) * 0.8
    packet.current.scale.setScalar(glow)
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 24, 0.024, 7, false]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="glass"
          opacity={0.58}
          partId="canals"
          hoveredPart={hoveredPart}
        />
      </mesh>
      <mesh ref={packet}>
        <sphereGeometry args={[0.055, 12, 8]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="core"
          opacity={0.9}
          emissiveBoost={0.8}
          partId="canals"
          hoveredPart={hoveredPart}
        />
      </mesh>
    </group>
  )
}

function CanalNetwork({ theme, mode, hoveredPart, pulseRef }) {
  return (
    <group>
      {Array.from({ length: 8 }, (_, index) => (
        <Canal
          key={index}
          index={index}
          theme={theme}
          mode={mode}
          hoveredPart={hoveredPart}
          pulseRef={pulseRef}
        />
      ))}
    </group>
  )
}

function NerveRing({ theme, mode, hoveredPart, pulseRef }) {
  const nodes = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!nodes.current) return
    for (let index = 0; index < 32; index += 1) {
      const angle = (index / 32) * Math.PI * 2
      dummy.position.set(Math.cos(angle) * 2.59, 0.012, Math.sin(angle) * 2.59)
      dummy.scale.setScalar(index % 4 === 0 ? 1.9 : 1)
      dummy.updateMatrix()
      nodes.current.setMatrixAt(index, dummy.matrix)
    }
    nodes.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <group position={[0, -0.035, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.59, 0.024, 7, 128]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          opacity={0.88}
          emissiveBoost={0.15}
          signalRef={pulseRef}
          partId="nerveRing"
          hoveredPart={hoveredPart}
        />
      </mesh>
      <instancedMesh ref={nodes} args={[null, null, 32]}>
        <sphereGeometry args={[0.018, 7, 5]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          signalRef={pulseRef}
          partId="nerveRing"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
    </group>
  )
}

function Lappet({ index, theme, mode, hoveredPart, pulseRef }) {
  const group = useRef()
  const angle = (index / 8) * Math.PI * 2
  useFrame((_, delta) => {
    if (!group.current) return
    const contraction = pulseRef.current.contraction || 0
    const independent = Math.sin((pulseRef.current.time || 0) * (1.4 + index * 0.035) + index * 1.72) * 0.06
    group.current.rotation.z = damp(group.current.rotation.z, independent + contraction * 0.15, 6, delta)
    group.current.position.y = damp(group.current.position.y, -0.08 - contraction * 0.09 + independent * 0.08, 7, delta)
  })

  return (
    <group
      ref={group}
      position={[Math.cos(angle) * 2.58, -0.08, Math.sin(angle) * 2.58]}
      rotation={[0, -angle, 0]}
    >
      <mesh scale={[0.58, 0.16, 0.42]} castShadow>
        <sphereGeometry args={[1, 24, 12]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="porcelain"
          opacity={0.92}
          partId="lappets"
          hoveredPart={hoveredPart}
        />
        <Edges
          color={mode === 'SCHEMATIC' ? theme.ink : theme.metalDark}
          opacity={mode === 'SCHEMATIC' ? 0.7 : 0.18}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.04, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.105, 0.018, 6, 28]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="lappets"
          hoveredPart={hoveredPart}
        />
      </mesh>
    </group>
  )
}

function Lappets({ theme, mode, hoveredPart, pulseRef }) {
  return (
    <group>
      {Array.from({ length: 8 }, (_, index) => (
        <Lappet
          key={index}
          index={index}
          theme={theme}
          mode={mode}
          hoveredPart={hoveredPart}
          pulseRef={pulseRef}
        />
      ))}
    </group>
  )
}

function Rhopalia({ theme, mode, hoveredPart, pulseRef, pointerRef }) {
  const bezels = useRef()
  const jewels = useRef()
  const stems = useRef()
  const statoliths = useRef()
  const bezelDummy = useMemo(() => new THREE.Object3D(), [])
  const jewelDummy = useMemo(() => new THREE.Object3D(), [])
  const stemDummy = useMemo(() => new THREE.Object3D(), [])
  const statolithDummy = useMemo(() => new THREE.Object3D(), [])
  const work = useMemo(
    () => ({
      basePosition: new THREE.Vector3(),
      localPosition: new THREE.Vector3(),
      baseQuaternion: new THREE.Quaternion(),
      localQuaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
    }),
    [],
  )
  const count = 8

  useEffect(() => {
    for (const mesh of [bezels.current, jewels.current, stems.current, statoliths.current]) {
      if (mesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    }
  }, [])

  useFrame(() => {
    if (!bezels.current || !jewels.current || !stems.current || !statoliths.current) return
    const time = pulseRef.current.time || 0
    const bank = pulseRef.current.bank || 0
    const gazeX = pointerRef.current.x * 0.18
    const gazeY = pointerRef.current.y * 0.1

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      const stabilise = -bank * Math.cos(angle) * 0.42
      work.basePosition.set(Math.cos(angle) * 2.79, -0.18, Math.sin(angle) * 2.79)
      work.euler.set(0, -angle, stabilise)
      work.baseQuaternion.setFromEuler(work.euler)

      work.euler.set(Math.PI / 2, 0, 0)
      work.localQuaternion.setFromEuler(work.euler).premultiply(work.baseQuaternion)
      bezelDummy.position.copy(work.basePosition)
      bezelDummy.quaternion.copy(work.localQuaternion)
      bezelDummy.scale.set(1, 1, 0.82)
      bezelDummy.updateMatrix()
      bezels.current.setMatrixAt(index, bezelDummy.matrix)

      work.localPosition.set(0, 0, 0.015).applyQuaternion(work.baseQuaternion).add(work.basePosition)
      work.euler.set(gazeY + Math.sin(time * 0.7 + index) * 0.03, gazeX, 0)
      work.localQuaternion.setFromEuler(work.euler).premultiply(work.baseQuaternion)
      jewelDummy.position.copy(work.localPosition)
      jewelDummy.quaternion.copy(work.localQuaternion)
      jewelDummy.scale.set(0.88, 0.72, 0.52)
      jewelDummy.updateMatrix()
      jewels.current.setMatrixAt(index, jewelDummy.matrix)

      const pendulum = Math.sin(time * 0.56 + index * 0.83) * 0.06 - bank * 0.24
      work.euler.set(0, 0, pendulum)
      work.localQuaternion.setFromEuler(work.euler).premultiply(work.baseQuaternion)
      work.localPosition.set(0, -0.18, 0).applyQuaternion(work.baseQuaternion).add(work.basePosition)
      stemDummy.position.copy(work.localPosition)
      stemDummy.quaternion.copy(work.localQuaternion)
      stemDummy.scale.set(1, 1, 1)
      stemDummy.updateMatrix()
      stems.current.setMatrixAt(index, stemDummy.matrix)

      work.localPosition
        .set(Math.sin(pendulum) * 0.045, -0.31, 0)
        .applyQuaternion(work.baseQuaternion)
        .add(work.basePosition)
      statolithDummy.position.copy(work.localPosition)
      statolithDummy.quaternion.copy(work.localQuaternion)
      statolithDummy.scale.setScalar(1)
      statolithDummy.updateMatrix()
      statoliths.current.setMatrixAt(index, statolithDummy.matrix)
    }
    bezels.current.instanceMatrix.needsUpdate = true
    jewels.current.instanceMatrix.needsUpdate = true
    stems.current.instanceMatrix.needsUpdate = true
    statoliths.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={bezels} args={[null, null, count]} frustumCulled={false}>
        <torusGeometry args={[0.14, 0.04, 8, 30]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          partId="rhopalia"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh ref={jewels} args={[null, null, count]} frustumCulled={false}>
        <sphereGeometry args={[0.115, 20, 12]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="jewel"
          opacity={0.96}
          emissiveBoost={0.45}
          partId="rhopalia"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh ref={stems} args={[null, null, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.011, 0.011, 0.22, 7]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="platinum"
          partId="rhopalia"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh ref={statoliths} args={[null, null, count]} frustumCulled={false}>
        <sphereGeometry args={[0.052, 12, 8]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="rhopalia"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
    </group>
  )
}

function Manubrium({ theme, mode, hoveredPart, pulseRef, explode }) {
  const group = useRef()
  useFrame((_, delta) => {
    if (!group.current) return
    const lag = (pulseRef.current.contraction || 0) * 0.09
    group.current.rotation.x = damp(
      group.current.rotation.x,
      Math.sin((pulseRef.current.time || 0) * 0.8) * 0.025 - lag,
      4,
      delta,
    )
  })

  return (
    <group ref={group}>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.31, 0.23, 0.86 + explode * 0.42, 24, 1, true]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="glass"
          opacity={0.64}
          side={THREE.DoubleSide}
          partId="manubrium"
          hoveredPart={hoveredPart}
        />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh
          key={index}
          position={[0, -0.18 - index * (0.18 + explode * 0.06), 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.29 - index * 0.012, 0.026, 8, 32]} />
          <ThemedMaterial
            theme={theme}
            mode={mode}
            kind="metal"
            partId="manubrium"
            hoveredPart={hoveredPart}
          />
        </mesh>
      ))}
    </group>
  )
}

function Mouth({ theme, mode, hoveredPart, pulseRef }) {
  const leaves = useRef([])
  const gearDiscs = useRef()
  const gearTeeth = useRef()
  const discDummy = useMemo(() => new THREE.Object3D(), [])
  const toothDummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (gearDiscs.current) gearDiscs.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (gearTeeth.current) gearTeeth.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useFrame((_, delta) => {
    let toothInstance = 0
    leaves.current.forEach((leaf, index) => {
      if (!leaf) return
      const open = 0.08 + Math.max(0, Math.sin((pulseRef.current.time || 0) * 0.42 - 1.2)) * 0.16
      leaf.rotation.y = damp(leaf.rotation.y, index * (Math.PI / 2) + open, 4, delta)
      leaf.position.y = -1.12 - (pulseRef.current.contraction || 0) * 0.025

      if (gearDiscs.current && gearTeeth.current) {
        const baseAngle = index * (Math.PI / 2) + Math.PI / 4
        const spin = (pulseRef.current.time || 0) * 0.34 * (index % 2 ? -1 : 1)
        const centerX = Math.cos(baseAngle) * 0.142
        const centerZ = Math.sin(baseAngle) * 0.142
        discDummy.position.set(centerX, -1.055, centerZ)
        discDummy.rotation.set(0, spin, 0)
        discDummy.scale.setScalar(1)
        discDummy.updateMatrix()
        gearDiscs.current.setMatrixAt(index, discDummy.matrix)

        for (let tooth = 0; tooth < 10; tooth += 1) {
          const toothAngle = (tooth / 10) * Math.PI * 2 + spin
          toothDummy.position.set(
            centerX + Math.cos(toothAngle) * 0.103,
            -1.055,
            centerZ + Math.sin(toothAngle) * 0.103,
          )
          toothDummy.rotation.set(0, -toothAngle, 0)
          toothDummy.scale.setScalar(1)
          toothDummy.updateMatrix()
          gearTeeth.current.setMatrixAt(toothInstance, toothDummy.matrix)
          toothInstance += 1
        }
      }
    })
    if (gearDiscs.current) gearDiscs.current.instanceMatrix.needsUpdate = true
    if (gearTeeth.current) gearTeeth.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {Array.from({ length: 4 }, (_, index) => (
        <group
          key={index}
          ref={(node) => {
            leaves.current[index] = node
          }}
          rotation={[0, index * (Math.PI / 2), 0]}
          position={[0, -1.12, 0]}
        >
          <mesh position={[0.15, 0, 0]} rotation={[Math.PI / 2, 0, -0.38]} scale={[1, 0.72, 1]}>
            <circleGeometry args={[0.31, 24, 0, Math.PI]} />
            <ThemedMaterial
              theme={theme}
              mode={mode}
              kind="porcelain"
              side={THREE.DoubleSide}
              partId="mouth"
              hoveredPart={hoveredPart}
            />
            <Edges color={theme.metalDark} opacity={0.38} transparent />
          </mesh>
          <mesh position={[0.34, 0.02, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.07, 12]} />
            <ThemedMaterial
              theme={theme}
              mode={mode}
              kind="metal"
              partId="mouth"
              hoveredPart={hoveredPart}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.39, 0.04, 8, 48]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="mouth"
          hoveredPart={hoveredPart}
        />
      </mesh>
      <instancedMesh ref={gearDiscs} args={[null, null, 4]}>
        <cylinderGeometry args={[0.09, 0.09, 0.055, 20]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="mouth"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh ref={gearTeeth} args={[null, null, 40]}>
        <boxGeometry args={[0.032, 0.06, 0.025]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          partId="mouth"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
    </group>
  )
}

function OralArms({ theme, mode, hoveredPart, pulseRef, pointerRef, explode }) {
  const segments = useRef()
  const frills = useRef()
  const setae = useRef()
  const segmentDummy = useMemo(() => new THREE.Object3D(), [])
  const frillDummy = useMemo(() => new THREE.Object3D(), [])
  const setaDummy = useMemo(() => new THREE.Object3D(), [])
  const armCount = 4
  const segmentCount = 14
  const frillsPerArm = Math.ceil(segmentCount / 2)
  const armState = useRef(
    Array.from({ length: armCount * segmentCount }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      target: new THREE.Vector3(),
      force: new THREE.Vector3(),
      initialized: false,
    })),
  )

  useEffect(() => {
    if (segments.current) segments.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (frills.current) frills.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (setae.current) setae.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useFrame((_, deltaRaw) => {
    if (!segments.current || !frills.current || !setae.current) return
    const delta = Math.min(deltaRaw, 0.04) * (pulseRef.current.timeScale ?? 1)
    const time = pulseRef.current.time || 0
    const contraction = pulseRef.current.contraction || 0
    let segmentInstance = 0
    let frillInstance = 0
    let setaInstance = 0

    for (let arm = 0; arm < armCount; arm += 1) {
      const angle = arm * (Math.PI / 2) + Math.PI / 4
      const tangentX = -Math.sin(angle)
      const tangentZ = Math.cos(angle)
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const progress = segment / (segmentCount - 1)
        const lag = progress * 1.35
        const amplitude = 0.08 + progress * 0.24
        const wave = Math.sin(time * (0.72 + arm * 0.06) - lag * 2.4 + arm * 1.7) * amplitude
        const curl = Math.cos(time * 0.43 + segment * 0.44 + arm) * progress * 0.16
        const radial = 0.43 + progress * 0.62 + explode * progress * 0.34
        const gaze = pointerRef.current.x * progress * 0.08
        const physics = armState.current[segmentInstance]
        physics.target.set(
          Math.cos(angle) * radial + tangentX * (wave + gaze),
          -1.42 - segment * (0.235 + explode * 0.035) + contraction * progress * 0.18,
          Math.sin(angle) * radial + tangentZ * (wave + curl),
        )
        if (!physics.initialized) {
          physics.position.copy(physics.target)
          physics.initialized = true
        }
        const stiffness = 20 - progress * 9 + arm * 0.35
        const dampingForce = 5.6 - progress * 1.2
        physics.force
          .subVectors(physics.target, physics.position)
          .multiplyScalar(stiffness)
          .addScaledVector(physics.velocity, -dampingForce)
        physics.velocity.addScaledVector(physics.force, delta)
        physics.position.addScaledVector(physics.velocity, delta)
        segmentDummy.position.copy(physics.position)
        segmentDummy.rotation.set(curl * 0.45, angle + wave * 0.5, wave * 0.55 + curl)
        segmentDummy.scale.set(0.24 - progress * 0.06, 0.28, 0.12 - progress * 0.025)
        segmentDummy.updateMatrix()
        segments.current.setMatrixAt(segmentInstance, segmentDummy.matrix)
        segmentInstance += 1

        if (segment % 2 === 0) {
          frillDummy.position.copy(segmentDummy.position)
          frillDummy.position.x += Math.cos(angle) * 0.18
          frillDummy.position.z += Math.sin(angle) * 0.18
          frillDummy.rotation.set(
            Math.PI / 2 + curl * 0.25,
            angle,
            time * 0.08 * (arm % 2 ? -1 : 1) + wave,
          )
          const shimmer = 0.92 + Math.sin(time + segment + arm) * 0.06
          frillDummy.scale.set(shimmer * 1.25, shimmer, shimmer)
          frillDummy.updateMatrix()
          frills.current.setMatrixAt(frillInstance, frillDummy.matrix)
          frillInstance += 1
        } else {
          setaDummy.position.copy(segmentDummy.position)
          setaDummy.position.x += tangentX * 0.09
          setaDummy.position.z += tangentZ * 0.09
          setaDummy.rotation.set(0.62 + curl, angle, wave * 0.5)
          setaDummy.scale.set(0.7, 0.72 + progress * 0.5, 0.7)
          setaDummy.updateMatrix()
          setae.current.setMatrixAt(setaInstance, setaDummy.matrix)
          setaInstance += 1
        }
      }
    }
    segments.current.instanceMatrix.needsUpdate = true
    frills.current.instanceMatrix.needsUpdate = true
    setae.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh
        ref={segments}
        args={[null, null, armCount * segmentCount]}
        frustumCulled={false}
        castShadow
      >
        <sphereGeometry args={[1, 14, 9]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="membrane"
          opacity={0.72}
          depthWrite={false}
          partId="oralArms"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh
        ref={frills}
        args={[null, null, armCount * frillsPerArm]}
        frustumCulled={false}
      >
        <torusGeometry args={[0.16, 0.014, 5, 18, Math.PI * 1.35]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          opacity={0.84}
          partId="oralArms"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh
        ref={setae}
        args={[null, null, armCount * Math.floor(segmentCount / 2)]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.006, 0.011, 0.22, 5]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          opacity={0.82}
          partId="oralArms"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
    </group>
  )
}

function TentacleFringe({ theme, mode, hoveredPart, pulseRef, status, explode }) {
  const segments = useRef()
  const barbs = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const barbDummy = useMemo(() => new THREE.Object3D(), [])
  const work = useMemo(
    () => ({
      previous: new THREE.Vector3(),
      current: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      direction: new THREE.Vector3(),
    }),
    [],
  )
  const count = 40
  const segmentCount = 9
  const tentacleState = useRef(
    Array.from({ length: count }, (_, index) => ({
      phase: (index * 2.39996) % (Math.PI * 2),
      stiffness: 0.78 + (index % 7) * 0.045,
      sway: 0,
      velocity: 0,
    })),
  )

  useEffect(() => {
    if (segments.current) segments.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (barbs.current) barbs.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useFrame((_, deltaRaw) => {
    if (!segments.current || !barbs.current) return
    const delta = Math.min(deltaRaw, 0.04) * (pulseRef.current.timeScale ?? 1)
    const time = pulseRef.current.time || 0
    const contraction = pulseRef.current.contraction || 0
    const moving = status !== 'RESTING'
    let instance = 0
    let barbInstance = 0

    for (let tentacle = 0; tentacle < count; tentacle += 1) {
      const config = tentacleState.current[tentacle]
      const angle = (tentacle / count) * Math.PI * 2
      const gust = Math.sin(time * 0.28 + tentacle * 1.91) * 0.025
      const force =
        Math.sin(time * (0.68 + (tentacle % 5) * 0.026) + config.phase) *
          (moving ? 0.21 : 0.08) +
        gust -
        config.sway * config.stiffness
      config.velocity += force * delta
      config.velocity *= Math.exp(-delta * (2.4 + config.stiffness))
      config.sway += config.velocity * delta

      const tangent = work.tangent.set(-Math.sin(angle), 0, Math.cos(angle))
      const previous = work.previous.set(Math.cos(angle) * 2.65, -0.18, Math.sin(angle) * 2.65)

      for (let segment = 0; segment < segmentCount; segment += 1) {
        const progress = (segment + 1) / segmentCount
        const trail = moving ? 0.15 + contraction * 0.16 : 0.03
        const wave =
          config.sway * progress * 3.2 +
          Math.sin(time * 0.62 - progress * 3.1 + config.phase) * progress * 0.11
        const radial = 2.65 + progress * (0.1 + explode * 0.72)
        const current = work.current.set(
          Math.cos(angle) * radial + tangent.x * wave,
          -0.18 - progress * (1.75 + (tentacle % 4) * 0.12 + explode * 0.68) + trail * progress,
          Math.sin(angle) * radial + tangent.z * wave + progress * trail * 0.35,
        )
        const length = previous.distanceTo(current)
        dummy.position.copy(previous).lerp(current, 0.5)
        work.direction.subVectors(current, previous).normalize()
        dummy.quaternion.setFromUnitVectors(UP, work.direction)
        const taper = 1 - progress * 0.45
        dummy.scale.set(taper, length / 0.19, taper)
        dummy.updateMatrix()
        segments.current.setMatrixAt(instance, dummy.matrix)

        if (segment === 4 || segment === 7) {
          barbDummy.position.copy(current).addScaledVector(tangent, 0.045)
          barbDummy.quaternion.copy(dummy.quaternion)
          barbDummy.rotateZ(Math.PI / 2.8)
          const barbExtension =
            0.42 +
            (Math.sin(time * 0.47 + config.phase + segment * 0.8) * 0.5 + 0.5) * 0.34 +
            contraction * 0.24
          barbDummy.scale.setScalar(barbExtension)
          barbDummy.updateMatrix()
          barbs.current.setMatrixAt(barbInstance, barbDummy.matrix)
          barbInstance += 1
        }
        previous.copy(current)
        instance += 1
      }
    }
    segments.current.instanceMatrix.needsUpdate = true
    barbs.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={segments} args={[null, null, count * segmentCount]} frustumCulled={false}>
        <capsuleGeometry args={[0.038, 0.12, 3, 7]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="membrane"
          opacity={0.72}
          depthWrite={false}
          partId="tentacles"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
      <instancedMesh ref={barbs} args={[null, null, count * 2]} frustumCulled={false}>
        <coneGeometry args={[0.016, 0.12, 5]} />
        <ThemedMaterial
          theme={theme}
          mode={mode}
          kind="metal"
          opacity={0.9}
          partId="tentacles"
          hoveredPart={hoveredPart}
        />
      </instancedMesh>
    </group>
  )
}

function BellGhosts({ theme, mode, pulseRef, tempo }) {
  const ghosts = useRef([])
  useFrame((_, delta) => {
    ghosts.current.forEach((ghost, index) => {
      if (!ghost?.material) return
      const speed = pulseRef.current.speed || 0
      const slowReveal = clamp((tempo - 0.25) / 0.75, 0, 1)
      const targetOpacity = speed * slowReveal * (0.055 - index * 0.012)
      ghost.material.opacity = damp(ghost.material.opacity, targetOpacity, 10, delta)
      const offset = (index + 1) * speed * 0.035
      ghost.scale.set(1 + offset, 0.54 - offset * 0.8, 1 + offset)
    })
  })

  return (
    <group>
      {Array.from({ length: 3 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            ghosts.current[index] = node
          }}
          scale={[1, 0.54, 1]}
        >
          <sphereGeometry args={[2.77, 32, 10, 0, Math.PI * 2, 0.07, Math.PI / 2.03]} />
          <meshPhysicalMaterial
            color={theme.glassEdge}
            transmission={0.6}
            transparent
            opacity={0}
            roughness={0.25}
            depthWrite={false}
            side={THREE.DoubleSide}
            clippingPlanes={mode === 'SECTION' ? [SECTION_PLANE] : []}
          />
        </mesh>
      ))}
    </group>
  )
}

const ASSEMBLY_GUIDES = [
  { id: 'rhopalia', seat: [-2.5, -0.22, 0], axis: [-1, -0.12, 0], distance: 2.8, order: 0 },
  { id: 'lappets', seat: [2.45, -0.05, 0], axis: [1, 0.18, 0], distance: 2.2, order: 0.05 },
  { id: 'tentacles', seat: [-2.25, -2.1, 0], axis: [-0.3, -1, 0], distance: 1.75, order: 0.16 },
  { id: 'oralArms', seat: [1.05, -2.45, 0], axis: [0.28, -1, 0.18], distance: 2.45, order: 0.26 },
  { id: 'nerveRing', seat: [-1.7, -0.08, 0], axis: [0, -1, 0], distance: 0.78, order: 0.38 },
  { id: 'exumbrella', seat: [0.7, 1.1, 0], axis: [0, 1, 0], distance: 3.05, order: 0.42 },
  { id: 'mouth', seat: [0, -1.25, 0], axis: [0, -1, 0], distance: 2, order: 0.46 },
  { id: 'manubrium', seat: [0.15, -0.75, 0], axis: [0, -1, 0], distance: 1.45, order: 0.52 },
  { id: 'mesoglea', seat: [0, 0.42, 0], axis: [0, 1, 0], distance: 2.35, order: 0.54 },
  { id: 'subumbrella', seat: [-1.5, -0.05, 0.3], axis: [0, -1, 0], distance: 1.15, order: 0.62 },
  { id: 'canals', seat: [1.3, 0.05, 0], axis: [0, 1, 0], distance: 1.32, order: 0.64 },
  { id: 'pulseMotor', seat: [0, -0.2, 0], axis: [0, -1, 0], distance: 1.9, order: 0.73 },
]

function AssemblyGuides({ theme, explode }) {
  return (
    <group>
      {ASSEMBLY_GUIDES.map((guide) => {
        const progress = smoothstep(guide.order, Math.min(1, guide.order + 0.32), explode)
        const axis = new THREE.Vector3(...guide.axis).normalize()
        const end = new THREE.Vector3(...guide.seat).addScaledVector(axis, guide.distance * progress)
        return (
          <group key={guide.id} visible={progress > 0.01}>
            <Line
              points={[guide.seat, end.toArray()]}
              color={theme.floor}
              lineWidth={0.48}
              dashed
              dashSize={0.055}
              gapSize={0.045}
              transparent
              opacity={progress * 0.48}
              depthWrite={false}
            />
            <mesh position={guide.seat}>
              <sphereGeometry args={[0.021, 7, 5]} />
              <meshBasicMaterial
                color={theme.metal}
                transparent
                opacity={progress * 0.7}
                depthWrite={false}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function SectionCap({ theme, mode }) {
  const group = useRef()
  const shape = useMemo(() => {
    const result = new THREE.Shape()
    result.moveTo(-2.72, 0)
    result.bezierCurveTo(-2.2, 0.85, -1.4, 1.45, 0, 1.5)
    result.bezierCurveTo(1.4, 1.45, 2.2, 0.85, 2.72, 0)
    result.lineTo(2.45, -0.12)
    result.bezierCurveTo(1.3, 0.18, -1.3, 0.18, -2.45, -0.12)
    result.closePath()
    return result
  }, [])

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.visible = true
    group.current.traverse((child) => {
      if (!child.material) return
      child.material.opacity = damp(child.material.opacity, mode === 'SECTION' ? 0.42 : 0, 7, delta)
      child.material.transparent = true
    })
  })

  return (
    <group ref={group} rotation={[0, Math.PI / 2, 0]} position={[0.018, 0, 0]}>
      <mesh>
        <shapeGeometry args={[shape, 48]} />
        <meshBasicMaterial color={theme.core} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        <Edges color={theme.core} opacity={0.9} transparent />
      </mesh>
      {Array.from({ length: 9 }, (_, index) => (
        <Line
          key={index}
          points={[
            [-2.2 + index * 0.48, 0.04, 0.006],
            [-1.72 + index * 0.48, 0.52, 0.006],
          ]}
          color={theme.ink}
          lineWidth={0.45}
          transparent
          opacity={0}
        />
      ))}
    </group>
  )
}

function SchematicOverlay({ theme, mode }) {
  const group = useRef()

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.traverse((child) => {
      if (!child.material) return
      child.material.transparent = true
      child.material.opacity = damp(child.material.opacity, mode === 'SCHEMATIC' ? 0.66 : 0, 6, delta)
      child.material.depthWrite = false
    })
  })

  const circlePoints = useMemo(
    () =>
      Array.from({ length: 97 }, (_, index) => {
        const angle = (index / 96) * Math.PI * 2
        return [Math.cos(angle) * 3.15, 0.04, Math.sin(angle) * 3.15]
      }),
    [],
  )

  return (
    <group ref={group}>
      <Line points={circlePoints} color={theme.ink} lineWidth={0.55} dashed dashSize={0.1} gapSize={0.07} opacity={0} />
      <Line points={[[-3.35, 1.85, 0], [3.35, 1.85, 0]]} color={theme.ink} lineWidth={0.75} opacity={0} />
      <Line points={[[-3.18, 1.7, 0], [-3.18, 2, 0]]} color={theme.ink} lineWidth={0.75} opacity={0} />
      <Line points={[[3.18, 1.7, 0], [3.18, 2, 0]]} color={theme.ink} lineWidth={0.75} opacity={0} />
      <Line points={[[3.45, -1.35, 0], [3.45, -4.5, 0]]} color={theme.ink} lineWidth={0.75} opacity={0} />
      <Line points={[[3.3, -1.42, 0], [3.6, -1.42, 0]]} color={theme.ink} lineWidth={0.75} opacity={0} />
      <Line points={[[3.3, -4.38, 0], [3.6, -4.38, 0]]} color={theme.ink} lineWidth={0.75} opacity={0} />
      <Line points={[[-3.65, 0, 0], [3.65, 0, 0]]} color={theme.ink} lineWidth={0.4} dashed opacity={0} />
      <Line points={[[0, 0, -3.65], [0, 0, 3.65]]} color={theme.ink} lineWidth={0.4} dashed opacity={0} />
    </group>
  )
}

function VortexTrails({ theme, pulseRef, bodyRef }) {
  const rings = useRef([])
  const trailState = useRef(Array.from({ length: 5 }, () => ({ age: 99, position: new THREE.Vector3() })))
  const lastPulse = useRef(-1)
  const cursor = useRef(0)

  useFrame((_, delta) => {
    const simulationDelta = delta * (pulseRef.current.timeScale ?? 1)
    if (
      pulseRef.current.count !== lastPulse.current &&
      pulseRef.current.count >= 0 &&
      pulseRef.current.motor > 0.3 &&
      bodyRef.current
    ) {
      lastPulse.current = pulseRef.current.count
      const slot = cursor.current % trailState.current.length
      cursor.current += 1
      bodyRef.current.getWorldPosition(trailState.current[slot].position)
      trailState.current[slot].position.y -= 0.26
      trailState.current[slot].age = 0
    }

    trailState.current.forEach((entry, index) => {
      const ring = rings.current[index]
      if (!ring) return
      entry.age += simulationDelta
      const life = 1 - smoothstep(0.15, 3.1, entry.age)
      ring.visible = life > 0.001
      ring.position.copy(entry.position)
      ring.position.y -= entry.age * 0.48
      ring.position.x += Math.sin(entry.age * 1.3 + index) * 0.06
      const scale = 0.42 + entry.age * 0.75
      ring.scale.setScalar(scale)
      ring.material.opacity = life * 0.24
    })
  })

  return (
    <group>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            rings.current[index] = node
          }}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <torusGeometry args={[1.05, 0.018, 6, 96]} />
          <meshBasicMaterial color={theme.core} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function CausticShadow({ theme, bodyRef }) {
  const mesh = useRef()
  const material = useRef()
  const targetColor = useMemo(() => new THREE.Color(), [])
  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color('#665b48') },
        uOpacity: { value: 0.2 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float soft = exp(-radius * radius * 2.9);
          float caustic = sin(radius * 20.0 - uTime * 0.35 + sin(angle * 6.0) * 0.9) * 0.5 + 0.5;
          caustic = mix(0.62, 1.0, caustic);
          float edge = 1.0 - smoothstep(0.55, 1.0, radius);
          gl_FragColor = vec4(uColor, soft * edge * caustic * uOpacity);
        }
      `,
    }),
    [],
  )

  useFrame((state, delta) => {
    if (!mesh.current || !material.current || !bodyRef.current) return
    bodyRef.current.getWorldPosition(TEMP_A)
    const altitude = Math.max(0, TEMP_A.y)
    mesh.current.position.x = damp(mesh.current.position.x, TEMP_A.x, 8, delta)
    mesh.current.position.z = damp(mesh.current.position.z, TEMP_A.z, 8, delta)
    const spread = 1 + altitude * 0.24
    mesh.current.scale.x = damp(mesh.current.scale.x, spread, 5, delta)
    mesh.current.scale.y = damp(mesh.current.scale.y, spread, 5, delta)
    material.current.uniforms.uTime.value = state.clock.elapsedTime
    material.current.uniforms.uOpacity.value = damp(
      material.current.uniforms.uOpacity.value,
      (theme.id === 'obsidian' ? 0.42 : 0.2) / (1 + altitude * 0.25),
      4,
      delta,
    )
    targetColor.set(theme.id === 'obsidian' ? '#000000' : theme.floor)
    material.current.uniforms.uColor.value.lerp(targetColor, 1 - Math.exp(-delta * 4))
  })

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.555, 0]} scale={[1, 1, 1]}>
      <planeGeometry args={[5.2, 5.2]} />
      <shaderMaterial ref={material} args={[shader]} />
    </mesh>
  )
}

function Medusa({
  theme,
  mode,
  explode,
  intro,
  status,
  tempo,
  hoveredPart,
  setHoveredPart,
  setSelectedPart,
  bodyRef,
  anchorsRef,
  pulseRef,
  pointerRef,
  onTelemetry,
}) {
  const scaleGroup = useRef()
  const movement = useRef({
    time: 0,
    phase: 0,
    count: 0,
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(),
    yaw: 0,
    bank: 0,
    pitch: 0,
    lastPointerNear: false,
    telemetryTimer: 0,
  })

  const partProps = {
    explode,
    intro,
    hoveredPart,
    setHoveredPart,
    setSelectedPart,
  }

  const setAnchor = (id) => (node) => {
    anchorsRef.current[id] = node
  }

  useFrame((state, deltaRaw) => {
    if (!bodyRef.current || !scaleGroup.current) return
    const delta = Math.min(deltaRaw, 0.04)
    const data = movement.current
    const simulationDelta = delta * tempo
    data.time += simulationDelta
    const time = data.time
    pointerRef.current.lerp(state.pointer, 1 - Math.exp(-delta * 5))
    const active = status === 'PULSING' || status === 'WARMING' || status === 'SETTLING'
    const curiosity =
      status === 'PULSING'
        ? smoothstep(0.78, 0.98, Math.sin(time * 0.19 + 0.8) * 0.5 + 0.5)
        : 0
    const frequency =
      status === 'PULSING'
        ? 1.8 - curiosity * 0.65
        : status === 'WARMING'
          ? 2.2
          : status === 'SETTLING'
            ? 0.68
            : 0.18
    const amplitude =
      status === 'PULSING'
        ? 1 - curiosity * 0.24
        : status === 'WARMING'
          ? 0.16
          : status === 'SETTLING'
            ? 0.48
            : 0.015

    const previousPhase = data.phase
    data.phase = (data.phase + simulationDelta * frequency) % 1
    if (active && data.phase < previousPhase) {
      data.count += 1
      const lift = status === 'PULSING' ? 0.22 : status === 'SETTLING' ? 0.04 : 0.025
      data.velocity.y += lift * amplitude
    }

    const powerFraction = 0.36
    let contraction
    let speed
    if (data.phase < powerFraction) {
      const p = data.phase / powerFraction
      contraction = Math.sin((p * Math.PI) / 2)
      speed = Math.sin(p * Math.PI)
    } else {
      const p = (data.phase - powerFraction) / (1 - powerFraction)
      contraction = Math.pow(1 - p, 2.2)
      speed = (1 - p) * 0.32
    }
    contraction *= amplitude

    const pointerNear = state.pointer.length() < 0.23 && status === 'PULSING'
    if (pointerNear && !data.lastPointerNear) {
      const escapeX = Math.abs(state.pointer.x) < 0.04 ? 1 : -Math.sign(state.pointer.x)
      data.velocity.x += escapeX * 0.7
      data.velocity.z += -Math.sign(state.pointer.y || 1) * 0.24
      data.velocity.y += 0.15
    }
    data.lastPointerNear = pointerNear

    const target = TEMP_A.set(0, 0, 0)
    if (status === 'PULSING') {
      const travel = 1 - curiosity * 0.72
      target.set(
        (Math.sin(time * 0.17) * 0.78 + Math.sin(time * 0.071) * 0.38) * travel,
        1.1 + Math.sin(time * 0.23) * 0.16,
        Math.cos(time * 0.13) * 0.48 * travel,
      )
    } else if (status === 'WARMING') {
      target.set(0, 0.1, 0)
    } else if (status === 'SETTLING') {
      target.set(0, 0, 0)
    }

    const gust = TEMP_B.set(
      Math.sin(time * 0.37 + 2.4) * 0.018,
      Math.sin(time * 0.21) * 0.006,
      Math.cos(time * 0.29 + 0.8) * 0.016,
    )
    const spring = status === 'PULSING' ? 0.9 : 1.55
    data.velocity.addScaledVector(TEMP_C.subVectors(target, data.position), spring * simulationDelta)
    data.velocity.addScaledVector(gust, simulationDelta)
    data.velocity.multiplyScalar(
      Math.exp(-simulationDelta * (status === 'PULSING' ? 1.28 : 2.6)),
    )
    data.position.addScaledVector(data.velocity, simulationDelta)
    if (status === 'RESTING') {
      data.position.y = damp(data.position.y, 0, 4, delta)
      data.position.x = damp(data.position.x, 0, 3, delta)
      data.position.z = damp(data.position.z, 0, 3, delta)
    }

    const desiredHeading =
      Math.atan2(data.velocity.x, Math.max(0.06, data.velocity.z + 0.12)) +
      curiosity * Math.sin(time * 0.38) * 0.5
    const headingError = THREE.MathUtils.euclideanModulo(desiredHeading - data.yaw + Math.PI, Math.PI * 2) - Math.PI
    const turn = clamp(headingError * 0.65, -1, 1)
    const asymmetry = active ? turn * 0.14 + Math.sin(time * 0.41) * 0.018 : 0
    const left = 1 + asymmetry
    const right = 1 - asymmetry
    data.yaw = damp(data.yaw, desiredHeading, 0.8, delta)
    data.bank = damp(data.bank, -turn * 0.13 - data.velocity.x * 0.08, 2.4, delta)
    data.pitch = damp(data.pitch, status === 'PULSING' ? 0.04 + data.velocity.z * 0.06 : 0, 2, delta)

    bodyRef.current.position.lerp(data.position, 1 - Math.exp(-delta * 8))
    bodyRef.current.rotation.y = data.yaw
    bodyRef.current.rotation.z = data.bank + Math.sin(time * 0.53) * 0.006
    bodyRef.current.rotation.x = data.pitch + Math.cos(time * 0.47) * 0.005

    const diameterX = 1 - contraction * 0.28 * left
    const diameterZ = 1 - contraction * 0.28 * right
    scaleGroup.current.scale.x = damp(scaleGroup.current.scale.x, diameterX, 18, delta)
    scaleGroup.current.scale.z = damp(scaleGroup.current.scale.z, diameterZ, 18, delta)
    scaleGroup.current.scale.y = damp(
      scaleGroup.current.scale.y,
      1 + contraction * 0.12 - (status === 'SETTLING' && data.position.y < 0.08 ? 0.025 : 0),
      18,
      delta,
    )

    pulseRef.current.phase = data.phase
    pulseRef.current.contraction = contraction
    pulseRef.current.recoil = data.phase > powerFraction ? contraction : 0
    pulseRef.current.speed = speed * amplitude
    pulseRef.current.signal = data.phase < 0.1 ? 1 - data.phase / 0.1 : 0
    pulseRef.current.motor = active ? amplitude : 0
    pulseRef.current.left = left
    pulseRef.current.right = right
    pulseRef.current.bank = data.bank
    pulseRef.current.count = data.count
    pulseRef.current.time = time
    pulseRef.current.timeScale = tempo

    data.telemetryTimer += delta
    if (data.telemetryTimer > 0.09) {
      data.telemetryTimer = 0
      onTelemetry({
        depth: Math.max(0, 4.7 - data.position.y).toFixed(2),
        verticalSpeed: data.velocity.y.toFixed(2),
        heading: `${String(Math.round(THREE.MathUtils.radToDeg(data.yaw) + 360) % 360).padStart(3, '0')}°`,
        pulse: active ? (frequency * tempo).toFixed(2) : '0.00',
        left,
        right,
        phase: data.phase,
      })
    }
  })

  return (
    <>
      <group ref={bodyRef}>
        <group ref={scaleGroup}>
          <AssemblyGuides theme={theme} explode={explode} />
          <ExplodedPart
            ref={setAnchor('mesoglea')}
            id="mesoglea"
            axis={[0, 1, 0]}
            distance={2.35}
            order={0.54}
            {...partProps}
          >
            <Mesoglea theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('canals')}
            id="canals"
            axis={[0, 1, 0]}
            distance={1.32}
            order={0.64}
            {...partProps}
          >
            <CanalNetwork theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('subumbrella')}
            id="subumbrella"
            axis={[0, -1, 0]}
            distance={1.15}
            order={0.62}
            {...partProps}
          >
            <Subumbrella theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('pulseMotor')}
            id="pulseMotor"
            axis={[0, -1, 0]}
            distance={1.9}
            order={0.73}
            {...partProps}
          >
            <PulseMotor theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('nerveRing')}
            id="nerveRing"
            axis={[0, -1, 0]}
            distance={0.78}
            order={0.38}
            {...partProps}
          >
            <NerveRing theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('exumbrella')}
            id="exumbrella"
            axis={[0, 1, 0]}
            distance={3.05}
            order={0.42}
            {...partProps}
          >
            <Exumbrella theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('lappets')}
            id="lappets"
            axis={[1, 0.18, 0]}
            distance={2.2}
            order={0.05}
            {...partProps}
          >
            <Lappets theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('rhopalia')}
            id="rhopalia"
            axis={[-1, -0.12, 0]}
            distance={2.8}
            order={0}
            {...partProps}
          >
            <Rhopalia
              theme={theme}
              mode={mode}
              hoveredPart={hoveredPart}
              pulseRef={pulseRef}
              pointerRef={pointerRef}
            />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('manubrium')}
            id="manubrium"
            axis={[0, -1, 0]}
            distance={1.45}
            order={0.52}
            {...partProps}
          >
            <Manubrium
              theme={theme}
              mode={mode}
              hoveredPart={hoveredPart}
              pulseRef={pulseRef}
              explode={explode}
            />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('mouth')}
            id="mouth"
            axis={[0, -1, 0]}
            distance={2.0}
            order={0.46}
            {...partProps}
          >
            <Mouth theme={theme} mode={mode} hoveredPart={hoveredPart} pulseRef={pulseRef} />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('oralArms')}
            id="oralArms"
            axis={[0.28, -1, 0.18]}
            distance={2.45}
            order={0.26}
            {...partProps}
          >
            <OralArms
              theme={theme}
              mode={mode}
              hoveredPart={hoveredPart}
              pulseRef={pulseRef}
              pointerRef={pointerRef}
              explode={explode}
            />
          </ExplodedPart>

          <ExplodedPart
            ref={setAnchor('tentacles')}
            id="tentacles"
            axis={[-0.3, -1, 0]}
            distance={1.75}
            order={0.16}
            {...partProps}
          >
            <TentacleFringe
              theme={theme}
              mode={mode}
              hoveredPart={hoveredPart}
              pulseRef={pulseRef}
              status={status}
              explode={explode}
            />
          </ExplodedPart>
          <BellGhosts theme={theme} mode={mode} pulseRef={pulseRef} tempo={tempo} />
          <SectionCap theme={theme} mode={mode} />
          <SchematicOverlay theme={theme} mode={mode} />
        </group>
      </group>
    </>
  )
}

function DraftingFloor({ theme, intro }) {
  const material = useRef()
  const targetFloorColor = useMemo(() => new THREE.Color(), [])
  const shader = useMemo(
    () => ({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color('#8b806e') },
        uTime: { value: 0 },
        uReveal: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        varying vec3 vWorld;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uReveal;

        float lineGrid(vec2 p, float scale, float width) {
          vec2 q = abs(fract(p * scale - 0.5) - 0.5) / fwidth(p * scale);
          return 1.0 - min(min(q.x, q.y) / width, 1.0);
        }

        float hexLine(vec2 p) {
          p *= 0.68;
          p.x *= 0.5773503 * 2.0;
          p.y += mod(floor(p.x), 2.0) * 0.5;
          p = abs(fract(p) - 0.5);
          float d = abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 0.5);
          return 1.0 - smoothstep(0.015, 0.04, d);
        }

        void main() {
          vec2 p = vWorld.xz;
          float radius = length(p);
          float fade = 1.0 - smoothstep(5.5, 13.5, radius);
          float grid = lineGrid(p, 0.48, 1.15) * 0.22;
          float hexes = hexLine(p) * 0.28;
          float circles = 1.0 - smoothstep(0.012, 0.035, abs(fract(radius * 0.36) - 0.5));
          circles *= 0.22;
          float axis = (1.0 - smoothstep(0.0, 0.018, min(abs(p.x), abs(p.y)))) * 0.28;
          float revealRadius = uReveal * 16.0;
          float reveal = (1.0 - smoothstep(revealRadius - 1.0, revealRadius + 0.8, radius));
          reveal *= smoothstep(0.01, 0.12, uReveal);
          float alpha = (grid + hexes + circles + axis) * fade * reveal;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    }),
    [],
  )

  useFrame((state, delta) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = state.clock.elapsedTime
    material.current.uniforms.uReveal.value = damp(
      material.current.uniforms.uReveal.value,
      Math.min(1, intro * 1.65),
      4,
      delta,
    )
    targetFloorColor.set(theme.floor)
    material.current.uniforms.uColor.value.lerp(targetFloorColor, 1 - Math.exp(-delta * 4))
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.58, 0]}>
        <planeGeometry args={[30, 30, 1, 1]} />
        <shaderMaterial ref={material} args={[shader]} extensions={{ derivatives: true }} />
      </mesh>
      <mesh position={[0, -4.44, 0]} receiveShadow>
        <cylinderGeometry args={[1.2, 1.32, 0.28, 6, 1]} />
        <ThemedMaterial theme={theme} mode="SOLID" kind="porcelain" />
        <Edges color={theme.floor} opacity={0.4} transparent />
      </mesh>
      <mesh position={[0, -4.285, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 6]} />
        <ThemedMaterial theme={theme} mode="SOLID" kind="metal" opacity={0.18} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2
        return (
          <Line
            key={index}
            points={[
              [Math.cos(angle) * 4.1, -4.565, Math.sin(angle) * 4.1],
              [Math.cos(angle) * 5.7, -4.565, Math.sin(angle) * 5.7],
            ]}
            color={theme.floor}
            lineWidth={0.4}
            transparent
            opacity={0.24}
          />
        )
      })}
    </group>
  )
}

function SceneLights({ theme, bodyRef, status }) {
  const ambient = useRef()
  const key = useRef()
  const rim = useRef()
  const core = useRef()
  const keyColor = useMemo(() => new THREE.Color(), [])
  const rimColor = useMemo(() => new THREE.Color(), [])
  const coreColor = useMemo(() => new THREE.Color(), [])
  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    if (ambient.current) {
      ambient.current.intensity = damp(
        ambient.current.intensity,
        theme.id === 'obsidian' ? 0.28 : 0.72,
        3,
        delta,
      )
    }
    if (key.current) {
      keyColor.set(theme.background2)
      key.current.color.lerp(keyColor, 1 - Math.exp(-delta * 3))
      key.current.position.x = 5.5 + Math.sin(time * 0.12) * 0.65
      key.current.intensity = damp(
        key.current.intensity,
        theme.id === 'obsidian' ? 2.2 : 3.4,
        3,
        delta,
      )
    }
    if (rim.current) {
      rimColor.set(theme.glassEdge)
      rim.current.color.lerp(rimColor, 1 - Math.exp(-delta * 3))
      rim.current.position.z = -5 + Math.cos(time * 0.1) * 0.5
      rim.current.intensity = damp(
        rim.current.intensity,
        theme.id === 'obsidian' ? 3.4 : 2.1,
        3,
        delta,
      )
    }
    if (core.current) {
      coreColor.set(theme.core)
      core.current.color.lerp(coreColor, 1 - Math.exp(-delta * 3))
      core.current.intensity = damp(core.current.intensity, status === 'PULSING' ? 3.2 : 1.5, 3, delta)
      if (bodyRef.current) bodyRef.current.getWorldPosition(core.current.position)
    }
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.72} />
      <directionalLight
        ref={key}
        position={[5.5, 8, 6]}
        intensity={theme.id === 'obsidian' ? 2.2 : 3.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.00015}
      />
      <directionalLight ref={rim} position={[-5, 2, -5]} intensity={theme.id === 'obsidian' ? 3.4 : 2.1} />
      <pointLight ref={core} distance={6.5} decay={2.2} intensity={2} />
    </>
  )
}

function CameraRig({ view, selectedPart, status, orbit, explode, controlsRef, bodyRef, anchorsRef }) {
  const { camera } = useThree()
  const transition = useRef({
    progress: 1,
    fromPosition: camera.position.clone(),
    fromTarget: new THREE.Vector3(),
    toPosition: new THREE.Vector3(...VIEWS.ISO.position),
    toTarget: new THREE.Vector3(...VIEWS.ISO.target),
    fromFov: camera.fov,
    toFov: VIEWS.ISO.fov,
  })

  useEffect(() => {
    const targetView = VIEWS[view] || VIEWS.ISO
    const nextTarget = new THREE.Vector3(...targetView.target)
    const nextPosition = new THREE.Vector3(...targetView.position)
    let nextFov = targetView.fov

    if (selectedPart && anchorsRef.current[selectedPart]) {
      anchorsRef.current[selectedPart].getWorldPosition(nextTarget)
      const offset = selectedPart === 'oralArms' || selectedPart === 'tentacles'
        ? new THREE.Vector3(3.1, 1.2, 4.1)
        : new THREE.Vector3(3.5, 2.1, 4.4)
      nextPosition.copy(nextTarget).add(offset)
      nextFov = 28
    }

    transition.current = {
      progress: 0,
      fromPosition: camera.position.clone(),
      fromTarget: controlsRef.current?.target.clone() || new THREE.Vector3(),
      toPosition: nextPosition,
      toTarget: nextTarget,
      fromFov: camera.fov,
      toFov: nextFov,
    }
  }, [view, selectedPart, camera, anchorsRef, controlsRef])

  useFrame((_, delta) => {
    const move = transition.current
    if (move.progress < 1) {
      move.progress = Math.min(1, move.progress + delta / 1.15)
      const eased = move.progress * move.progress * (3 - 2 * move.progress)
      camera.position.lerpVectors(move.fromPosition, move.toPosition, eased)
      camera.fov = THREE.MathUtils.lerp(move.fromFov, move.toFov, eased)
      camera.updateProjectionMatrix()
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(move.fromTarget, move.toTarget, eased)
        controlsRef.current.update()
      }
    } else if (!selectedPart && controlsRef.current && explode > 0.002) {
      const targetView = VIEWS[view] || VIEWS.ISO
      const dx = targetView.position[0] - targetView.target[0]
      const dy = targetView.position[1] - targetView.target[1]
      const dz = targetView.position[2] - targetView.target[2]
      const baseDistance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      TEMP_B.subVectors(camera.position, controlsRef.current.target).normalize()
      const desiredDistance = baseDistance * (1 + explode * 0.4)
      const currentDistance = camera.position.distanceTo(controlsRef.current.target)
      camera.position.addScaledVector(
        TEMP_B,
        (desiredDistance - currentDistance) * (1 - Math.exp(-delta * 3.5)),
      )
      controlsRef.current.update()
    } else if (status === 'PULSING' && !selectedPart && controlsRef.current && bodyRef.current) {
      bodyRef.current.getWorldPosition(TEMP_A)
      TEMP_A.y -= 0.55
      controlsRef.current.target.lerp(TEMP_A, 1 - Math.exp(-delta * 0.7))
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={orbit}
      enableDamping
      dampingFactor={0.055}
      minDistance={4.8}
      maxDistance={18}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI * 0.78}
      target={VIEWS.ISO.target}
    />
  )
}

function LabelTracker({ explode, intro, anchorsRef, onLabels }) {
  const { camera, size } = useThree()
  const frame = useRef(0)
  const hadLabels = useRef(false)

  useFrame(() => {
    frame.current += 1
    if (frame.current % 8 !== 0) return
    if (explode < 0.23 || intro < 0.92) {
      if (hadLabels.current) {
        hadLabels.current = false
        onLabels([])
      }
      return
    }
    hadLabels.current = true

    const labels = Object.keys(PARTS)
      .map((id) => {
        const object = anchorsRef.current[id]
        if (!object) return null
        const anchor = new THREE.Vector3(...(PART_ANCHORS[id] || [0, 0, 0]))
        object.localToWorld(anchor)
        const projected = anchor.clone().project(camera)
        return {
          id,
          anchorX: (projected.x * 0.5 + 0.5) * size.width,
          anchorY: (-projected.y * 0.5 + 0.5) * size.height,
          side: projected.x < 0 ? 'left' : 'right',
        }
      })
      .filter(Boolean)

    const layoutSide = (side) => {
      const rows = labels.filter((item) => item.side === side).sort((a, b) => a.anchorY - b.anchorY)
      const minY = 142
      const maxY = size.height - 154
      const gap = size.height < 760 ? 42 : 52
      let cursor = minY
      rows.forEach((row) => {
        row.labelY = clamp(Math.max(row.anchorY, cursor), minY, maxY)
        cursor = row.labelY + gap
      })
      if (rows.length && rows[rows.length - 1].labelY > maxY) {
        rows[rows.length - 1].labelY = maxY
        for (let index = rows.length - 2; index >= 0; index -= 1) {
          rows[index].labelY = Math.min(rows[index].labelY, rows[index + 1].labelY - gap)
        }
      }
      rows.forEach((row) => {
        row.labelX = side === 'left' ? Math.min(330, size.width * 0.23) : Math.max(size.width - 330, size.width * 0.77)
      })
      return rows
    }

    onLabels([...layoutSide('left'), ...layoutSide('right')])
  })

  return null
}

function BackgroundController({ theme }) {
  const { scene, gl } = useThree()
  const color = useRef(new THREE.Color(theme.background))
  const targetColor = useMemo(() => new THREE.Color(), [])
  useEffect(() => {
    gl.localClippingEnabled = true
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.08
  }, [gl])

  useFrame((_, delta) => {
    targetColor.set(theme.background)
    color.current.lerp(targetColor, 1 - Math.exp(-delta * 3.6))
    scene.background = color.current
    if (scene.fog) scene.fog.color.copy(color.current)
  })
  return <fog attach="fog" args={[theme.background, 12, 29]} />
}

function World({
  theme,
  renderMode,
  explode,
  intro,
  status,
  tempo,
  view,
  orbit,
  hoveredPart,
  setHoveredPart,
  selectedPart,
  setSelectedPart,
  onTelemetry,
  onLabels,
}) {
  const bodyRef = useRef()
  const anchorsRef = useRef({})
  const controlsRef = useRef()
  const pointerRef = useRef(new THREE.Vector2())
  const pulseRef = useRef({
    phase: 0,
    contraction: 0,
    recoil: 0,
    speed: 0,
    signal: 0,
    motor: 0,
    left: 1,
    right: 1,
    bank: 0,
    count: -1,
    time: 0,
    timeScale: 1,
  })

  return (
    <>
      <BackgroundController theme={theme} />
      <SceneLights theme={theme} bodyRef={bodyRef} status={status} />
      <Environment resolution={64}>
        <Lightformer
          form="ring"
          color={theme.background2}
          intensity={3}
          scale={7}
          position={[0, 6, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Lightformer
          form="rect"
          color={theme.glassEdge}
          intensity={2}
          scale={[4, 7, 1]}
          position={[-5, 1, -3]}
          rotation={[0, -0.7, 0]}
        />
        <Lightformer
          form="rect"
          color={theme.metal}
          intensity={1.5}
          scale={[3, 2, 1]}
          position={[5, -1, 2]}
          rotation={[0, 0.8, 0]}
        />
      </Environment>

      <DraftingFloor theme={theme} intro={intro} />
      <Medusa
        theme={theme}
        mode={renderMode}
        explode={explode}
        intro={intro}
        status={status}
        tempo={tempo}
        hoveredPart={hoveredPart}
        setHoveredPart={setHoveredPart}
        setSelectedPart={setSelectedPart}
        bodyRef={bodyRef}
        anchorsRef={anchorsRef}
        pulseRef={pulseRef}
        pointerRef={pointerRef}
        onTelemetry={onTelemetry}
      />
      <VortexTrails theme={theme} pulseRef={pulseRef} bodyRef={bodyRef} />
      <Sparkles
        count={34}
        scale={[12, 8, 10]}
        size={0.55}
        speed={0.08}
        opacity={theme.id === 'obsidian' ? 0.25 : 0.1}
        color={theme.glassEdge}
        position={[0, 0, 0]}
      />
      <CausticShadow theme={theme} bodyRef={bodyRef} />
      <CameraRig
        view={view}
        selectedPart={selectedPart}
        status={status}
        orbit={orbit}
        explode={explode}
        controlsRef={controlsRef}
        bodyRef={bodyRef}
        anchorsRef={anchorsRef}
      />
      <LabelTracker explode={explode} intro={intro} anchorsRef={anchorsRef} onLabels={onLabels} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.35} intensity={0.32} radius={0.55} />
        {view === 'MACRO' && (
          <DepthOfField focusDistance={0.018} focalLength={0.032} bokehScale={1.6} />
        )}
        <SMAA />
        <Vignette eskil={false} offset={0.16} darkness={theme.id === 'obsidian' ? 0.32 : 0.12} />
      </EffectComposer>
    </>
  )
}

const MedusaScene = memo(function MedusaScene(props) {
  const theme = THEMES[props.themeId]
  return (
    <Canvas
      className="medusa-canvas"
      shadows="percentage"
      frameloop={props.tempo === 0 ? 'demand' : 'always'}
      dpr={[1, 2]}
      camera={{ position: VIEWS.ISO.position, fov: VIEWS.ISO.fov, near: 0.1, far: 80 }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      onPointerMissed={() => {
        props.setSelectedPart(null)
        props.setHoveredPart(null)
      }}
    >
      <World {...props} theme={theme} />
    </Canvas>
  )
})

export default MedusaScene
