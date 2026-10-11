import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraInput, keyboardSpray, fastSpray, sneakInput, editableTarget, RESERVED_KEYS} from '../play/input-bindings.mjs';

test('keyboard painting requires V plus U or O; releasing either stops',()=>{
  for(const keys of [{},{KeyV:true},{KeyU:true},{KeyO:true},{KeyV:false,KeyU:true}])assert.equal(keyboardSpray(keys),false);
  assert.equal(keyboardSpray({KeyV:true,KeyU:true}),true);
  assert.equal(keyboardSpray({KeyV:true,KeyO:true}),true);
  assert.equal(fastSpray({KeyV:true,KeyU:true}),false);
  assert.equal(fastSpray({KeyV:true,KeyO:true}),true);
  assert.equal(fastSpray({KeyO:true}),false);
});
test('camera directions and opposite-key cancellation',()=>{
  assert.deepEqual(cameraInput({KeyI:true,KeyL:true}),{yaw:1,pitch:1});
  assert.deepEqual(cameraInput({KeyK:true,KeyJ:true}),{yaw:-1,pitch:-1});
  assert.deepEqual(cameraInput({KeyI:true,KeyK:true,KeyJ:true,KeyL:true}),{yaw:0,pitch:0});
});
test('Shift sneaks; Ctrl and touch reach do not',()=>{
  assert.equal(sneakInput({ShiftLeft:true}),true);
  assert.equal(sneakInput({ShiftRight:true}),true);
  assert.equal(sneakInput({ControlLeft:true,TouchReach:true}),false);
});
test('original action keys are reserved, extensions are separate',()=>{
  for(const code of ['KeyF','Tab','ArrowUp','Digit1','Digit2','Digit3','Digit4','KeyC'])assert.ok(RESERVED_KEYS.has(code));
  for(const code of ['KeyR','Digit6','Digit7','Digit8','Digit9','Digit0'])assert.ok(!RESERVED_KEYS.has(code));
});
test('editable UI targets are ignored',()=>{
  assert.equal(editableTarget(null),false);
  assert.equal(editableTarget({closest:()=>null}),false);
  assert.equal(editableTarget({closest:()=>({})}),true);
});
