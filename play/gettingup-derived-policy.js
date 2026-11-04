/* Exact derived +58 policy; deliberately separate from the base actor API.
 * Not a complete derived controller, constructor or gameplay interpreter.
 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const P=node?require('./gettingup-transition-parameter.js'):root.GettingUpTransitionParameter;
  const api=factory(P);if(node)module.exports=api;else root.GettingUpDerivedPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(P){'use strict';
  if(!P)throw Error('packed transition parameter library required');
  function minimum(enabled,incomingFlags,actorFlags,minTween,actorClass='derived'){
    if(!Number.isInteger(enabled)||enabled<0||enabled>255)throw Error('unsigned enabled byte required');
    const incoming=P.decode(incomingFlags).raw,current=P.decode(actorFlags).raw,floor=P.decode(minTween).raw;
    if(actorClass!=='base'&&actorClass!=='derived')throw Error('explicit base or derived actor class required');
    return actorClass==='base'||!enabled||((incoming|current)&0x20000)?0:floor;
  }
  function selection(request,enabled,incomingFlags,actorFlags,minTween,override=null,actorClass='derived'){
    return P.queueParameter(request,minimum(enabled,incomingFlags,actorFlags,minTween,actorClass),override);
  }
  return Object.freeze({minimum,selection});
});
