/**
 * Web Audio API procedural sound synthesizer for 4-cylinder 4-stroke engine
 * Zero external audio files, 100% synthesized in real time.
 */

class EngineSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private masterGain: GainNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  private midOsc: OscillatorNode | null = null;
  private midGain: GainNode | null = null;
  private highOsc: OscillatorNode | null = null;
  private highGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;

  private isInitialized = false;

  private init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume * 0.35;
      this.masterGain.connect(this.ctx.destination);

      // 1. Sub fundamental (combustion pulse frequency)
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sawtooth';
      this.subGain = this.ctx.createGain();
      this.subGain.gain.value = 0.25;
      this.subOsc.connect(this.subGain);
      this.subGain.connect(this.masterGain);
      this.subOsc.start();

      // 2. Mid harmonic (crankshaft & mechanical resonance)
      this.midOsc = this.ctx.createOscillator();
      this.midOsc.type = 'triangle';
      this.midGain = this.ctx.createGain();
      this.midGain.gain.value = 0.35;
      this.midOsc.connect(this.midGain);
      this.midGain.connect(this.masterGain);
      this.midOsc.start();

      // 3. High valve tap harmonic
      this.highOsc = this.ctx.createOscillator();
      this.highOsc.type = 'sine';
      this.highGain = this.ctx.createGain();
      this.highGain.gain.value = 0.15;
      this.highOsc.connect(this.highGain);
      this.highGain.connect(this.masterGain);
      this.highOsc.start();

      // 4. Mechanical chain & friction white noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.value = 1200;
      this.noiseFilter.Q.value = 3.0;

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.08;

      this.noiseNode.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.masterGain);
      this.noiseNode.start();

      this.isInitialized = true;
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  public update(rpm: number, isRunning: boolean) {
    if (!this.isInitialized) return;
    if (!this.ctx || !this.masterGain) return;

    if (!isRunning || rpm <= 50 || this.isMuted) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Firing frequency for a 4-stroke 4-cylinder engine:
    // F_fire = (RPM / 60) * 2 pulses per second
    const fireFreq = Math.max(12, (rpm / 60) * 2);
    const now = this.ctx.currentTime;

    if (this.subOsc) {
      this.subOsc.frequency.setTargetAtTime(fireFreq, now, 0.03);
    }
    if (this.midOsc) {
      // Mechanical second harmonic
      this.midOsc.frequency.setTargetAtTime(fireFreq * 2, now, 0.03);
    }
    if (this.highOsc) {
      // Valve chatter 4th harmonic
      this.highOsc.frequency.setTargetAtTime(fireFreq * 4, now, 0.03);
    }
    if (this.noiseFilter) {
      // Timing chain whir frequency scales with RPM
      this.noiseFilter.frequency.setTargetAtTime(800 + (rpm / 6000) * 1800, now, 0.04);
    }

    // Dynamic volume scaling: quieter at idle, deeper and louder at 6000 RPM
    const throttleGain = (0.2 + 0.8 * Math.pow(rpm / 6000, 0.75)) * this.volume * 0.35;
    this.masterGain.gain.setTargetAtTime(throttleGain, now, 0.04);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume * 0.35, this.ctx.currentTime, 0.03);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.35, this.ctx.currentTime, 0.03);
    }
  }

  public start() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

export const engineAudio = new EngineSoundEngine();
