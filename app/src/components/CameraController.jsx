import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../store/sceneStore'

export function CameraController({ orbitRef }) {
  const { cameraFlyTarget, cameraFlyPos, clearFlyTarget } = useSceneStore()
  // dev-only escape hatch so tooling (screenshot capture) can teleport the camera
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__dtOrbit = orbitRef
  const destTarget = useRef(null)
  const destPos    = useRef(null)
  const activeRef  = useRef(false)

  useEffect(() => {
    if (!cameraFlyTarget) return
    destTarget.current = new THREE.Vector3(...cameraFlyTarget)
    destPos.current    = cameraFlyPos ? new THREE.Vector3(...cameraFlyPos) : null
    activeRef.current  = true
  }, [cameraFlyTarget, cameraFlyPos])

  useFrame(() => {
    if (!activeRef.current || !orbitRef?.current || !destTarget.current) return
    const ctrl = orbitRef.current
    ctrl.target.lerp(destTarget.current, 0.09)
    if (destPos.current && ctrl.object) ctrl.object.position.lerp(destPos.current, 0.09)
    ctrl.update()
    const posArrived = !destPos.current || !ctrl.object || ctrl.object.position.distanceTo(destPos.current) < 0.5
    if (ctrl.target.distanceTo(destTarget.current) < 0.1 && posArrived) {
      activeRef.current = false
      clearFlyTarget()
    }
  })

  return null
}
