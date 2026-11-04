#!/bin/sh
# Правила SprayFight запускаются через системный JavaScriptCore на macOS.
# Дополнительная проверка Enhanced-пресета использует Node, когда он доступен.
set -e
if command -v node >/dev/null 2>&1; then
  node "$(dirname "$0")/pool-yard-enhancement.test.js"
fi
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
[ -x "$JSC" ] || { echo "jsc не найден"; exit 1; }
DIR=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
cp "$DIR/../play/paint-rules.mjs" "$TMP/"
cat > "$TMP/assert.mjs" <<'JS'
let n=0;
const eq=(a,b,m)=>{n++;if(!Object.is(a,b)&&JSON.stringify(a)!==JSON.stringify(b))
  throw new Error(`FAIL #${n}: ${m||''} получено ${a}, ожидалось ${b}`);};
const thr=(f,m)=>{n++;let ok=false;try{f()}catch(e){ok=true}
  if(!ok)throw new Error(`FAIL #${n}: ${m||''} исключения не было`);};
const ok=(v,m)=>{n++;if(!v)throw new Error(`FAIL #${n}: ${m||''} ожидалось истинное значение`);};
export default {equal:eq,throws:thr,ok,get count(){return n}};
JS
sed "s#\.\./play/paint-rules\.mjs#./paint-rules.mjs#g;s#node:assert/strict#./assert.mjs#;s#console\.log#print#g" \
  "$DIR/sprayfight-rules.mjs" > "$TMP/run.mjs"
printf "\nimport __a from './assert.mjs';\nprint('проверок: '+__a.count);\n" >> "$TMP/run.mjs"
cd "$TMP" && "$JSC" --module-file=run.mjs
rm -rf "$TMP"
