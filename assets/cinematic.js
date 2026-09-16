// Original portfolio montage composited inside a receding KEVIN title.
export function cinematicIntro(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cinematic-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas'), mc = mask.getContext('2d');
  if (!ctx || !mc) return () => canvas.remove();
  const images = ['via-platform-architecture.webp', 'roborefer-diagnostic.svg', 'seckill-transaction-path.webp', 'esca-threat-model.svg'].map(src => {
    const im = new Image(); im.src = 'assets/' + src; return im;
  });
  let frame, start = performance.now();
  function draw(now) {
    const t = (now - start) / 1000, w = innerWidth, h = innerHeight, d = Math.min(devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(w*d) || canvas.height !== Math.round(h*d)) {
      canvas.width = mask.width = Math.round(w*d); canvas.height = mask.height = Math.round(h*d);
    }
    ctx.setTransform(d,0,0,d,0,0); mc.setTransform(d,0,0,d,0,0);
    const fade = Math.max(0, Math.min(1, (t-3.9)/1.1));
    ctx.fillStyle = `rgb(${15+158*fade},${19-10*fade},${24+3*fade})`; ctx.fillRect(0,0,w,h);
    function montage(c) {
      c.fillStyle='#132633'; c.fillRect(0,0,w,h);
      const strip=w/3;
      for(let i=-1;i<5;i++) {
        const im=images[(i+5+Math.floor(t*.65))%images.length], x=i*strip-(t*100)%strip;
        if(im.complete && im.naturalWidth && im.naturalHeight) {
          const width = strip + 6, height = h * 1.3;
          // Cover each moving panel without distorting the source image.
          const scale = Math.max(width / im.naturalWidth, height / im.naturalHeight);
          const sw = width / scale, sh = height / scale;
          c.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2,
            sw, sh, x, Math.sin(t+i)*h*.08-h*.15, width, height);
        }
        c.fillStyle='rgba(5,12,20,.3)'; c.fillRect(x,0,strip,h);
        c.strokeStyle='#bf965c'; c.lineWidth=2; c.strokeRect(x,0,strip,h);
      }
    }
    if(t<1.2) montage(ctx);
    else {
      const p=Math.min(1,(t-1.2)/3), pull=Math.pow(1-p,3), font=Math.min(w*.23,h*.37);
      function pose(c) { c.translate(w/2+w*.3*pull,h/2); c.rotate(-.18*pull); c.scale(1+6*pull,1+6*pull); c.font=`900 ${font}px Impact, Arial Narrow, sans-serif`; c.textAlign='center'; c.textBaseline='middle'; }
      ctx.save();pose(ctx);
      for(let z=15;z>0;z--) { ctx.fillStyle=`rgb(${65+z*4},${45+z*2},${28+z})`;ctx.fillText('KEVIN',z*(1-fade)*1.4,z*(1-fade)*.9); }
      ctx.restore();
      mc.clearRect(0,0,w,h); montage(mc); mc.globalCompositeOperation='destination-in';mc.save();pose(mc);mc.fillStyle='#fff';mc.fillText('KEVIN',0,0);mc.restore();mc.globalCompositeOperation='source-over';
      ctx.drawImage(mask,0,0,w,h);ctx.save();pose(ctx);ctx.fillStyle=`rgba(250,247,240,${fade})`;ctx.fillText('KEVIN',0,0);ctx.restore();
      ctx.fillStyle=`rgba(250,247,240,${fade})`;ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText('SYSTEMS  /  VISION  /  INTELLIGENCE',w/2,h/2+font*.64);
    }
    frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(frame); canvas.remove(); };
}
