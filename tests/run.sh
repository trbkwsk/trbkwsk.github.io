#!/bin/sh
# Запуск правил SprayFight без Node — через JavaScriptCore, который есть в macOS.
# Node на машине не установлен, поэтому `node tests/sprayfight-rules.mjs` не работал
# и тесты ни разу не выполнялись. Этот раннер подменяет node:assert и console.
set -e
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
export default {equal:eq,throws:thr,get count(){return n}};
JS
sed "s#\.\./play/paint-rules\.mjs#./paint-rules.mjs#g;s#node:assert/strict#./assert.mjs#;s#console\.log#print#g" \
  "$DIR/sprayfight-rules.mjs" > "$TMP/run.mjs"
printf "\nimport __a from './assert.mjs';\nprint('проверок: '+__a.count);\n" >> "$TMP/run.mjs"
cd "$TMP" && "$JSC" --module-file=run.mjs
rm -rf "$TMP"
