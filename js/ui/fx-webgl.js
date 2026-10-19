// @ts-check
/**
 * fx-webgl.js — backend WebGL degli effetti di carta (FX).
 * ------------------------------------------------------------------
 * PERCHÉ. Gli effetti "spettacolo" (Buco Nero, Spade Rivelatrici, Raigeki...)
 * sono fatti da una dozzina di elementi DOM ciascuno, tutti con filtri,
 * ombre e trasformazioni 3D, e animati da una libreria (GSAP): sul telefono
 * sono i momenti in cui i frame cadono. Qui lo stesso effetto e' UNO shader
 * su UN canvas a tutto schermo, disegnato solo finche' l'effetto dura.
 *
 * COME SI INNESTA. effects.js ha un sistema di backend (FX.registerBackend):
 * questo se ne registra uno, che rimpiazza SOLO gli effetti qui elencati in
 * `impls`; tutti gli altri restano a js/ui/fx-gsap.js o alla versione di base.
 * Per questo effects.js sceglie il backend PER EFFETTO, dall'ultimo registrato
 * al primo (questo file va quindi caricato DOPO fx-gsap.js). Le firme sono
 * identiche a quelle di base: il motore non sa nemmeno che esiste, e le
 * callback da cui dipende il duello (`onLanded`, `onImpact`) restano
 * quelle di sempre — con le stesse reti di sicurezza di effects.js.
 *
 * Non usa GSAP: il tempo e' l'orologio del frame. Le CARTE risucchiate dal
 * Buco Nero restano elementi della pagina (sono carte vere, con la loro
 * grafica) e si animano con una transizione CSS, come nella versione di base.
 *
 * COME SI SPEGNE. `window.FX_BACKEND = 'gsap'` (o 'css') in console, oppure
 * cancellare questo file e il suo <script>: si torna a GSAP/base. Se WebGL
 * manca, il backend non si attiva da solo (vedi `FxWebglPronto`).
 */
