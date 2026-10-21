// @ts-check
/**
 * mp-term-fx.js — lo sfondo "KaibaCorp System" della console di connessione al server Multiplayer.
 * ------------------------------------------------------------------------------------------
 * Un canvas WebGL DENTRO la console, dietro le righe di testo e sfumato ai bordi (js/multiplayer/mp-lobby.js, `.mp-term`;
 * mai a tutto schermo): pavimento a griglia in prospettiva che
 * scorre verso chi guarda, pacchetti di dati che corrono lungo le linee del circuito, onde radar che partono
 * dall'emblema KC e un fascio di scansione. Tre fasi:
 *   - collegamento (azzurro KaibaCorp),
 *   - accesso concesso (`ok()`: ondata luminosa verde-bianca dall'emblema, la griglia si accende),
 *   - connessione rifiutata (`errore()`: tinta rossa e barre di disturbo).
 * Si spegne da solo quando la console lascia la pagina (la riga di stato viene sostituita), non tiene nessuno stato
 * fuori da questo file e, se WebGL manca o c'e' "riduci movimento", `monta` torna null: resta la console CSS di prima.
 */
(function () {
    'use strict';

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `precision highp float;
uniform vec2 r; uniform float t; uniform float tok; uniform float terr; uniform vec2 org;
float h(float n){return fract(n*43758.5453+.137*n*n);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 uv=gl_FragCoord.xy/r; float asp=r.x/r.y;
  // fase: 0 collegamento, verso 1 con l'accesso concesso; err verso 1 con il rifiuto
  float ok=tok<0.?0.:smoothstep(0.,.35,t-tok); float err=terr<0.?0.:smoothstep(0.,.2,t-terr);
  vec3 base=mix(vec3(.25,.85,1.),vec3(.35,1.,.75),ok); base=mix(base,vec3(1.,.28,.32),err);
  vec3 col=vec3(0.); float a=0.;
  // pavimento a griglia in prospettiva (meta' bassa), che scorre verso chi guarda
  float hor=.30;
  if(uv.y<hor){
    float d=hor-uv.y; float z=.09/d; float x=(uv.x-.5)*asp*z;
    float sp=t*(.9+ok*1.6);
    float gx=smoothstep(.06,0.,abs(fract(x*1.4)-.5)-.44);
    float gz=smoothstep(.06,0.,abs(fract(z*1.3-sp)-.5)-.44);
    float fade=smoothstep(0.,.2,d)*(1.-smoothstep(.2,.3,d))+.12*smoothstep(0.,.08,d);
    float g=max(gx,gz)*fade;
    col+=base*g*.45; a+=g*.4;
  }
  // linea d'orizzonte
  float ho=exp(-pow((uv.y-hor)*70.,2.)); col+=base*ho*.6; a+=ho*.45;
  // tre linee di circuito con pacchetti di dati che le percorrono
  for(int i=0;i<3;i++){
    float fi=float(i); float y=.66+fi*.1; float sp=.35+fi*.17+ok*.5;
    float lin=exp(-pow((uv.y-y)*r.y/1.6,2.))*.28;
    float x0=fract(t*sp+h(fi+3.)); float cab=0.;
    for(int k=0;k<2;k++){ float xx=fract(x0+float(k)*.5); float dd=uv.x-xx; float coda=smoothstep(-.18,0.,dd)*step(dd,0.); float testa=exp(-pow(dd*r.x/5.,2.)); cab+=coda*.5+testa*1.4; }
    float aY=exp(-pow((uv.y-y)*r.y/2.4,2.));
    col+=mix(base,vec3(1.,.9,.5),.5)*(cab*aY)+base*lin; a+=cab*aY*.7+lin;
  }
  // onde radar dall'emblema (sinistra)
  vec2 dd2=(uv-org)*vec2(asp,1.);
  float rr=length(dd2);
  for(int j=0;j<2;j++){
    float ph=fract(t*.42+float(j)*.5); float R=ph*1.15;
    float ring=exp(-pow((rr-R)*20.,2.))*(1.-ph)*.8; col+=base*ring; a+=ring*.6;
  }
  // l'ondata dell'accesso concesso
  if(tok>=0.){ float u=t-tok; float R=u*1.7; float w=exp(-pow((rr-R)*10.,2.))*exp(-u*2.2); col+=vec3(.8,1.,.9)*w*.75; a+=w*.7; col+=vec3(.5,1.,.8)*exp(-rr*rr*5.)*exp(-u*3.)*.5; a+=exp(-rr*rr*5.)*exp(-u*3.)*.3; }
  // fascio di scansione verticale
  float sx=fract(t*.18); float sc=exp(-pow((uv.x-sx)*r.x/10.,2.))*.35; col+=base*sc; a+=sc*.5;
  // puntini di dati sparsi che lampeggiano
  vec2 gv=uv*vec2(46.,14.); vec2 cell=floor(gv); float rn=h2(cell); float punto=1.-smoothstep(.12,.26,length(fract(gv)-.5)); float tw=step(.965,rn)*(.5+.5*sin(t*4.+rn*40.))*punto; col+=base*tw*.5; a+=tw*.35;
  // rifiuto: barre di disturbo rosse
  if(err>0.){ float band=step(.86,h2(vec2(floor(uv.y*18.),floor(t*14.))))*err; col+=vec3(1.,.2,.25)*band*.5; a+=band*.4; col*=1.-.25*err; }
  // l'atmosfera sta DIETRO le righe della console: tenue, perche' il testo resti leggibile
  float gain=.5; a=clamp(a,0.,1.)*gain; col=min(col*gain,vec3(a)*1.4);
  gl_FragColor=vec4(min(col,vec3(1.)),a);
}`;

    function riduciMovimento() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /**
     * Monta lo sfondo dentro `term` (la `.mp-term`). Torna `{ ok, errore, ferma }` o null.
     * @param {HTMLElement} term
     */
    function monta(term) {
        if (!term || window.MP_TERM_FX_OFF || riduciMovimento()) return null;
        try {
            const cv = document.createElement('canvas');
            cv.className = 'mp-term-gl';   // a pagina intera, fissa, senza tocco: e' l'atmosfera della connessione, non un riquadro
            cv.setAttribute('aria-hidden', 'true');
            cv.style.opacity = '0';
            const gl = /** @type {WebGLRenderingContext|null} */ (cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }));
            if (!gl) return null;
            const sh = (tp, src) => { const o = gl.createShader(tp); gl.shaderSource(o, src); gl.compileShader(o); return o; };
            const pr = gl.createProgram();
            gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
            if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
            gl.useProgram(pr);
            const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            const uR = gl.getUniformLocation(pr, 'r'); const uT = gl.getUniformLocation(pr, 't');
            const uOk = gl.getUniformLocation(pr, 'tok'); const uErr = gl.getUniformLocation(pr, 'terr'); const uOrg = gl.getUniformLocation(pr, 'org');
            // DENTRO la console, non sulla pagina: l'atmosfera sta dietro le righe di testo, con i bordi sfumati.
            term.insertBefore(cv, term.firstChild);

            let scala = Math.min(window.devicePixelRatio || 1, 2) * 0.7;
            const adatta = () => {
                const w = Math.max(2, Math.round((cv.clientWidth || 300) * scala)); const h = Math.max(2, Math.round((cv.clientHeight || 120) * scala));
                if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
            };
            const t0 = performance.now(); let tOk = -1; let tErr = -1; let raf = 0; let n = 0; let lento = 0; let ultimo = t0; let morto = false;
            const fine = () => {
                morto = true; cancelAnimationFrame(raf);
                try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (x) { /* nessuno */ }
            };
            const giro = (now) => {
                if (morto) return;
                // La console sparisce appena il flusso va avanti (nessuno aspetta): l'atmosfera no — l'onda di "accesso concesso"
                // (o il lampo rosso) finisce comunque di girare, poi il canvas si toglie da solo.
                const tt = (now - t0) / 1000;
                const esito = Math.max(tOk, tErr);
                if (!term.isConnected || (esito >= 0 && tt - esito > 1.7)) { cv.remove(); fine(); return; }
                // regolatore: se i fotogrammi sono lenti si scende di risoluzione, poi si spegne
                const dt = now - ultimo; ultimo = now;
                if (dt > 40) lento++; else lento = Math.max(0, lento - 1);
                if (lento > 25) { if (scala > 0.45) { scala *= 0.65; lento = 0; } else { cv.remove(); fine(); return; } }
                if (n++ % 20 === 0) adatta();
                const t = (now - t0) / 1000;
                gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, t);
                // l'origine delle onde: l'emblema KC, in coordinate della tela (y verso l'alto)
                const emb = term.querySelector('.mp-term-emblem');
                const cr = cv.getBoundingClientRect();
                const er = emb ? emb.getBoundingClientRect() : null;
                const ox = er && cr.width ? (er.left + er.width / 2 - cr.left) / cr.width : 0.12;
                const oy = er && cr.height ? 1 - (er.top + er.height / 2 - cr.top) / cr.height : 0.5;
                gl.uniform2f(uOrg, Math.min(1, Math.max(0, ox)), Math.min(1, Math.max(0, oy)));
                gl.uniform1f(uOk, tOk < 0 ? -1 : tOk); gl.uniform1f(uErr, tErr < 0 ? -1 : tErr);
                gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
                if (cv.style.opacity === '0') cv.style.opacity = '1';
                raf = requestAnimationFrame(giro);
            };
            adatta();
            raf = requestAnimationFrame(giro);
            return {
                ok() { tOk = (performance.now() - t0) / 1000; },
                errore() { tErr = (performance.now() - t0) / 1000; },
                ferma: fine
            };
        } catch (e) { return null; }
    }

    window.MpTermFx = { monta: monta };
})();
