# Navmesh Brief

Create a navigation mesh for the current arena from
[`examples/models/gltf/collision-world.glb`](/home/alan/home_ai/projects/threefps/examples/models/gltf/collision-world.glb).

## Purpose

This asset is for AI navigation only.

It will not be visible in-game.
Its job is to describe where enemies are allowed to walk so they can:
- find stairs and ramps
- move between lower and upper levels
- chase the player reliably
- stop getting stuck under platforms

## Deliverable

Export a single GLB file:

`assets/nav/collision-world-navmesh.glb`

Object name inside Blender:

`NavMesh`

## Source Asset

Import this file into Blender:

`examples/models/gltf/collision-world.glb`

## Workflow

1. Import `collision-world.glb` into Blender.
2. Duplicate the level mesh.
3. Rename the duplicate `NavMesh`.
4. Hide the original visual mesh.
5. Edit only the `NavMesh` copy.
6. Delete all geometry enemies should not walk on.
7. Keep only the surfaces enemies should path across.
8. Simplify the remaining geometry aggressively.
9. Export only `NavMesh` as a `.glb`.

## Keep

- Main floors
- Stairs
- Ramps
- Upper walkways
- Platforms enemies should be able to reach
- Spawn-to-combat traversal routes

## Remove

- Walls
- Ceilings
- Railings
- Props
- Trim
- Decorative clutter
- Undersides of geometry
- Thin lips and bevel details
- Any surface enemies should not stand on

## Modeling Rules

- Prioritize correctness over appearance.
- Keep the mesh low poly and clean.
- Stairs may be simplified into a smooth ramp-like surface if that produces cleaner navigation.
- Avoid tiny steps, seams, gaps, slivers, and jagged edges.
- Do not include disconnected islands unless enemies are truly meant to reach them.
- Only connect areas if the enemy can physically travel between them.
- Slightly over-simplified is better than noisy.

## Validation Checklist

Before export, verify:

- Enemies can move from all intended spawn areas to all intended combat areas.
- Lower and upper levels are connected where stairs/ramps exist.
- There are no accidental walkable surfaces on walls or props.
- There are no floating navmesh islands.
- There are no tiny holes or narrow strips that could confuse pathfinding.
- The mesh sits cleanly on the intended walk surfaces.

## Export Settings

- Export format: `glb`
- Export only the `NavMesh` object
- Apply transforms if needed
- Do not include extra hidden scene objects

## Notes

- This is not the collision mesh and not the visible map mesh.
- This is a separate AI-only asset.
- A simple, continuous, readable walkable mesh is the target.
- If a staircase is messy, simplify it.
- If a platform transition is ambiguous, make the traversable intent obvious in the navmesh.
