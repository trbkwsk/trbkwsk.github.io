# Pool Yard presentation modes

`Original` preserves the materials, light intensities and tone mapping loaded by
the published Pool Yard preview.

`Enhanced` is an authored remaster presentation, not recovered original game
data. It currently adds:

- ACES filmic tone mapping;
- a balanced sun/fill/rim light rig;
- 2048 px soft directional shadows;
- material-class roughness/metalness policies for concrete, metal, glass,
  foliage, Trane's skin/clothes and the paint can.

The mode is reversible at runtime. It does not modify GLB files, textures,
geometry, skeletons, animation data, collision data or graffiti simulation.
The diagnostics snapshot records the active mode and labels it
`authored_remaster: true`.
