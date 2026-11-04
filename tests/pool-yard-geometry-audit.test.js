'use strict';
const assert=require('assert'),fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..'),audit=require('../play/pool-yard-geometry-audit.json');
for(const expected of audit.files){
  const bytes=fs.readFileSync(path.join(root,expected.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256);
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString().replace(/\0+$/,''));
  const actual={meshes:(json.meshes||[]).length,primitives:0,position:0,normals:0,tangents:0,uv0:0,indexed:0};
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){const a=primitive.attributes||{};actual.primitives++;
    actual.position+=a.POSITION!==undefined;actual.normals+=a.NORMAL!==undefined;actual.tangents+=a.TANGENT!==undefined;
    actual.uv0+=a.TEXCOORD_0!==undefined;actual.indexed+=primitive.indices!==undefined;}
  for(const key of Object.keys(actual))assert.equal(actual[key],expected[key],`${expected.path}: ${key}`);
  assert.equal(actual.position,actual.primitives);assert.equal(actual.normals,actual.primitives);assert.equal(actual.uv0,actual.primitives);
}
console.log('pool-yard geometry audit: 4 GLBs verified');
