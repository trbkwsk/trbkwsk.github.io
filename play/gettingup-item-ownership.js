'use strict';
// Independent semantic reference for the bounded diagnostic ownership leaves.
// Not an actor/manager/inventory constructor and not a hand-rendering system.
function word(x) {
  if (!Number.isInteger(x) || x < 0 || x > 0xffffffff) throw new Error('explicit uint32 required');
  return x;
}
function replay(operations, control=null) {
  if (!Array.isArray(operations)) throw new Error('operation array required');
  const actors=new Map(), registry=new Map(), rows=[];
  let id=0xffffffff, previous=0xffffffff, character=false, owned=false, disabled=false, present=true;
  function actor(name) {
    if (typeof name!=='string' || !name) throw new Error('actor label required');
    if (!actors.has(name)) actors.set(name,{id:0,disabled:false});
    return actors.get(name);
  }
  function flag(value) {if (value!==0 && value!==1) throw new Error('explicit boolean byte required');return Boolean(value);}
  for (const operation of operations) {
    let resolved=null;
    switch(operation.op) {
      case 'id': actor(operation.actor).id=word(operation.value);break;
      case 'insert': {
        const a=actor(operation.actor);
        // This bounded corpus uses unique keys; the oldest match wins in the
        // original hash walk, so retain an existing mapping for duplicate keys.
        if (!registry.has(a.id)) registry.set(a.id,operation.actor);
        break;
      }
      case 'own':
        previous=id;
        if (operation.actor===null) {
          id=0xffffffff;character=false;
          if (control==='clear-previous') previous=0xffffffff;
        } else {
          id=actor(operation.actor).id;character=true;owned=true;
        }
        break;
      case 'actor-disabled': actor(operation.actor).disabled=flag(operation.value);break;
      case 'manager-disabled': disabled=flag(operation.value);break;
      case 'manager-present': present=flag(operation.value);break;
      case 'lookup': {
        let found=registry.get(id);
        if (control==='skip-registry') found=[...actors.keys()].find(k=>actors.get(k).id===id);
        if (present && !disabled && (id!==0 || control==='allow-zero-id') && found!==undefined &&
            (!actors.get(found).disabled || control==='ignore-disabled')) resolved=found;
        if (control==='pointer-not-id' && id!==0xffffffff && id!==0) resolved=null;
        break;
      }
      default: throw new Error('unknown diagnostic operation');
    }
    rows.push({operation:{...operation},owner_id:id,previous_owner_id:previous,
      is_character:character,owned,resolved});
  }
  return rows;
}
if (typeof module!=='undefined') module.exports={replay};
