/* Diagnostic original Core x87 matrix helpers, not a replacement for EXE.
 * Normal x87 64-significand arithmetic, named f32 stores, finite bounded
 * inputs. No exception/status-word or undefined fourth-column claim.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GettingUpCoreMatrix=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const f=Math.fround,identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],length=n=>n.toString(2).length;
 function rounded(n,s){if(s<=0)return n<<BigInt(-s);const k=BigInt(s),q=n>>k,r=n-(q<<k),h=1n<<(k-1n);return q+(r>h||r===h&&(q&1n)?1n:0n)}
 function ext(n,e,z=false){if(n===0n)return {n,e:0,z};const sign=n<0n?-1n:1n,s=Math.max(0,length(sign*n)-64);return {n:sign*rounded(sign*n,s),e:e+s,z:false}}
 function num(v){v=f(v);if(!Number.isFinite(v))throw Error('finite Core float32 required');const a=new Float32Array([v]),b=new Uint32Array(a.buffer)[0],sign=b>>>31?-1n:1n,e=(b>>>23)&255;return ext(sign*BigInt(e?(b&0x7fffff)|0x800000:b&0x7fffff),e?e-150:-149,Object.is(v,-0))}
 const neg=a=>({n:-a.n,e:a.e,z:a.n===0n?!a.z:false}),sign=a=>a.n<0n||a.n===0n&&a.z;
 function add(a,b){const e=Math.min(a.e,b.e),n=(a.n<<BigInt(a.e-e))+(b.n<<BigInt(b.e-e));return ext(n,e,n===0n&&a.n===0n&&b.n===0n&&a.z&&b.z)}
 const mul=(a,b)=>ext(a.n*b.n,a.e+b.e,sign(a)!==sign(b));
 function div(a,b){if(b.n===0n)throw Error('Core x87 division by zero');if(a.n===0n)return ext(0n,0,sign(a)!==sign(b));const n=a.n<0n?-a.n:a.n,d=b.n<0n?-b.n:b.n;let k=length(n)-length(d);if(k>=0?n<(d<<BigInt(k)):(n<<BigInt(-k))<d)k--;const s=63-k,N=s>=0?n<<BigInt(s):n,D=s>=0?d:d<<BigInt(-s);let q=N/D,r=N%D;if(2n*r>D||2n*r===D&&(q&1n))q++;return ext((sign(a)!==sign(b)?-1n:1n)*q,a.e-b.e-s)}
 function store(a){if(a.n===0n)return a.z?-0:0;const s=a.n<0n?-1:1,n=a.n<0n?-a.n:a.n,b=length(n),exp=a.e+b-1;if(exp>127)throw Error('Core float32 overflow outside diagnostic domain');const shift=exp<-126?-149-a.e:b-24,q=rounded(n,shift);return f(s*Number(q)*2**(a.e+shift))}
 const saved=a=>num(store(a)),one=num(1),two=num(2);
 function quaternionMatrix(q){
  if(!Array.isArray(q)||q.length!==4)throw Error('Core quaternion xyzw required');const [x,y,z,w]=q.map(num);if(f(q[3])===1)return identity();
  const n=add(add(add(mul(x,x),mul(y,y)),mul(z,z)),mul(w,w)),s=n.n===0n?one:div(two,n);
  const X=mul(s,x),Y=saved(mul(s,y)),Z=saved(mul(s,z)),XW=saved(mul(X,w)),YW=saved(mul(Y,w)),ZW=saved(mul(Z,w)),XX=mul(X,x),XY=mul(Y,x),XZ=mul(Z,x),YY=saved(mul(Y,y)),YZ=saved(mul(Z,y)),ZZ=mul(Z,z);
  const out=identity();[add(one,neg(add(YY,ZZ))),add(XY,neg(ZW)),add(XZ,YW),add(XY,ZW),add(one,neg(add(ZZ,XX))),add(YZ,neg(XW)),add(XZ,neg(YW)),add(YZ,XW),add(one,neg(add(YY,XX)))].forEach((v,i)=>out[4*Math.floor(i/3)+i%3]=store(v));return out;
 }
 function inverseUnit(matrix){
  if(!Array.isArray(matrix)||matrix.length!==16)throw Error('Core affine matrix required');const m=matrix.map(num),out=identity();for(let i=0;i<3;i++)for(let j=0;j<3;j++)out[4*i+j]=f(matrix[4*j+i]);
  const products=j=>[mul(num(out[j]),m[12]),mul(num(out[4+j]),m[13]),mul(num(out[8+j]),m[14])];
  for(let j=0;j<3;j++){const p=products(j);out[12+j]=store(neg(j===0?add(add(p[2],p[0]),p[1]):add(add(p[2],p[1]),p[0])))}return out;
 }
 return Object.freeze({quaternionMatrix,inverseUnit});
});
