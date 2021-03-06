async function loadAssets(additional: FileReq[] = []) {
    const uiEl = $("#files");
    uiEl.innerText = "indexing assets";
    const reqs: FileReq[] = [
        ...((await (await fetch("/assets")).json()) as any[]).filter(_ => (_.enabled ?? true) && _.id != "video0_").map(_ => ({
            url: "/assets/" + _.id,
            id: _.id,
            label: _.label,
            mime: _.mime,
            size: _.size,
            objectURL: true,
        } as FileReq)),
        ...additional
    ];
    uiEl.innerText = "";
    loading += reqs.length;
    reqs.forEach(file => {
        const el = $el();
        el.innerText = `'${file.label}': path='${file.url}'; size=${typeof file.size == "number" ? file.size + "bytes" : file.size}; mime=${file.mime})`
        uiEl.appendChild(el);
        fetch(file.url).then(res => {
            if (res.ok) {
                el.innerText += " res_ok";
                console.log(`%c [${timeSinceAppStart()}] reponse ${file.id}`, "color: #0f0");
                function loaded() {
                    el.innerText += " parsed";
                    el.classList.add("ok");
                    loading--;
                    checkLoadState();
                }
                if (file.objectURL) {
                    res.blob().then(_ => URL.createObjectURL(_)).then(_ => assets.set(file.id, _)).then(() => loaded()).catch(err => {
                        console.error("Response parsing failed")
                    })
                } else {
                    res.text().then(_ => assets.set(file.id, _)).then(() => loaded()).catch(err => {
                        console.error("Response parsing failed")
                    })
                }
            } else {
                el.innerText += " Failed"
                el.classList.add("failed");
                loading--;
                checkLoadState();
            }

        })
    })
    return new Promise<void>(res => void (loaded = res));
}
let loaded: () => void;
let loading = 0;
function checkLoadState() {
    if (loading == 0) {
        console.log("%c loaded assets", "color: #0f0")
        loaded();
    }
}
interface FileReq {
    url: string,
    id: string,
    label: string,
    size: number | "unknown" | "a few bytes",
    objectURL: boolean,
    mime: string
}
const assets = new Map<string, string>();
window.addEventListener("load", () => {
    const reqs: FileReq[] = ["vertex", "fragment"].map(_ => ({
        url: `/client/shaders/${_}.shader`,
        id: `${_}.shader`,
        objectURL: false,
        label: `Shader ${_}`,
        size: "a few bytes",
        mime: "WebGL/shader"
    }))

    loadAssets([
        ...reqs
    ]).then(() => {
        shaderCode();
    })
});

let shaderCode: () => void;

function getShaderCode() {
    return new Promise<void>(res => void (shaderCode = res))
}