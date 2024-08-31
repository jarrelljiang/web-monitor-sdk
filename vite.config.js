// vite.config.js

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
const path = require('path')
import catchInjectorPlugin from './service/plugins/catch-injector'
import deadcodePlugins from 'vite-plugin-deadcode'

const getCommonConfig = (env) => {
    const commonConfig = {
        plugins: [
            vue(),
            createSvgIconsPlugin({
                iconDirs: [path.resolve(process.cwd(), 'src/assets/svg')],
                // 指定symbolId格式
                symbolId: 'icon-[dir]-[name]'
            }),
            catchInjectorPlugin({
                include: env == 'dev' ? ['**/*.vue', '**/*.ts', '**/*.js'] : ['**/*.ts', '**/*.js'],
                exclude: 'node_modules/**'
            }),
            deadcodePlugins({
                inputDir: 'src', // serarch path, default: src
                outDir: 'dist' // the path where deadcode output, default: dist
            })
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            },
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue', '.less', '.svg']
        },
        css: {
            preprocessorOptions: {
                less: {
                    math: 'always',
                    javascriptEnabled: true
                }
            }
        },
        server: {
            host: '0.0.0.0',
            port: 8080,
            watch: {
                ignored: ['!/node_modules/@donson/dsight']
            }
        },
        optimizeDeps: {
            exclude: ['@donson/dsight']
        }
    }
    return commonConfig
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
    if (command === 'serve') {
        return {
            ...getCommonConfig('dev'),
            base: '/'
        }
    } else {
        // command === 'build'
        return {
            // build 独有配置
            ...getCommonConfig(),
            base: 'https://static5.yingsaidata.com/mip/'
        }
    }
})

// base: env.VUE_APP_ENV === 'loc' ? '/' : 'https://static5.yingsaidata.com/mip/'
