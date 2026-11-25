/*
 * camera.js — Os "olhos de verdade" do robô: a câmera do celular.
 * Tira uma foto pequena na hora em que você fala com ele, para a IA ver.
 * A câmera só fica ligada quando você liga (botão 📷) e aparece uma
 * miniatura no canto da tela enquanto ela está ligada.
 */

class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.lado = 'user';   // 'user' = câmera da frente | 'environment' = de trás
  }

  get ligada() {
    return !!this.stream;
  }

  async ligar(lado = this.lado) {
    this.desligar();
    this.lado = lado;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ErroRobo('sem-camera', 'Este navegador não deixa usar a câmera.');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: lado, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (e) {
      this.stream = null;
      if (e.name === 'NotAllowedError') {
        throw new ErroRobo('camera-bloqueada', 'A câmera está bloqueada. Libere nas permissões do site (cadeado ao lado do endereço).');
      }
      throw new ErroRobo('sem-camera', 'Não consegui ligar a câmera.');
    }
    this.video.srcObject = this.stream;
    // A câmera da frente aparece espelhada na miniatura, como um espelho
    this.video.classList.toggle('espelhado', lado === 'user');
    await this.video.play().catch(() => {});
    // Espera a imagem começar a chegar
    await new Promise((pronto) => {
      if (this.video.readyState >= 2) return pronto();
      this.video.onloadeddata = () => pronto();
      setTimeout(pronto, 1500);
    });
  }

  desligar() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  /** Tira uma foto pequena (JPEG) e devolve como texto "data:image/jpeg;base64,..." */
  foto(tamanhoMax = 512) {
    if (!this.stream) return null;
    const v = this.video;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return null;
    const escala = Math.min(1, tamanhoMax / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * escala);
    c.height = Math.round(h * escala);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  }
}
