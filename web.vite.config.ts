import 'dotenv/config';
import { defineConfig, Plugin } from "vite";
import { getMaps, getMapsOptimizers, getMapsScripts, LogLevel, OptimizeOptions } from "wa-map-optimizer-vite";
import {VitePluginNode} from "vite-plugin-node";

const maps = getMaps();

// The Express server from @workadventure/map-starter-kit-core serves static files with
// "Cache-Control: public, max-age=86400". In dev that means the browser keeps showing a
// stale map for up to a day after you save in Tiled. Force revalidation on map assets by
// intercepting the header the static handler sets further down the middleware chain.
const mapAssetPattern = /(\.(tmj|tmx|png)($|\?))|(^\/tilesets\/)/i;

function noCacheMapAssets(): Plugin {
    return {
        name: "no-cache-map-assets",
        apply: "serve",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url && mapAssetPattern.test(req.url)) {
                    const setHeader = res.setHeader.bind(res);
                    res.setHeader = ((name: string, value: number | string | ReadonlyArray<string>) =>
                        name.toLowerCase() === "cache-control"
                            ? setHeader(name, "no-store, must-revalidate")
                            : setHeader(name, value)) as typeof res.setHeader;

                    res.setHeader("Cache-Control", "no-store, must-revalidate");
                }
                next();
            });
        },
    };
}

let optimizerOptions: OptimizeOptions = {
    logs: process.env.LOG_LEVEL && process.env.LOG_LEVEL in LogLevel ? LogLevel[process.env.LOG_LEVEL] : LogLevel.NORMAL,
};

if (process.env.TILESET_OPTIMIZATION && process.env.TILESET_OPTIMIZATION === "true") {
    const qualityMin = process.env.TILESET_OPTIMIZATION_QUALITY_MIN ? parseInt(process.env.TILESET_OPTIMIZATION_QUALITY_MIN) : 0.9;
    const qualityMax = process.env.TILESET_OPTIMIZATION_QUALITY_MAX ? parseInt(process.env.TILESET_OPTIMIZATION_QUALITY_MAX) : 1;

    optimizerOptions.output = {
        tileset: {
            compress: {
                quality: [qualityMin, qualityMax],
            }
        }
    }
}

export default defineConfig({
    base: "./",
    build: {
        sourcemap: true,
        rollupOptions: {
            input: {
                index: "./index.html",
                ...getMapsScripts(maps),
            },
        },
    },
    plugins: [
        noCacheMapAssets(),
        ...getMapsOptimizers(maps, optimizerOptions),
        ...VitePluginNode({
            // Nodejs native Request adapter
            // currently this plugin support 'express', 'nest', 'koa' and 'fastify' out of box,
            // you can also pass a function if you are using other frameworks, see Custom Adapter section
            adapter: 'express',

            // tell the plugin where is your project entry
            appPath: './app/app.ts',

            // Optional, default: 'viteNodeApp'
            // the name of named export of you app from the appPath file
            exportName: 'viteNodeApp',

            // Optional, default: false
            // if you want to init your app on boot, set this to true
            initAppOnBoot: false,

            // Optional, default: false
            // if you want to reload your app on file changes, set this to true, rebounce delay is 500ms
            reloadAppOnFileChange: false,
        })
    ],
    server: {
        host: "localhost",
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        open: "/",
        // Ensure Vite transforms TypeScript files when served directly
        middlewareMode: false,
    },
    // Ensure TypeScript files are transformed
    esbuild: {
        include: /\.tsx?$/,
    },
});
