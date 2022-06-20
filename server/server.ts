import * as fs from "fs-extra";
import * as path from "path";
//@ts-ignore
if (!global?.callOptions) global.callOptions = {} as any;
const port = callOptions?.port ?? parseInt(process.argv[3]);
export let dbFile = "";
import express from "express";
import { init_db } from "./src/db.js";
import { staticAssets } from "./src/assets.js";
import { initSacn } from "./src/sacn.js";
import { initSocket } from "./src/socket.js";
import expressWs from "express-ws";
import { clientConfig } from "./src/clientConfig.js";
// import { join } from "path";

export async function main() {
    const dbFile_ = callOptions?.file || path.join(__dirname, process.argv[2]);
    if (!fs.pathExistsSync(dbFile_)) {
        console.error("database does not exist");
        process.exit(1);
    }
    dbFile = dbFile_;
    const app = express();
    const expWsApp = expressWs(app);

    app.enable('etag');

    app.set('etag', 'strong')

    app.use("/static-test", express.static(path.join(__dirname, "./test")));

    app.use("/client", express.static(path.join(__dirname, "../client"), { index: "client.html" }));

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "../client/client.html"));
    })

    process.stdout.write("reading file ...");

    init_db().then(() => {
        console.log(" finished");
        staticAssets(app);
        initSacn();
        initSocket(app as any as expressWs.Application);
        app.get("/config", (req, res) => {
            clientConfig().then(config => {
                res.end(config);
            });
        })
        if (callOptions?.randomPort) {
            const server = app.listen(() => {
                //@ts-ignore
                const port = server.address().port;
                console.log("using port", port);
                callOptions?.portCb?.(port);
            })
        } else {
            app.listen(port, () => {
                console.log(`Go to http://localhost:${port}/`)
            });
        }
    })
}

if (!callOptions?.delayInit) main();