let gl;
const frameBufferSize = [window.screen.height, window.screen.width];
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}
function compileShader(vertexCode, fragmentCode) {
    return createProgram(gl, createShader(gl, gl.VERTEX_SHADER, vertexCode), createShader(gl, gl.FRAGMENT_SHADER, fragmentCode));
}
function resizeCanvasToDisplaySize(canvas, gl) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const needResize = canvas.width !== displayWidth ||
        canvas.height !== displayHeight;
    if (needResize) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    return needResize;
}
let renderTime = [];
let renderLoop = true;
let fps = 0;
let fpsEl;
setInterval(() => {
    if (!fpsEl)
        return;
    fpsEl.innerText = `${fps * 2}fps (${Math.round(renderTime.reduce((prev, current) => prev + current, 0) / renderTime.length * 1000)}μs of ${Math.round(1000000 / fps)}μs)`;
    renderTime = [];
    fps = 0;
}, 500);
function vec2(x, y) {
    return [x, y];
}
const transformProps = [
    vec2(0, 0),
    vec2(1, 0),
    vec2(0, 1),
    vec2(1, 1)
];
async function initGl() {
    console.log(`%c [${timeSinceAppStart()}] starting init`, "color: #0ff");
    updateStatus("creating WebGL context");
    fpsEl = $("#fps");
    const canvas = $("#c");
    gl = canvas.getContext("webgl2");
    if (!gl) {
        updateStatus("[ERROR] WebGL not supported", "error");
        throw new Error("no WebGL");
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    window.addEventListener("resize", () => resizeCanvasToDisplaySize(canvas, gl));
    resizeCanvasToDisplaySize(canvas, gl);
    console.log(`%c [${timeSinceAppStart()}] √ created WebGL context`, "color: #0f0");
    updateStatus("loading shaders");
    await getShaderCode();
    const fragmentCode = [
        "precision lowp float;",
        "precision lowp int;",
        flags.transform ? "#define ENABLE_TRANSFORM" : "// TRANSFORM DISABLED"
    ].join("\n") + "\n\n" + assets.get("fragment.shader");
    const vertexCode = [
        flags.transform ? "#define FLIP (u_mode == 2)" : "#define FLIP true"
    ].join("\n") + "\n\n" + assets.get("vertex.shader");
    lg.pr = compileShader(vertexCode, fragmentCode);
    gl.useProgram(lg.pr);
    console.log(`%c [${timeSinceAppStart()}] √ created WebGL shaders`, "color: #0f0");
    updateStatus("initializing");
    ["u_texture", "u_fbTex", "u_shutter", "u_mode", "u_shutterMode", "u_opacity", "u_eTL", "u_eTR", "u_eBL", "u_eBR"]
        .forEach(uname => uniforms.set(uname, gl.getUniformLocation(lg.pr, uname)));
    lg.objPosLoc = gl.getAttribLocation(lg.pr, "a_objectPos");
    lg.texPosLoc = gl.getAttribLocation(lg.pr, "a_texturePos");
    lg.objPosBuf = gl.createBuffer();
    lg.texPosBuf = gl.createBuffer();
    lg.fb = gl.createFramebuffer();
    lg.fbTex = gl.createTexture();
    lg.shutterTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lg.fbTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frameBufferSize[1], frameBufferSize[0], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, lg.shutterTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, lg.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lg.fbTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.uniform1i(uniforms.get("u_texture"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lg.fbTex);
    gl.uniform1i(uniforms.get("u_fbTex"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, lg.shutterTex);
    gl.uniform1i(uniforms.get("u_shutter"), 2);
    gl.activeTexture(gl.TEXTURE1);
    gl.uniform1i(uniforms.get("u_mode"), 0);
    gl.uniform1i(uniforms.get("u_shutterMode"), 1);
    gl.uniform2f(uniforms.get("u_eTL"), 0, 0);
    gl.uniform2f(uniforms.get("u_eTR"), 1, 0);
    gl.uniform2f(uniforms.get("u_eBL"), 0, 1);
    gl.uniform2f(uniforms.get("u_eBR"), 1, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, lg.objPosBuf);
    gl.vertexAttribPointer(lg.objPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(lg.objPosLoc);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1]), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, lg.texPosBuf);
    gl.vertexAttribPointer(lg.texPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(lg.texPosLoc);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    updateStatus("loading components");
    loadElmnts().then(() => {
        requestAnimationFrame(render);
        updateStatus("ready");
        hideInfos();
    });
}
const lg = {};
const uniforms = new Map();
let renderCycle = 0;
const clockPrescaler = flags.clockPrescaler;
function updateTransform(transformProps) {
    gl.uniform2f(uniforms.get("u_eTL"), ...transformProps[0]);
    gl.uniform2f(uniforms.get("u_eTR"), ...transformProps[1]);
    gl.uniform2f(uniforms.get("u_eBL"), ...transformProps[2]);
    gl.uniform2f(uniforms.get("u_eBR"), ...transformProps[3]);
}
function render() {
    renderCycle++;
    if (renderCycle < clockPrescaler) {
        window.requestAnimationFrame(render);
        return;
    }
    else {
        renderCycle = 0;
    }
    const startRender = performance.now();
    resizeCanvasToDisplaySize(gl.canvas, gl);
    updateTransform(transformProps);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    if (flags.transform) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, lg.fb);
        gl.viewport(0, 0, frameBufferSize[1], frameBufferSize[0]);
    }
    else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1i(uniforms.get("u_mode"), 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, lg.objPosBuf);
    for (let el of elmnts) {
        const op = el.getOpacity();
        if (op == 0)
            continue;
        gl.uniform1f(uniforms.get("u_opacity"), op);
        el.bufferPos();
        el.bindTex();
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (flags.transform) {
        gl.uniform1i(uniforms.get("u_shutterMode"), hasShutter ? 1 : 0);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1]), gl.DYNAMIC_DRAW);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, lg.fbTex);
        gl.uniform1i(uniforms.get("u_mode"), 2);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    renderTime.push(performance.now() - startRender);
    fps++;
    window.requestAnimationFrame(render);
}
function Pos2Buffer({ x, y, h, w }) {
    return new Float32Array([x, y, x + w, y, x + w, y + h, x, y, x, y + h, x + w, y + h]);
}
const elmnts = new Set();
class Elmnt {
    constructor(id) {
        this.id = id;
        this.opacity = 0;
        this.pos = { x: 0, y: 0, h: 1, w: 1 };
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    getOpacity() {
        return this.opacity;
    }
    bindTex(bindPoint = gl.TEXTURE_2D) {
        gl.bindTexture(bindPoint, this.tex);
    }
    bufferPos() {
        gl.bufferData(gl.ARRAY_BUFFER, Pos2Buffer(this.pos), gl.DYNAMIC_DRAW);
    }
    updatePars(par, value, sacn) {
        switch (par) {
            case "intens":
            case "i":
            case "o":
            case "intensity":
                this.opacity = parseFloat(value);
                break;
            case "x":
                this.pos.x = parseFloat(value);
                break;
            case "y":
                this.pos.y = parseFloat(value);
                break;
            case "h":
                this.pos.h = parseFloat(value);
                break;
            case "w":
                this.pos.w = parseFloat(value);
                break;
        }
    }
    initPar([name, type, value]) {
        type = type.toLowerCase();
        function addSacnListener(addr, listener) {
            if (sacnListener.has(addr)) {
                sacnListener.get(addr).add(listener);
            }
            else {
                sacnListener.set(addr, new Set([listener]));
            }
        }
        if (type.startsWith("static")) {
            if (type == "staticcp") {
                this.updatePars(name, (parseFloat(value) + 1) / 2, false);
            }
            else if (type == "staticpcp") {
                this.updatePars(name, (parseFloat(value) + 100) / 200, false);
            }
            else {
                this.updatePars(name, value, false);
            }
        }
        else if (type.startsWith("sacn")) {
            if (type == "sacn" || type == "sacn8") {
                const addr = parseInt(value);
                addSacnListener(addr, value => {
                    this.updatePars(name, value / 255, true);
                });
            }
            else if (type == "sacn16") {
                const fulladdr = value.split("/");
                const addrlow = parseInt(fulladdr[0]);
                const addrhi = parseInt(fulladdr[1]);
                let valuelow = 0, valuehi = 0;
                const updateValue = (() => {
                    this.updatePars(name, ((valuehi << 8) + valuelow) / 65535, true);
                }).bind(this);
                addSacnListener(addrlow, value => {
                    valuelow = value;
                    this;
                    updateValue();
                });
                addSacnListener(addrhi, value => {
                    valuehi = value;
                    updateValue();
                });
            }
        }
        else {
            console.warn(`type of ${this.id}.${name} is unknown`);
        }
    }
}
class ImgElmnt extends Elmnt {
    constructor(id, props) {
        super(id);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
        const img = new Image();
        img.src = assets.get(props.find(_ => _[0] == "src")[2]);
        textureLoadIndicator(false);
        img.addEventListener('load', () => {
            // Now that the image has loaded make copy it to the texture.
            gl.bindTexture(gl.TEXTURE_2D, this.tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            console.log(`%c [${timeSinceAppStart()}] mounted ${id}`, "color: #0f0");
            textureLoadIndicator(true);
        });
        props.forEach(this.initPar.bind(this));
    }
}
class VideoElmnt extends Elmnt {
    constructor(id, props) {
        super(id);
        this.loaded = false;
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
        this.video = document.createElement("video");
        this.video.addEventListener('playing', () => {
            if (this.loaded)
                return;
            this.loaded = true;
            console.log(`%c [${timeSinceAppStart()}] mounted ${id}`, "color: #0f0");
            textureLoadIndicator(true);
        });
        this.video.src = assets.get(props.find(_ => _[0] == "src")[2]);
        this.playback = new Playback(this.video);
        textureLoadIndicator(false);
        props.forEach(this.initPar.bind(this));
    }
    bindTex(bindPoint) {
        super.bindTex(bindPoint);
        if (!this.loaded)
            return;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
    }
    updatePars(par, value, sacn) {
        switch (par) {
            case "pb":
            case "playback":
                this.playback.parsePBState(Math.round(parseFloat(value) * 255));
                break;
            default:
                super.updatePars(par, value, sacn);
        }
    }
}
class AudioElmnt extends Elmnt {
    constructor(id, props) {
        super(id);
        this.loaded = false;
        this.audio = document.createElement("video");
        this.audio.addEventListener('playing', () => {
            if (this.loaded)
                return;
            this.loaded = true;
            console.log(`%c [${timeSinceAppStart()}] mounted ${id}`, "color: #0f0");
            textureLoadIndicator(true);
        });
        this.audio.src = assets.get(props.find(_ => _[0] == "src")[2]);
        this.playback = new Playback(this.audio);
        textureLoadIndicator(false);
        props.forEach(this.initPar.bind(this));
    }
    bindTex(bindPoint) {
        super.bindTex(bindPoint);
        if (!this.loaded)
            return;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.audio);
    }
    updatePars(par, value, sacn) {
        switch (par) {
            case "pb":
            case "playback":
                this.playback.parsePBState(Math.round(parseFloat(value) * 255));
                break;
            default:
                super.updatePars(par, value, sacn);
        }
    }
    getOpacity() {
        return 0;
    }
}
class Playback {
    constructor(el) {
        this.el = el;
        this.playing = false;
        this.looping = false;
        this.beginning = false;
    }
    updatePB(play, loop, begin) {
        if (!play && (begin || loop))
            return; //invalid
        let anythingCanged = false;
        if (play != this.playing) {
            if (play) {
                this.el.play();
            }
            else {
                this.el.pause();
            }
            this.playing = play;
            anythingCanged = true;
        }
        if (loop != this.looping) {
            this.looping = this.el.loop = loop;
            anythingCanged = true;
        }
        if (begin != this.beginning) {
            this.beginning = begin;
            anythingCanged = true;
        }
        if ((begin || this.el.ended) && anythingCanged) {
            this.el.currentTime = 0;
            this.el.play();
        }
        if (anythingCanged)
            console.log(this);
    }
    parsePBState(value) {
        value = Math.floor(value / 10);
        this.updatePB(...pbMapping[value] || [false, true, true]);
    }
}
const pbMapping = [
    [false, true, true],
    [false, false, false],
    [true, false, false],
    [true, false, true],
    [true, true, false],
    [true, true, true], //5 loop begin
];
function tranformCorner(corner) {
    switch (corner) {
        case "TL":
            return 0;
        case "TR":
            return 1;
        case "BL":
            return 2;
        case "BR":
            return 3;
        default:
            return null;
    }
}
let hasShutter = false;
const rootLock = false;
async function loadElmnts() {
    const config = await (await fetch("/config")).json();
    console.log(config);
    for (let el of config) {
        const id = el[0];
        const props = el[2];
        switch (el[1]) {
            case "img":
                elmnts.add(new ImgElmnt(id, props));
                break;
            case "video":
                elmnts.add(new VideoElmnt(id, props));
                break;
            case "root":
                if (rootLock) {
                    console.error(`found more than one root config`);
                }
                else {
                    const a = {
                        updatePars(par, value, sacn) {
                            const corner = par.slice(0, 2);
                            const coord = par.slice(2);
                            if (corner.length == 2 && coord.length == 1) {
                                transformProps[tranformCorner(corner)][coord == "X" ? 0 : 1] =
                                    parseFloat(value);
                            }
                            else {
                                if (par == "shutter") {
                                    textureLoadIndicator(false);
                                    const img = new Image();
                                    img.src = assets.get(value.toString());
                                    hasShutter = true;
                                    img.addEventListener("load", () => {
                                        gl.bindTexture(gl.TEXTURE_2D, lg.shutterTex);
                                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                                        console.log(`%c [${timeSinceAppStart()}] mounted shutter`, "color: #0f0");
                                        textureLoadIndicator(true);
                                    });
                                }
                            }
                        }
                    };
                    props.forEach(Elmnt.prototype.initPar.bind(a));
                }
                break;
        }
    }
    clear();
}
//# sourceMappingURL=gl.js.map