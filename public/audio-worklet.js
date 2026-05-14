class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const inputData = inputs[0][0];
    
    if (inputData && this.port) {
      // Convertir float32 [-1.0, 1.0] a int16 [-32768, 32767]
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Enviar datos procesados al hilo principal
      this.port.postMessage({ pcm16: pcm16 });
    }
    
    return true; // Continuar procesando
  }
}

registerProcessor('audio-processor', AudioProcessor);
