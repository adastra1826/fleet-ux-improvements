// ============= source-data-explorer.js =============
// Plugin that uses context data from other plugins

const plugin = {
    id: 'sourceDataExplorer',
    name: 'Source Data Explorer',
    description: 'Add button to open source data in new tab',
    _version: '2.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { buttonAdded: false, missingLogged: false, interceptionInstalled: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '[id="\:r7\:"] > div.flex-shrink-0 > div > div.space-y-2.relative',
    },
    
    onMutation(state, context) {
        if (!state.interceptionInstalled) {
            this.installNetworkInterception(context, state);
        }

        if (state.buttonAdded) return;
        
        const toolbar = Context.dom.query(this.selectors.toolbar, {
            context: `${this.id}.toolbar`
        });
        
        if (!toolbar) {
            if (!state.missingLogged) {
                Logger.debug('Toolbar or workflow indicator not found for Source Data Explorer');
                state.missingLogged = true;
            }
            return;
        }

        this.addSourceButton(toolbar, context);
        state.buttonAdded = true;
    },

    installNetworkInterception(context, state) {
        const pageWindow = context.getPageWindow();

        if (pageWindow.__fleetNetworkInterceptionInstalled) {
            state.interceptionInstalled = true;
            return;
        }

        pageWindow.__fleetNetworkInterceptionInstalled = true;

        const originalFetch = pageWindow.fetch;
        if (typeof originalFetch === 'function') {
            pageWindow.fetch = function(...args) {
                const [resource, config] = args;
                let url;
                try {
                    url = new URL(resource, pageWindow.location.href);
                } catch (e) {
                    url = { href: resource, pathname: '' };
                }

                if (url.pathname === '/mcp' && config && config.method === 'POST') {
                    if (context.source === null) {
                        context.source = url.href;
                        Logger.log(`✓ Source URL captured (fetch): ${url.href}`);
                    }
                }
                return originalFetch.apply(this, args);
            };
        }

        const originalXHROpen = pageWindow.XMLHttpRequest.prototype.open;
        const originalXHRSend = pageWindow.XMLHttpRequest.prototype.send;

        pageWindow.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._interceptedURL = url;
            this._interceptedMethod = method;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        pageWindow.XMLHttpRequest.prototype.send = function(body) {
            if (this._interceptedMethod === 'POST' && this._interceptedURL && this._interceptedURL.includes('/mcp')) {
                if (context.source === null) {
                    context.source = this._interceptedURL;
                    Logger.log(`✓ Source URL captured (XHR): ${this._interceptedURL}`);
                }
            }
            return originalXHRSend.apply(this, [body]);
        };

        // Expose getter globally for debugging
        pageWindow.getFleetSource = () => context.source;

        state.interceptionInstalled = true;
        Logger.log('✓ Network interception installed');
    },
    
    addSourceButton(toolbar, context) {
        const button = document.createElement('button');
        button.className = 'ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors';
        button.textContent = '📊 Source Data';
        button.title = 'Open source data in new tab';
        
        button.onclick = () => {
            if (context.source) {
                window.open(context.source, '_blank');
                Logger.log('Opening source data:', context.source);
            } else {
                alert('Source data URL not captured yet. Try refreshing the page and creating a workflow.');
                Logger.warn('Source URL not available');
            }
        };
        
        toolbar.appendChild(button);
        Logger.log('✓ Source Data Explorer button added');
    }
};