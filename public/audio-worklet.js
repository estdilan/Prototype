class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const inputData = inputs[0][0];
    if (!inputData || !this.port) return true;

    const float32 = new Float32Array(inputData.length);
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      float32[i] = s;
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage({ pcm16, float32 });
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
