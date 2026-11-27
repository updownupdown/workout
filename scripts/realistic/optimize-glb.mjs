import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, weld, meshopt, joinPrimitives, join } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const [,, inp, out] = process.argv
const doc = await io.read(inp)
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const c = p.getAttribute('COLOR_0'); if (c) { p.setAttribute('COLOR_0', null); c.dispose() } }
await doc.transform(dedup({ propertyTypes: ['Accessor','Mesh','Texture'] }), weld())
for (const m of doc.getRoot().listMeshes()) {
  const by = new Map(); for (const p of m.listPrimitives()) { const k = p.getMaterial(); if (!by.has(k)) by.set(k, []); by.get(k).push(p) }
  for (const [mat, ps] of by) { if (ps.length < 2) continue; const j = joinPrimitives(ps); j.setMaterial(mat); for (const p of ps) { m.removePrimitive(p); p.dispose() } m.addPrimitive(j) }
}
await doc.transform(dedup({ propertyTypes: ['Accessor','Mesh','Texture'] }), weld(), join({ keepNamed: false }), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
for (const m of doc.getRoot().listMeshes()) console.log(m.getName(), m.listPrimitives().map(p => p.getMaterial()?.getName() + ':' + p.getAttribute('POSITION').getCount()))
console.log('skins', doc.getRoot().listSkins().length, doc.getRoot().listSkins().map(s=>s.listJoints().length), 'nodes w/ skin', doc.getRoot().listNodes().filter(n=>n.getSkin()).length)
await io.write(out, doc)
