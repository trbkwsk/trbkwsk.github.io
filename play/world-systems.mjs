import * as THREE from './vendor/three.module.js';

const clamp = THREE.MathUtils.clamp;

export class DistrictWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.sectors = new Map();
    this.discovered = new Set();
    this.activeSector = 'warehouse';
  }

  addSector(id, range, group) {
    group.name = `Sector_${id}`;
    this.sectors.set(id, { id, range, group });
    this.scene.add(group);
    return group;
  }

  addCollider(spec) {
    const collider = {
      id: spec.id,
      minX: spec.x - spec.w / 2,
      maxX: spec.x + spec.w / 2,
      minZ: spec.z - spec.d / 2,
      maxZ: spec.z + spec.d / 2,
      height: spec.h,
      vaultable: !!spec.vaultable,
      climbable: !!spec.climbable,
      sector: spec.sector || 'warehouse'
    };
    this.colliders.push(collider);
    return collider;
  }

  sectorAt(z) {
    for (const sector of this.sectors.values()) {
      if (z >= sector.range[0] && z < sector.range[1]) return sector.id;
    }
    return this.activeSector;
  }

  updateSectors(position) {
    const id = this.sectorAt(position.z);
    this.activeSector = id;
    this.discovered.add(id);
    for (const sector of this.sectors.values()) {
      const center = (sector.range[0] + sector.range[1]) / 2;
      const half = (sector.range[1] - sector.range[0]) / 2;
      sector.group.visible = Math.abs(position.z - center) <= half + 22;
    }
    return id;
  }

  collides(x, z, radius = .34) {
    return this.colliders.find((c) =>
      x + radius > c.minX && x - radius < c.maxX &&
      z + radius > c.minZ && z - radius < c.maxZ
    ) || null;
  }

  resolve(previous, wanted, radius = .34) {
    const result = wanted.clone();
    const hitX = this.collides(result.x, previous.z, radius);
    if (hitX) result.x = previous.x;
    const hitZ = this.collides(result.x, result.z, radius);
    if (hitZ) result.z = previous.z;
    result.x = clamp(result.x, -10.0 + radius, 10.0 - radius);
    result.z = clamp(result.z, -7.45, 46.0);
    return { position: result, hit: hitZ || hitX };
  }

  traversalCandidate(position, yaw, maxDistance = 1.05) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    let best = null;
    for (const collider of this.colliders) {
      if (!collider.vaultable && !collider.climbable) continue;
      const cx = clamp(position.x, collider.minX, collider.maxX);
      const cz = clamp(position.z, collider.minZ, collider.maxZ);
      const delta = new THREE.Vector3(cx - position.x, 0, cz - position.z);
      const distance = delta.length();
      if (distance > maxDistance || distance < .001) continue;
      if (delta.normalize().dot(forward) < .42) continue;
      if (!best || distance < best.distance) best = { collider, distance, forward };
    }
    return best;
  }

  traversalLanding(candidate, position) {
    const c = candidate.collider;
    const step = c.climbable ? 1.45 : 1.15;
    const landing = position.clone().addScaledVector(candidate.forward, step);
    landing.x = clamp(landing.x, -9.5, 9.5);
    landing.z = clamp(landing.z, -7.2, 45.5);
    return landing;
  }
}

export class ProgressStore {
  constructor(key = 'sprayfight-progress-v1') { this.key = key; }

  load() {
    try {
      const value = JSON.parse(localStorage.getItem(this.key) || 'null');
      return value && value.version === 1 ? value : null;
    } catch { return null; }
  }

  save(data) {
    try { localStorage.setItem(this.key, JSON.stringify({ version: 1, savedAt: Date.now(), ...data })); }
    catch (error) { console.warn('SprayFight: progress save failed', error); }
  }
}
