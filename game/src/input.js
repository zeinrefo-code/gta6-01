// input.js — keyboard + mouse state, with edge-triggered "just pressed" keys.
// I wrote this file fresh for Solmar Heat; it replaces the starter's input module.
export function createInput(canvas) {
  const I = {
    keys: {}, pressed: {}, mouse: { x: 0, y: 0, down: false, clicked: false },
    init() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        const k = e.key.toLowerCase();
        if (!this.keys[k]) this.pressed[k] = true;
        this.keys[k] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; } });
      window.addEventListener('mouseup', () => { this.mouse.down = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });
    },
    down(...names) { return names.some(n => this.keys[n]); },
    hit(...names) { return names.some(n => this.pressed[n]); },
    endFrame() { this.pressed = {}; this.mouse.clicked = false; },
  };
  return I;
}
