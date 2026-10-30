// @ts-check
/**
 * splash-webgl.js — lo splash d'apertura del gioco: il Puzzle del Millennio in 3D che ruota piano, legato al CARICAMENTO VERO.
 * ------------------------------------------------------------------------------------------------
 * Una scena a tutto schermo disegnata da UNO shader (nessun modello, nessuna texture: funziona anche su file:// e senza rete):
 *   - il Puzzle di Yugi Muto, la piramide d'oro rovesciata con i pannelli incassati, la cornice rialzata, il collare e l'anello
 *     con due maglie di catena, in raymarching, con riflessi di un ambiente di studio e occlusione ambientale;
 *   - l'Occhio di Wedjat inciso sui pannelli: SI ACCENDE DA SINISTRA A DESTRA man mano che il caricamento procede, quindi il
 *     progresso e' dentro l'oggetto stesso, non solo in una barra sotto;
 *   - polvere d'oro che sale e un alone caldo dietro: NESSUN raggio che gira;
 *   - a caricamento finito l'Occhio esplode di luce, un'onda attraversa lo schermo e la camera entra nel Puzzle.
 *
 * IL PROGRESSO E' VERO (`creaMisuratore`): conta le risorse della pagina (script, fogli di stile) che il browser ha davvero finito di
 * scaricare, via Resource Timing, contro il numero atteso letto dal documento stesso; poi i traguardi del documento (DOM pronto,
 * `load`) e il verdetto dell'accesso (`concludi`, chiamata dalla pagina). Vale per qualunque server (Cloudflare compreso): si
 * misura quello che il browser ha ricevuto, non si interroga nessun servizio. Il minimo di durata e la velocita' massima di
 * riempimento fanno si' che con tutto gia' in cache (Service Worker) la scena si veda comunque, senza scatti.
 *
 * ESCE DI SCENA se: nessun WebGL con highp, o niente canvas. La pagina allora tiene lo splash di sempre (`attivo` resta falso).
 * Per provarlo: `_anteprima-splash.html` (slider del progresso; `?t=` congela il tempo per gli screenshot).
 */
