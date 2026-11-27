import fs from 'fs'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
globalThis.self = globalThis
globalThis.FileReader = class { readAsArrayBuffer(b){ b.arrayBuffer().then(r=>{this.result=r; this.onloadend&&this.onloadend()}) } readAsDataURL(b){ b.arrayBuffer().then(r=>{this.result='data:application/octet-stream;base64,'+Buffer.from(r).toString('base64'); this.onloadend&&this.onloadend()}) } }
const [,, inp, out] = process.argv
const buf = fs.readFileSync(inp)
const loader = new FBXLoader()
console.warn = () => {}
const g = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength), '')
const rm = []
g.traverse(o => { if (o.isLight) rm.push(o); if (o.isMesh) { o.material = [].concat(o.material).map(m => new THREE.MeshStandardMaterial({ name: m.name })); if (o.material.length===1) o.material=o.material[0]; console.log(o.name, o.geometry.attributes.position.count, o.geometry.groups.length, Object.keys(o.geometry.attributes)) } })
rm.forEach(o => o.removeFromParent())
new GLTFExporter().parse(g, (res) => { fs.writeFileSync(out, Buffer.from(res)); console.log('wrote', out, res.byteLength) }, (e) => console.error(e), { binary: true })
