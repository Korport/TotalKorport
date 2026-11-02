export class Audio {
  private context: AudioContext | null = null;
  enabled = true;
  private last = 0;
  unlock() {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume().catch(() => {});
  }
  tone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.035,
  ) {
    if (!this.enabled || !this.context) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      frequency * 0.45,
      c.currentTime + duration,
    );
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  shot(time: number) {
    if (time - this.last < 0.15) return;
    this.last = time;
    this.tone(100, 0.06, "sawtooth", 0.012);
  }
}
