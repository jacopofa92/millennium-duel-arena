/**
 * pack-opening-webgl.js — la LUCE della cerimonia di apertura di una bustina.
 * ------------------------------------------------------------------------
 * Prima lo strappo e la rivelazione di ogni carta erano un lampo CSS più qualche scintilla DOM
 * (e nel Negozio le scintille non comparivano nemmeno: FX non è caricato in quella pagina). Qui la
 * stessa cerimonia ha una sua luce vera: UN canvas WebGL sopra la scena, che disegna impulsi di luce
 * per ogni momento — strappo, comparsa della carta — e un alone che resta dietro la carta in mostra.
 *
 * COME È FATTO. Un solo shader a tutto schermo, risoluzione ridotta (la luce è morbida: non serve
 * di più), con fino a 6 impulsi contemporanei. Ogni impulso ha un TIER che decide intensità e colore:
 *
 *   0 strappo della busta (oro caldo)         4 ultra rara   (oro, colonna di luce e scia)
 *   1 comune       (bagliore piccolo)         5 leggendaria  (rosa-oro)
 *   2 rara         (azzurro, anello)          6 segreta/mitica (arcobaleno)
 *   3 super rara   (viola, colonna di luce)
 *
 * Un impulso = nucleo di luce + onda d'urto + raggi + scintille che schizzano, e dai tier alti una
 * colonna di luce verticale e una scia orizzontale (stile anamorfico). Il colore si legge dal tier.
 *
 * SOLO PRESENTAZIONE E AUTOSUFFICIENTE. Non decide niente (le carte sono già estratte), non dipende da
 * js/ui/fx-webgl.js (che qui non c'è: richiede effects.js) e ha un SUO contesto, creato all'apertura
 * della cerimonia e rilasciato alla chiusura: su telefono i contesti sono pochi, e uno che resta
 * aperto dopo la fine si paga alla cerimonia successiva (e altrove nella pagina).
 *
 * SE WEBGL MANCA o lo shader non compila, `crea` torna null e pack-opening.js tiene le scintille di
 * prima: la cerimonia funziona identica, solo senza questa luce.
 */
