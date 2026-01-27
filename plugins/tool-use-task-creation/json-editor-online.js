// ============= json-editor-online.js =============
// Plugin that adds JSON Editor Online button to toolbar and optionally to each tool result

const plugin = {
    id: 'jsonEditorOnline',
    name: 'JSON Editor Online',
    description: 'Add button that opens JSON Editor Online in a new tab. Optionally show button on each tool result to copy output and open editor.',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    
    // ========== SUB-OPTIONS ==========
    subOptions: [
        {
            id: 'show-on-tool',
            name: 'Show button on each tool',
            description: 'Add a small button to each tool result area that copies the output and opens JSON Editor Online',
            enabledByDefault: false
        }
    ],
    
    initialState: { 
        toolbarButtonAdded: false, 
        missingLogged: false,
        processedTools: new Set()
    },
    
    onMutation(state, context) {
        // Add toolbar button
        if (!state.toolbarButtonAdded) {
            this.addToolbarButton(state, context);
        }
        
        // Add buttons to individual tools if option is enabled
        const showOnTool = Storage.getSubOptionEnabled(this.id, 'show-on-tool', false);
        if (showOnTool) {
            this.addToolButtons(state, context);
        }
    },
    
    addToolbarButton(state, context) {
        // Find the button container using the same strategies as source-data-explorer
        let buttonContainer = null;
        
        // Strategy 1: Find by class combination (flex, gap-1, ml-auto, items-center)
        const candidates = document.querySelectorAll('div.flex.gap-1.ml-auto.items-center');
        buttonContainer = Array.from(candidates).find(el => 
            el.classList.contains('mr-0') || 
            (el.classList.contains('flex') && 
             el.classList.contains('gap-1') && 
             el.classList.contains('items-center') &&
             getComputedStyle(el).marginLeft === 'auto')
        );
        
        // Strategy 2: Find by looking for container with Reset Instance button
        if (!buttonContainer) {
            const buttons = Array.from(document.querySelectorAll('button'));
            const resetBtn = buttons.find(btn => {
                const text = btn.textContent.trim();
                return text === 'Reset Instance' || text.includes('Reset Instance');
            });
            if (resetBtn) {
                buttonContainer = resetBtn.closest('div.flex.gap-1');
            }
        }
        
        // Strategy 3: Find by looking for container with Save button
        if (!buttonContainer) {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(btn => {
                const text = btn.textContent.trim();
                return text === 'Save';
            });
            if (saveBtn) {
                const parent = saveBtn.parentElement;
                if (parent && parent.classList.contains('flex') && parent.classList.contains('gap-1')) {
                    buttonContainer = parent;
                }
            }
        }
        
        // Strategy 4: Look for Source Data button and use its container
        if (!buttonContainer) {
            const sourceDataBtn = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent.includes('Source Data')
            );
            if (sourceDataBtn) {
                buttonContainer = sourceDataBtn.parentElement;
            }
        }
        
        if (!buttonContainer) {
            if (!state.missingLogged) {
                Logger.debug('Button container not found for JSON Editor Online button');
                state.missingLogged = true;
            }
            return;
        }
        
        // Check if button already exists
        const existing = buttonContainer.querySelector('[data-fleet-plugin="jsonEditorOnline"][data-slot="toolbar-button"]');
        if (existing) {
            state.toolbarButtonAdded = true;
            return;
        }
        
        const button = document.createElement('button');
        button.setAttribute('data-fleet-plugin', this.id);
        button.setAttribute('data-slot', 'toolbar-button');
        // Same style as source data but no outline (remove border classes)
        button.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-background transition-colors hover:bg-accent hover:text-accent-foreground h-8 rounded-sm pl-3 pr-3 gap-2 text-xs relative';
        button.innerHTML = '<span>{ }</span> <span>JSON Editor</span>';
        button.title = 'Open JSON Editor Online in new tab';
        
        button.onclick = () => {
            window.open('https://jsoneditoronline.org', '_blank');
            Logger.log('Opening JSON Editor Online');
        };
        
        // Insert after Source Data button if it exists, otherwise as first child
        const sourceDataBtn = Array.from(buttonContainer.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Source Data')
        );
        if (sourceDataBtn) {
            sourceDataBtn.insertAdjacentElement('afterend', button);
        } else {
            buttonContainer.insertBefore(button, buttonContainer.firstChild);
        }
        
        state.toolbarButtonAdded = true;
        Logger.log('✓ JSON Editor Online toolbar button added');
    },
    
    addToolButtons(state, context) {
        // Find workflow panel
        const panel = this.findWorkflowPanel();
        if (!panel) {
            if (!state.missingLogged) {
                Logger.debug('Workflow panel not found for JSON Editor Online tool buttons');
                state.missingLogged = true;
            }
            return;
        }
        
        const toolsContainer = this.findToolsArea(panel);
        if (!toolsContainer) {
            return;
        }
        
        const toolCards = Context.dom.queryAll('div.rounded-lg.border.transition-colors', {
            root: toolsContainer,
            context: `${this.id}.toolCards`
        });
        
        toolCards.forEach(card => {
            // Get a unique identifier for this tool card
            const cardId = this.getCardId(card);
            if (state.processedTools.has(cardId)) {
                return; // Already processed
            }
            
            // Find the result area
            const resultArea = this.findResultArea(card);
            if (!resultArea) {
                return;
            }
            
            // Check if button already exists
            const existing = resultArea.querySelector('[data-fleet-plugin="jsonEditorOnline"][data-slot="tool-button"]');
            if (existing) {
                state.processedTools.add(cardId);
                return;
            }
            
            // Find the button container (where "Find in result..." and other buttons are)
            const buttonContainer = this.findResultButtonContainer(resultArea);
            if (!buttonContainer) {
                return;
            }
            
            // Create the button
            const button = document.createElement('button');
            button.setAttribute('data-fleet-plugin', this.id);
            button.setAttribute('data-slot', 'tool-button');
            button.className = 'inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground size-7 h-6 w-6';
            button.title = 'Copy current output and go to JSON Editor Online';
            button.innerHTML = '<span class="text-xs font-mono">{ }</span>';
            
            button.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                await this.copyResultAndOpenEditor(card, resultArea);
            };
            
            // Insert after the divider (w-px h-4 bg-border mx-1)
            const divider = buttonContainer.querySelector('.w-px.h-4.bg-border.mx-1');
            if (divider) {
                divider.insertAdjacentElement('afterend', button);
            } else {
                // Fallback: insert before the first button after the search input
                const searchInput = buttonContainer.querySelector('input[placeholder*="Find in result"]');
                if (searchInput) {
                    const searchContainer = searchInput.closest('div.relative');
                    if (searchContainer && searchContainer.nextElementSibling) {
                        searchContainer.nextElementSibling.insertAdjacentElement('afterend', button);
                    } else {
                        buttonContainer.appendChild(button);
                    }
                } else {
                    buttonContainer.appendChild(button);
                }
            }
            
            state.processedTools.add(cardId);
            Logger.log(`✓ JSON Editor Online button added to tool result`);
        });
    },
    
    findWorkflowPanel() {
        // Find panels by data-panel-id attribute
        const panels = Context.dom.queryAll('[data-panel-id][data-panel]', {
            context: `${this.id}.panels`
        });
        
        // Look for panel containing "Workflow" text in toolbar
        for (const candidate of panels) {
            const toolbar = candidate.querySelector('.border-b.h-9');
            if (toolbar) {
                const workflowText = Array.from(toolbar.querySelectorAll('span')).find(
                    span => span.textContent.trim() === 'Workflow'
                );
                if (workflowText) {
                    return candidate;
                }
            }
        }
        
        return null;
    },
    
    findToolsArea(panel) {
        if (!panel) return null;
        
        // Find scrollable container
        const scrollable = panel.querySelector('.overflow-y-auto');
        if (!scrollable) return null;
        
        // Find tools container with space-y-3 class
        const toolsArea = scrollable.querySelector('.space-y-3');
        return toolsArea;
    },
    
    getCardId(card) {
        // Try to get a unique identifier for the card
        // Use the tool name if available, otherwise use position
        const header = card.querySelector('div.flex.items-center.gap-3.p-3');
        if (header) {
            const toolName = header.querySelector('span.font-mono');
            if (toolName) {
                return toolName.textContent.trim();
            }
        }
        // Fallback to index
        const cards = Array.from(card.parentElement?.children || []);
        return `card-${cards.indexOf(card)}`;
    },
    
    findResultArea(card) {
        // Find the collapsible content area
        const collapsibleContent = Context.dom.query('div[data-state="open"] > div[id^="radix-"][data-state="open"]', {
            root: card,
            context: `${this.id}.collapsibleContent`
        });
        if (!collapsibleContent) return null;
        
        // Find the result section - look for div with "Result" text
        const resultSection = Array.from(collapsibleContent.querySelectorAll('div')).find(div => {
            const text = div.textContent.trim();
            return text.includes('Result') && div.querySelector('input[placeholder*="Find in result"]');
        });
        
        return resultSection || null;
    },
    
    findResultButtonContainer(resultArea) {
        // Find the container with "Find in result..." input and buttons
        // Look for div.flex.items-center.gap-1 that contains the search input
        const searchInput = resultArea.querySelector('input[placeholder*="Find in result"]');
        if (!searchInput) return null;
        
        // Navigate up to find the flex container with buttons
        let container = searchInput.closest('div.flex.items-center');
        if (!container) return null;
        
        // Make sure it's the right container (has buttons)
        const hasButtons = container.querySelectorAll('button').length > 0;
        if (hasButtons) {
            return container;
        }
        
        // Try parent
        container = container.parentElement;
        if (container && container.classList.contains('flex') && container.classList.contains('items-center')) {
            return container;
        }
        
        return null;
    },
    
    async copyResultAndOpenEditor(card, resultArea) {
        Logger.log('Copying result and opening JSON Editor Online');
        
        // Find the copy button in the result area
        const copyButton = this.findCopyButton(resultArea);
        if (copyButton) {
            try {
                // Click the copy button
                copyButton.click();
                Logger.log('✓ Clicked copy button');
                
                // Small delay to ensure clipboard is updated
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                Logger.warn('Failed to click copy button:', e);
            }
        } else {
            Logger.warn('Copy button not found, opening editor anyway');
        }
        
        // Open JSON Editor Online in new tab
        window.open('https://jsoneditoronline.org', '_blank');
        Logger.log('✓ Opened JSON Editor Online');
    },
    
    findCopyButton(resultArea) {
        // Look for copy button - it's typically near the result area
        // Try multiple strategies
        
        // Strategy 1: Look in the button container we found earlier (most likely location)
        const buttonContainer = this.findResultButtonContainer(resultArea);
        if (buttonContainer) {
            // Look for button with copy-related title or aria-label
            const copyBtn = Array.from(buttonContainer.querySelectorAll('button')).find(btn => {
                const title = (btn.getAttribute('title') || '').toLowerCase();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                const text = btn.textContent.toLowerCase();
                return title.includes('copy') || title.includes('clipboard') || 
                       ariaLabel.includes('copy') || ariaLabel.includes('clipboard') ||
                       text.includes('copy');
            });
            if (copyBtn) {
                return copyBtn;
            }
            
            // Look for button with copy icon (clipboard icon) in SVG
            const buttons = buttonContainer.querySelectorAll('button');
            for (const btn of buttons) {
                const svg = btn.querySelector('svg');
                if (svg) {
                    // Check for common copy icon paths
                    const paths = svg.querySelectorAll('path');
                    for (const path of paths) {
                        const d = path.getAttribute('d') || '';
                        // Common copy icon patterns (clipboard rectangles)
                        if (d.includes('M16 1H4c-1.1') || d.includes('M20 9h-2v2h2V9z') || 
                            d.includes('rect') && d.includes('M8') && d.includes('M4')) {
                            return btn;
                        }
                    }
                }
            }
        }
        
        // Strategy 2: Look for button near the result content area
        const resultContent = resultArea.querySelector('div.p-3.rounded-md.border');
        if (resultContent) {
            // Look for buttons in the same parent or nearby
            const parent = resultContent.parentElement;
            if (parent) {
                const nearbyButtons = parent.querySelectorAll('button');
                for (const btn of nearbyButtons) {
                    const title = (btn.getAttribute('title') || '').toLowerCase();
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (title.includes('copy') || title.includes('clipboard') || 
                        ariaLabel.includes('copy') || ariaLabel.includes('clipboard')) {
                        return btn;
                    }
                }
            }
        }
        
        // Strategy 3: Look for any button with copy-related attributes in the entire result area
        const allButtons = resultArea.querySelectorAll('button');
        for (const btn of allButtons) {
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (title.includes('copy') || title.includes('clipboard') || 
                ariaLabel.includes('copy') || ariaLabel.includes('clipboard')) {
                return btn;
            }
        }
        
        return null;
    }
};
