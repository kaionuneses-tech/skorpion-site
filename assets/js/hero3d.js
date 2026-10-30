/* =====================================================================
   SKORPION — Cena 3D do hero (Three.js via CDN)

   O que acontece na tela:
     1. um globo escuro com malha de pontos, meridianos e brilho atmosférico;
     2. rotas de comércio exterior desenhadas como arcos discretos;
     3. um avião que faz a corrida de decolagem sobre a superfície, sobe,
        cruza em altitude deixando um rastro luminoso e pousa no destino;
     4. loop trocando de rota a cada viagem.

   Respeita "prefers-reduced-motion" (renderiza um quadro estático) e
   simplesmente não faz nada se não houver WebGL — o gradiente CSS assume.
   ===================================================================== */

(function (global) {
  'use strict';

  const COR = {
    globo:      0x0b2740,
    oceano:     0x0e3557,
    pontos:     0x58a8ff,
    pontosAlt:  0x68d8ff,
    malha:      0x2e93da,
    atmosfera:  0x58a8ff,
    rota:       0x58a8ff,
    rastro:     0x68d8ff,
    rastroQuente: 0xf8a838,
    fuselagem:  0xe8f1f8,
    detalhe:    0xf8a838,
    escuro:     0x123049
  };

  // Aeroportos/portos usados nas rotas (lat, lon)
  const PONTOS = {
    santos:    [-23.96, -46.33],
    guarulhos: [-23.43, -46.47],
    hamburgo:  [ 53.55,  10.00],
    roterda:   [ 51.92,   4.48],
    xangai:    [ 31.23, 121.47],
    shenzhen:  [ 22.54, 114.05],
    dubai:     [ 25.20,  55.27],
    miami:     [ 25.77, -80.19],
    houston:   [ 29.76, -95.37],
    lisboa:    [ 38.72,  -9.14]
  };

  // Rotas percorridas pelo avião, em sequência
  const ROTAS = [
    [PONTOS.hamburgo, PONTOS.santos],
    [PONTOS.miami,    PONTOS.santos],
    [PONTOS.lisboa,   PONTOS.santos],
    [PONTOS.houston,  PONTOS.guarulhos]
  ];

  // Arcos fixos de fundo (contexto visual)
  const ROTAS_FUNDO = [
    [PONTOS.xangai,   PONTOS.santos],
    [PONTOS.dubai,    PONTOS.santos],
    [PONTOS.roterda,  PONTOS.santos],
    [PONTOS.shenzhen, PONTOS.guarulhos]
  ];

  const R = 1.9;                  // raio do globo
  const ALT_CRUZEIRO = 0.46;      // altura de cruzeiro (em unidades de mundo)
  const AMOSTRAS = 320;           // resolução da rota do avião

  /* ------------------------------------------------------------------
     Helpers geométricos
     ------------------------------------------------------------------ */
  function latLonParaVetor(lat, lon, raio) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -raio * Math.sin(phi) * Math.cos(theta),
       raio * Math.cos(phi),
       raio * Math.sin(phi) * Math.sin(theta)
    );
  }

  /** Interpolação sobre o grande círculo (caminho real de um voo). */
  function slerp(a, b, t) {
    const dot = Math.min(1, Math.max(-1, a.dot(b)));
    const omega = Math.acos(dot);
    if (omega < 1e-6) return a.clone();
    const so = Math.sin(omega);
    return a.clone().multiplyScalar(Math.sin((1 - t) * omega) / so)
      .add(b.clone().multiplyScalar(Math.sin(t * omega) / so));
  }

  const suave = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));

  /** Perfil de altitude: solo → subida → cruzeiro → descida → solo. */
  function perfilAltitude(s) {
    const decolagem = 0.035, fimSubida = 0.30, inicioDescida = 0.78, pouso = 0.972;
    if (s <= decolagem) return 0;
    if (s < fimSubida) return suave((s - decolagem) / (fimSubida - decolagem));
    if (s < inicioDescida) return 1;
    if (s < pouso) return 1 - suave((s - inicioDescida) / (pouso - inicioDescida));
    return 0;
  }

  /** Progresso não-linear: corrida de decolagem acelerando, cruzeiro constante. */
  function progresso(u) {
    const acel = 0.17;
    const bruto = u < acel ? (u * u) / (2 * acel) : u - acel / 2;
    return clamp01(bruto / (1 - acel / 2));
  }

  /* ------------------------------------------------------------------
     Construção do globo
     ------------------------------------------------------------------ */
  function criarGlobo() {
    const grupo = new THREE.Group();

    // Esfera base
    const esfera = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 48),
      new THREE.MeshPhongMaterial({
        color: COR.globo, emissive: 0x03101b, specular: 0x0a2438,
        shininess: 5, transparent: true, opacity: 0.98
      })
    );
    grupo.add(esfera);

    // Malha de pontos (distribuição de Fibonacci na esfera)
    const N = 2600;
    const pos = new Float32Array(N * 3);
    const cor = new Float32Array(N * 3);
    const c1 = new THREE.Color(COR.pontos);
    const c2 = new THREE.Color(COR.pontosAlt);
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const raio = Math.sqrt(Math.max(0, 1 - y * y));
      const th = phi * i;
      const r = R * 1.002;
      pos[i * 3]     = Math.cos(th) * raio * r;
      pos[i * 3 + 1] = y * r;
      pos[i * 3 + 2] = Math.sin(th) * raio * r;
      const c = c1.clone().lerp(c2, Math.random() * 0.8);
      const brilho = 0.5 + Math.random() * 0.5;
      cor[i * 3] = c.r * brilho; cor[i * 3 + 1] = c.g * brilho; cor[i * 3 + 2] = c.b * brilho;
    }
    const geoPontos = new THREE.BufferGeometry();
    geoPontos.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geoPontos.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    grupo.add(new THREE.Points(geoPontos, new THREE.PointsMaterial({
      size: 0.021, vertexColors: true, transparent: true, opacity: 0.95,
      sizeAttenuation: true, depthWrite: false
    })));

    // Paralelos e meridianos
    const matMalha = new THREE.LineBasicMaterial({
      color: COR.malha, transparent: true, opacity: 0.17, depthWrite: false
    });
    for (let i = 1; i < 8; i++) {
      const lat = -90 + (180 * i) / 8;
      const pts = [];
      for (let j = 0; j <= 96; j++) pts.push(latLonParaVetor(lat, (360 * j) / 96 - 180, R * 1.004));
      grupo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), matMalha));
    }
    for (let i = 0; i < 12; i++) {
      const lon = -180 + (360 * i) / 12;
      const pts = [];
      for (let j = 0; j <= 96; j++) pts.push(latLonParaVetor(-90 + (180 * j) / 96, lon, R * 1.004));
      grupo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matMalha));
    }

    // Brilho atmosférico
    const atmosfera = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.13, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: { corBrilho: { value: new THREE.Color(COR.atmosfera) } },
        vertexShader:
          'varying vec3 vNormal;' +
          'void main(){ vNormal = normalize(normalMatrix * normal);' +
          'gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 corBrilho; varying vec3 vNormal;' +
          'void main(){ float i = pow(clamp(0.66 - dot(vNormal, vec3(0.0,0.0,1.0)), 0.0, 1.0), 4.2);' +
          'gl_FragColor = vec4(corBrilho, 1.0) * i * 1.15; }',
        side: THREE.BackSide, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false
      })
    );
    grupo.add(atmosfera);

    return grupo;
  }

  /* ------------------------------------------------------------------
     Arcos de rota
     ------------------------------------------------------------------ */
  function criarArco(a, b, altura, cor, opacidade, segmentos) {
    const va = latLonParaVetor(a[0], a[1], 1);
    const vb = latLonParaVetor(b[0], b[1], 1);
    const n = segmentos || 128;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const dir = slerp(va, vb, t);
      const h = Math.sin(Math.PI * t) * altura;
      pts.push(dir.multiplyScalar(R + 0.012 + h));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: cor, transparent: true, opacity: opacidade,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
  }

  function criarMarcador(ponto, cor, tamanho) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(tamanho, 12, 12),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9 })
    );
    m.position.copy(latLonParaVetor(ponto[0], ponto[1], R * 1.008));
    return m;
  }

  /* ------------------------------------------------------------------
     Avião (low-poly, montado com primitivas — nariz para +Z)
     ------------------------------------------------------------------ */
  function criarAviao() {
    const aviao = new THREE.Group();
    const materiais = [];

    const mat = (cor, opts) => {
      const m = new THREE.MeshPhongMaterial(Object.assign({
        color: cor, shininess: 46, specular: 0x666666, transparent: true, opacity: 1
      }, opts || {}));
      materiais.push(m);
      return m;
    };

    const corpo   = mat(COR.fuselagem);
    const acento  = mat(COR.detalhe, { shininess: 70 });
    const escuro  = mat(COR.escuro);

    // Fuselagem
    const fuselagem = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.125, 1.5, 18), corpo);
    fuselagem.rotation.x = Math.PI / 2;
    aviao.add(fuselagem);

    // Nariz
    const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), corpo);
    nariz.scale.set(1, 1, 2.1);
    nariz.position.z = 0.75;
    aviao.add(nariz);

    // Cauda afunilada
    const cauda = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.62, 18), corpo);
    cauda.rotation.x = -Math.PI / 2;
    cauda.position.set(0, 0.04, -1.02);
    aviao.add(cauda);

    // Faixa âmbar na lateral
    const faixa = new THREE.Mesh(new THREE.CylinderGeometry(0.139, 0.129, 0.1, 18), acento);
    faixa.rotation.x = Math.PI / 2;
    faixa.position.z = -0.1;
    aviao.add(faixa);

    // Janelas (linha escura)
    const janelas = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.9), escuro);
    janelas.position.set(0, 0.075, 0.12);
    aviao.add(janelas);

    // Asas enflechadas
    [-1, 1].forEach((lado) => {
      const asa = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.045, 0.52), corpo);
      asa.position.set(lado * 0.72, -0.02, -0.12);
      asa.rotation.y = lado * 0.30;     // enflechamento
      asa.rotation.z = -lado * 0.09;    // diedro
      aviao.add(asa);

      const ponta = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.2), acento);
      ponta.position.set(lado * 1.36, 0.08, -0.32);
      aviao.add(ponta);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.092, 0.42, 14), escuro);
      motor.rotation.x = Math.PI / 2;
      motor.position.set(lado * 0.62, -0.12, 0.06);
      aviao.add(motor);

      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.017, 8, 16), acento);
      aro.position.set(lado * 0.62, -0.12, 0.26);
      aviao.add(aro);

      const estab = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.26), corpo);
      estab.position.set(lado * 0.28, 0.06, -1.05);
      estab.rotation.y = lado * 0.34;
      aviao.add(estab);
    });

    // Deriva vertical
    const deriva = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.34), acento);
    deriva.position.set(0, 0.28, -1.02);
    deriva.rotation.x = -0.38;
    aviao.add(deriva);

    aviao.scale.setScalar(0.15);
    aviao.userData.materiais = materiais;
    return aviao;
  }

  function texturaBrilho() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0,    'rgba(255,236,200,0.95)');
    g.addColorStop(0.25, 'rgba(248,168,56,0.55)');
    g.addColorStop(1,    'rgba(248,168,56,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /* ------------------------------------------------------------------
     Cena
     ------------------------------------------------------------------ */
  function iniciar(canvas, opcoes) {
    if (!canvas) return null;
    if (typeof THREE === 'undefined') {
      console.warn('[Skorpion] Three.js não carregou — o hero fica só com o gradiente.');
      return null;
    }

    const opts = Object.assign({ modo: 'full' }, opcoes || {});
    const mini = opts.modo === 'mini';
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
      });
    } catch (e) {
      console.warn('[Skorpion] WebGL indisponível.', e);
      return null;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setClearColor(0x000000, 0);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.4);

    // Luzes
    cena.add(new THREE.AmbientLight(0x4d6a85, 0.6));
    const solar = new THREE.DirectionalLight(0xffffff, 1.05);
    solar.position.set(-4.2, 3.4, 5.0);
    cena.add(solar);
    const contraluz = new THREE.DirectionalLight(0x58a8ff, 0.55);
    contraluz.position.set(4, -2, -3);
    cena.add(contraluz);
    const quente = new THREE.PointLight(0xf8a838, 0.7, 16);
    quente.position.set(2.6, 1.6, 4);
    cena.add(quente);

    // Mundo (globo + rotas + avião giram juntos)
    const mundo = new THREE.Group();
    mundo.rotation.z = -0.32;         // inclinação do eixo
    cena.add(mundo);

    const globo = criarGlobo();
    mundo.add(globo);

    // Arcos de fundo + marcadores
    ROTAS_FUNDO.forEach((r, i) => {
      mundo.add(criarArco(r[0], r[1], 0.20 + i * 0.05, COR.rota, 0.16));
      mundo.add(criarMarcador(r[0], COR.pontosAlt, 0.016));
    });
    mundo.add(criarMarcador(PONTOS.santos, COR.detalhe, 0.026));
    mundo.add(criarMarcador(PONTOS.guarulhos, COR.detalhe, 0.02));

    // Rota ativa (linha discreta) + rastro luminoso
    const grupoRota = new THREE.Group();
    mundo.add(grupoRota);

    const posRastro = new Float32Array(AMOSTRAS * 3);
    const corRastro = new Float32Array(AMOSTRAS * 3);
    const geoRastro = new THREE.BufferGeometry();
    geoRastro.setAttribute('position', new THREE.BufferAttribute(posRastro, 3));
    geoRastro.setAttribute('color', new THREE.BufferAttribute(corRastro, 3));
    const rastro = new THREE.Line(geoRastro, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2
    }));
    rastro.frustumCulled = false;
    mundo.add(rastro);

    const aviao = criarAviao();
    mundo.add(aviao);

    const brilho = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaBrilho(), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.85
    }));
    brilho.scale.setScalar(0.5);
    mundo.add(brilho);

    /* --- Estado da rota atual --- */
    const caminho = { pontos: [], linha: null };
    let rotaAtual = -1;
    const corQuente = new THREE.Color(COR.rastroQuente);
    const corFria = new THREE.Color(COR.rastro);

    function montarRota(indice) {
      rotaAtual = indice % ROTAS.length;
      const [a, b] = ROTAS[rotaAtual];
      const va = latLonParaVetor(a[0], a[1], 1);
      const vb = latLonParaVetor(b[0], b[1], 1);

      caminho.pontos = [];
      for (let i = 0; i < AMOSTRAS; i++) {
        const s = i / (AMOSTRAS - 1);
        const alt = perfilAltitude(s) * ALT_CRUZEIRO;
        const p = slerp(va, vb, s).multiplyScalar(R + 0.014 + alt);
        caminho.pontos.push(p);
        posRastro[i * 3] = p.x; posRastro[i * 3 + 1] = p.y; posRastro[i * 3 + 2] = p.z;
      }
      geoRastro.attributes.position.needsUpdate = true;
      geoRastro.setDrawRange(0, 0);
      geoRastro.computeBoundingSphere();

      // Linha fantasma da rota inteira
      if (caminho.linha) {
        grupoRota.remove(caminho.linha);
        caminho.linha.geometry.dispose();
        caminho.linha.material.dispose();
      }
      caminho.linha = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(caminho.pontos),
        new THREE.LineBasicMaterial({
          color: COR.rota, transparent: true, opacity: 0.20,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      grupoRota.add(caminho.linha);

      // Marcadores de origem/destino da rota ativa
      grupoRota.add(criarMarcador(a, COR.rastro, 0.022));
    }

    montarRota(0);

    /* --- Posicionamento do avião --- */
    const vTmp = new THREE.Vector3();
    const vFrente = new THREE.Vector3();
    const vCima = new THREE.Vector3();
    const mRot = new THREE.Matrix4();

    function posicionarAviao(s) {
      const i = Math.min(AMOSTRAS - 2, Math.max(0, Math.floor(s * (AMOSTRAS - 1))));
      const p = caminho.pontos[i];
      const p2 = caminho.pontos[i + 1];
      aviao.position.copy(p);
      brilho.position.copy(p);

      vFrente.copy(p2).sub(p).normalize();
      vCima.copy(p).normalize();
      // Ortogonaliza "cima" em relação à frente
      vTmp.copy(vFrente).multiplyScalar(vCima.dot(vFrente));
      vCima.sub(vTmp).normalize();
      const vLado = new THREE.Vector3().crossVectors(vCima, vFrente).normalize();

      mRot.makeBasis(vLado, vCima, vFrente);
      aviao.quaternion.setFromRotationMatrix(mRot);

      // Inclinação lateral suave durante o cruzeiro
      const banco = Math.sin(s * Math.PI) * 0.22;
      aviao.rotateZ(banco);

      return i;
    }

    function atualizarRastro(indiceCabeca, opacidade) {
      const comprimento = 62;
      const inicio = Math.max(0, indiceCabeca - comprimento);
      const total = indiceCabeca - inicio + 1;
      for (let i = inicio; i <= indiceCabeca; i++) {
        const k = total > 1 ? (i - inicio) / (total - 1) : 1;   // 0 = cauda, 1 = cabeça
        const c = corFria.clone().lerp(corQuente, Math.pow(k, 3) * 0.7);
        const f = Math.pow(k, 1.7) * opacidade;
        corRastro[i * 3] = c.r * f;
        corRastro[i * 3 + 1] = c.g * f;
        corRastro[i * 3 + 2] = c.b * f;
      }
      geoRastro.attributes.color.needsUpdate = true;
      geoRastro.setDrawRange(inicio, Math.max(0, total));
    }

    function definirOpacidadeAviao(v) {
      aviao.visible = v > 0.02;
      aviao.userData.materiais.forEach((m) => { m.opacity = v; });
      brilho.material.opacity = v * 0.85;
      brilho.visible = aviao.visible;
    }

    /* --- Enquadramento responsivo ---
       O hero costuma ser mais alto que a janela, então dimensionar o globo por
       fração da altura o deixaria gigante. Em vez disso definimos o raio e o
       centro desejados EM PIXELS e convertemos para unidades de mundo. --- */
    const DIST_CAMERA = 9.2;

    function redimensionar() {
      const largura = canvas.clientWidth || canvas.parentElement.clientWidth || 1;
      const altura = canvas.clientHeight || canvas.parentElement.clientHeight || 1;
      renderer.setSize(largura, altura, false);
      camera.aspect = largura / altura;
      camera.position.z = DIST_CAMERA;
      camera.updateProjectionMatrix();

      const meiaAltura = Math.tan((camera.fov / 2) * Math.PI / 180) * DIST_CAMERA;
      const unidadePorPx = (meiaAltura * 2) / altura;   // unidades de mundo por pixel
      const largo = camera.aspect > 1.05;

      // Raio do globo na tela
      const fator = mini ? 0.20 : 0.23;
      const tetoPx = mini ? 180 : 258;
      const raioPx = largo
        ? Math.max(90, Math.min(largura * fator, altura * 0.40, tetoPx))
        : Math.max(86, Math.min(largura * 0.30, 122));

      // Centro do globo na tela.
      // Em telas estreitas ele ocupa a faixa reservada no topo do hero
      // (ver .hero--home no CSS), acima do título.
      const cxPx = largo ? largura * (mini ? 0.78 : 0.73) : largura * 0.62;
      const cyPx = largo ? Math.min(altura * 0.42, 400) : raioPx * 0.80;

      mundo.scale.setScalar((raioPx * unidadePorPx) / R);
      mundo.position.set(
        (cxPx - largura / 2) * unidadePorPx,
        (altura / 2 - cyPx) * unidadePorPx,
        0
      );
    }

    redimensionar();

    /* --- Loop --- */
    const DURACAO = mini ? 26 : 19;     // segundos por viagem
    let u = mini ? 0.42 : 0;
    let ultimo = performance.now();
    let rodando = true;
    let visivel = true;
    let rafId = null;
    const rotacaoBase = -1.0;           // Atlântico voltado para a câmera

    function quadro(agora) {
      rafId = requestAnimationFrame(quadro);
      const dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;
      if (!rodando || !visivel) return;

      const t = agora / 1000;

      // Avanço da viagem
      u += dt / DURACAO;
      if (u >= 1) { u = 0; montarRota(rotaAtual + 1); }

      const s = progresso(u);
      const i = posicionarAviao(s);

      // Aparecer/sumir nas pontas do trajeto
      const fade = Math.min(clamp01(u / 0.035), clamp01((1 - u) / 0.05));
      definirOpacidadeAviao(fade);
      atualizarRastro(i, fade);

      // Balanço lento do globo (não gira 360º para a rota nunca sumir de vista)
      mundo.rotation.y = rotacaoBase + Math.sin(t * 0.085) * 0.22;
      mundo.rotation.x = Math.sin(t * 0.06) * 0.055;

      // Respiro da câmera
      camera.position.y = Math.sin(t * 0.22) * 0.14;
      camera.position.x = Math.sin(t * 0.17) * 0.18;
      camera.lookAt(0, 0, 0);

      renderer.render(cena, camera);
    }

    function quadroEstatico() {
      const s = progresso(0.42);
      const i = posicionarAviao(s);
      definirOpacidadeAviao(1);
      atualizarRastro(i, 1);
      mundo.rotation.y = rotacaoBase;
      camera.position.set(0, 0, DIST_CAMERA);
      camera.lookAt(0, 0, 0);
      renderer.render(cena, camera);
    }

    canvas.classList.add('is-ready');

    if (reduzido) {
      quadroEstatico();
    } else {
      rafId = requestAnimationFrame(quadro);
    }

    /* --- Economia de recursos --- */
    let tempoResize;
    window.addEventListener('resize', () => {
      clearTimeout(tempoResize);
      tempoResize = setTimeout(() => {
        redimensionar();
        if (reduzido) quadroEstatico();
      }, 160);
    });

    document.addEventListener('visibilitychange', () => {
      rodando = !document.hidden;
      ultimo = performance.now();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entradas) => {
        visivel = entradas[0].isIntersecting;
        ultimo = performance.now();
      }, { threshold: 0 }).observe(canvas);
    }

    return {
      destruir() {
        if (rafId) cancelAnimationFrame(rafId);
        renderer.dispose();
      }
    };
  }

  global.SkorpionHero3D = { iniciar: iniciar };
})(window);
