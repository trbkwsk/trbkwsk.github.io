#!/bin/bash
# Дымовой тест: поднимает игру в headless Chrome, входит в фазу рисования и
# требует, чтобы ни один кадр не упал. Остальные тесты проверяют чистые
# правила и игру не запускают — из-за этого ReferenceError в animate() жил
# неделю: падал каждый кадр фазы paint, срывая applyCanGrip и renderer.render.
set -u
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -x "$CHROME" ] || { echo "ПРОПУСК: Chrome не найден"; exit 0; }
PORT=8799
python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; rm -f "$ROOT/play/__smoke.html"' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/play/index.html" && break
  sleep 0.3
done

python3 - "$ROOT" <<'PY'
import pathlib, sys
play = pathlib.Path(sys.argv[1]) / 'play'
probe = '''<script>
window.__errs=[];
addEventListener('error',e=>{__errs.push((e.message||'')+'@'+(e.lineno||''));});
addEventListener('unhandledrejection',e=>{__errs.push('promise:'+e.reason);});
function ready(){const b=document.getElementById('start');return window.SF&&b&&!b.disabled&&b.textContent==='ENTER';}
function go(){
  if(!ready()){setTimeout(go,300);return;}
  const s=SF.state,p=SF.player;
  SF.start();
  p.root.position.set(SF.surfaces[0].x,0,SF.surfaces[0].z+1.4);
  p.root.rotation.y=0; s.nearWall=true;
  dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
  setTimeout(()=>{
    // прогоняем покадровую последовательность руками: под виртуальным
    // временем rAF почти не тикает, а проверить надо именно кадр
    let bad='';
    try{
      for(let i=0;i<30;i++){ p.updateMixer(1/60); p.applyCanGrip(); SF.updatePaint(performance.now()+i*16.7,1/60); }
    }catch(e){ bad='бросок:'+e.message; }
    document.title='ДЫМ фаза='+s.phase+' ОШИБОК='+(__errs.length)+(bad?' '+bad:'')+(__errs[0]?' '+__errs[0]:'');
  },2500);
}
setTimeout(go,500);
</script>'''
src = (play / 'index.html').read_text()
(play / '__smoke.html').write_text(src.replace('</head>', probe + '</head>', 1))
PY

TITLE=""
for _ in 1 2 3; do
  TITLE=$("$CHROME" --headless=new --no-sandbox --enable-unsafe-swiftshader \
    --use-gl=angle --use-angle=swiftshader --window-size=1280,720 \
    --virtual-time-budget=250000 --dump-dom \
    "http://127.0.0.1:$PORT/play/__smoke.html" 2>/dev/null \
    | grep -o '<title>[^<]*</title>' | head -1)
  case "$TITLE" in *ДЫМ*) break;; esac
done

echo "$TITLE"
case "$TITLE" in
  *"фаза=paint ОШИБОК=0"*) echo "PASS: кадр фазы рисования проходит целиком"; exit 0;;
  *ДЫМ*) echo "FAIL: кадр фазы рисования падает"; exit 1;;
  *) echo "FAIL: игра не дошла до готовности"; exit 1;;
esac
