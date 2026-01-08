// Console Polyfill for QuickJS WASM runtime
// 将 console 方法桥接到 Host Function

(function(global) {
    'use strict';

    // 如果已经存在 console，直接返回
    if (global.console && typeof global.console.log === 'function') {
        return;
    }

    // Host Function 调用接口（由 Go 注入）
    const hostConsole = global.__hostConsole || {
        log: function() {},
        warn: function() {},
        error: function() {},
        info: function() {},
        debug: function() {}
    };

    // 格式化参数
    function formatArgs(args) {
        return Array.prototype.map.call(args, function(arg) {
            if (arg === null) return 'null';
            if (arg === undefined) return 'undefined';
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    // Console 实现
    global.console = {
        log: function() {
            hostConsole.log(formatArgs(arguments));
        },
        warn: function() {
            hostConsole.warn(formatArgs(arguments));
        },
        error: function() {
            hostConsole.error(formatArgs(arguments));
        },
        info: function() {
            hostConsole.info(formatArgs(arguments));
        },
        debug: function() {
            hostConsole.debug(formatArgs(arguments));
        },
        // 计时功能
        _timers: {},
        time: function(label) {
            label = label || 'default';
            this._timers[label] = Date.now();
        },
        timeEnd: function(label) {
            label = label || 'default';
            if (this._timers[label]) {
                var elapsed = Date.now() - this._timers[label];
                this.log(label + ': ' + elapsed + 'ms');
                delete this._timers[label];
            }
        },
        // 断言
        assert: function(condition, message) {
            if (!condition) {
                this.error('Assertion failed: ' + (message || ''));
            }
        },
        // 占位符（不实现完整功能）
        table: function(data) {
            this.log(data);
        },
        group: function(label) {
            this.log('▼ ' + (label || ''));
        },
        groupEnd: function() {},
        clear: function() {}
    };

})(typeof globalThis !== 'undefined' ? globalThis : this);
