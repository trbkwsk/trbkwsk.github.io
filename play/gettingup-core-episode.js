/* UI session over the existing native-validated episode, not a second sampler.
 * Playback rate is diagnostic. No native capture supplies controller inputs.
 */
(function(root,factory){
  const E=typeof module==='object'&&module.exports?require('./gettingup-fresh-layer-episode.js'):root.GettingUpFreshLayerEpisode;
  const R=typeof module==='object'&&module.exports?require('./gettingup-superrun-episode.js'):root.GettingUpSuperRunEpisode;
  const api=factory(E,R);if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpCoreEpisode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E,R){'use strict';
  const KEYS=Object.freeze(['bones','codes','descriptors','held','inverseBindMatrices','masks','operations','source','source_flags','steps','target','target_flags']);
  const CASES=Object.freeze(['derived-3','default-power-superrun']);
  function keys(name){if(!CASES.includes(name))throw Error('known native-validated Core case required');return name==='derived-3'?KEYS:[...KEYS,'superrun']}
  function canonical(value){
    if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
    if(typeof value==='number'){if(!Number.isFinite(value))throw Error('finite JSON numbers required');return Object.is(value,-0)?'-0':JSON.stringify(value)}
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
    throw Error('complete JSON inputs required');
  }
  function inputText(data,name='derived-3'){
    const required=keys(name);
    if(!data||required.some(k=>!Object.hasOwn(data,k)))throw Error('all original inputs for the selected Core case required');
    return canonical(Object.fromEntries(required.map(k=>[k,data[k]])));
  }
  function clone(value){
    if(Array.isArray(value))return value.map(clone);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)]));
    return value;
  }
  class Session{
    constructor(data,name='derived-3'){
      if(data?.schema!==1||data.kind!=='gettingup-native-gear-continuation'||!Array.isArray(data.bones)||data.bones.length!==48||
        !/^[a-f0-9]{64}$/.test(data.model_sha256||''))throw Error('full 48-bone Core episode sidecar required');
      inputText(data,name);this.caseName=name;this.data=clone(Object.fromEntries(keys(name).map(k=>[k,data[k]])));this.modelSHA=data.model_sha256;
      this.limit=160;this.playing=false;this.carry=0;this.controller=this.makeController();
    }
    makeController(){return this.caseName==='derived-3'?new E.FreshLayerEpisode(this.data,'derived-3'):new R.SuperRunEpisode(this.data)}
    get position(){return this.controller.stepCount}
    seek(position){
      if(!Number.isInteger(position)||position<0||position>this.limit)throw Error('Core step must be an integer from 0 to 160');
      const next=this.makeController();
      for(let i=0;i<position;i++)next.continueStep();
      this.controller=next;this.playing=false;this.carry=0;return this.snapshot();
    }
    step(count=1){
      if(!Number.isInteger(count)||count<1||count>this.limit-this.position)throw Error('Core batch exceeds the remaining verified episode');
      this.playing=false;this.carry=0;for(let i=0;i<count;i++)this.controller.continueStep();return this.snapshot();
    }
    setPlaying(value){
      if(typeof value!=='boolean'||value&&this.position===this.limit)throw Error('seek or reset before replaying a finished Core episode');
      this.playing=value;this.carry=0;
    }
    pump(seconds,rate){
      if(!Number.isFinite(seconds)||seconds<0||seconds>1||!Number.isInteger(rate)||rate<1||rate>60)throw Error('bounded diagnostic playback rate required');
      if(!this.playing)return 0;
      this.carry+=seconds*rate;let count=0;
      while(this.carry>=1&&this.position<this.limit){this.controller.continueStep();this.carry-=1;count++}
      if(this.position===this.limit){this.playing=false;this.carry=0}return count;
    }
    snapshot(){return clone({snapshot:this.controller.snapshot(),layer_snapshot:{...this.controller.layerSnapshot(),step:this.position}})}
  }
  return Object.freeze({KEYS,CASES,inputText,Session});
});
