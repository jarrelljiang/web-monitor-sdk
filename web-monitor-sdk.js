if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
    module.exports = {
        Monitor
    }
} else {
    window.Monitor = Monitor
}
//测试环境、灰度环境、带端口的环境(本地环境)不上报
function notReport() {
    return (
        ['test.mip', 'test2.mip', 'gray.mip', 'graymip'].some((host) => window.location.href.includes(host)) ||
        window.location.port
    )
}
//不用进行上报的错误信息
const blackMsgList = [
    '用户未登录',
    '该账号已在其他地方登录,请重新登录',
    JSON.stringify({ stack: '(cancel)' }),
    'Failed to fetch', //使用fetch(url)不通且没catch时，会触发unhandledrejection，message为Failed to fetch(Chrome)
    'NetworkError when attempting to fetch resource.', //同上(Firefox)
    "Uncaught SecurityError: Failed to execute 'toBlob' on 'HTMLCanvasElement': Tainted canvases may not be exported.", //"@openreplay/tracker"内部报错
    'SecurityError: The operation is insecure.', //"@openreplay/tracker"内部报错
    "project doesn't exist or is not active, key: HBCHl9YKVOCMbbxZC9us" //"@openreplay/tracker"内部报错
]
function getBrowser() {
    const userAgent = navigator.userAgent
    if (userAgent.indexOf('Chrome') !== -1 && userAgent.indexOf('Safari') !== -1 && userAgent.indexOf('Edg') === -1) {
        return 'Chrome' // Chrome
    } else if (userAgent.indexOf('Firefox') !== -1) {
        return 'Firefox'
    } else if (
        userAgent.indexOf('Safari') !== -1 &&
        userAgent.indexOf('Chrome') === -1 &&
        userAgent.indexOf('Edge') === -1
    ) {
        return 'Safari'
    } else if (userAgent.indexOf('Edg') !== -1) {
        return 'Edge'
    } else {
        return '其他浏览器'
    }
}
function getWholeErrString(err) {
    if (JSON.stringify(err)?.length > JSON.stringify(err, Object.getOwnPropertyNames(err))?.length) {
        return JSON.stringify(err)
    } else {
        return JSON.stringify(err, Object.getOwnPropertyNames(err))
    }
}
function Monitor(option) {
    if (notReport()) {
        window.catchError = function () {}
        return
    }
    function handleErr() {
        const getMsg = (err, errType) => {
            if (!err) return
            //错误信息兜底的处理方法
            const getFinalMsg = (err) => {
                //mip中getUserInfo()中的failedHandle方法reject({})了一个空对象,已被catch，会触发catchError方法，err就是{}
                //mip中cache-api.ts文件reject({})了一个空对象,未被catch，会触发unhandledrejection事件,err.reason就是{}
                //还有一些处理是直接reject()，err或者err.reason都是undefined
                if (
                    (err.constructor == Object && Object.keys(err).length == 0) ||
                    (err.reason?.constructor == Object && Object.keys(err.reason).length == 0) ||
                    (errType == 'unhandledrejection' && !err.reason)
                ) {
                    return undefined
                } else if (!err.reason) {
                    return getWholeErrString(err)
                } else {
                    return getWholeErrString(err.reason)
                }
            }
            return (
                err.message || err.data?.message || err.reason?.data?.message || err.reason?.message || getFinalMsg(err)
            )
        }
        const getLocation = (err) => {
            if (!err) return
            //浏览器兼容性处理
            let errArr = [err, err.reason, err.error].filter((e) => e)
            let fileProp = ['sourceURL', 'filename', 'fileName'].find((p) => errArr.some((e) => e[p]))
            let lineProp = ['line', 'lineno', 'lineNumber'].find((p) => errArr.some((e) => e[p]))
            let columnProp = ['column', 'colno', 'columnNumber'].find((p) => errArr.some((e) => e[p]))

            if (fileProp && lineProp && columnProp) {
                let errObj = errArr.find((e) => e[fileProp] && e[lineProp] && e[columnProp])
                return `${errObj[fileProp]}:${errObj[lineProp]}:${errObj[columnProp]}`
            }
            //错误位置兜底的处理方法
            const getFinalLocation = (err) => {
                if (err.stack) {
                    return `err.stack：${getWholeErrString(err.stack)}`
                } else if (err.reason) {
                    return `err.reason：${getWholeErrString(err.reason)}`
                } else if (err.error) {
                    return `err.error：${getWholeErrString(err.error)}`
                } else {
                    return `err.stack、err.reason、err.error都不存在，err：${getWholeErrString(err)}`
                }
            }
            return (
                err.config?.url ||
                err.reason?.config?.url ||
                err.stack?.split('\n')[1] ||
                err.reason?.stack?.split('\n')[1] ||
                err.error?.stack?.split('\n')[1] ||
                getFinalLocation(err)
            )
        }
        const getErrObj = (err) => {
            if (!err) return
            /*
                onerror中的err对象有error属性
                onunhandledrejection中的err对象有reason属性
                catch中的err对象没有error和reason属性，但自身属性能够被getOwnPropertyNames获取到
             */
            return err.error || err.reason || err
        }
        const msgTip = function (msg, location, errType, err) {
            if (!msg || !err || blackMsgList.some((item) => msg.includes(item))) {
                return
            }
            let errObj = JSON.parse(getWholeErrString(err))
            fetch(option.domain, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: window.location.href,
                    msg,
                    location,
                    errType,
                    err: errObj,
                    browser: getBrowser()
                })
            })
                .then((response) => response.json())
                .catch(() => {}) //加个空catch是为了防止上报的fetch失败触发unhandledrejection，然后又触发上报的fetch导致死循环
        }
        window.catchError = function (err) {
            msgTip(getMsg(err), getLocation(err), 'catchError', getErrObj(err))
        }
        //TODO难点攻关...safari中的error事件无法获取到具体错误信息，message为"Script error."
        //https://blog.csdn.net/weixin_33343700/article/details/118233951
        window.addEventListener('error', (err) => {
            msgTip(getMsg(err), getLocation(err), 'onerror', getErrObj(err))
        })
        window.addEventListener('unhandledrejection', (err) => {
            msgTip(getMsg(err, 'unhandledrejection'), getLocation(err), 'unhandledrejection', getErrObj(err))
        })
        const e = console.error
        console.error = function () {
            msgTip(getMsg(arguments[0]), getLocation(arguments[0]), 'console.error', getErrObj(arguments[0]))
            Function.prototype.apply.call(e, console, arguments)
        }
    }
    handleErr()
}
