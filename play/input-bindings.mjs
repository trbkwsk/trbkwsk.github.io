// Physical KeyboardEvent.code: works independently of the keyboard language.
export function cameraInput(keys) {
  return {yaw: Number(!!keys.KeyL)-Number(!!keys.KeyJ),
    pitch: Number(!!keys.KeyI)-Number(!!keys.KeyK)};
}
export function keyboardSpray(keys) {
  return !!(keys.KeyV && (keys.KeyU || keys.KeyO));
}
export function fastSpray(keys) { return !!(keys.KeyV && keys.KeyO); }
export function sneakInput(keys) { return !!(keys.ShiftLeft || keys.ShiftRight); }
export function editableTarget(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable="true"]');
}
export const RESERVED_KEYS = new Set([
  'KeyF','Tab','ArrowUp','KeyZ','KeyX','KeyC','KeyB','KeyT',
  'Digit1','Digit2','Digit3','Digit4'
]);
