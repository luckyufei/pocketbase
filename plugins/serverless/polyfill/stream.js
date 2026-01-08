// ReadableStream Polyfill for QuickJS WASM runtime
// 基础实现，支持流式响应

(function(global) {
    'use strict';

    // 如果已经存在 ReadableStream，直接返回
    if (typeof global.ReadableStream !== 'undefined') {
        return;
    }

    // ========== ReadableStreamDefaultReader ==========
    function ReadableStreamDefaultReader(stream) {
        this._stream = stream;
        this._closed = false;
    }

    ReadableStreamDefaultReader.prototype.read = function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (self._closed) {
                resolve({ done: true, value: undefined });
                return;
            }

            var chunk = self._stream._pull();
            if (chunk === null) {
                self._closed = true;
                resolve({ done: true, value: undefined });
            } else {
                resolve({ done: false, value: chunk });
            }
        });
    };

    ReadableStreamDefaultReader.prototype.releaseLock = function() {
        this._stream._reader = null;
    };

    ReadableStreamDefaultReader.prototype.cancel = function(reason) {
        this._closed = true;
        return Promise.resolve();
    };

    // ========== ReadableStream ==========
    global.ReadableStream = function ReadableStream(underlyingSource) {
        this._source = underlyingSource || {};
        this._controller = new ReadableStreamDefaultController(this);
        this._reader = null;
        this._chunks = [];
        this._closed = false;

        // 调用 start
        if (this._source.start) {
            this._source.start(this._controller);
        }
    };

    ReadableStream.prototype.getReader = function() {
        if (this._reader) {
            throw new TypeError('ReadableStream is already locked');
        }
        this._reader = new ReadableStreamDefaultReader(this);
        return this._reader;
    };

    ReadableStream.prototype._pull = function() {
        if (this._chunks.length > 0) {
            return this._chunks.shift();
        }

        if (this._source.pull) {
            this._source.pull(this._controller);
            if (this._chunks.length > 0) {
                return this._chunks.shift();
            }
        }

        if (this._closed) {
            return null;
        }

        return null;
    };

    ReadableStream.prototype.cancel = function(reason) {
        this._closed = true;
        if (this._source.cancel) {
            return Promise.resolve(this._source.cancel(reason));
        }
        return Promise.resolve();
    };

    ReadableStream.prototype.tee = function() {
        // 简化实现：返回两个相同的流
        var self = this;
        return [
            new ReadableStream({
                pull: function(controller) {
                    var chunk = self._pull();
                    if (chunk === null) {
                        controller.close();
                    } else {
                        controller.enqueue(chunk);
                    }
                }
            }),
            new ReadableStream({
                pull: function(controller) {
                    var chunk = self._pull();
                    if (chunk === null) {
                        controller.close();
                    } else {
                        controller.enqueue(chunk);
                    }
                }
            })
        ];
    };

    // ========== ReadableStreamDefaultController ==========
    function ReadableStreamDefaultController(stream) {
        this._stream = stream;
    }

    ReadableStreamDefaultController.prototype.enqueue = function(chunk) {
        this._stream._chunks.push(chunk);
    };

    ReadableStreamDefaultController.prototype.close = function() {
        this._stream._closed = true;
    };

    ReadableStreamDefaultController.prototype.error = function(e) {
        this._stream._closed = true;
        this._stream._error = e;
    };

    // ========== TransformStream ==========
    global.TransformStream = function TransformStream(transformer) {
        var self = this;
        transformer = transformer || {};

        this._readable = new ReadableStream({
            start: function(controller) {
                self._readableController = controller;
            }
        });

        this._writable = {
            getWriter: function() {
                return new WritableStreamDefaultWriter(self, transformer);
            }
        };

        this.readable = this._readable;
        this.writable = this._writable;
    };

    // ========== WritableStreamDefaultWriter ==========
    function WritableStreamDefaultWriter(transformStream, transformer) {
        this._transformStream = transformStream;
        this._transformer = transformer;
    }

    WritableStreamDefaultWriter.prototype.write = function(chunk) {
        var self = this;
        return new Promise(function(resolve) {
            if (self._transformer.transform) {
                self._transformer.transform(chunk, {
                    enqueue: function(c) {
                        self._transformStream._readableController.enqueue(c);
                    }
                });
            } else {
                self._transformStream._readableController.enqueue(chunk);
            }
            resolve();
        });
    };

    WritableStreamDefaultWriter.prototype.close = function() {
        this._transformStream._readableController.close();
        return Promise.resolve();
    };

    WritableStreamDefaultWriter.prototype.releaseLock = function() {};

})(typeof globalThis !== 'undefined' ? globalThis : this);
