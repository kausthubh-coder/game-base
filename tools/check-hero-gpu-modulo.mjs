// Exercises the shipped vertex shader's frame calculation directly on the graphics chip.
import { launchChrome } from './lib/chrome.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = '.artifacts/hero-frame-repair'; mkdirSync(out, { recursive: true });
const browser = await launchChrome();
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const result = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    in vec2 inputFrame; out float result;
    void main() { float frame = inputFrame.x; float frames = inputFrame.y; result = mod(frame, frames); gl_Position = vec4(0,0,0,1); }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; out vec4 color; void main() {color=vec4(1);}`));
    gl.transformFeedbackVaryings(program, ['result'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const cases = []; for (const frames of [3,4,6]) for(let tick=0;tick<6000;tick++) cases.push(tick,frames);
    const data = new Float32Array(cases), buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program,'inputFrame'); gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const output=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,data.length/2*4,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
    gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,data.length/2);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
    const values=new Float32Array(data.length/2);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);
    const failures=[];for(let i=0;i<values.length;i++) if(values[i]!==data[i*2]%data[i*2+1]) failures.push({tick:data[i*2],frames:data[i*2+1],got:values[i],expected:data[i*2]%data[i*2+1]});
    return {cases:values.length,failures,glError:gl.getError()};
  });
  writeFileSync(out+'/gpu-modulo-original.json',JSON.stringify({renderer:browser.gameRenderer,...result},null,2));
  console.log(JSON.stringify({renderer:browser.gameRenderer,...result,failures:result.failures.slice(0,20)}));
  if(result.failures.length||result.glError)process.exitCode=1;
} finally {await browser.close();}
