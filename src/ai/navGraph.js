import * as THREE from "three";
import { GAME_CONFIG } from "../core/config.js";

const UP = new THREE.Vector3(0, 1, 0);
const nodePositions = new Map();
const adjacencyList = new Map();

function heuristic(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function nodeKey(pos) {
  return `${pos[0].toFixed(1)},${pos[1].toFixed(1)},${pos[2].toFixed(1)}`;
}

export class NavGraph {
  constructor() {
    this.nodes = [];
    this.nodeMap = new Map();
    this.ready = false;
  }

  buildFromConfig() {
    this.nodes = [];
    this.nodeMap = new Map();
    const routeConfig = GAME_CONFIG.survival.routeAssist?.nodes ?? [];
    const spawnPoints = GAME_CONFIG.survival.spawnPoints ?? [];

    for (const node of routeConfig) {
      this.addNode(node.id, node.position, node.links ?? []);
    }

    for (const pos of spawnPoints) {
      const id = `spawn_${pos[0].toFixed(0)}_${pos[2].toFixed(0)}`;
      if (!this.nodeMap.has(id)) {
        this.addNode(id, pos, []);
      }
    }

    for (const pos of spawnPoints) {
      const spawnId = `spawn_${pos[0].toFixed(0)}_${pos[2].toFixed(0)}`;
      const nearestRouteNode = this.getNearestRouteNode(new THREE.Vector3(...pos));
      if (nearestRouteNode && nearestRouteNode.id !== spawnId) {
        const spawnNode = this.nodeMap.get(spawnId);
        if (spawnNode) {
          if (!spawnNode.links.includes(nearestRouteNode.id)) {
            spawnNode.links.push(nearestRouteNode.id);
          }
          if (!nearestRouteNode.links.includes(spawnId)) {
            nearestRouteNode.links.push(spawnId);
          }
        }
      }
    }

    this.ready = true;
  }

  addNode(id, position, links) {
    const node = {
      id,
      position: [...position],
      links: [...links],
      neighbors: []
    };
    this.nodes.push(node);
    this.nodeMap.set(id, node);
    nodePositions.set(id, node.position);
    adjacencyList.set(id, node.links);
  }

  getNode(id) {
    return this.nodeMap.get(id);
  }

  getNodeAtPosition(position) {
    let bestNode = null;
    let bestDist = Infinity;

    for (const node of this.nodes) {
      const dist = Math.hypot(
        position.x - node.position[0],
        position.y - node.position[1],
        position.z - node.position[2]
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    return bestNode;
  }

  findPath(fromPos, toPos) {
    if (!this.ready) return null;

    const startNode = this.getNodeAtPosition(fromPos);
    const endNode = this.getNodeAtPosition(toPos);

    if (!startNode || !endNode) return null;
    if (startNode === endNode) return [endNode.position];

    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = startNode.id;
    const endKey = endNode.id;

    openSet.set(startKey, startNode);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(startNode.position, endNode.position));

    while (openSet.size > 0) {
      let current = null;
      let currentF = Infinity;
      for (const [id, node] of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < currentF) {
          currentF = f;
          current = id;
        }
      }

      if (current === endKey) {
        return this.reconstructPath(cameFrom, endKey);
      }

      openSet.delete(current);
      closedSet.add(current);

      const currentNode = this.nodeMap.get(current);
      const neighbors = this.getDirectNeighbors(currentNode);

      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor.id)) continue;

        const tentativeG = (gScore.get(current) ?? Infinity) +
          heuristic(currentNode.position, neighbor.position);

        if (!openSet.has(neighbor.id)) {
          openSet.set(neighbor.id, neighbor);
        } else if (tentativeG >= (gScore.get(neighbor.id) ?? Infinity)) {
          continue;
        }

        cameFrom.set(neighbor.id, current);
        gScore.set(neighbor.id, tentativeG);
        fScore.set(neighbor.id, tentativeG + heuristic(neighbor.position, endNode.position));
      }
    }

    return null;
  }

  getDirectNeighbors(node) {
    const neighbors = [];
    for (const linkId of node.links) {
      const neighbor = this.nodeMap.get(linkId);
      if (neighbor) neighbors.push(neighbor);
    }
    return neighbors;
  }

  reconstructPath(cameFrom, current) {
    const path = [];
    let curr = current;
    while (curr) {
      const node = this.nodeMap.get(curr);
      if (node) path.unshift([...node.position]);
      curr = cameFrom.get(curr);
    }
    return path;
  }

  findNearestNode(position) {
    return this.getNodeAtPosition(position);
  }

  getNearestRouteNode(position) {
    let bestNode = null;
    let bestDist = Infinity;

    for (const node of this.nodes) {
      if (node.id.startsWith("spawn_")) {
        continue;
      }

      const dist = Math.hypot(
        position.x - node.position[0],
        position.y - node.position[1],
        position.z - node.position[2]
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    return bestNode;
  }

  getNextWaypoint(fromPos, toPos) {
    const path = this.findPath(fromPos, toPos);
    if (!path || path.length < 2) return null;

    const fromNode = this.getNodeAtPosition(fromPos);
    if (fromNode && path.length > 1) {
      if (path[0][0] === fromNode.position[0] &&
          path[0][1] === fromNode.position[1] &&
          path[0][2] === fromNode.position[2]) {
        return new THREE.Vector3(...path[1]);
      }
    }
    return new THREE.Vector3(...path[1]);
  }

  findRetreatPoint(fromPos, threatPos) {
    let bestPoint = null;
    let bestScore = -Infinity;

    for (const node of this.nodes) {
      const nodeVec = new THREE.Vector3(...node.position);
      const toNode = nodeVec.clone().sub(threatPos);
      const toNodeDist = toNode.length();

      if (toNodeDist < 5) continue;

      const fromToNode = new THREE.Vector3(...node.position).sub(fromPos);
      const dot = fromToNode.dot(toNode.normalize());

      if (dot > bestScore) {
        bestScore = dot;
        bestPoint = node.position;
      }
    }

    return bestPoint ? new THREE.Vector3(...bestPoint) : null;
  }

  findCoverPoint(fromPos, threatPos, minDistance = 3, maxDistance = 8) {
    const candidates = [];
    const threatDir = new THREE.Vector3().subVectors(threatPos, fromPos).normalize();
    const perpendicular = new THREE.Vector3().crossVectors(threatDir, UP).normalize();

    for (const node of this.nodes) {
      const nodePos = new THREE.Vector3(...node.position);
      const toNode = nodePos.clone().sub(fromPos);
      const dist = toNode.length();

      if (dist < minDistance || dist > maxDistance) continue;

      const dot = toNode.normalize().dot(threatDir);
      if (dot > -0.3) continue;

      const lateral = Math.abs(toNode.normalize().dot(perpendicular));
      if (lateral < 0.3) continue;

      candidates.push({ node, score: lateral * 0.7 + (1 - Math.abs(dot)) * 0.3 });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return new THREE.Vector3(...candidates[0].node.position);
  }
}
