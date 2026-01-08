// Web API Polyfills for QuickJS WASM runtime
// TextEncoder, TextDecoder, URL, URLSearchParams, Headers, Request, Response

(function(global) {
    'use strict';

    // ========== TextEncoder ==========
    if (typeof global.TextEncoder === 'undefined') {
        global.TextEncoder = function TextEncoder() {
            this.encoding = 'utf-8';
        };
        
        global.TextEncoder.prototype.encode = function(str) {
            str = String(str);
            var bytes = [];
            for (var i = 0; i < str.length; i++) {
                var code = str.charCodeAt(i);
                if (code < 0x80) {
                    bytes.push(code);
                } else if (code < 0x800) {
                    bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                } else if (code < 0xd800 || code >= 0xe000) {
                    bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                } else {
                    // Surrogate pair
                    i++;
                    code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    bytes.push(
                        0xf0 | (code >> 18),
                        0x80 | ((code >> 12) & 0x3f),
                        0x80 | ((code >> 6) & 0x3f),
                        0x80 | (code & 0x3f)
                    );
                }
            }
            return new Uint8Array(bytes);
        };
    }

    // ========== TextDecoder ==========
    if (typeof global.TextDecoder === 'undefined') {
        global.TextDecoder = function TextDecoder(encoding) {
            this.encoding = encoding || 'utf-8';
        };
        
        global.TextDecoder.prototype.decode = function(bytes) {
            if (!bytes) return '';
            var array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            var result = '';
            var i = 0;
            while (i < array.length) {
                var byte1 = array[i++];
                if (byte1 < 0x80) {
                    result += String.fromCharCode(byte1);
                } else if (byte1 < 0xe0) {
                    var byte2 = array[i++];
                    result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
                } else if (byte1 < 0xf0) {
                    var byte2 = array[i++];
                    var byte3 = array[i++];
                    result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
                } else {
                    var byte2 = array[i++];
                    var byte3 = array[i++];
                    var byte4 = array[i++];
                    var codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
                    codePoint -= 0x10000;
                    result += String.fromCharCode((codePoint >> 10) + 0xd800, (codePoint & 0x3ff) + 0xdc00);
                }
            }
            return result;
        };
    }

    // ========== URLSearchParams ==========
    if (typeof global.URLSearchParams === 'undefined') {
        global.URLSearchParams = function URLSearchParams(init) {
            this._params = [];
            if (typeof init === 'string') {
                init = init.replace(/^\?/, '');
                var pairs = init.split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    if (pair[0]) {
                        this._params.push([decodeURIComponent(pair[0]), decodeURIComponent(pair[1] || '')]);
                    }
                }
            } else if (init && typeof init === 'object') {
                for (var key in init) {
                    if (init.hasOwnProperty(key)) {
                        this._params.push([key, String(init[key])]);
                    }
                }
            }
        };

        global.URLSearchParams.prototype.get = function(name) {
            for (var i = 0; i < this._params.length; i++) {
                if (this._params[i][0] === name) return this._params[i][1];
            }
            return null;
        };

        global.URLSearchParams.prototype.set = function(name, value) {
            var found = false;
            for (var i = 0; i < this._params.length; i++) {
                if (this._params[i][0] === name) {
                    if (!found) {
                        this._params[i][1] = String(value);
                        found = true;
                    } else {
                        this._params.splice(i--, 1);
                    }
                }
            }
            if (!found) this._params.push([name, String(value)]);
        };

        global.URLSearchParams.prototype.append = function(name, value) {
            this._params.push([name, String(value)]);
        };

        global.URLSearchParams.prototype.delete = function(name) {
            for (var i = this._params.length - 1; i >= 0; i--) {
                if (this._params[i][0] === name) this._params.splice(i, 1);
            }
        };

        global.URLSearchParams.prototype.has = function(name) {
            return this.get(name) !== null;
        };

        global.URLSearchParams.prototype.toString = function() {
            return this._params.map(function(p) {
                return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
            }).join('&');
        };

        global.URLSearchParams.prototype.forEach = function(callback) {
            for (var i = 0; i < this._params.length; i++) {
                callback(this._params[i][1], this._params[i][0], this);
            }
        };
    }

    // ========== URL ==========
    if (typeof global.URL === 'undefined') {
        global.URL = function URL(url, base) {
            if (base) {
                // 简化的 base URL 处理
                if (url.indexOf('://') === -1 && url[0] !== '/') {
                    url = base.replace(/\/[^\/]*$/, '/') + url;
                } else if (url[0] === '/') {
                    var match = base.match(/^([a-z]+:\/\/[^\/]+)/i);
                    if (match) url = match[1] + url;
                }
            }

            var match = url.match(/^([a-z]+):\/\/([^\/\?#]+)(\/[^\?#]*)?(\?[^#]*)?(#.*)?$/i);
            if (!match) throw new TypeError('Invalid URL: ' + url);

            this.protocol = match[1] + ':';
            this.host = match[2];
            this.hostname = match[2].replace(/:\d+$/, '');
            this.port = (match[2].match(/:(\d+)$/) || [])[1] || '';
            this.pathname = match[3] || '/';
            this.search = match[4] || '';
            this.hash = match[5] || '';
            this.origin = this.protocol + '//' + this.host;
            this.href = url;
            this.searchParams = new URLSearchParams(this.search);
        };

        global.URL.prototype.toString = function() {
            return this.href;
        };
    }

    // ========== Headers ==========
    if (typeof global.Headers === 'undefined') {
        global.Headers = function Headers(init) {
            this._headers = {};
            if (init instanceof Headers) {
                init.forEach(function(value, name) {
                    this.append(name, value);
                }, this);
            } else if (init && typeof init === 'object') {
                for (var name in init) {
                    if (init.hasOwnProperty(name)) {
                        this.append(name, init[name]);
                    }
                }
            }
        };

        Headers.prototype.append = function(name, value) {
            name = name.toLowerCase();
            if (!this._headers[name]) this._headers[name] = [];
            this._headers[name].push(String(value));
        };

        Headers.prototype.set = function(name, value) {
            this._headers[name.toLowerCase()] = [String(value)];
        };

        Headers.prototype.get = function(name) {
            var values = this._headers[name.toLowerCase()];
            return values ? values.join(', ') : null;
        };

        Headers.prototype.has = function(name) {
            return name.toLowerCase() in this._headers;
        };

        Headers.prototype.delete = function(name) {
            delete this._headers[name.toLowerCase()];
        };

        Headers.prototype.forEach = function(callback) {
            for (var name in this._headers) {
                callback(this._headers[name].join(', '), name, this);
            }
        };

        Headers.prototype.entries = function() {
            var result = [];
            for (var name in this._headers) {
                result.push([name, this._headers[name].join(', ')]);
            }
            return result[Symbol.iterator] ? result[Symbol.iterator]() : result;
        };
    }

    // ========== Response ==========
    if (typeof global.Response === 'undefined') {
        global.Response = function Response(body, init) {
            init = init || {};
            this.status = init.status !== undefined ? init.status : 200;
            this.statusText = init.statusText || '';
            this.ok = this.status >= 200 && this.status < 300;
            this.headers = new Headers(init.headers);
            this._body = body;
            this.bodyUsed = false;
        };

        Response.prototype.text = function() {
            var self = this;
            return new Promise(function(resolve) {
                self.bodyUsed = true;
                if (typeof self._body === 'string') {
                    resolve(self._body);
                } else if (self._body instanceof ArrayBuffer || self._body instanceof Uint8Array) {
                    resolve(new TextDecoder().decode(self._body));
                } else {
                    resolve(String(self._body || ''));
                }
            });
        };

        Response.prototype.json = function() {
            return this.text().then(JSON.parse);
        };

        Response.prototype.arrayBuffer = function() {
            var self = this;
            return new Promise(function(resolve) {
                self.bodyUsed = true;
                if (self._body instanceof ArrayBuffer) {
                    resolve(self._body);
                } else if (self._body instanceof Uint8Array) {
                    resolve(self._body.buffer);
                } else {
                    resolve(new TextEncoder().encode(String(self._body || '')).buffer);
                }
            });
        };

        Response.json = function(data, init) {
            init = init || {};
            init.headers = init.headers || {};
            init.headers['Content-Type'] = 'application/json';
            return new Response(JSON.stringify(data), init);
        };
    }

    // ========== Request ==========
    if (typeof global.Request === 'undefined') {
        global.Request = function Request(input, init) {
            init = init || {};
            if (typeof input === 'string') {
                this.url = input;
            } else if (input instanceof Request) {
                this.url = input.url;
                init = Object.assign({}, input, init);
            }
            this.method = (init.method || 'GET').toUpperCase();
            this.headers = new Headers(init.headers);
            this._body = init.body;
            this.bodyUsed = false;
            this.signal = init.signal || null;
        };

        Request.prototype.text = function() {
            var self = this;
            return new Promise(function(resolve) {
                self.bodyUsed = true;
                resolve(String(self._body || ''));
            });
        };

        Request.prototype.json = function() {
            return this.text().then(JSON.parse);
        };
    }

    // ========== AbortController / AbortSignal ==========
    // T037: 完善 fetch Polyfill - AbortController 支持
    if (typeof global.AbortSignal === 'undefined') {
        global.AbortSignal = function AbortSignal() {
            this.aborted = false;
            this.reason = undefined;
            this._listeners = [];
        };

        AbortSignal.prototype.addEventListener = function(type, listener) {
            if (type === 'abort') {
                this._listeners.push(listener);
            }
        };

        AbortSignal.prototype.removeEventListener = function(type, listener) {
            if (type === 'abort') {
                var idx = this._listeners.indexOf(listener);
                if (idx !== -1) {
                    this._listeners.splice(idx, 1);
                }
            }
        };

        AbortSignal.prototype._dispatchAbort = function() {
            var event = { type: 'abort', target: this };
            for (var i = 0; i < this._listeners.length; i++) {
                try {
                    this._listeners[i].call(this, event);
                } catch (e) {
                    // 忽略监听器错误
                }
            }
        };

        AbortSignal.prototype.throwIfAborted = function() {
            if (this.aborted) {
                throw this.reason || new DOMException('The operation was aborted.', 'AbortError');
            }
        };

        // 静态方法
        AbortSignal.abort = function(reason) {
            var signal = new AbortSignal();
            signal.aborted = true;
            signal.reason = reason || new DOMException('The operation was aborted.', 'AbortError');
            return signal;
        };

        AbortSignal.timeout = function(ms) {
            var signal = new AbortSignal();
            setTimeout(function() {
                signal.aborted = true;
                signal.reason = new DOMException('The operation timed out.', 'TimeoutError');
                signal._dispatchAbort();
            }, ms);
            return signal;
        };
    }

    if (typeof global.AbortController === 'undefined') {
        global.AbortController = function AbortController() {
            this.signal = new AbortSignal();
        };

        AbortController.prototype.abort = function(reason) {
            if (!this.signal.aborted) {
                this.signal.aborted = true;
                this.signal.reason = reason || new DOMException('The operation was aborted.', 'AbortError');
                this.signal._dispatchAbort();
            }
        };
    }

    // ========== DOMException (用于 AbortError) ==========
    if (typeof global.DOMException === 'undefined') {
        global.DOMException = function DOMException(message, name) {
            this.message = message || '';
            this.name = name || 'Error';
        };
        DOMException.prototype = Object.create(Error.prototype);
        DOMException.prototype.constructor = DOMException;
    }

    // ========== FormData ==========
    // T037: 完善 fetch Polyfill - FormData 支持
    if (typeof global.FormData === 'undefined') {
        global.FormData = function FormData(form) {
            this._entries = [];
            // 注意: 在 WASM 环境中，不支持从 HTMLFormElement 初始化
            // 这里只支持手动添加数据
        };

        FormData.prototype.append = function(name, value, filename) {
            // 如果是 Blob/File，需要特殊处理
            if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Blob') {
                this._entries.push([String(name), value, filename || 'blob']);
            } else if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'File') {
                this._entries.push([String(name), value, filename || value.name || 'file']);
            } else {
                this._entries.push([String(name), String(value)]);
            }
        };

        FormData.prototype.delete = function(name) {
            name = String(name);
            for (var i = this._entries.length - 1; i >= 0; i--) {
                if (this._entries[i][0] === name) {
                    this._entries.splice(i, 1);
                }
            }
        };

        FormData.prototype.get = function(name) {
            name = String(name);
            for (var i = 0; i < this._entries.length; i++) {
                if (this._entries[i][0] === name) {
                    return this._entries[i][1];
                }
            }
            return null;
        };

        FormData.prototype.getAll = function(name) {
            name = String(name);
            var result = [];
            for (var i = 0; i < this._entries.length; i++) {
                if (this._entries[i][0] === name) {
                    result.push(this._entries[i][1]);
                }
            }
            return result;
        };

        FormData.prototype.has = function(name) {
            return this.get(name) !== null;
        };

        FormData.prototype.set = function(name, value, filename) {
            name = String(name);
            // 删除所有同名条目
            this.delete(name);
            // 添加新条目
            this.append(name, value, filename);
        };

        FormData.prototype.forEach = function(callback, thisArg) {
            for (var i = 0; i < this._entries.length; i++) {
                var entry = this._entries[i];
                callback.call(thisArg, entry[1], entry[0], this);
            }
        };

        FormData.prototype.entries = function() {
            var entries = this._entries.slice();
            var index = 0;
            return {
                next: function() {
                    if (index < entries.length) {
                        return { value: entries[index++], done: false };
                    }
                    return { value: undefined, done: true };
                }
            };
        };

        FormData.prototype.keys = function() {
            var entries = this._entries;
            var index = 0;
            return {
                next: function() {
                    if (index < entries.length) {
                        return { value: entries[index++][0], done: false };
                    }
                    return { value: undefined, done: true };
                }
            };
        };

        FormData.prototype.values = function() {
            var entries = this._entries;
            var index = 0;
            return {
                next: function() {
                    if (index < entries.length) {
                        return { value: entries[index++][1], done: false };
                    }
                    return { value: undefined, done: true };
                }
            };
        };

        // 转换为 multipart/form-data 格式字符串
        FormData.prototype._toMultipartString = function(boundary) {
            var parts = [];
            for (var i = 0; i < this._entries.length; i++) {
                var entry = this._entries[i];
                var name = entry[0];
                var value = entry[1];
                var filename = entry[2];

                var part = '--' + boundary + '\r\n';
                if (filename) {
                    part += 'Content-Disposition: form-data; name="' + name + '"; filename="' + filename + '"\r\n';
                    part += 'Content-Type: application/octet-stream\r\n';
                } else {
                    part += 'Content-Disposition: form-data; name="' + name + '"\r\n';
                }
                part += '\r\n';
                part += value + '\r\n';
                parts.push(part);
            }
            parts.push('--' + boundary + '--\r\n');
            return parts.join('');
        };
    }

    // ========== fetch ==========
    // fetch 函数通过 Host Function 实现，这里提供 Polyfill 包装
    if (typeof global.fetch === 'undefined') {
        // __hostFetch 是由 Go Host Function 注入的原生函数
        // 如果不存在，提供一个模拟实现用于测试
        var hostFetch = global.__hostFetch || function(url, options) {
            return JSON.stringify({
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: '{"error": "fetch not available in this environment"}'
            });
        };

        // __hostFetchStream 是流式 fetch 的 Host Function
        var hostFetchStream = global.__hostFetchStream || null;

        global.fetch = function fetch(input, init) {
            return new Promise(function(resolve, reject) {
                try {
                    var url = typeof input === 'string' ? input : input.url;
                    var options = init || {};
                    
                    if (input instanceof Request) {
                        options.method = options.method || input.method;
                        options.headers = options.headers || {};
                        input.headers.forEach(function(value, name) {
                            options.headers[name] = value;
                        });
                        if (input._body && !options.body) {
                            options.body = input._body;
                        }
                    }

                    var fetchOptions = {
                        url: url,
                        method: (options.method || 'GET').toUpperCase(),
                        headers: {},
                        body: ''
                    };

                    // 处理 headers
                    if (options.headers) {
                        if (options.headers instanceof Headers) {
                            options.headers.forEach(function(value, name) {
                                fetchOptions.headers[name] = value;
                            });
                        } else {
                            for (var name in options.headers) {
                                if (options.headers.hasOwnProperty(name)) {
                                    fetchOptions.headers[name] = options.headers[name];
                                }
                            }
                        }
                    }

                    // 处理 body
                    if (options.body) {
                        if (typeof options.body === 'string') {
                            fetchOptions.body = options.body;
                        } else if (options.body instanceof ArrayBuffer) {
                            fetchOptions.body = new TextDecoder().decode(options.body);
                        } else if (options.body instanceof Uint8Array) {
                            fetchOptions.body = new TextDecoder().decode(options.body);
                        } else if (options.body instanceof FormData) {
                            // T037: FormData 支持
                            var boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
                            fetchOptions.body = options.body._toMultipartString(boundary);
                            if (!fetchOptions.headers['Content-Type']) {
                                fetchOptions.headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary;
                            }
                        } else if (typeof options.body === 'object') {
                            fetchOptions.body = JSON.stringify(options.body);
                            if (!fetchOptions.headers['Content-Type']) {
                                fetchOptions.headers['Content-Type'] = 'application/json';
                            }
                        }
                    }

                    // T037: AbortController 支持
                    if (options.signal && options.signal.aborted) {
                        reject(options.signal.reason || new DOMException('The operation was aborted.', 'AbortError'));
                        return;
                    }

                    // 调用 Host Function
                    var resultJson = hostFetch(JSON.stringify(fetchOptions));
                    var result = JSON.parse(resultJson);

                    // 构建 Response
                    var response = new Response(result.body, {
                        status: result.status,
                        statusText: result.statusText || '',
                        headers: result.headers
                    });

                    // 添加 url 属性
                    response.url = url;

                    resolve(response);
                } catch (err) {
                    reject(new TypeError('Network request failed: ' + err.message));
                }
            });
        };

        // 添加流式 fetch 支持
        global.fetch.stream = function fetchStream(input, init) {
            return new Promise(function(resolve, reject) {
                if (!hostFetchStream) {
                    reject(new Error('Streaming fetch not available'));
                    return;
                }

                try {
                    var url = typeof input === 'string' ? input : input.url;
                    var options = init || {};

                    var fetchOptions = {
                        url: url,
                        method: (options.method || 'GET').toUpperCase(),
                        headers: {},
                        body: ''
                    };

                    // 处理 headers
                    if (options.headers) {
                        if (options.headers instanceof Headers) {
                            options.headers.forEach(function(value, name) {
                                fetchOptions.headers[name] = value;
                            });
                        } else {
                            for (var name in options.headers) {
                                if (options.headers.hasOwnProperty(name)) {
                                    fetchOptions.headers[name] = options.headers[name];
                                }
                            }
                        }
                    }

                    // 处理 body
                    if (options.body) {
                        if (typeof options.body === 'string') {
                            fetchOptions.body = options.body;
                        } else if (typeof options.body === 'object') {
                            fetchOptions.body = JSON.stringify(options.body);
                        }
                    }

                    // 调用流式 Host Function
                    var streamId = hostFetchStream(JSON.stringify(fetchOptions));

                    // 创建 ReadableStream
                    var stream = new ReadableStream({
                        start: function(controller) {
                            // 流控制器
                            this._controller = controller;
                            this._streamId = streamId;
                        },
                        pull: function(controller) {
                            // 从 Host 读取下一个块
                            if (global.__hostStreamRead) {
                                var chunk = global.__hostStreamRead(this._streamId);
                                if (chunk === null) {
                                    controller.close();
                                } else {
                                    controller.enqueue(new TextEncoder().encode(chunk));
                                }
                            }
                        },
                        cancel: function() {
                            // 取消流
                            if (global.__hostStreamClose) {
                                global.__hostStreamClose(this._streamId);
                            }
                        }
                    });

                    // 构建带流的 Response
                    var response = new Response(stream, {
                        status: 200,
                        headers: { 'Content-Type': 'text/event-stream' }
                    });
                    response.url = url;
                    response.body = stream;

                    resolve(response);
                } catch (err) {
                    reject(new TypeError('Streaming request failed: ' + err.message));
                }
            });
        };
    }

})(typeof globalThis !== 'undefined' ? globalThis : this);
