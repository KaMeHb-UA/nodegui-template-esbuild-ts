import { build, analyzeMetafile } from 'esbuild';
import { exit, argv, cwd } from 'process';
import { resolve, isAbsolute, join as pathJoin, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const banner = `
import { createRequire } from 'module';
const require = createRequire(new URL(import.meta.url));
`.slice(1, -1);

const prod = argv[2] === '--prod',
    dirname = resolve(fileURLToPath(import.meta.url), '..'),
    distFile = resolve(dirname, 'dist/app.js');

/** @type {import('esbuild').Plugin} */
const nativePlugin = {
    name: 'native',
    setup(build){
        build.onResolve({ filter: /\.node$/ }, args => {
            if(args.namespace === 'native-stub'){
                return {
                    path: args.path,
                    namespace: 'native-binary',
                }
            }
            if(args.resolveDir === '') return; // Ignore unresolvable paths
            return {
                path: relative(dirname, isAbsolute(args.path) ? args.path : pathJoin(args.resolveDir, args.path)),
                namespace: 'native-stub',
            }
        });
        build.onLoad({ filter: /.*/, namespace: 'native-stub' }, async args => ({
            contents: existsSync(args.path) ? `module.exports = require(require(${JSON.stringify(args.path)}));` : `throw new Error("Cannot require ${args.path}: file not found")`,
        }));
        build.onLoad({ filter: /.*/, namespace: 'native-binary' }, async args => ({
            contents: await readFile(args.path),
            loader: 'file',
        }));
    },
};

/** @type {import('esbuild').BuildOptions} */
const buildConfig = {
    entryPoints: [
        resolve(dirname, 'src/index.ts'),
    ],
    bundle: true,
    outfile: distFile,
    sourcemap: true,
    allowOverwrite: true,
    minify: prod,
    minifyIdentifiers: prod,
    minifySyntax: prod,
    minifyWhitespace: prod,
    platform: 'node',
    format: 'esm',
    tsconfig: 'tsconfig.json',
    external: [
        'dotenv',
    ],
    banner: {
        js: banner,
    },
    metafile: prod,
    plugins: [
        nativePlugin,
    ],
    legalComments: 'none',
    loader: {
        '.svg': 'file',
        '.png': 'file',
        '.jpg': 'file',
        '.jpeg': 'file',
        '.gif': 'file',
        '.bmp': 'file',
    },
};

async function writePkgJson(target){
    const pkgJSON = Buffer.from(JSON.stringify({
        private: true,
        type: 'module',
    }), 'utf8');
    await writeFile(target, pkgJSON);
    const from = '[[runtime]]';
    return {
        metafile: {
            inputs: {
                [from]: {
                    bytes: 0,
                    imports: [],
                },
            },
            outputs: {
                [relative(cwd(), target)]: {
                    imports: [],
                    exports: [],
                    entryPoint: from,
                    inputs: {
                        [from]: {
                            bytesInOutput: pkgJSON.length,
                        },
                    },
                    bytes: pkgJSON.length,
                },
            },
        },
    };
}

try{
    const buildMain = build(buildConfig);
    const result = await buildMain;
    const distPkgJsonResult = await writePkgJson(resolve(distFile, '..', 'package.json'));
    if(prod){
        const metafile = JSON.parse(JSON.stringify(result.metafile));
        Object.assign(metafile.inputs, distPkgJsonResult.metafile.inputs);
        Object.assign(metafile.outputs, distPkgJsonResult.metafile.outputs);
        console.log(await analyzeMetafile(metafile));
    };
} catch(e){
    exit(1);
}
