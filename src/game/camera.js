// The part of the world on screen. At zoom 1 the whole world fills the view;
// zoomed in, a smaller window of it does, and the window can be moved
// around. Positions are in world cells; (fx, fy) are fractions across and
// down the view, so (0.5, 0.5) is its centre.

export const MAX_ZOOM = 12;
const STEPS = [1, 1.5, 2, 3, 4, 6, 8, 12];

export class Camera {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.zoom = 1;
    this.x = 0; // top-left corner of the view
    this.y = 0;
  }

  get maxZoom() { return MAX_ZOOM; }
  get vw() { return this.w / this.zoom; }
  get vh() { return this.h / this.zoom; }

  // Zoom to z, keeping whatever is at (fx, fy) in the same place on screen.
  zoomTo(z, fx = 0.5, fy = 0.5) {
    const px = this.x + fx * this.vw, py = this.y + fy * this.vh;
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, z));
    this.anchor(px, py, fx, fy);
  }

  // Move the view so world point (px, py) is at (fx, fy).
  anchor(px, py, fx, fy) {
    this.x = px - fx * this.vw;
    this.y = py - fy * this.vh;
    this.clamp();
  }

  // Step to the next zoom level in (dir > 0) or out.
  step(dir, fx, fy) {
    const z = this.zoom;
    const next = dir > 0
      ? STEPS.find((s) => s > z + 0.01) ?? MAX_ZOOM
      : [...STEPS].reverse().find((s) => s < z - 0.01) ?? 1;
    this.zoomTo(next, fx, fy);
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  centerOn(x, y) {
    this.x = x - this.vw / 2;
    this.y = y - this.vh / 2;
    this.clamp();
  }

  // Keep the view inside the world.
  clamp() {
    this.x = Math.min(Math.max(0, this.x), this.w - this.vw);
    this.y = Math.min(Math.max(0, this.y), this.h - this.vh);
  }

  // The world cell at (fx, fy). A pointer dragged off the view gives cells
  // outside the world, as it did before zooming existed.
  cellAt(fx, fy) {
    return { x: Math.floor(this.x + fx * this.vw), y: Math.floor(this.y + fy * this.vh) };
  }
}
