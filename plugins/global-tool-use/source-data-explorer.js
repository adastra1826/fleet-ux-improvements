// ============= source-data-explorer.js =============
// Plugin that uses context data from other plugins

const plugin = {
    id: 'sourceDataExplorer',
    name: 'Source Data Explorer',
    description: 'Add button to open source data in new tab',
    _version: '2.3',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { buttonAdded: false, missingLogged: false, interceptionInstalled: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '[id="\:r7\:"] > div.flex-shrink-0 > div > div.flex.items-center.gap-2.mt-2'
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
                Logger.debug('Toolbar not found for Source Data Explorer button');
                state.missingLogged = true;
            }
            return;
        }

        if (!context.source) {
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
        button.className = 'class="inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-background transition-colors hover:bg-accent hover:text-accent-foreground h-8 rounded-sm pl-3 pr-3 gap-2 text-xs relative border-amber-300 dark:border-amber-700"';
        button.textContent = '📊 Source Data';
        button.title = 'Open source data in new tab';
        
        button.onclick = () => {
            if (context.source) {
                const sourceUrl = context.source.replace('/mcp', '');
                window.open(sourceUrl, '_blank');
                Logger.log('Opening source data:', sourceUrl);
            } else {
                alert('Source data URL not captured yet. Try refreshing the page.');
                Logger.warn('Source URL not available');
            }
        };
        
        toolbar.appendChild(button);
        Logger.log('✓ Source Data Explorer button added');
    }
};