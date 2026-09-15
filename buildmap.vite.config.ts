import 'dotenv/config';
import { defineConfig } from "vite";
import { getMaps, getMapsOptimizers, getMapsScripts, LogLevel, OptimizeOptions } from "wa-map-optimizer-vite";

// getMaps() picks up every .tmj in the project, which would ship the starter-kit
// demo maps (office, conference, smallOffice) alongside ours on every upload.
// They stay in the repo as reference; only the map listed here is built.
const MAPS_TO_BUILD = ["normalis_office.tmj"];

const allMaps = getMaps();
const maps = new Map(
    [...allMaps].filter(([mapPath]) => MAPS_TO_BUILD.some((name) => mapPath.endsWith(`/${name}`) || mapPath === name))
);

if (maps.size !== MAPS_TO_BUILD.length) {
    throw new Error(
        `Expected to build ${MAPS_TO_BUILD.join(", ")} but matched ${maps.size} map(s): ${[...maps.keys()].join(", ") || "none"}.\n` +
        `Maps found in the project: ${[...allMaps.keys()].join(", ")}`
    );
}

// Saving a map in Tiled rewrites the whole file, so a "script" map property that was
// added by hand outside Tiled silently disappears on the next save. Without it there is
// no rollup entry point and the build dies on "You must supply options.input" instead of
// saying what is actually missing. Set this property in Tiled (Map > Map Properties).
for (const [mapPath, map] of maps) {
    const script = map.properties?.find((property) => property.name === "script");
    if (!script?.value) {
        throw new Error(
            `${mapPath} has no "script" map property, so no script would be bundled for it.\n` +
            `Add it in Tiled under Map > Map Properties as a string property: script = src/main.ts`
        );
    }
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
                ...getMapsScripts(maps),
            },
        },
    },
    preview: {
        cors: true,
    },
    plugins: [
        ...getMapsOptimizers(maps, optimizerOptions),
    ],
});