(function () {
    'use strict';
    if (!window.FX || typeof window.FX.registerBackend !== 'function') return;

    const Z_INDEX = 10046;
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

    // ---------------------------------------------------------------------
    // Motore: un canvas, un ciclo che gira solo se c'e' un effetto in corso
    // ---------------------------------------------------------------------

    /** @type {HTMLCanvasElement|null} */ let canvas = null;
    /** @type {WebGLRenderingContext|null} */ let gl = null;
    let scala = 0.8;
    /** @type {WebGLBuffer|null} */ let buf = null;
    const programmi = {};
    /** @type {{ prog: any, avvio: number, durata: number, uniformi: (t:number, u:(n:string)=>WebGLUniformLocation|null, g:WebGLRenderingContext)=>void, fine?: ()=>void }[]} */
    let attivi = [];
    let rid = 0;
    let pronto = null;

    function compila(tipo, src) {
        const o = gl.createShader(tipo);
        gl.shaderSource(o, src);
        gl.compileShader(o);
        return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
    }

    function assicuraCanvas() {
        if (canvas && gl) return true;
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;display:none;z-index:' + Z_INDEX + ';';
        gl = /** @type {WebGLRenderingContext|null} */ (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }));
        if (!gl) { canvas = null; return false; }
        const prec = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!prec || prec.precision === 0) { gl = null; canvas = null; return false; }
        buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); chiudiTutto(); });
        document.body.appendChild(canvas);
        return true;
    }

    function adattaDimensioni() {
        scala = window.innerWidth <= 900 ? 0.55 : 0.65;
        canvas.width = Math.max(64, Math.round(window.innerWidth * scala));
        canvas.height = Math.max(64, Math.round(window.innerHeight * scala));
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function programma(chiave, frammento) {
        if (programmi[chiave]) return programmi[chiave];
        const vs = compila(gl.VERTEX_SHADER, VS);
        const fs = compila(gl.FRAGMENT_SHADER, frammento);
        if (!vs || !fs) return null;
        const p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
        const cache = {};
        programmi[chiave] = { p: p, u: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n))) };
        return programmi[chiave];
    }

    function chiudiTutto() {
        const fini = attivi.map((a) => a.fine).filter(Boolean);
        attivi = [];
        cancelAnimationFrame(rid); rid = 0;
        if (canvas) canvas.remove();
        canvas = null; gl = null;
        Object.keys(programmi).forEach((k) => delete programmi[k]);
        fini.forEach((f) => { try { /** @type {Function} */ (f)(); } catch (e) { /* un effetto non rompe il duello */ } });
    }

    /**
     * Una passata a tutto schermo su un solo RIQUADRO (box in px CSS: [x0, y0, x1, y1], y dall'alto; null = tutto):
     * lo scissor impedisce di sprecare pixel fuori dall'area che la primitiva puo' toccare.
     */
    function disegnaPassata(prog, t, bbox, imposta) {
        gl.useProgram(prog.p);
        const loc = gl.getAttribLocation(prog.p, 'p');
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(prog.u('r'), canvas.width, canvas.height);
        gl.uniform1f(prog.u('k'), 1 / scala);
        gl.uniform1f(prog.u('H'), window.innerHeight);
        gl.uniform1f(prog.u('t'), t);
        imposta(prog.u, gl);
        if (bbox) {
            const x0 = Math.max(0, Math.floor(bbox[0] * scala)); const x1 = Math.min(canvas.width, Math.ceil(bbox[2] * scala));
            const yTop = Math.max(0, Math.floor(bbox[1] * scala)); const yBot = Math.min(canvas.height, Math.ceil(bbox[3] * scala));
            if (x1 <= x0 || yBot <= yTop) return;
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(x0, canvas.height - yBot, x1 - x0, yBot - yTop);
        } else {
            gl.disable(gl.SCISSOR_TEST);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /** Cio' che un effetto a disegno personalizzato puo' usare. */
    const contestoDisegno = {
        passata: function (chiave, frammento, t, bbox, imposta) {
            const p = programma(chiave, frammento);
            if (p) disegnaPassata(p, t, bbox, imposta);
        }
    };

    function ciclo(ora) {
        if (!gl || !canvas) return;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        attivi = attivi.filter((a) => {
            const t = (typeof window.FX_WEBGL_T === 'number') ? window.FX_WEBGL_T : (ora - a.avvio) / 1000;
            if (t > a.durata) { if (a.fine) { try { a.fine(); } catch (e) { /* idem */ } } return false; }
            // Disegno personalizzato: l'effetto decide quante passate fare e su quale riquadro
            // (vedi js/ui/fx-webgl-scena.js: una passata piccola per ogni primitiva).
            if (a.custom) {
                try { a.custom(t, contestoDisegno); } catch (e) { console.warn('[FX webgl]', e); }
                gl.disable(gl.SCISSOR_TEST);
                return true;
            }
            gl.useProgram(a.prog.p);
            const loc = gl.getAttribLocation(a.prog.p, 'p');
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(a.prog.u('r'), canvas.width, canvas.height);
            gl.uniform1f(a.prog.u('k'), 1 / scala);
            gl.uniform1f(a.prog.u('H'), window.innerHeight);
            gl.uniform1f(a.prog.u('t'), t);
            a.uniformi(t, a.prog.u, gl);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            return true;
        });
        if (attivi.length) rid = requestAnimationFrame(ciclo);
        else {
            // A riposo il canvas si nasconde ma contesto e shader compilati restano: la prossima
            // volta l'effetto parte subito, senza il salto di compilazione.
            rid = 0;
            canvas.style.display = 'none';
        }
    }

    /**
     * Fa partire un effetto. Torna una funzione che lo interrompe subito
     * (necessaria per le spade, che restano finche' il chiamante non le toglie).
     * Lancia un errore se WebGL non c'e': il chiamante (effects.js) ricade
     * sul backend successivo.
     */
    function lancia(chiave, frammento, durata, uniformi, fine, custom) {
        if (!assicuraCanvas()) throw new Error('webgl-non-disponibile');
        if (!attivi.length) { adattaDimensioni(); canvas.style.display = ''; }
        const prog = custom ? null : programma(chiave, frammento);
        if (!custom && !prog) throw new Error('shader-non-compilato');
        const voce = { prog: prog, avvio: performance.now(), durata: durata, uniformi: uniformi, fine: fine, custom: custom };
        attivi.push(voce);
        if (!rid) rid = requestAnimationFrame(ciclo);
        return function interrompi() {
            const i = attivi.indexOf(voce);
            if (i >= 0) attivi.splice(i, 1);
        };
    }

    // ---------------------------------------------------------------------
    // GLSL condiviso
    // ---------------------------------------------------------------------

    const BASE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r;   // pixel del canvas
uniform float k;  // pixel CSS per pixel del canvas
uniform float H;  // altezza della finestra in pixel CSS
uniform float t;  // secondi dall'avvio
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
// Posizione del pixel in px CSS, y verso il BASSO come nel DOM.
vec2 css(){vec2 f=gl_FragCoord.xy*k;return vec2(f.x,H-f.y);}
`;

    // ---------------------------------------------------------------------
    // Buco Nero
    // ---------------------------------------------------------------------

    const DURATA_BH = 2.6;
    // Un buco nero visto quasi di taglio: orizzonte nero con anello di fotoni, disco di accrescimento
    // sottile e turbolento (il lato che si avvicina e' piu' luminoso), l'immagine lensata del lato
    // lontano del disco che si piega sopra e sotto l'orizzonte, filamenti di materia che
    // spiraleggiano dentro, e un collasso finale con onda d'urto.
    const FS_BH = BASE + `
uniform vec2 c;       // centro, px CSS
void main(){
  const float DUR=${DURATA_BH.toFixed(2)};
  vec2 q=css()-c;
  float m=min(r.x,r.y)*k;       // lato corto in px CSS: tutto e' in unita' di m
  vec2 p=q/m;                   // y verso il basso
  float rr=length(p);
  float ap=smoothstep(0.,.55,t);
  float fine=smoothstep(DUR-.35,DUR,t);
  float v=ap*(1.-fine);
  float R=.1*mix(.3,1.,ap)*(1.-.35*fine);

  // Oscuramento: la scena si spegne attorno.
  float buio=smoothstep(1.15,.08,rr)*.93*v;

  // Filamenti di materia che spiraleggiano verso il centro.
  float ang=atan(p.y,p.x);
  float lr=log(rr+.02);
  float fil=pow(.5+.5*sin(9.*(ang+.55*lr)+t*5.5),10.)*(.4+.8*fbm(vec2(ang*3.,lr*5.+t*2.)));
  fil*=smoothstep(.85,.25,rr)*smoothstep(R*1.3,R*3.,rr)*v;

  // Disco di accrescimento quasi di taglio, con rotazione differenziale.
  float tilt=.11;
  vec2 d=vec2(p.x,p.y/tilt);
  float rd=length(d);
  float thd=atan(d.y,d.x);
  float rin=R*1.55;
  float rout=R*6.4*mix(.6,1.,ap);
  float band=smoothstep(rin,rin*1.12,rd)*smoothstep(rout,rout*.55,rd);
  float th2=thd-t*(1.2+3.5*R/max(rd,R));
  vec2 uu=vec2(cos(th2),sin(th2))*(rd/R)*.9;
  float turb=.3+.9*fbm(uu*1.3);
  float dop=.5+.9*smoothstep(-1.,1.,-cos(thd));
  float heat=smoothstep(rout,rin,rd);
  vec3 col=mix(vec3(.95,.3,.06),vec3(1.,.92,.75),heat*heat);
  float disco=band*turb*dop*(.6+1.6*heat)*v;
  float dietro=step(p.y,0.)*smoothstep(R*.98,R*1.06,rr);

  // Immagine lensata del lato lontano del disco: arco sopra l'orizzonte, uno piu' debole sotto.
  float sopra=exp(-pow((rr-R*1.38)/(R*.2),2.))*smoothstep(R*.2,-R*.9,p.y);
  float sotto=exp(-pow((rr-R*1.18)/(R*.11),2.))*smoothstep(-R*.2,R*.9,p.y)*.35;
  float arco=(sopra+sotto)*(.5+.6*dop)*(.55+turb)*v;

  float foto=exp(-pow((rr-R*1.06)/(R*.045),2.))*v;
  float alone=exp(-rr*rr/(R*R*42.))*.5*v;
  float nero=smoothstep(R,R*.96,rr);

  // Collasso: onda d'urto e lampo.
  float ce=max(0.,t-(DUR-.28));
  float onda=exp(-pow((rr-ce*2.2)/.022,2.))*smoothstep(0.,.04,ce)*(1.-smoothstep(.1,.28,ce));
  float lampo=exp(-rr*rr*40.)*smoothstep(0.,.05,ce)*(1.-smoothstep(.05,.28,ce));

  vec3 L=vec3(.45,.55,1.)*fil*.5
        +col*disco*dietro*1.6
        +col*arco*1.3
        +vec3(1.,.95,.85)*(foto*1.6+alone)
        +vec3(.7,.75,1.)*(onda*1.2+lampo*1.5);
  float a=clamp(buio+fil*.4+disco*dietro*.9+arco*.9+foto+alone*.5+onda+lampo,0.,1.);
  vec4 o=vec4(L,a);
  o=vec4(o.rgb*(1.-nero),mix(o.a,1.,nero*v));
  // La meta' bassa del disco passa DAVANTI all'orizzonte.
  float davanti=step(0.,p.y)*band*turb*dop*v;
  float af=clamp(davanti*.95,0.,1.);
  o=vec4(col*davanti*1.8,af)+o*(1.-af);
  gl_FragColor=o;
}`;

    /**
     * Le carte risucchiate: elementi veri della pagina (hanno la loro grafica), animati SOLO con
     * transform e opacita' — le uniche proprieta' che il browser anima sulla GPU senza ricalcolare
     * il layout. La versione di base animava left/top/width/height con una transizione e un
     * drop-shadow, ed era quella a scattare. Ogni carta segue una spirale che si stringe verso
     * il centro, si inclina e si rimpicciolisce.
     */
    function fantasmiRisucchiati(sucked, cx, cy) {
        if (!Array.isArray(sucked) || typeof window.createCardElement !== 'function') return;
        sucked.forEach(({ card, rect }, i) => {
            if (!card || !rect || rect.width === 0) return;
            const ghost = window.createCardElement(card);
            ghost.classList.add('fx-darkhole-sucked');
            Object.assign(ghost.style, {
                position: 'fixed', left: '0px', top: '0px',
                width: `${rect.width}px`, height: `${rect.height}px`, margin: '0',
                zIndex: String(Z_INDEX + 6), pointerEvents: 'none',
                transition: 'none', filter: 'none', willChange: 'transform, opacity',
                transformOrigin: '50% 50%'
            });
            document.body.appendChild(ghost);
            const x0 = rect.left + rect.width / 2 - cx;
            const y0 = rect.top + rect.height / 2 - cy;
            const r0 = Math.hypot(x0, y0);
            const a0 = Math.atan2(y0, x0);
            const verso = i % 2 === 0 ? 1 : -1;
            const giri = 1.3 + (i % 3) * 0.25;
            const N = 18;
            const frames = [];
            for (let s = 0; s <= N; s++) {
                const u = s / N;
                const e = Math.pow(u, 2.3);                 // parte piano, accelera verso l'orizzonte
                const r = r0 * (1 - e);
                const a = a0 + verso * e * giri * Math.PI * 2;
                const x = cx + r * Math.cos(a) - rect.width / 2;
                const y = cy + r * Math.sin(a) - rect.height / 2;
                const scala = 1 - 0.94 * e;
                const rot = verso * e * 520;
                const incl = 62 * e;
                frames.push({
                    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) perspective(700px) rotateX(${incl.toFixed(1)}deg) rotate(${rot.toFixed(1)}deg) scale(${scala.toFixed(3)})`,
                    opacity: u > 0.84 ? 1 - (u - 0.84) / 0.16 : 1,
                    offset: u
                });
            }
            const anim = ghost.animate(frames, { duration: 1700, delay: 250 + i * 40, easing: 'linear', fill: 'both' });
            // Prima dell'inizio la carta sta ferma dov'era (fill both applica il primo fotogramma).
            anim.onfinish = () => ghost.remove();
            setTimeout(() => ghost.remove(), 2400 + i * 40);
        });
    }

    function playDarkHoleVortex(sucked) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        lancia('buco-nero', FS_BH, DURATA_BH, (t, u, g) => { g.uniform2f(u('c'), cx, cy); });
        if (window.SFX && typeof window.SFX.darkHole === 'function') window.SFX.darkHole();
        fantasmiRisucchiati(sucked, cx, cy);
    }
    // ---------------------------------------------------------------------
    // Spade Rivelatrici
    // ---------------------------------------------------------------------

    const MAX_SPADE = 6;
    const FS_SPADE = BASE + `
uniform vec4 sp[${MAX_SPADE}];   // x centro, y fondo della fila, mezza larghezza slot, ritardo (s)
uniform float ns;                // quante spade
uniform vec4 fila;               // sinistra, alto, destra, basso della fila (px CSS)
uniform float alt;               // altezza di una spada
uniform float tFlash;            // istante del lampo sulla fila

// Una spada con la punta in basso: elsa, guardia, lama rastremata, gemma. Coordinate locali in px,
// origine al centro, y verso il basso.
vec4 spada(vec2 l,float alt){
  float v=(l.y/alt)+.5;
  if(v<-.02||v>1.04) return vec4(0.);
  float hw;
  if(v<.12) hw=3.6;
  else if(v<.18) hw=15.;
  else hw=11.*(1.-pow((v-.18)/.82,1.6));
  float d=abs(l.x)-hw;
  float corpo=1.-smoothstep(-.6,1.2,d);
  float alone=exp(-max(d,0.)*max(d,0.)/150.)*.7;
  float nucleo=1.-smoothstep(0.,1.,abs(l.x)/max(hw,.001));
  vec3 verde=vec3(.41,1.,.56);
  vec3 col=mix(verde,vec3(1.),nucleo*(v>.18?1.:.4));
  float gemma=exp(-dot(l-vec2(0.,(.15-.5)*alt),l-vec2(0.,(.15-.5)*alt))/22.);
  vec3 lum=col*corpo+verde*alone+vec3(.7,1.,.8)*gemma*1.4;
  float al=clamp(corpo+alone*.6+gemma,0.,1.);
  return vec4(lum,al);
}
float outExpo(float x){x=clamp(x,0.,1.);return x>=1.?1.:1.-pow(2.,-10.*x);}

void main(){
  vec2 P=css();
  vec4 o=vec4(0.);
  // Cielo che si schiarisce sopra la fila.
  float inX=smoothstep(fila.x-60.,fila.x,P.x)*smoothstep(fila.z+60.,fila.z,P.x);
  float cielo=inX*(1.-smoothstep(0.,fila.w,P.y))*smoothstep(0.,.3,t);
  float fineCielo=1.-smoothstep(.9+ns*.095,1.5+ns*.095,t);
  o+=vec4(vec3(1.,.97,.8)*cielo*.55*fineCielo,cielo*.4*fineCielo);
  for(int i=0;i<${MAX_SPADE};i++){
    if(float(i)>=ns) break;
    vec4 s=sp[i];
    float tt=t-s.w;
    float cx=s.x;
    // Colonna di luce che anticipa la lama: trapezio che si stringe verso l'alto.
    float ra=smoothstep(0.,.32,t-s.w*.4)*(1.-smoothstep(.82,1.4,t-s.w*.4));
    float semi=mix(s.z*.12,s.z*.72,smoothstep(0.,s.y,P.y));
    float colonna=smoothstep(semi,semi*.2,abs(P.x-cx))*smoothstep(0.,s.y,P.y)*ra;
    o+=vec4(vec3(.7,1.,.8)*colonna*.3,colonna*.22);
    // La lama cade da lontano, inclinata, e si raddrizza all'impatto.
    float cad=outExpo(tt/.62);
    float lato=(float(i)<ns*.5)?-1.:1.;
    float dist=abs(float(i)-(ns-1.)*.5);
    float ang=-lato*(14.+dist*3.)*(1.-cad)*.01745;
    float sc=mix(.56,1.,cad);
    vec2 centro=vec2(cx+lato*(55.+dist*16.)*(1.-cad), mix(-alt, s.y-alt*.5, cad));
    vec2 l=P-centro;
    float cs=cos(ang),sn=sin(ang);
    l=vec2(cs*l.x+sn*l.y,-sn*l.x+cs*l.y)/sc;
    vec4 sw=spada(l,alt);
    float vis=smoothstep(0.,.12,tt);
    o=sw*vis+o*(1.-sw.a*vis);
    // Anello d'impatto alla punta.
    float imp=exp(-pow((length(P-vec2(cx,s.y))-(tt-.55)*260.)*.09,2.))*step(.55,tt)*(1.-smoothstep(.55,1.,tt));
    o+=vec4(vec3(.8,1.,.85)*imp*.8,imp*.5);
  }
  // Lampo orizzontale sulla fila quando l'ultima e' atterrata.
  float lf=t-tFlash;
  if(lf>0. && lf<.65){
    float y=smoothstep(fila.y-30.,fila.y,P.y)*smoothstep(fila.w+30.,fila.w,P.y);
    float x=smoothstep(fila.x-30.,fila.x,P.x)*smoothstep(fila.z+30.,fila.z,P.x);
    float e=sin(3.14159*lf/.65);
    float f=y*x*e;
    o+=vec4(vec3(1.,.98,.85)*f*.45,f*.3);
  }
  gl_FragColor=o;
}`;

    function playSwordsOfRevealingLight(owner, onLanded) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slots = document.querySelectorAll(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"]`);
        if (!slots.length) { if (typeof onLanded === 'function') onLanded(() => {}); return; }
        const rects = Array.from(slots).slice(0, MAX_SPADE).map((s) => s.getBoundingClientRect());
        const rowTop = Math.min(...rects.map((r) => r.top));
        const rowBottom = Math.max(...rects.map((r) => r.bottom));
        const rowLeft = Math.min(...rects.map((r) => r.left));
        const rowRight = Math.max(...rects.map((r) => r.right));
        const altezza = Math.max(145, Math.min(205, (rowBottom - rowTop) * 1.16));
        const PASSO = 0.095;
        const CADUTA = 0.62;
        const n = rects.length;
        const data = new Float32Array(MAX_SPADE * 4);
        rects.forEach((rect, i) => {
            const dist = Math.abs(i - (n - 1) / 2);
            data[i * 4] = rect.left + rect.width / 2;
            data[i * 4 + 1] = rowBottom;
            data[i * 4 + 2] = rect.width / 2;
            data[i * 4 + 3] = dist * PASSO;
        });
        const ultima = Math.max(...Array.from({ length: n }, (_, i) => data[i * 4 + 3])) + CADUTA;

        // Le spade restano finche' il chiamante non le toglie (vedi il commento in effects.js):
        // la durata e' "infinita" e `togli` interrompe l'effetto.
        let interrompi = () => {};
        if (window.SFX && typeof window.SFX.swordsOfRevealingLight === 'function') window.SFX.swordsOfRevealingLight();
        interrompi = lancia('spade', FS_SPADE, 60, (t, u, g) => {
            g.uniform4fv(u('sp'), data);
            g.uniform1f(u('ns'), n);
            g.uniform4f(u('fila'), rowLeft, rowTop, rowRight, rowBottom);
            g.uniform1f(u('alt'), altezza);
            g.uniform1f(u('tFlash'), ultima);
        });
        setTimeout(() => {
            if (typeof onLanded === 'function') onLanded(() => interrompi());
            else interrompi();
        }, (ultima + 0.06) * 1000);
    }

    // ---------------------------------------------------------------------
    // Raigeki
    // ---------------------------------------------------------------------

    const FS_RAIGEKI = BASE + `
uniform vec4 sl[${MAX_SPADE}];   // x, y d'impatto, larghezza, ordine (s)
uniform float ns;
uniform float tImpatto;
void main(){
  vec2 P=css();
  vec4 o=vec4(0.);
  // Cielo di tempesta.
  float tem=smoothstep(0.,.25,t)*(1.-smoothstep(tImpatto+.3,tImpatto+.72,t));
  float nuvole=fbm(vec2(P.x*.004+t*.5,P.y*.006));
  o+=vec4(vec3(.15,.1,.35)*nuvole*.3*tem,.45*tem*(1.-smoothstep(0.,H*.7,P.y)));
  for(int i=0;i<${MAX_SPADE};i++){
    if(float(i)>=ns) break;
    vec4 s=sl[i];
    float tt=t-s.w;
    if(tt<0.) continue;
    // Fulmine seghettato dall'alto fino al punto d'impatto.
    float y01=clamp(P.y/s.y,0.,1.);
    float wob=(fbm(vec2(y01*7.,float(i)*3.1))-.5)*70.+(fbm(vec2(y01*19.,float(i)*7.7))-.5)*16.;
    float dx=abs(P.x-(s.x+wob*(1.-y01*.6)));
    float vive=step(P.y,s.y)*(1.-smoothstep(.34,.52,tt))*smoothstep(0.,.05,tt);
    float flick=.7+.3*step(.5,fract(tt*14.));
    float nucleo=exp(-dx*dx/5.)*vive*flick;
    float alone=exp(-dx*dx/260.)*vive*.55;
    o+=vec4(vec3(.8,.85,1.)*(nucleo*1.5+alone),clamp(nucleo+alone*.5,0.,1.));
    // Impatto sullo slot.
    vec2 dd=(P-vec2(s.x,s.y))/vec2(s.z*.8,s.z*.6);
    float imp=exp(-dot(dd,dd)*2.2)*step(.3,tt)*(1.-smoothstep(.3,.78,tt));
    o+=vec4(vec3(1.,.95,.7)*imp*1.2,clamp(imp*.8,0.,1.));
  }
  // Lampo bianco al momento dell'impatto finale.
  float lf=t-tImpatto;
  float fl=(lf>0.&&lf<.35)?(1.-lf/.35):0.;
  o+=vec4(vec3(.85,.9,1.)*fl*.5,fl*.35);
  gl_FragColor=o;
}`;

    function playRaigeki(owner, onImpact) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slots = Array.from(document.querySelectorAll(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"]`)).slice(0, MAX_SPADE);
        if (!slots.length) { if (typeof onImpact === 'function') onImpact(); return; }
        const rects = slots.map((s) => s.getBoundingClientRect());
        const n = rects.length;
        const centro = (n - 1) / 2;
        const ordine = rects.map((_, i) => i).sort((a, b) => Math.abs(a - centro) - Math.abs(b - centro));
        const data = new Float32Array(MAX_SPADE * 4);
        ordine.forEach((slotIndex, seq) => {
            const r = rects[slotIndex];
            data[seq * 4] = r.left + r.width / 2;
            data[seq * 4 + 1] = r.top + r.height * 0.52;
            data[seq * 4 + 2] = r.width * 1.55;
            data[seq * 4 + 3] = seq * 0.075;
        });
        const impatto = 0.33 + (n - 1) * 0.075;
        if (window.SFX && typeof window.SFX.raigeki === 'function') window.SFX.raigeki();
        lancia('raigeki', FS_RAIGEKI, impatto + 0.75, (t, u, g) => {
            g.uniform4fv(u('sl'), data);
            g.uniform1f(u('ns'), n);
            g.uniform1f(u('tImpatto'), impatto);
        });
        setTimeout(() => { if (typeof onImpact === 'function') onImpact(); }, impatto * 1000);
    }

    // ---------------------------------------------------------------------
    // Registrazione
    // ---------------------------------------------------------------------

    // Il backend si attiva solo se WebGL funziona davvero (una sola prova, in cache).
    Object.defineProperty(window, 'FxWebglPronto', {
        configurable: true,
        get() {
            if (pronto === null) {
                try {
                    const c = document.createElement('canvas');
                    const g = c.getContext('webgl');
                    const p = g && g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
                    pronto = !!(g && p && p.precision > 0);
                    const ext = g && g.getExtension('WEBGL_lose_context');
                    if (ext) ext.loseContext();
                } catch (e) { pronto = false; }
            }
            return pronto;
        }
    });

    window.FX.registerBackend('webgl', {
        requires: ['FxWebglPronto'],
        impls: {
            playDarkHoleVortex: playDarkHoleVortex,
            playSwordsOfRevealingLight: playSwordsOfRevealingLight,
            playRaigeki: playRaigeki
        }
    });

    // Compila gli shader a pagina tranquilla, cosi' il primo Buco Nero della partita non fa scattare i frame.
    function riscalda() {
        try {
            if (!window.FxWebglPronto || !assicuraCanvas()) return;
            adattaDimensioni();
            programma('buco-nero', FS_BH); programma('spade', FS_SPADE); programma('raigeki', FS_RAIGEKI);
        } catch (e) { /* e' solo un'ottimizzazione */ }
    }
    if (window.requestIdleCallback) window.requestIdleCallback(riscalda, { timeout: 4000 });
    else setTimeout(riscalda, 2500);

    // `BASE` e `Z_INDEX` servono a js/ui/fx-webgl-scena.js, che costruisce sopra questo motore gli altri spettacoli.
    /** Compila in anticipo uno shader (per i moduli che ne portano di propri). */
    /** true se lo shader compila (e lo tiene in cache): serve a un effetto a passate multiple per decidere PRIMA di partire se puo' girare. */
    function compilabile(chiave, frammento) {
        if (!assicuraCanvas()) return false;
        return !!programma(chiave, frammento);
    }

    function scalda(chiave, frammento) {
        try { if (window.FxWebglPronto && assicuraCanvas()) { adattaDimensioni(); programma(chiave, frammento); } } catch (e) { /* ottimizzazione */ }
    }

    window.FxWebgl = { scalda: scalda, compilabile: compilabile, lancia: lancia, chiudi: chiudiTutto, attivi: () => attivi.length, BASE: BASE, Z_INDEX: Z_INDEX };
})();
