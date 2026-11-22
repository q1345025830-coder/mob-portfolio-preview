(() => {
  'use strict';
  const vertexSource=`
    attribute vec2 aPoint;
    attribute vec2 aUv;
    varying vec2 vUv;
    void main() {
      vUv = aUv;
      gl_Position = vec4(aPoint, 0.0, 1.0);
    }
  `;
  const fragmentSource=`
    precision mediump float;
    uniform sampler2D uImage;
    uniform vec2 uCrop;
    uniform vec2 uTrail;
    uniform float uDepth;
    uniform float uAlpha;
    varying vec2 vUv;

    vec3 cover(vec2 point) {
      return texture2D(uImage, clamp((point - 0.5) * uCrop + 0.5, 0.0, 1.0)).rgb;
    }

    void main() {
      vec2 size = vec2(1.0, 0.5625);
      vec2 corner = abs(vUv - 0.5) * size - size * 0.5 + 0.024;
      float mask = 1.0 - smoothstep(0.021, 0.025, length(max(corner, 0.0)));
      vec3 base = cover(vUv);
      if (uDepth > 0.005) {
        vec3 echo = (cover(vUv + uTrail) * 0.47
                   + cover(vUv + uTrail * 1.9) * 0.32
                   + cover(vUv + uTrail * 3.05) * 0.21);
        base = mix(base, echo, uDepth * 0.63);
      }
      float alpha = mask * uAlpha;
      gl_FragColor = vec4(base * (1.0 - uDepth * 0.25) * alpha, alpha);
    }
  `;
  function shader(gl,type,source) {
    const compiled=gl.createShader(type);
    gl.shaderSource(compiled,source);
    gl.compileShader(compiled);
    if(gl.getShaderParameter(compiled,gl.COMPILE_STATUS)) return compiled;
    gl.deleteShader(compiled);
    throw new Error('Orbit shader could not compile');
  }
  function makeProgram(gl) {
    const vertex=shader(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=shader(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);
    gl.attachShader(program,fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Orbit shaders could not link');
    return program;
  }
  function inside(point,x,y) {
    let hit=false;
    for(let i=0,j=point.length-1;i<point.length;j=i++) {
      const a=point[i],b=point[j];
      if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) hit=!hit;
    }
    return hit;
  }
  window.createMobOrbitCanvas=(stage,cards,onRedraw,onFallback)=>{
    const canvas=document.createElement('canvas');
    canvas.className='orbit-canvas';
    canvas.setAttribute('aria-hidden','true');
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:false,powerPreference:'high-performance'});
    if(!gl) return null;
    const releaseContext=gl.getExtension('WEBGL_lose_context');
    let program;
    try {program=makeProgram(gl);}
    catch {return null;}
    const controller=new AbortController();
    const {signal}=controller;
    const positions=gl.createBuffer();
    const elements=gl.createBuffer();
    const point=gl.getAttribLocation(program,'aPoint');
    const uv=gl.getAttribLocation(program,'aUv');
    const uniforms=Object.fromEntries(['uImage','uCrop','uTrail','uDepth','uAlpha'].map(id=>[id,gl.getUniformLocation(program,id)]));
    const columns=14,rows=6,stride=columns+1;
    const mesh=new Float32Array(stride*(rows+1)*4);
    const indices=[];
    const edge=[];
    for(let col=0;col<=columns;col++) edge.push(col);
    for(let row=1;row<=rows;row++) edge.push(row*stride+columns);
    for(let col=columns-1;col>=0;col--) edge.push(rows*stride+col);
    for(let row=rows-1;row>0;row--) edge.push(row*stride);
    const rim=new Set(edge);
    for(let row=0;row<=rows;row++) {
      for(let col=0;col<=columns;col++) {
        const index=row*stride+col;
        mesh[index*4+2]=col/columns;
        mesh[index*4+3]=row/rows;
        if(row<rows&&col<columns) indices.push(index,index+1,index+stride,index+1,index+stride+1,index+stride);
      }
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,positions);
    gl.bufferData(gl.ARRAY_BUFFER,mesh.byteLength,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(point);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(point,2,gl.FLOAT,false,16,0);
    gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(uniforms.uImage,0);
    let drawn=[];
    let omitted=null;
    const entries=cards.map(link=>{
      const img=link.querySelector('img');
      const texture=gl.createTexture();
      const entry={link,img,texture,loaded:false,crop:[1,1]};
      const sync=()=>{
        if(!img.naturalWidth || gl.isContextLost()) return;
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
        const aspect=img.naturalWidth/img.naturalHeight;
        entry.crop=[Math.min(1,16/9/aspect),Math.min(1,aspect/(16/9))];
        entry.loaded=true;
        onRedraw();
      };
      img.addEventListener('load',sync,{signal});
      img.loading='eager';
      if(img.complete&&img.naturalWidth) sync();
      return entry;
    });
    stage.prepend(canvas);
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      onFallback();
    },{signal});

    function draw({width,height,mobile,cursor,selected,direction}) {
      if(!width||!height||gl.isContextLost()) return;
      const scale=Math.min(devicePixelRatio||1,mobile?1.55:1.65,Math.sqrt(3200000/(width*height)));
      const pixelsWide=Math.round(width*scale),pixelsHigh=Math.round(height*scale);
      if(canvas.width!==pixelsWide || canvas.height!==pixelsHigh) {
        canvas.width=pixelsWide;
        canvas.height=pixelsHigh;
      }
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const total=entries.length;
      const half=total/2;
      const range=Math.min(4.52,half-.03);
      const cardsInView=entries.map((entry,index)=>{
        const delta=((index-cursor+half)%total+total)%total-half;
        return {entry,index,delta,distance:Math.abs(delta)};
      }).filter(card=>card.distance<range)
        .sort((a,b)=>b.distance-a.distance || Number(a.index===selected)-Number(b.index===selected));
      drawn=[];
      const cardW=mobile?Math.min(width*.75,500):Math.min(width*.286,height*.51,550);
      const cardH=cardW*9/16;
      const focal=Math.max(width*.74,height*1.08,450);
      for(const {entry,index,delta,distance} of cardsInView) {
        const travel=-delta;
        const angle=travel*.92;
        const phaseSin=Math.sin(angle),phaseCos=Math.cos(angle);
        const sweep=phaseSin*(mobile?.64:.329)-travel*(mobile?.052:.051);
        const centerX=width*((mobile?.50:.515)+sweep+(1-phaseCos)*.016);
        const pitch=mobile?.173:.132+.052*Math.min(1,distance/2.8);
        const centerY=height*.465 + travel*height*pitch;
        const centerZ=(phaseCos-1)*(mobile?295:Math.min(755,width*.49));
        const yaw=-phaseSin*(mobile?.99:1.39);
        const tilt=-Math.sign(travel)*(1-phaseCos)*.25;
        const roll=phaseSin*.105;
        const sy=Math.sin(yaw),cy=Math.cos(yaw);
        const st=Math.sin(tilt),ct=Math.cos(tilt);
        const sr=Math.sin(roll),cr=Math.cos(roll);
        const focus=index===selected;
        const depth=focus?0:Math.min(1,Math.max(0,.15+(distance-.45)*.60));
        const bend=.084+depth*.30;
        const outline=[];
        for(let row=0;row<=rows;row++) {
          const localY=(row/rows-.5)*cardH;
          for(let col=0;col<=columns;col++) {
            const i=row*stride+col;
            const u=col/columns-.5;
            const localX=u*cardW;
            const localZ=(.25-u*u)*cardW*bend;
            const x=localX*cy+localZ*sy;
            const z=localZ*cy-localX*sy;
            const y=localY*ct-z*st;
            const perspective=focal/(focal-centerZ-localY*st-z*ct);
            const screenX=centerX+(x*cr-y*sr)*perspective+(centerX-width*.50)*(perspective-1);
            const screenY=centerY+(x*sr+y*cr)*perspective+(centerY-height*.49)*(perspective-1);
            mesh[i*4]=screenX/width*2-1;
            mesh[i*4+1]=1-screenY/height*2;
            if(rim.has(i)) outline[i]={x:screenX,y:screenY};
          }
        }
        const polygon=edge.map(i=>outline[i]);
        drawn.push({entry,polygon});
        if(!entry.loaded || entry.link===omitted) continue;
        gl.bindTexture(gl.TEXTURE_2D,entry.texture);
        gl.uniform2f(uniforms.uCrop,...entry.crop);
        gl.uniform2f(uniforms.uTrail,direction*phaseCos*(.007+depth*.019),direction*(.004+depth*.012));
        gl.uniform1f(uniforms.uDepth,depth);
        gl.uniform1f(uniforms.uAlpha,Math.min(1,(range-distance)*.82));
        gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh);
        gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      }
    }
    return {
      draw,
      hit(x,y) {
        for(let i=drawn.length-1;i>=0;i--) {
          const {entry,polygon}=drawn[i];
          if(entry.loaded && inside(polygon,x,y)) return entry.link;
        }
        return null;
      },
      bounds(link) {
        const shape=drawn.find(card=>card.entry.link===link);
        if(!shape) return null;
        const xs=shape.polygon.map(p=>p.x),ys=shape.polygon.map(p=>p.y);
        const left=Math.min(...xs),top=Math.min(...ys);
        return {left,top,width:Math.max(...xs)-left,height:Math.max(...ys)-top};
      },
      omit(link) {omitted=link;},
      destroy() {
        controller.abort();
        for(const entry of entries) gl.deleteTexture(entry.texture);
        gl.deleteBuffer(positions);
        gl.deleteBuffer(elements);
        gl.deleteProgram(program);
        if(!gl.isContextLost()) releaseContext?.loseContext();
        canvas.remove();
      }
    };
  };
})();