(function () {
    'use strict';

    const MAX_IMPULSI = 6;
    const VITA_IMPULSO = 3.0; // secondi dopo i quali un impulso non disegna più nulla

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r;         // pixel del canvas
uniform vec2 R;         // pixel CSS dell'area (la finestra)
uniform float t;        // secondi dall'avvio
uniform vec4 imp[${MAX_IMPULSI}];   // x, y (px CSS, y dall'alto), istante d'inizio, tier (-1 = vuoto)
uniform vec4 amb;       // x, y, intensita', tier: l'alone che resta dietro la carta in mostra

float h(float n){return fract(sin(n*91.345)*47453.5453);}

vec3 arcobaleno(float a){return .5+.5*cos(6.2832*(a/6.2832+vec3(0.,.33,.67)));}

// Il colore di un tier. 'a' e' l'angolo: serve solo ai tier che cambiano colore girando attorno.
vec3 tinta(float tier,float a){
  if(tier<.5) return vec3(1.,.82,.45);
  if(tier<1.5) return vec3(1.,.95,.8);
  if(tier<2.5) return vec3(.45,.8,1.);
  if(tier<3.5) return vec3(.75,.5,1.);
  if(tier<4.5) return vec3(1.,.8,.3);
  if(tier<5.5) return mix(vec3(1.,.55,.85),vec3(1.,.9,.6),.5+.5*sin(a*3.));
  if(tier<6.5) return mix(arcobaleno(a),vec3(1.),.3);
  if(tier<7.5) return mix(vec3(1.,.82,.4),arcobaleno(a),.25);   // apertura del mazzo: oro con un velo d'iride
  if(tier<8.5) return vec3(1.,.9,.62);                          // carica: oro-bianco
  return vec3(1.,.78,.32);                                       // fontana: oro
}

void main(){
  float k=R.x/r.x;
  vec2 P=vec2(gl_FragCoord.x*k,R.y-gl_FragCoord.y*k);
  float M=min(R.x,R.y);
  vec3 col=vec3(0.);
  float al=0.;
  for(int i=0;i<${MAX_IMPULSI};i++){
    vec4 I=imp[i];
    if(I.w<-.5) continue;
    float u=t-I.z;
    if(u<0.||u>${VITA_IMPULSO.toFixed(1)}) continue;
    float tier=I.w;
    float pw=.45+.2*tier;
    vec2 d=(P-I.xy)/M;
    float rr=length(d);
    float an=atan(d.y,d.x);
    vec3 c=tinta(tier,an);

    // ===== I TRE ATTI DEL MAZZO COMPRATO (tier 7, 8, 9) =====
    if(tier>6.5){
      float Lx=0.; float spx=0.; float wash=0.;
      if(tier>8.5){
        // FONTANA (tier 9): una sorgente al centro che spara scintille a ventaglio verso l'alto, per un paio di secondi.
        Lx=exp(-rr*rr*40.)*.28*smoothstep(0.,.1,u)*(1.-smoothstep(1.2,2.2,u));
        for(int j=0;j<40;j++){
          float fj=float(j);
          float ts=h(fj)*1.4;
          float vita=.9+.5*h(fj+3.);
          float uu=(u-ts)/vita;
          if(uu<0.||uu>1.) continue;
          float a2=-1.5708+(h(fj+1.)-.5)*1.1;
          float v=.55+.7*h(fj+4.);
          vec2 pos=vec2(cos(a2),sin(a2))*v*uu*(1.-.35*uu)+vec2(0.,.55*uu*uu);
          float sz=.0065*(1.-.55*uu);
          spx+=smoothstep(sz*1.8,0.,length(d-pos))*(1.-uu)*(.6+.4*sin(u*22.+fj));
        }
      } else if(tier>7.5){
        // CARICA (tier 8): la luce si raccoglie. Particelle a spirale convergono sulla scatola, un anello si
        // stringe e il nucleo cresce, fino al momento in cui la scatola si apre.
        Lx=exp(-rr*rr*(60./(.4+u)))*u*u*1.6;
        float R0=.55*(1.-pow(clamp(u/.9,0.,1.),2.));
        Lx+=exp(-pow((rr-R0)/.012,2.))*smoothstep(0.,.15,u)*(.6+.8*u);
        for(int j=0;j<26;j++){
          float fj=float(j);
          float ts=h(fj)*.45;
          if(u<ts) continue;
          float dir=h(fj+7.)>.5?1.:-1.;
          for(int q=0;q<3;q++){
            float pr=clamp((u-ts)/.45-.05*float(q),0.,1.);
            float rad=(.35+.3*h(fj+2.))*pow(1.-pr,1.6);
            float ang=h(fj+5.)*6.2832+(1.-pr)*3.2*dir;
            vec2 pos=vec2(cos(ang),sin(ang))*rad;
            spx+=smoothstep(.0065,0.,length(d-pos))*(1.-.3*float(q))*(.4+.6*pr)*step(pr,.995);
          }
        }
      } else {
        // APERTURA (tier 7): il colpo. Flash enorme, tre onde d'urto, sedici raggi, una colonna di luce che
        // sfonda verso l'alto, una scia anamorfica da bordo a bordo e un ventaglio di scintille.
        Lx=exp(-rr*rr*14.)*exp(-u*3.4)*1.6+exp(-rr*rr*120.)*exp(-u*2.2)*1.0;
        for(int k=0;k<3;k++){
          float fk=float(k);
          float uk=u-fk*.14;
          if(uk>0.){
            float Rk=(.25+.5*fk)*(1.-pow(1.-clamp(uk/1.4,0.,1.),3.))*1.3;
            Lx+=exp(-pow((rr-Rk)/(.02+.012*fk),2.))*(1.-smoothstep(.3,1.5,uk))*(1.2-.25*fk);
          }
        }
        Lx+=pow(.5+.5*sin(an*16.+u*.7+h(I.z)*6.28),8.)*exp(-rr*1.5)*smoothstep(.04,.3,rr)
            *smoothstep(0.,.1,u)*(1.-smoothstep(.6,2.4,u));
        float su=step(d.y,.06);
        Lx+=(exp(-d.x*d.x*70.)*.8+exp(-d.x*d.x*1500.)*1.2)*smoothstep(0.,.1,u)*(1.-smoothstep(.8,2.2,u))
            *su*(.9-.4*smoothstep(0.,1.2,-d.y));
        Lx+=exp(-d.y*d.y*1800.)*exp(-abs(d.x)*.9)*smoothstep(0.,.08,u)*(1.-smoothstep(.2,1.4,u))*1.2;
        wash=(1.-smoothstep(0.,.35,u))*.25*smoothstep(1.4,0.,rr);
        for(int j=0;j<24;j++){
          float fj=float(j);
          float a2=-1.5708+(h(fj)-.5)*1.7;
          float v=.45+.7*h(fj+3.);
          float vita=1.2+1.*h(fj+9.);
          float uu=(u-.05-.3*h(fj+11.))/vita;
          if(uu<0.||uu>1.) continue;
          vec2 pos=vec2(cos(a2),sin(a2))*v*(1.-pow(1.-uu,2.))+vec2(0.,.5*uu*uu);
          float sz=.007*(1.-.5*uu);
          spx+=smoothstep(sz*1.8,0.,length(d-pos))*(1.-uu)*(.6+.4*sin(u*25.+fj));
        }
      }
      col+=c*Lx+vec3(1.)*(spx*1.0+Lx*.12)+c*spx*.8+vec3(1.,.95,.8)*wash;
      al=max(al,clamp(Lx*.7+spx+wash,0.,1.));
      continue;
    }

    // nucleo di luce, subito, che si spegne in fretta
    float core=exp(-rr*rr*(40.-4.*tier))*exp(-u*5.5)*(.8+.08*tier);
    // onda d'urto
    float R0=(.12+.55*pw)*(1.-pow(1.-clamp(u/1.1,0.,1.),3.));
    float ring=exp(-pow((rr-R0)/(.012+.01*tier),2.))*(1.-smoothstep(.2,1.1,u))*pw*1.3;
    // raggi che si aprono a ventaglio e si dissolvono
    float nr=6.+2.*tier;
    float ray=pow(.5+.5*sin(an*nr+h(I.z)*6.28+u*.5),7.)*exp(-rr*(2.6-.2*tier))
             *smoothstep(.04,.3,rr)*smoothstep(0.,.08,u)*(1.-smoothstep(.35,1.6+.2*tier,u))*pw*(tier<.5?.6:.7);
    // colonna di luce verticale (dalla super rara in su)
    float colonna=0.;
    if(tier>=2.5){
      colonna=exp(-d.x*d.x*(120.-14.*tier))*smoothstep(0.,.12,u)*(1.-smoothstep(.5,1.9,u))*(.35+.12*tier);
    }
    // scia orizzontale stile anamorfico (dall'ultra rara in su)
    float scia=0.;
    if(tier>=3.5){
      scia=exp(-d.y*d.y*1400.)*exp(-abs(d.x)*1.6)*smoothstep(0.,.1,u)*(1.-smoothstep(.3,1.3,u))*.8;
    }
    // scintille che schizzano e ricadono
    float sp=0.;
    float ns=8.+3.*tier;
    for(int j=0;j<26;j++){
      if(float(j)>=ns) break;
      float fj=float(j);
      float a2=h(fj+I.z*3.1)*6.2832;
      float v=.25+h(fj*1.7+4.)*.55*pw*1.4;
      float vita=.8+h(fj+9.)*.9;
      float uu=u/vita;
      if(uu>1.) continue;
      vec2 pos=vec2(cos(a2),sin(a2))*v*(1.-pow(1.-uu,2.));
      pos.y+=.28*uu*uu;
      float sz=(.006+.006*h(fj+2.))*(1.-uu);
      float tw=.6+.4*sin(u*18.+fj);
      sp+=smoothstep(sz*1.6,0.,length(d-pos))*tw*(1.-uu);
    }
    float L=core+ring+ray+colonna+scia;
    col+=c*L+vec3(1.)*(core*.35+sp*.9)+c*sp*.8;
    al=max(al,clamp(L*.7+sp,0.,1.));
  }
  // alone fisso dietro la carta in mostra, con raggi lenti
  if(amb.z>.001){
    vec2 d=(P-amb.xy)/M;
    float rr=length(d);
    float an=atan(d.y,d.x);
    vec3 c=tinta(amb.w,an+t*.3);
    float g=exp(-rr*rr*7.)*.4+exp(-rr*rr*55.)*.1;
    float rays=pow(.5+.5*sin(an*(9.+amb.w)+t*.8),9.)*exp(-rr*2.)*.6*smoothstep(.05,.3,rr);
    float L=(g+rays)*amb.z*(.85+.15*sin(t*3.));
    col+=c*L;
    al=max(al,clamp(L*.6,0.,1.));
  }
  // Compressione morbida dei bianchi: più sorgenti si sommano nello stesso punto e un taglio netto
  // (min) le faceva diventare un disco bianco che copriva la carta. Così il colore resta e la carta si legge.
  col=1.-exp(-col*1.1);
  gl_FragColor=vec4(col,min(al,.9));
}`;

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    /**
     * Crea la luce dentro `host` (l'elemento a tutto schermo della cerimonia). Torna
     * `{ impulso, ambiente, spegniAmbiente, distruggi }`, oppure null se non si può (WebGL assente,
     * movimento ridotto, shader non compilato): chi chiama ripiega sulle scintille di prima.
     * @param {HTMLElement} host
     */
    function crea(host) {
        if (!host || menoMovimento() || !window.WebGLRenderingContext) return null;
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        // Sopra la scena ma trasparente ai tocchi: la luce si somma a ciò che sta sotto.
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;';
        let gl = null;
        try {
            gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
        } catch (e) { gl = null; }
        if (!gl) return null;
        const prec = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!prec || prec.precision === 0) return null;

        const compila = (tipo, src) => {
            const o = gl.createShader(tipo);
            gl.shaderSource(o, src);
            gl.compileShader(o);
            return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
        };
        const vs = compila(gl.VERTEX_SHADER, VS);
        const fs = compila(gl.FRAGMENT_SHADER, FS);
        const prog = vs && fs ? gl.createProgram() : null;
        if (prog) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
        if (!prog || !gl.getProgramParameter(prog, gl.LINK_STATUS)) { rilascia(gl); return null; }

        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const locP = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(locP);
        gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const uR = gl.getUniformLocation(prog, 'r');
        const uAreaCss = gl.getUniformLocation(prog, 'R');
        const uT = gl.getUniformLocation(prog, 't');
        const uImp = gl.getUniformLocation(prog, 'imp');
        const uAmb = gl.getUniformLocation(prog, 'amb');

        host.appendChild(canvas);

        // --- stato
        const imp = new Float32Array(MAX_IMPULSI * 4);
        for (let i = 0; i < MAX_IMPULSI; i++) imp[i * 4 + 3] = -1;
        let prossimo = 0;
        const amb = { x: 0, y: 0, v: 0, bersaglio: 0, tier: 4 };
        let t0 = performance.now();
        let rid = 0;
        let ultimo = 0;
        let morto = false;

        function dimensiona() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const s = w <= 900 ? 0.5 : 0.6;   // la luce e' morbida: poca risoluzione basta e costa poco
            canvas.width = Math.max(64, Math.round(w * s));
            canvas.height = Math.max(64, Math.round(h * s));
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        dimensiona();
        window.addEventListener('resize', dimensiona);
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); morto = true; fermaCiclo(); });

        const adesso = () => (performance.now() - t0) / 1000;

        function qualcosaDaDisegnare(t) {
            if (amb.v > 0.004 || amb.bersaglio > 0) return true;
            for (let i = 0; i < MAX_IMPULSI; i++) {
                if (imp[i * 4 + 3] >= -0.5 && t - imp[i * 4 + 2] <= VITA_IMPULSO) return true;
            }
            return false;
        }

        function ciclo(ora) {
            rid = 0;
            if (morto) return;
            const t = adesso();
            const dt = Math.min(0.1, Math.max(0, (ora - ultimo) / 1000));
            ultimo = ora;
            amb.v += (amb.bersaglio - amb.v) * Math.min(1, dt * 5);
            if (!qualcosaDaDisegnare(t)) {
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                return;   // a riposo non disegna e non gira: riparte da solo al prossimo impulso
            }
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(uR, canvas.width, canvas.height);
            gl.uniform2f(uAreaCss, window.innerWidth, window.innerHeight);
            gl.uniform1f(uT, t);
            gl.uniform4fv(uImp, imp);
            gl.uniform4f(uAmb, amb.x, amb.y, amb.v, amb.tier);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            rid = requestAnimationFrame(ciclo);
        }
        function avviaCiclo() {
            if (morto || rid) return;
            ultimo = performance.now();
            rid = requestAnimationFrame(ciclo);
        }
        function fermaCiclo() { if (rid) cancelAnimationFrame(rid); rid = 0; }

        return {
            /** Un impulso di luce in (x, y) px CSS dalla finestra, con l'intensita' e il colore del tier. */
            impulso(x, y, tier) {
                if (morto) return;
                const i = prossimo;
                prossimo = (prossimo + 1) % MAX_IMPULSI;
                imp[i * 4] = x; imp[i * 4 + 1] = y; imp[i * 4 + 2] = adesso(); imp[i * 4 + 3] = tier;
                avviaCiclo();
            },
            /** L'alone che resta dietro la carta in mostra, finche' non lo si spegne. */
            ambiente(x, y, tier) {
                if (morto) return;
                amb.x = x; amb.y = y; amb.tier = tier; amb.bersaglio = 1;
                avviaCiclo();
            },
            spegniAmbiente() { amb.bersaglio = 0; },
            /** Rilascia tutto: canvas, ciclo e contesto WebGL. Da chiamare quando la cerimonia finisce. */
            distruggi() {
                morto = true;
                fermaCiclo();
                window.removeEventListener('resize', dimensiona);
                canvas.remove();
                rilascia(gl);
            }
        };
    }

    /** Libera il contesto subito, invece di aspettare il garbage collector (su telefono i contesti sono pochi). */
    function rilascia(gl) {
        try {
            const ext = gl && gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        } catch (e) { /* e' solo pulizia */ }
    }

    window.PackOpeningGL = { crea: crea };
})();
