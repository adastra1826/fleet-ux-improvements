// logger-panel.js
// Floating panel that shows only script logs

const plugin = {
    id: 'dev-logger-panel',
    name: 'Dev Logger Panel',
    description: 'Floating panel to view Fleet UX Enhancer logs without prefix',
    _version: '1.2',
    enabledByDefault: true,
    phase: 'core',

    initialState: {
        initialized: false,
        logs: [],
        maxLogs: 500,
        isVisible: true,
        isDragging: false,
        isResizing: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        resizeStartX: 0,
        resizeStartY: 0,
        resizeStartWidth: 0,
        resizeStartHeight: 0,
        searchQuery: '',
        originalConsole: null,
        unsubscribe: null
    },

    init(state, context) {
        if (state.initialized) return;
        state.initialized = true;

        const logPrefix = context.logPrefix || '';
        const root = document.createElement('div');
        root.id = 'wf-dev-log-panel';
        root.style.position = 'fixed';
        root.style.right = '24px';
        root.style.bottom = '80px';
        root.style.width = '360px';
        root.style.height = '240px';
        root.style.background = 'rgba(16, 18, 24, 0.95)';
        root.style.color = '#e5e7eb';
        root.style.border = '1px solid rgba(255,255,255,0.12)';
        root.style.borderRadius = '10px';
        root.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
        root.style.display = 'flex';
        root.style.flexDirection = 'column';
        root.style.zIndex = '2147483646';
        root.style.resize = 'none';
        root.style.overflow = 'auto';
        root.style.minWidth = '240px';
        root.style.minHeight = '140px';

        const header = document.createElement('div');
        header.id = 'wf-dev-log-panel-header';
        header.style.flex = '0 0 auto';
        header.style.padding = '6px 10px';
        header.style.fontSize = '12px';
        header.style.fontWeight = '600';
        header.style.background = 'rgba(255,255,255,0.06)';
        header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        header.style.cursor = 'move';
        header.style.userSelect = 'none';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';

        const headerTitle = document.createElement('span');
        headerTitle.textContent = 'Fleet UX Logs';

        const headerActions = document.createElement('div');
        headerActions.style.display = 'flex';
        headerActions.style.gap = '6px';

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.textContent = 'Clear';
        clearButton.style.fontSize = '11px';
        clearButton.style.padding = '2px 6px';
        clearButton.style.borderRadius = '6px';
        clearButton.style.border = '1px solid rgba(255,255,255,0.2)';
        clearButton.style.background = 'transparent';
        clearButton.style.color = 'inherit';
        clearButton.style.cursor = 'pointer';

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = 'Copy';
        copyButton.style.fontSize = '11px';
        copyButton.style.padding = '2px 6px';
        copyButton.style.borderRadius = '6px';
        copyButton.style.border = '1px solid rgba(255,255,255,0.2)';
        copyButton.style.background = 'transparent';
        copyButton.style.color = 'inherit';
        copyButton.style.cursor = 'pointer';

        const minimizeButton = document.createElement('button');
        minimizeButton.type = 'button';
        minimizeButton.textContent = 'Minimize';
        minimizeButton.style.fontSize = '11px';
        minimizeButton.style.padding = '2px 6px';
        minimizeButton.style.borderRadius = '6px';
        minimizeButton.style.border = '1px solid rgba(255,255,255,0.2)';
        minimizeButton.style.background = 'transparent';
        minimizeButton.style.color = 'inherit';
        minimizeButton.style.cursor = 'pointer';

        const searchWrap = document.createElement('div');
        searchWrap.style.flex = '0 0 auto';
        searchWrap.style.padding = '6px 10px';
        searchWrap.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search logs...';
        searchInput.style.width = '100%';
        searchInput.style.fontSize = '11px';
        searchInput.style.padding = '6px 8px';
        searchInput.style.borderRadius = '6px';
        searchInput.style.border = '1px solid rgba(255,255,255,0.2)';
        searchInput.style.background = 'rgba(15, 23, 42, 0.6)';
        searchInput.style.color = '#e5e7eb';
        searchInput.style.outline = 'none';

        searchWrap.appendChild(searchInput);

        const body = document.createElement('div');
        body.id = 'wf-dev-log-panel-body';
        body.style.flex = '1 1 auto';
        body.style.overflow = 'auto';
        body.style.padding = '8px';
        body.style.fontSize = '11px';
        body.style.lineHeight = '1.4';
        body.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

        const toggleButton = document.createElement('button');
        toggleButton.id = 'wf-dev-log-toggle';
        toggleButton.type = 'button';
        toggleButton.textContent = 'Hide Logs';
        toggleButton.style.position = 'fixed';
        toggleButton.style.left = '20px';
        toggleButton.style.bottom = '78px';
        toggleButton.style.zIndex = '2147483646';
        toggleButton.style.padding = '6px 10px';
        toggleButton.style.fontSize = '12px';
        toggleButton.style.borderRadius = '10px';
        toggleButton.style.border = '1px solid rgba(0,0,0,0.2)';
        toggleButton.style.background = '#111827';
        toggleButton.style.color = '#f9fafb';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';

        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '2px';
        resizeHandle.style.bottom = '2px';
        resizeHandle.style.width = '14px';
        resizeHandle.style.height = '14px';
        resizeHandle.style.cursor = 'se-resize';
        resizeHandle.style.background = 'transparent';
        resizeHandle.style.borderRight = '2px solid rgba(255,255,255,0.25)';
        resizeHandle.style.borderBottom = '2px solid rgba(255,255,255,0.25)';
        resizeHandle.style.borderRadius = '0 0 8px 0';

        headerActions.appendChild(clearButton);
        headerActions.appendChild(copyButton);
        headerActions.appendChild(minimizeButton);
        header.appendChild(headerTitle);
        header.appendChild(headerActions);
        root.appendChild(header);
        root.appendChild(searchWrap);
        root.appendChild(body);
        root.appendChild(resizeHandle);

        document.body.appendChild(root);
        document.body.appendChild(toggleButton);

        requestAnimationFrame(() => {
            const rect = root.getBoundingClientRect();
            root.style.left = `${rect.left}px`;
            root.style.top = `${rect.top}px`;
            root.style.right = 'auto';
            root.style.bottom = 'auto';
        });

        const updateVisibility = (visible) => {
            state.isVisible = visible;
            root.style.display = visible ? 'flex' : 'none';
            toggleButton.textContent = visible ? 'Hide Logs' : 'Show Logs';
        };

        const onMinimize = () => updateVisibility(false);

        const copyToClipboard = async (text) => {
            if (!text) return;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return;
                }
            } catch (e) {
                // Fall back below
            }

            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.top = '-1000px';
            document.body.appendChild(temp);
            temp.select();
            try {
                document.execCommand('copy');
            } catch (e) {
                // Ignore
            }
            document.body.removeChild(temp);
        };

        const addLogEntry = (level, message) => {
            const entry = document.createElement('div');
            entry.style.marginBottom = '4px';
            entry.style.whiteSpace = 'pre-wrap';
            entry.style.wordBreak = 'break-word';

            if (level === 'error') entry.style.color = '#fca5a5';
            if (level === 'warn') entry.style.color = '#facc15';
            if (level === 'debug') entry.style.color = '#93c5fd';
            if (level === 'info') entry.style.color = '#6ee7b7';

            entry.textContent = message;
            entry.style.borderRadius = '6px';
            entry.style.padding = '2px 4px';
            entry.style.cursor = 'pointer';

            entry.addEventListener('mouseenter', () => {
                entry.style.background = 'rgba(255,255,255,0.08)';
            });
            entry.addEventListener('mouseleave', () => {
                entry.style.background = 'transparent';
            });
            entry.addEventListener('click', () => {
                copyToClipboard(message);
            });

            body.appendChild(entry);
            body.scrollTop = body.scrollHeight;

            const logRecord = { node: entry, text: message };
            state.logs.push(logRecord);
            if (state.logs.length > state.maxLogs) {
                const old = state.logs.shift();
                if (old && old.node && old.node.parentNode) {
                    old.node.parentNode.removeChild(old.node);
                }
            }

            if (state.searchQuery) {
                const matches = logRecord.text.toLowerCase().includes(state.searchQuery);
                entry.style.display = matches ? 'block' : 'none';
            }
        };

        const formatArgs = (args) => {
            return args.map((arg) => {
                if (typeof arg === 'string') return arg;
                if (arg instanceof Error) return arg.stack || arg.message || String(arg);
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }).join(' ');
        };

        const stripPrefix = (text) => {
            if (!logPrefix || typeof text !== 'string') return text;
            if (text.startsWith(logPrefix)) {
                const trimmed = text.slice(logPrefix.length);
                return trimmed.startsWith(' ') ? trimmed.slice(1) : trimmed;
            }
            return text;
        };

        const handleConsoleCall = (level, args) => {
            if (!args || args.length === 0) return;
            const first = args[0];
            if (typeof first !== 'string' || !first.startsWith(logPrefix)) return;

            const normalizedArgs = [...args];
            normalizedArgs[0] = stripPrefix(normalizedArgs[0]);
            addLogEntry(level, formatArgs(normalizedArgs));
        };

        const wrapConsole = (methodName, level) => {
            const original = console[methodName].bind(console);
            state.originalConsole[methodName] = original;
            console[methodName] = (...args) => {
                original(...args);
                try {
                    handleConsoleCall(level, args);
                } catch (e) {
                    original('Logger panel failed to capture log', e);
                }
            };
        };

        if (typeof Logger !== 'undefined' && typeof Logger.onLog === 'function') {
            state.unsubscribe = Logger.onLog((level, args) => {
                handleConsoleCall(level, args);
            });
        } else {
            state.originalConsole = {};
            wrapConsole('log', 'log');
            wrapConsole('info', 'info');
            wrapConsole('warn', 'warn');
            wrapConsole('error', 'error');
            wrapConsole('debug', 'debug');
        }

        const onMouseDown = (event) => {
            if (event.button !== 0) return;
            if (event.target === clearButton || headerActions.contains(event.target)) return;
            if (event.target !== header && !header.contains(event.target)) return;
            state.isDragging = true;
            const rect = root.getBoundingClientRect();
            state.dragOffsetX = event.clientX - rect.left;
            state.dragOffsetY = event.clientY - rect.top;
        };

        const onMouseMove = (event) => {
            if (!state.isDragging) return;
            const nextLeft = Math.max(8, event.clientX - state.dragOffsetX);
            const nextTop = Math.max(8, event.clientY - state.dragOffsetY);
            root.style.left = `${nextLeft}px`;
            root.style.top = `${nextTop}px`;
            root.style.right = 'auto';
            root.style.bottom = 'auto';
        };

        const onMouseUp = () => {
            state.isDragging = false;
            state.isResizing = false;
            document.body.style.userSelect = '';
        };

        const onToggle = () => updateVisibility(!state.isVisible);
        const onClear = () => {
            state.logs.forEach((log) => log.node && log.node.parentNode && log.node.parentNode.removeChild(log.node));
            state.logs = [];
        };

        const onCopyAll = () => {
            const text = state.logs.map((log) => log.text).join('\n');
            copyToClipboard(text);
        };

        const onResizeStart = (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            state.isResizing = true;
            const rect = root.getBoundingClientRect();
            state.resizeStartX = event.clientX;
            state.resizeStartY = event.clientY;
            state.resizeStartWidth = rect.width;
            state.resizeStartHeight = rect.height;
            document.body.style.userSelect = 'none';
        };

        const onResizeMove = (event) => {
            if (!state.isResizing) return;
            const nextWidth = Math.max(240, state.resizeStartWidth + (event.clientX - state.resizeStartX));
            const nextHeight = Math.max(140, state.resizeStartHeight + (event.clientY - state.resizeStartY));
            root.style.width = `${nextWidth}px`;
            root.style.height = `${nextHeight}px`;
        };

        const onSearch = (event) => {
            state.searchQuery = event.target.value.trim().toLowerCase();
            state.logs.forEach((log) => {
                const matches = !state.searchQuery || log.text.toLowerCase().includes(state.searchQuery);
                log.node.style.display = matches ? 'block' : 'none';
            });
        };

        header.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onMouseUp);
        toggleButton.addEventListener('click', onToggle);
        clearButton.addEventListener('click', onClear);
        copyButton.addEventListener('click', onCopyAll);
        minimizeButton.addEventListener('click', onMinimize);
        searchInput.addEventListener('input', onSearch);
        resizeHandle.addEventListener('mousedown', onResizeStart);

        updateVisibility(true);
        Logger.log('✓ Dev logger panel initialized');
    },

    destroy(state) {
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }
        if (state.originalConsole) {
            ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
                if (state.originalConsole[method]) {
                    console[method] = state.originalConsole[method];
                }
            });
        }
    }
};
