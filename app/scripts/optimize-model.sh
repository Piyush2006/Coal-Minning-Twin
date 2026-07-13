#!/usr/bin/env sh
# Optimize a GLB for the twin: weld verts, simplify meshes, prune unused data,
# resize textures to 2048, plain GLB out (no draco/meshopt — the runtime loads
# with the standard GLTFLoader). Usage:
#   npm run model:optimize -- input.glb public/models/output.glb
set -e
[ -z "$2" ] && { echo "usage: optimize-model.sh <input.glb> <output.glb>"; exit 1; }
npx --yes @gltf-transform/cli optimize "$1" "$2" \
  --texture-size 2048 --compress false --simplify true --weld true --prune true