(function () {
    'use strict';

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `precision highp float;
uniform vec2 r;
uniform float t;
uniform float uProg;     // 0..1 progresso mostrato (l'Occhio si accende fin li')
uniform float uIntro;    // 0..1 comparsa
uniform float uOut;      // 0..1 uscita (esplosione + camera che entra)
uniform float uDist;     // distanza della camera (si allarga sugli schermi bassi)
const float PI=3.14159265;
const float TOP=.9;
const float APEX=-.66;   // piramide piu' piatta, come il Puzzle vero: 2,6 di larghezza in cima su 1,56 di altezza
const vec2 NXY=vec2(.7682,-.6402);   // normale del piano di una faccia nel piano (raggio, y): normalize(1.56, -1.3)

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(11.7,3.1); a*=.5; } return s; }
float ease(float x){ x=clamp(x,0.,1.); return x*x*(3.-2.*x); }

float sdTorus(vec3 p, vec2 t2){ vec2 q=vec2(length(p.xz)-t2.x,p.y); return length(q)-t2.y; }
float sdCyl(vec3 p, float h, float rad){ vec2 d=abs(vec2(length(p.xz),p.y))-vec2(rad,h); return min(max(d.x,d.y),0.)+length(max(d,0.)); }

float occhioH(vec2 e, out float lungo);
float scanalature(vec2 e);

// Coordinate sul pannello della faccia dominante, per l'Occhio (centrato, ingrandito): x lungo la faccia, y verso l'alto.
vec2 coordOcchio(vec3 p, float dX, float dZ){
  float u=(dZ>dX)?p.x*sign(p.z):-p.z*sign(p.x);
  // unita' "e" della FOTO del Puzzle: mezza larghezza in cima = 1 (1,3 nel mondo), origine al centro dell'iride, y verso l'alto
  return vec2(u,p.y-.31)/1.3;
}

// Il corpo: piramide rovesciata (apice in basso), spigoli arrotondati, pannelli incassati dentro una cornice rialzata,
// e sul pannello l'Occhio di Wedjat IN RILIEVO (come sul Puzzle vero: non e' disegnato, sporge dal metallo).
float sdBody(vec3 p, out float panel){
  float dX=dot(vec2(abs(p.x),p.y-APEX),NXY);
  float dZ=dot(vec2(abs(p.z),p.y-APEX),NXY);
  float top=p.y-TOP;
  float d=max(max(dX,dZ),top)-.035;
  float m=.02;
  panel=smoothstep(2.*m,2.*m+.035,abs(dX-dZ))*smoothstep(m,m+.035,-top);
  float r=d+.006*panel;
  // il rilievo si calcola solo vicino alla superficie del pannello: fuori sarebbe lavoro inutile per ogni passo del raggio
  if(panel>.02 && d<.16){
    float lg;
    vec2 e=coordOcchio(p,dX,dZ);
    float h=occhioH(e,lg);
    r-=.06*h*panel;
    r+=.032*scanalature(e)*(1.-h)*panel;      // le spaccature fra i pezzi, a gradini come sul Puzzle vero
  }
  return r;
}
// Anello e catena in cima (assieme al collare).
float sdRing(vec3 p){
  float d=sdCyl(p-vec3(0.,TOP+.03,0.),.06,.115);
  d=min(d,sdTorus(vec3(p.x,p.z,p.y-(TOP+.36)),vec2(.26,.055)));
  d=min(d,sdTorus(vec3(p.z,p.x,p.y-(TOP+.72)),vec2(.17,.043)));
  d=min(d,sdTorus(vec3(p.x,p.z,p.y-(TOP+.99)),vec2(.17,.043)));
  return d;
}
float map(vec3 p){ float pn; return min(sdBody(p,pn),sdRing(p)); }
vec3 normalAt(vec3 p){ vec2 e=vec2(.0016,0.); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx))); }

// Un ambiente di studio fatto a mano: due softbox caldi, un contraluce freddo, il pavimento scuro. E' quello che l'oro riflette.
vec3 env(vec3 d){
  vec3 base=mix(vec3(.1,.058,.02),vec3(.3,.17,.05),smoothstep(-.25,1.,d.y));
  float k1=pow(max(dot(d,normalize(vec3(-.45,.75,.55))),0.),6.)*.8;
  float k2=pow(max(dot(d,normalize(vec3(.8,.25,-.45))),0.),14.);
  float k3=pow(max(dot(d,normalize(vec3(.1,.95,.2))),0.),5.);
  return base+vec3(3.2,2.7,2.1)*k1+vec3(.9,1.15,1.7)*k2*1.5+vec3(1.6,1.3,.9)*k3*.5;
}

float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }

// Le scanalature fra i pezzi del Puzzle, COPIATE DALLA FOTO (unita' "e", la meta' sinistra si specchia): un taglio a gradini che
// scende dal bordo alto verso l'apice, il blocco centrale in cima e le giunture sotto l'occhio. Ritorna 1 sul solco, 0 fuori.
float scanalature(vec2 e){
  vec2 q=vec2(abs(e.x),e.y);
  float d=seg(q,vec2(.627,.453),vec2(.627,.333));
  d=min(d,seg(q,vec2(.627,.333),vec2(.747,.333)));
  d=min(d,seg(q,vec2(.747,.333),vec2(.667,.248)));
  d=min(d,seg(q,vec2(.667,.248),vec2(.741,.155)));
  d=min(d,seg(q,vec2(.741,.155),vec2(.515,.048)));
  d=min(d,seg(q,vec2(.28,.44),vec2(.28,.248)));
  d=min(d,seg(q,vec2(.28,.248),vec2(.475,.248)));
  d=min(d,seg(q,vec2(.475,.248),vec2(.408,.155)));
  d=min(d,seg(q,vec2(.408,.155),vec2(.515,.048)));
  d=min(d,seg(q,vec2(.515,.048),vec2(.328,-.125)));
  d=min(d,seg(q,vec2(.328,-.125),vec2(.368,-.227)));
  d=min(d,seg(q,vec2(.368,-.227),vec2(.195,-.227)));
  d=min(d,seg(q,vec2(.195,-.227),vec2(.115,-.293)));
  d=min(d,seg(q,vec2(.115,-.293),vec2(0.,-.39)));
  d=min(d,seg(q,vec2(.141,.44),vec2(.141,.248)));
  d=min(d,seg(q,vec2(.141,.248),vec2(0.,.248)));
  d=min(d,seg(q,vec2(0.,-.387),vec2(0.,-.533)));
  d=min(d,seg(q,vec2(.181,-.536),vec2(0.,-.536)));
  return smoothstep(.018,.006,d);
}
// Una barra a capsula dal profilo tondo (un "filo" che sporge): 1 sull'asse, 0 al bordo. w e' il mezzo spessore.
float barra(vec2 q, vec2 a, vec2 b, float w){ float d=seg(q,a,b)/w; return sqrt(max(1.-d*d,0.)); }
// Come sopra ma lungo una linea ARCUATA di quota yc a x di q: dx e' l'eccesso oltre l'estremita' (il cappuccio tondo).
float arco(vec2 q, float L, float yc, float w){ float d=length(vec2(max(abs(q.x)-L,0.),q.y-yc))/w; return sqrt(max(1.-d*d,0.)); }
// La spirale della Wedjat (Archimede, ~1,5 giri, r = .012 + .0105*T): distanza dal tratto.
float spirale(vec2 q){
  float rl=length(q);
  float th=atan(q.y,q.x); if(th<0.) th+=6.2832;
  float best=1.;
  for(int n=0;n<2;n++){
    float T=th+6.2832*float(n);
    if(T<=3.1*PI) best=min(best,abs(rl-(.012+.0105*T)));
  }
  return best;
}
// L'Occhio di Wedjat IN RILIEVO, ricalcato sulla foto del Puzzle: sopracciglio (barra grossa), barra di mezzo, palpebra inferiore a
// "sorriso", anello dell'iride con la pupilla a cupola, le due gambe (la sinistra con il piede, la destra che si arrotola) e la spirale.
// Niente "bianco dell'occhio": l'interno resta il piano del metallo, non e' colorato. "lungo" (0..1) fa accendere l'Occhio da sinistra
// a destra col progresso.
float occhioH(vec2 e, out float lungo){
  lungo=clamp(e.x/.81+.5,0.,1.);
  float x2=min(e.x*e.x/.1364,1.);
  float r=length(e);
  float h=arco(e,.353,.083+.014*(1.-x2),.052);               // sopracciglio
  float fuori=smoothstep(.15,.17,r);                          // la barra di mezzo passa dietro l'iride
  h=max(h,arco(e,.373,-.025,.032)*fuori);                     // barra di mezzo
  h=max(h,arco(e,.373,-.03-.1*(1.-x2),.034));                 // palpebra inferiore
  float anello=sqrt(max(1.-pow(abs(r-.118)/.033,2.),0.))*smoothstep(.07,.02,e.y);   // l'anello sfuma nel sopracciglio
  h=max(h,anello);
  h=max(h,.12*step(r,.1));                                    // il fondo dell'iride, appena sopra il piano
  h=max(h,.8*sqrt(max(1.-(r*r)/(.058*.058),0.)));             // la pupilla a cupola
  h=max(h,barra(e,vec2(-.067,-.17),vec2(-.067,-.31),.036));   // gamba sinistra
  h=max(h,barra(e,vec2(-.067,-.31),vec2(-.125,-.385),.034));  // ...il piede che gira a sinistra
  h=max(h,barra(e,vec2(-.125,-.385),vec2(-.235,-.435),.03));
  h=max(h,barra(e,vec2(.058,-.17),vec2(.058,-.31),.036));     // gamba destra
  h=max(h,barra(e,vec2(.058,-.31),vec2(.105,-.375),.034));    // ...che scende verso la spirale
  float ds=spirale(e-vec2(.215,-.345));
  h=max(h,sqrt(max(1.-pow(ds/.028,2.),0.)));                  // spirale
  return h;
}mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

const vec3 WHITE=vec3(.012,.01,.008);   // il nome e' rimasto: e' il colore di FINE uscita, adesso un nero caldo (il menu sotto e' scuro)
void main(){
  // fine dell'uscita: bianco pieno, niente raymarching (il frame costa quasi zero mentre la pagina lavora sotto)
  if(uOut>=.6){ gl_FragColor=vec4(WHITE,1.); return; }
  vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;
  float tt=t;
  float prog=uProg;

  // ---------- fondale: buio caldo, nebbia lenta, alone dietro al Puzzle, polvere d'oro che sale
  vec2 pc=uv-vec2(0.,.07);
  float rr=length(pc);
  vec3 col=mix(vec3(.01,.011,.02),vec3(.055,.04,.02),exp(-rr*rr*2.4));
  col+=vec3(.05,.035,.018)*fbm(uv*2.2+vec2(tt*.02,-tt*.015))*exp(-rr*1.3);
  float alone=exp(-rr*rr*5.5);
  col+=vec3(1.,.6,.2)*alone*(.04+.1*prog)*ease(uIntro);
  for(int l=0;l<3;l++){
    float fl=float(l);
    float sc=7.+fl*6.;
    vec2 q=uv*sc+vec2(fl*17.,-tt*(.16+fl*.07));
    vec2 id=floor(q);
    float hh=hash(id+fl*3.7);
    vec2 off=vec2(hash(id+1.3),hash(id+7.9))*.7+.15;
    float d=length(fract(q)-off);
    float tw=.55+.45*sin(tt*(1.6+hh*2.)+hh*40.);
    col+=vec3(1.,.82,.45)*smoothstep(.07+.02*fl,0.,d)*step(.78,hh)*tw*(.55-.12*fl)*ease(uIntro);
  }
  col*=1.-.55*smoothstep(.4,1.15,length(uv*vec2(.85,1.)));

  // ---------- camera e oggetto
  float dolly=ease(uOut);
  vec3 ro=vec3(0.,.15,uDist*(1.-.62*dolly));
  vec3 ta=vec3(0.,mix(0.,.25,dolly),0.);
  vec3 fw=normalize(ta-ro), rg=normalize(cross(vec3(0.,1.,0.),fw)), up=cross(fw,rg);
  vec3 rd=normalize(uv.x*rg+uv.y*up+2.2*fw);
  // l'oggetto gira piano attorno al proprio asse, con un respiro di inclinazione e un galleggiamento
  float ang=tt*.42+sin(tt*.23)*.35+uOut*1.2;
  float tilt=.09*sin(tt*.5);
  float fly=.05*sin(tt*.8)+(1.-ease(uIntro))*-.4;
  vec3 o=ro-vec3(0.,fly,0.);
  mat2 R=rot(-ang), Rx=rot(tilt);
  float sopra=0.;   // 1 dove il Puzzle copre il fondale: i bagliori del fondale non devono lavarlo
  vec3 oo=o, dd=rd;
  oo.xz=R*oo.xz; dd.xz=R*dd.xz;
  oo.yz=Rx*oo.yz; dd.yz=Rx*dd.yz;

  // sfera di contenimento: fuori da qui non si cammina
  vec3 bc=vec3(0.,.55,0.);
  vec3 oc=oo-bc;
  float bq=dot(oc,dd), cq=dot(oc,oc)-2.7*2.7;
  float disc=bq*bq-cq;
  if(disc>0. && ease(uIntro)>.001){
    float tN=-bq-sqrt(disc);
    float tF=-bq+sqrt(disc);
    float tm=max(tN,0.);
    float hit=-1.;
    float dm=1.;
    for(int i=0;i<84;i++){
      vec3 pp=oo+dd*tm;
      dm=map(pp);
      if(dm<.0015*tm){ hit=tm; break; }
      tm+=dm*.85;
      if(tm>tF) break;
    }
    // un raggio che sfiora la sagoma consuma i passi senza mai toccare: se e' arrivato "quasi" lo si accetta, o i bordi si bucano a puntini
    if(hit<0. && tm<=tF && dm<.02*tm) hit=tm;
    if(hit>0.){
      vec3 p=oo+dd*hit;
      vec3 n=normalAt(p);
      float pn;
      float dB=sdBody(p,pn);
      float dRg=sdRing(p);
      bool corpo=dB<dRg;
      vec3 oro=vec3(1.,.74,.3);
      vec3 alb=oro;
      float emissione=0.;
      float scuro=0.;                 // quanto il punto e' L'OCCHIO (rilievo): li' l'oro e' scuro, quasi nero, e non riflette
      vec3 emC=vec3(.55,.27,.05);
      float rugosita=.05;
      if(corpo){
        // il pannello incassato e' piu' scuro e satinato, la cornice lucida
        alb=mix(oro,oro*vec3(.9,.8,.62),pn);
        rugosita=mix(.0,.06,pn);
        // l'Occhio e' RILIEVO (la normale lo sa gia', viene dalla distanza): qui serve solo sapere dove sta, per lucidarlo e accenderlo
        float dX=dot(vec2(abs(p.x),p.y-APEX),NXY), dZ=dot(vec2(abs(p.z),p.y-APEX),NXY);
        float lungo;
        float rilievo=occhioH(coordOcchio(p,dX,dZ),lungo)*pn;
        float cresta=smoothstep(.55,.95,rilievo);
        float acceso=1.-smoothstep(prog-.1,prog,lungo*.98);
        acceso=max(acceso,ease(uOut*2.));
        // L'Occhio e' ORO SCURO, QUASI NERO (richiesta dell'utente: col metallo lucido i riflessi lo facevano sembrare bianco).
        // Colore scuro, superficie opaca (niente specchio) e, piu' sotto, niente riflessi ne' luce frontale su di lui.
        scuro=smoothstep(.05,.4,rilievo)*.6;   // solo smorza i riflessi sul rilievo (niente bianco): il colore resta l'oro del metallo, non tinto
        // (il colore dell'Occhio NON cambia: e' oro come il resto, come sul Puzzle vero)
        rugosita=mix(rugosita,.3,scuro);
        emissione=cresta*acceso*.3;
        n=normalize(n+rugosita*(vec3(vnoise(p.xy*60.),vnoise(p.yz*60.),vnoise(p.zx*60.))-.5));
        emC=vec3(.6,.28,.05);   // la brace dell'avanzamento resta ambra scura: mai il bianco-giallo di prima
      } else {
        rugosita=.02;
        n=normalize(n+.01*(vec3(vnoise(p.xy*50.),vnoise(p.yz*50.),vnoise(p.zx*50.))-.5));
      }
      vec3 vdir=-dd;
      float nv=max(dot(n,vdir),0.);
      vec3 rf=reflect(dd,n);
      float fres=pow(1.-nv,4.);
      vec3 F=(alb+(1.-alb)*fres*.8)*(1.-.55*scuro);
      // occlusione ambientale: tre campioni lungo la normale
      float ao=1.;
      for(int k=1;k<=3;k++){ float h=.045*float(k); ao-=(h-map(p+n*h))*(.9/float(k)); }
      ao=clamp(ao,.25,1.);
      vec3 luce=normalize(vec3(-.45,.75,.55));
      float dif=max(dot(n,luce),0.);
      float spec=pow(max(dot(rf,luce),0.),48.)*(1.-rugosita*3.);
      vec3 c=env(rf)*F*1.2*ao + alb*(.14+.12*n.y+.42*dif)*ao + vec3(1.,.9,.7)*spec*.55*(1.-.7*scuro);
      c+=oro*vec3(1.,.82,.5)*pow(nv,1.4)*.5*ao*(1.-.7*scuro);     // una luce frontale: le facce che guardano in basso restano oro, non marrone
      c+=vec3(.5,.62,1.)*pow(1.-nv,3.)*.07*ao*(1.-scuro);   // un filo freddo sul bordo
      c*=mix(.6,1.,smoothstep(0.,.3,nv));           // a raso la normale non e' affidabile: niente puntini bianchi sulla sagoma
      c=min(c,vec3(2.2));
      c+=emC*emissione*(1.5+.4*sin(tt*7.+p.y*9.));
      // il Puzzle appena nato: si "ripassa" di luce dall'alto verso il basso
      float sweep=exp(-pow((p.y-(mix(1.9,-1.4,ease(uIntro*1.1))))*2.2,2.))*(1.-ease(uIntro));
      c+=vec3(1.,.8,.5)*sweep*1.4;
      col=mix(col,c,ease(uIntro*1.4));
      sopra=ease(uIntro*1.4);
    }
  }

  // ---------- il bagliore dell'Occhio che cresce col progresso, e l'esplosione finale
  float cuore=exp(-length(uv-vec2(0.,.06))*length(uv-vec2(0.,.06))*18.);
  col+=vec3(1.,.5,.12)*cuore*prog*prog*.07*(1.-sopra);
  float o1=ease(uOut);
  float lampo=exp(-pow((uOut-.18)*7.,2.));
  col+=vec3(1.,.9,.7)*lampo*exp(-length(uv)*length(uv)*2.)*1.6;
  float onda=exp(-pow((length(uv)-uOut*1.5)*9.,2.))*(1.-uOut);
  col+=vec3(1.,.78,.4)*onda*.8;

  // mappa dei toni
  col=vec3(1.)-exp(-col*.95);
  col=mix(vec3(dot(col,vec3(.3,.59,.11))),col,1.28);   // l'oro deve restare oro anche dove la luce lo schiarisce
  col=pow(max(col,0.),vec3(1.04));
  // Dopo il lampo dell'Occhio il Puzzle sprofonda nel NERO (dopo la mappa dei toni, o sarebbe grigio): a nero pieno la pagina
  // costruisce il menu sotto, dove il lavoro non si vede, e poi lo splash sfuma verso di lui (anche il menu e' scuro, quindi
  // non c'e' un salto di luminosita'). Lo stacco di prima era quel lavoro, fatto a meta' animazione.
  col=mix(col,WHITE,smoothstep(.3,.58,uOut));
  gl_FragColor=vec4(col,1.);
}`;

    // ------------------------------------------------------------------------------------------------
    // Il misuratore del caricamento vero
    // ------------------------------------------------------------------------------------------------
    /**
     * Cosa si misura (e cosa no). Le risorse attese sono gli <script src> e i <link rel=stylesheet> del documento, letti dal suo
     * stesso testo (una seconda richiesta della pagina, quasi sempre servita dalla cache); quelle FINITE vengono dal Resource Timing.
     * Se il testo non si puo' leggere (file://) si usa solo il DOM e il `load`. I traguardi sono pesi, non percentuali "vere": dire
     * 100% quando manca il verdetto dell'accesso sarebbe una bugia.
     */
    function creaMisuratore() {
        const stato = { attese: new Set(), fatte: new Set(), dom: document.readyState !== 'loading', load: document.readyState === 'complete', verdetto: false, conosciute: false };
        const assoluto = (u) => { try { return new URL(u, location.href).href; } catch (e) { return ''; } };
        const registra = (nome) => { if (stato.attese.has(nome)) stato.fatte.add(nome); };
        try {
            const osserva = new PerformanceObserver((lista) => lista.getEntries().forEach((e) => registra(e.name)));
            osserva.observe({ type: 'resource', buffered: true });
        } catch (e) { /* senza PerformanceObserver restano DOM e load */ }
        const conta = () => {
            // Gli elementi gia' nel DOM (script/foglio di stile): sono noti subito, senza leggere il testo della pagina.
            document.querySelectorAll('script[src], link[rel="stylesheet"]').forEach((el) => {
                const u = assoluto(el.getAttribute('src') || el.getAttribute('href') || '');
                if (u) stato.attese.add(u);
            });
            try { performance.getEntriesByType('resource').forEach((e) => registra(e.name)); } catch (e) { /* ignora */ }
        };
        conta();
        // Il resto della pagina non e' ancora stato letto dal parser: lo si conta dal testo, e il totale CRESCE al momento giusto.
        try {
            if (location.protocol === 'file:') throw new Error('file');   // da file:// la lettura e' vietata (e sporcherebbe la console)
            fetch(location.href, { cache: 'force-cache' }).then((r) => (r.ok ? r.text() : '')).then((txt) => {
                const re = /<script[^>]+src=["']([^"']+)["']|<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/g;
                let m;
                while ((m = re.exec(txt))) { const u = assoluto(m[1] || m[2] || m[3]); if (u) stato.attese.add(u); }
                stato.conosciute = stato.attese.size > 4;
                try { performance.getEntriesByType('resource').forEach((e) => registra(e.name)); } catch (e) { /* ignora */ }
            }).catch(() => {});
        } catch (e) { /* senza fetch si va a traguardi */ }
        document.addEventListener('DOMContentLoaded', () => { stato.dom = true; conta(); });
        window.addEventListener('load', () => { stato.load = true; conta(); });
        return {
            stato,
            /** Il progresso "vero" 0..1 in questo istante (prima dei limiti di velocita'). */
            valore() {
                let v = 0;
                const tot = stato.attese.size;
                if (tot > 0) v = 0.7 * (stato.fatte.size / tot);
                if (stato.dom) v = Math.max(v, 0.74);
                if (stato.load) v = Math.max(v, 0.9);
                if (stato.verdetto) v = 1;
                return Math.min(1, v);
            },
            /** Per il testo sotto la barra. */
            riga() { const tot = stato.attese.size; return tot > 0 && !stato.load ? `${Math.min(stato.fatte.size, tot)}/${tot} file` : ''; }
        };
    }

    // ------------------------------------------------------------------------------------------------
    // La scena
    // ------------------------------------------------------------------------------------------------
    const FRASI = ['Si mescola il mazzo…', 'Il Puzzle si ricompone…', 'L\'Occhio del Millennio si apre…', 'Che il duello abbia inizio!'];
    const MIN_MS = 2800;       // minimo di durata, dall'avvio
    const RIEMPI_MAX = 0.42;   // velocita' massima del riempimento (frazione al secondo): niente salti anche con tutto in cache
    const USCITA_MS = 1250;

    const menoMovimento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

    function highpOk() {
        try {
            const c = document.createElement('canvas');
            const g = c.getContext('webgl');
            if (!g) return false;
            const pr = g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
            const ok = !!(pr && pr.precision > 0);
            const e = g.getExtension('WEBGL_lose_context'); if (e) e.loseContext();
            return ok;
        } catch (e) { return false; }
    }

    /**
     * L'INTERRUTTORE DI EMERGENZA (il rollback "a caldo", senza ripubblicare): `?splash3d=0` nell'indirizzo, oppure
     * `localStorage.ygoSplash3D = '0'` per spegnerlo su quel dispositivo; allora vale lo splash di sempre. `?splash3d=1` toglie
     * la memoria e lo riaccende. Il rollback "a freddo" (togliere la funzione dal sito) e' il revert del merge: vedi CLAUDE.md.
     */
    function interruttoreSpento() {
        // "Dettagli video" (Impostazioni): lo splash 3D e' un effetto "Alti", con "Normali" resta lo splash di sempre. Vince sul resto,
        // salvo ?splash3d=1 che serve proprio a provarlo. Se VideoQuality non e' stato caricato non si decide nulla da qui.
        try {
            const forzato = new URLSearchParams(location.search).get('splash3d') === '1';
            if (!forzato && window.VideoQuality && !window.VideoQuality.isAlti()) return true;
        } catch (e) { /* ignora */ }
        try {
            const q = new URLSearchParams(location.search).get('splash3d');
            if (q === '0') { try { localStorage.setItem('ygoSplash3D', '0'); } catch (e) { /* ignora */ } return true; }
            if (q === '1') { try { localStorage.removeItem('ygoSplash3D'); } catch (e) { /* ignora */ } return false; }
            return localStorage.getItem('ygoSplash3D') === '0';
        } catch (e) { return false; }
    }

    const SplashWebgl = {
        attivo: false,
        /**
         * Monta la scena dentro `contenitore` (lo splash). Torna false (senza toccare niente) se non puo' partire.
         * @param {HTMLElement} contenitore
         * @param {{ manuale?: boolean }} [opz] manuale: il progresso lo decide `imposta()` (anteprima), non il misuratore.
         */
        avvia(contenitore, opz) {
            if (this.attivo || !contenitore || interruttoreSpento() || !highpOk()) return false;
            const canvas = document.createElement('canvas');
            canvas.setAttribute('aria-hidden', 'true');
            canvas.className = 'splash-webgl-canvas';
            const gl = /** @type {WebGLRenderingContext|null} */ (canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }));
            if (!gl) return false;
            const comp = (tipo, src) => { const o = /** @type {WebGLShader} */ (gl.createShader(tipo)); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { window.SPLASH_WEBGL_ERRORE = String(gl.getShaderInfoLog(o)); return null; } return o; };
            const vs = comp(gl.VERTEX_SHADER, VS), fs = comp(gl.FRAGMENT_SHADER, FS);
            const prog = gl.createProgram();
            if (!vs || !fs || !prog) return false;
            gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { window.SPLASH_WEBGL_ERRORE = 'link ' + gl.getProgramInfoLog(prog); return false; }
            gl.useProgram(prog);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, 'p');
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            const U = {};
            ['r', 't', 'uProg', 'uIntro', 'uOut', 'uDist'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

            contenitore.insertBefore(canvas, contenitore.firstChild);
            contenitore.classList.add('splash-webgl-on');
            this.attivo = true;

            const misuratore = opz && opz.manuale ? null : creaMisuratore();
            this.misuratore = misuratore;   // esposto per i controlli (quante risorse attese/finite)
            const t0 = performance.now();
            let visto = 0, disp = 0, manuale = 0, uscitaDa = 0, finito = false, rid = 0, ultimo = 0, lenti = 0;
            let cbUscita = null, chiamato = false;
            const barra = /** @type {HTMLElement|null} */ (contenitore.querySelector('.splash-barra-riempi'));
            const perc = /** @type {HTMLElement|null} */ (contenitore.querySelector('.splash-perc'));
            const frase = /** @type {HTMLElement|null} */ (contenitore.querySelector('.splash-frase'));
            const dettaglio = /** @type {HTMLElement|null} */ (contenitore.querySelector('.splash-dettaglio'));
            const contenuto = /** @type {HTMLElement|null} */ (contenitore.querySelector('.splash-contenuto'));
            let nFrase = -1;
            const congelato = () => (typeof window.FX_WEBGL_T === 'number' ? window.FX_WEBGL_T : null);

            const ridimensiona = () => {
                const W = window.innerWidth, H = window.innerHeight;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                // Il raymarching costa per pixel: tetto sui pixel totali, piu' basso sui telefoni.
                const budget = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 0.55e6 : 1.3e6;
                const s = Math.min(1, Math.sqrt(budget / (W * H * dpr * dpr))) * dpr;
                canvas.width = Math.max(120, Math.round(W * s));
                canvas.height = Math.max(120, Math.round(H * s));
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.uniform2f(U.r, canvas.width, canvas.height);
                // schermi bassi: il Puzzle si rimpicciolisce, o il titolo e la barra non ci stanno
                gl.uniform1f(U.uDist, 11.5 * Math.max(1, 640 / H) * Math.max(1, 0.62 * H / W + 0.38));
            };
            ridimensiona();
            window.addEventListener('resize', ridimensiona);

            const finePerche = () => {
                cancelAnimationFrame(rid);
                window.removeEventListener('resize', ridimensiona);
                try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) { /* gia' perso */ }
            };

            const frame = (ora) => {
                rid = requestAnimationFrame(frame);
                if (document.hidden) return;
                const dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0.016;
                lenti = ultimo && (ora - ultimo) > 60 ? lenti + (ora - ultimo) : Math.max(0, lenti - 40);
                ultimo = ora;
                const trascorso = ora - t0;
                const tempo = congelato() !== null ? /** @type {number} */ (congelato()) : trascorso / 1000;

                // progresso: vero (o manuale), limitato nel tempo e nella velocita'
                let bersaglio = misuratore ? misuratore.valore() : manuale;
                if (!misuratore) { /* anteprima: lo decide imposta() */ } else {
                    // mai oltre quello che il tempo "merita" (non si vede 100% prima del minimo) e mai 1 senza il verdetto
                    bersaglio = Math.min(bersaglio, 0.12 + 0.88 * Math.min(1, trascorso / MIN_MS));
                    if (!misuratore.stato.verdetto) bersaglio = Math.min(bersaglio, 0.97);
                }
                const passo = RIEMPI_MAX * dt;
                disp = bersaglio > disp ? Math.min(bersaglio, disp + passo * (0.5 + 2.5 * (bersaglio - disp))) : disp;
                const pc = Math.round(disp * 100);
                if (barra) barra.style.width = (disp * 100).toFixed(1) + '%';
                if (perc) perc.textContent = pc + '%';
                const iF = disp < .25 ? 0 : disp < .55 ? 1 : disp < .97 ? 2 : 3;
                if (frase && iF !== nFrase) { nFrase = iF; frase.style.opacity = '0'; setTimeout(() => { frase.textContent = FRASI[iF]; frase.style.opacity = '1'; }, 160); }
                if (dettaglio && misuratore) dettaglio.textContent = misuratore.riga();

                // fine del caricamento: dopo il minimo e col progresso arrivato in fondo parte l'uscita
                if (misuratore && misuratore.stato.verdetto && !uscitaDa && disp > 0.995 && trascorso >= MIN_MS) uscitaDa = ora;
                if (!misuratore && manuale >= 1 && !uscitaDa && disp > 0.995) uscitaDa = ora;
                const u = uscitaDa ? Math.min(1, (ora - uscitaDa) / USCITA_MS) : 0;
                if (u >= 1 && !finito) { finito = true; setTimeout(finePerche, 900); }
                // titolo e barra spariscono PRIMA del bianco, cosi' non restano scritte sopra la luce
                if (contenuto) contenuto.style.opacity = String(1 - Math.max(0, Math.min(1, (u - 0.08) / 0.3)));

                const intro = Math.min(1, trascorso / 1500);
                gl.uniform1f(U.t, tempo);
                gl.uniform1f(U.uProg, disp);
                gl.uniform1f(U.uIntro, menoMovimento() ? 1 : intro);
                gl.uniform1f(U.uOut, menoMovimento() ? (u > 0.5 ? 1 : 0) : u);
                // se il dispositivo non regge, il Puzzle resta (e' tutta la scena), ma si abbassa la risoluzione. PRIMA di disegnare:
                // cambiare la dimensione di un canvas lo svuota, e a fine frame si vedrebbe un lampo nero.
                if (lenti > 1500 && canvas.width > 360) { lenti = 0; canvas.width = Math.round(canvas.width * 0.7); canvas.height = Math.round(canvas.height * 0.7); gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(U.r, canvas.width, canvas.height); }
                gl.drawArrays(gl.TRIANGLES, 0, 3);
                // A BIANCO PIENO (il frame appena disegnato) la pagina fa il suo lavoro pesante: costruire il menu o l'accesso sotto lo
                // splash blocca il thread per un attimo, e a meta' animazione si vedeva come uno scatto. Qui non si vede niente.
                // Si aspetta anche un frame in piu': il bianco deve essere davvero sullo schermo prima che il thread si fermi.
                if (u > 0.62 && !chiamato && cbUscita) {
                    chiamato = true;
                    const f = cbUscita; cbUscita = null;
                    requestAnimationFrame(() => setTimeout(f, 0));
                }
            };
            rid = requestAnimationFrame(frame);

            this._api = {
                /** Anteprima: imposta il progresso a mano (0..1). */
                imposta(p) { manuale = Math.max(0, Math.min(1, p)); },
                /** La pagina ha il verdetto (accesso verificato): si puo' concludere. `cb` parte quando lo schermo e' quasi bianco. */
                concludi(cb) {
                    if (misuratore) misuratore.stato.verdetto = true; else manuale = 1;
                    cbUscita = cb || null; chiamato = false;
                    if (!cb) chiamato = true;
                },
                riavvia() { uscitaDa = 0; finito = false; chiamato = false; disp = 0; manuale = 0; if (misuratore) misuratore.stato.verdetto = false; }
            };
            return true;
        },
        imposta(p) { if (this._api) this._api.imposta(p); },
        /**
         * La pagina ha finito (accesso verificato): fa il finale. `cb` viene chiamata quando lo schermo e' pieno di luce, cioe' il momento
         * giusto per far comparire il menu sotto; poi la pagina dissolve lo splash.
         */
        concludi(cb) { if (this._api) this._api.concludi(cb); else if (cb) cb(); }
    };

    window.SplashWebgl = SplashWebgl;
})();
