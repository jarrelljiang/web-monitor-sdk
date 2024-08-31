import { createFilter } from '@rollup/pluginutils'

export default function catchInjectorPlugin(options = {}) {
    // 通过 createFilter 创建一个过滤器，它允许我们决定哪些文件应被处理
    const filter = createFilter(options.include, options.exclude)

    return {
        name: 'catch-injector', // 插件名称
        enforce: 'pre', // 该插件在 plugin-vue 插件之前执行，这样就可以直接解析到原模板文件
        transform(code, id) {
            // 使用过滤器检查当前文件是否应该被处理
            if (!filter(id)) return code
            //匹配promise中的catch代码字符，如".catch((err:any) => {"
            const promiseCatchRegex = /\.catch\(\([^)]*\)\s*=>\s*\{/g
            //匹配promise中的catch方法的参数名(包含类型)，如"err:any"
            const promiseParamRegex = /\.catch\(\((.*?)\)\s*=>\s*\{/
            //匹配try catch中的catch代码字符，如"catch (err:any) {"
            const tryCatchRegex = /catch\s*\([^)]*\)\s*\{/g
            //匹配try catch中的catch方法的参数名(包含类型)，如"err:any"
            const tryParamRegex = /catch\s*\((.*?)\)\s*\{/
            let transformedCode = code

            const handleCode = (catchRegex, paramRegex, type) => {
                transformedCode = transformedCode.replaceAll(catchRegex, (str) => {
                    //获取catch中小括号内的字符
                    const matchParam = str.match(paramRegex)
                    let paramName //catch中的参数名，不包含类型，如"err"
                    if (matchParam && matchParam[1]) {
                        //matchParam[1]→"err:any"
                        paramName = matchParam[1].split(':')[0].trim()
                        return str.replace('{', `{ catchError(${paramName});`) //加分号是为了防止可能有代码没格式化，出现在同一行导致语法报错
                    } else {
                        if (type == 1) {
                            return '.catch((err) => { catchError(err);'
                        } else {
                            return 'catch (err) { catchError(err);'
                        }
                    }
                })
            }
            handleCode(promiseCatchRegex, promiseParamRegex, 1)
            handleCode(tryCatchRegex, tryParamRegex, 2)

            // 返回修改后的代码
            return transformedCode
        }
    }
}
