// ==UserScript==
// @name         [DEV] Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  UX improvements for workflow builder tool with improved layout, favorites, and fixes
// @author       Nicholas Doherty
// @match        https://fleetai.com/work/problems/create*
// @icon         https://fleetai.com/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/adastra1826/fleet-ux-improvements/main/fleet.dev.user.js
// @updateURL    https://raw.githubusercontent.com/adastra1826/fleet-ux-improvements/main/fleet.dev.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============= CONFIGURATION =============
    const CONFIG = {
        DEBUG: true, // Set to true for console logging
        DEBUG_NOTES: true, // Set to true for detailed notes logging
        AUTO_CONFIRM_REEXECUTE: true, // Automatically confirm re-execute dialogs
        VERSION: '2.0.0',
    };

    // ============= NETWORK INTERCEPTION =============
    // Must be set up immediately at document-start before any other scripts run
    // Uses unsafeWindow to access the page's actual context (required when @grant is used)
    let source = null; // Stores the first intercepted MCP URL

    function setupNetworkInterception() {
        // When @grant is used, the script runs in a sandbox
        // We need to use unsafeWindow to access the page's real window object
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        
        // Store the original fetch function from the PAGE's context
        const originalFetch = pageWindow.fetch;

        // Override fetch on the PAGE's window
        pageWindow.fetch = function(...args) {
            const [resource, config] = args;
            
            // Convert resource to URL object for easier parsing
            let url;
            try {
                url = new URL(resource, pageWindow.location.href);
            } catch (e) {
                url = { href: resource, pathname: '' };
            }

            // Check if this is an MCP POST request
            if (url.pathname === '/mcp' && config && config.method === 'POST') {
                console.log('[WF Enhancer] 🎯 Intercepted MCP Request:', url.href);
                
                // Store the first one in source variable
                if (source === null) {
                    source = url.href;
                    console.log('[WF Enhancer] ✓ Source URL captured:', source);
                }
            }

            // Call the original fetch function
            return originalFetch.apply(this, args);
        };

        // Also intercept XMLHttpRequest on the PAGE's context
        const originalXHROpen = pageWindow.XMLHttpRequest.prototype.open;
        const originalXHRSend = pageWindow.XMLHttpRequest.prototype.send;

        pageWindow.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._interceptedURL = url;
            this._interceptedMethod = method;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        pageWindow.XMLHttpRequest.prototype.send = function(body) {
            if (this._interceptedMethod === 'POST' && this._interceptedURL && this._interceptedURL.includes('/mcp')) {
                console.log('[WF Enhancer] 🎯 Intercepted XHR MCP Request:', this._interceptedURL);
                
                // Store the first one in source variable
                if (source === null) {
                    source = this._interceptedURL;
                    console.log('[WF Enhancer] ✓ Source URL captured (XHR):', source);
                }
            }
            return originalXHRSend.apply(this, [body]);
        };

        console.log('[WF Enhancer] ✓ Network interception installed (using ' + (typeof unsafeWindow !== 'undefined' ? 'unsafeWindow' : 'window') + ')');
    }

    // Install network interception immediately
    setupNetworkInterception();

    // Expose source and getter globally for debugging (on page's window)
    const pageWindowForExport = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    pageWindowForExport.getWFSource = function() {
        return source;
    };
    
    // ============= STATE TRACKING =============
    const STATE = {
        searchInputDisabled: false,
        promptEditorDisabled: false,
        notesTextareaDisabled: false,
        expandCollapseButtonsAdded: false,
        textareaFadeRemoved: false,
        threeColumnLayoutApplied: false,
        notesAutoSaveSetup: false,
        favoritesInitialized: false,
        lastStarsCount: 0,
        bugReportExpandInitialized: false,
        retryCounters: {
            searchInput: 0,
            promptEditor: 0,
            notesTextarea: 0,
            toolbar: 0,
            textareaFade: 0,
            threeColumnLayout: 0,
            notesAutoSave: 0,
            favoriteButtons: 0,
            bugReportExpand: 0
        }
    };

    // Helper function for logging
    const log = (msg, ...args) => {
        if (CONFIG.DEBUG) console.log(`[WF Enhancer] ${msg}`, ...args);
    };

    // ============= DISABLE AUTOCORRECT ON SEARCH INPUT =============
    function disableAutocorrectOnSearchInput() {
        if (STATE.searchInputDisabled) return false;

        const searchInput = document.querySelector('input[placeholder="Search tools, descriptions, parameters..."]');

        if (searchInput) {
            searchInput.setAttribute('autocomplete', 'off');
            searchInput.setAttribute('autocorrect', 'off');
            searchInput.setAttribute('autocapitalize', 'off');
            searchInput.setAttribute('spellcheck', 'false');
            searchInput.setAttribute('data-form-type', 'other');
            searchInput.setAttribute('data-lpignore', 'true');
            searchInput.setAttribute('data-1p-ignore', 'true');

            STATE.searchInputDisabled = true;
            log('✓ Autocorrect disabled on search input');
            return true;
        }
        
        STATE.retryCounters.searchInput++;
        return false;
    }

    // ============= DISABLE AUTOCORRECT ON TEXTAREAS =============
    function disableAutocorrectOnTextareas() {
        let changesMade = false;

        // Prompt editor
        if (!STATE.promptEditorDisabled) {
            const promptEditor = document.getElementById('prompt-editor');
            if (promptEditor) {
                promptEditor.setAttribute('autocomplete', 'off');
                promptEditor.setAttribute('autocorrect', 'off');
                promptEditor.setAttribute('autocapitalize', 'off');
                promptEditor.setAttribute('spellcheck', 'false');
                STATE.promptEditorDisabled = true;
                log('✓ Autocorrect disabled on prompt editor');
                changesMade = true;
            } else {
                STATE.retryCounters.promptEditor++;
            }
        }

        // Notes textarea
        if (!STATE.notesTextareaDisabled) {
            const notesTextarea = document.getElementById('wf-notes-textarea');
            if (notesTextarea) {
                notesTextarea.setAttribute('autocomplete', 'off');
                notesTextarea.setAttribute('autocorrect', 'off');
                notesTextarea.setAttribute('autocapitalize', 'off');
                notesTextarea.setAttribute('spellcheck', 'false');
                STATE.notesTextareaDisabled = true;
                log('✓ Autocorrect disabled on notes textarea');
                changesMade = true;
            } else {
                STATE.retryCounters.notesTextarea++;
            }
        }

        return changesMade;
    }

    // ============= EXPAND/COLLAPSE ALL TOOLS =============
    // Selectors for the tools panel
    const SELECTORS = {
        toolbar: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        toolsContainer: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        promptTextareaContainer: '#\\:r7\\: > div.flex-shrink-0 > div > div.space-y-2.relative > div.relative > div',
        promptSectionParent: '#\\:r7\\: > div.flex-shrink-0 > div.p-3.border-b',
        workflowToolsIndicator: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)',
        workflowToolsArea: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3'
    };

    // Storage keys
    const STORAGE_KEYS = {
        notes: 'wf-enhancer-notes',
        notesHeight: 'wf-enhancer-notes-height',
        col1Width: 'wf-enhancer-col1-width',
        col2Width: 'wf-enhancer-col2-width',
        col3Width: 'wf-enhancer-col3-width',
        sectionSplitRatio: 'wf-enhancer-section-split-ratio',
        favoriteTools: 'wf-enhancer-favorite-tools'
    };

    function addExpandCollapseButtons() {
        const toolbar = document.querySelector(SELECTORS.toolbar);
        if (!toolbar) {
            STATE.retryCounters.toolbar++;
            return false;
        }

        const toolsIndicator = document.querySelector(SELECTORS.workflowToolsIndicator);
        const hasTools = toolsIndicator && toolsIndicator.children.length > 0;

        let container = document.getElementById('wf-expand-collapse-container');
        
        if (!container) {
            const buttonClass = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors hover:bg-accent rounded-sm h-7 px-2 text-xs text-muted-foreground hover:text-foreground';

            container = document.createElement('div');
            container.id = 'wf-expand-collapse-container';
            container.className = 'flex items-center gap-2';

            const expandBtn = document.createElement('button');
            expandBtn.id = 'wf-expand-btn';
            expandBtn.className = buttonClass;
            expandBtn.innerHTML = `<span>Expand All</span>`;
            expandBtn.addEventListener('click', () => setAllToolsState('open'));

            const divider = document.createElement('div');
            divider.className = 'w-px h-5 bg-border mx-1';

            const collapseBtn = document.createElement('button');
            collapseBtn.id = 'wf-collapse-btn';
            collapseBtn.className = buttonClass;
            collapseBtn.innerHTML = `<span>Collapse All</span>`;
            collapseBtn.addEventListener('click', () => setAllToolsState('closed'));

            const trailingDivider = document.createElement('div');
            trailingDivider.id = 'wf-expand-collapse-trailing-divider';
            trailingDivider.className = 'w-px h-5 bg-border mx-1';

            container.appendChild(expandBtn);
            container.appendChild(divider);
            container.appendChild(collapseBtn);
            container.appendChild(trailingDivider);

            toolbar.insertBefore(container, toolbar.firstChild);
            STATE.expandCollapseButtonsAdded = true;
            log('✓ Expand/Collapse buttons added to toolbar');
        }

        // Always update display based on whether tools exist
        container.style.display = hasTools ? 'flex' : 'none';
        return true;
    }

    function setAllToolsState(targetState) {
        const toolsContainer = document.querySelector(SELECTORS.toolsContainer);
        if (!toolsContainer) {
            log('⚠ Tools container not found for expand/collapse');
            return;
        }

        const toolHeaders = toolsContainer.querySelectorAll(SELECTORS.toolHeader);
        let successCount = 0;

        toolHeaders.forEach((header) => {
            const currentState = header.getAttribute('data-state');
            if ((targetState === 'open' && currentState === 'closed') ||
                (targetState === 'closed' && currentState === 'open')) {
                header.click();
                successCount++;
            }
        });

        log(`✓ ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} tools`);
    }

    // ============= REMOVE TEXTAREA GRADIENT FADE =============
    function removeTextareaGradientFade() {
        if (STATE.textareaFadeRemoved) return false;

        const container = document.querySelector(SELECTORS.promptTextareaContainer);
        if (!container) {
            STATE.retryCounters.textareaFade++;
            return false;
        }

        const gradientOverlay = container.querySelector('div.bg-gradient-to-b');
        if (gradientOverlay) {
            gradientOverlay.style.background = 'none';
            gradientOverlay.style.pointerEvents = 'none';
            STATE.textareaFadeRemoved = true;
            log('✓ Textarea gradient fade removed');
            return true;
        }

        STATE.retryCounters.textareaFade++;
        return false;
    }

    // ============= BUG REPORT EXPAND/COLLAPSE =============
    function setupBugReportExpand() {
        // Find all bug report cards in the modal
        const bugReportCards = document.querySelectorAll('div.p-3.bg-muted\\/50.rounded-lg.text-sm');
        
        if (bugReportCards.length === 0) {
            STATE.retryCounters.bugReportExpand++;
            return false;
        }

        let modified = 0;

        bugReportCards.forEach(card => {
            // Check if already processed
            if (card.hasAttribute('data-wf-expand-enabled')) {
                return;
            }

            const contentWrapper = card.querySelector('div.flex.items-start.justify-between.gap-2 > div.flex-1.min-w-0');
            if (!contentWrapper) return;

            const textParagraph = contentWrapper.querySelector('p.text-muted-foreground.text-xs.line-clamp-2');
            if (!textParagraph) return;

            // Mark as processed
            card.setAttribute('data-wf-expand-enabled', 'true');

            // Make the content wrapper clickable
            contentWrapper.style.cursor = 'pointer';
            contentWrapper.setAttribute('title', 'Click to expand/collapse');

            // Store original text
            const originalText = textParagraph.textContent;

            // Track expanded state
            let isExpanded = false;

            contentWrapper.addEventListener('click', (e) => {
                // Prevent if clicking on a button or link
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
                    return;
                }

                isExpanded = !isExpanded;

                if (isExpanded) {
                    // Remove line clamp
                    textParagraph.classList.remove('line-clamp-2');
                    
                    // Preserve and render newlines
                    textParagraph.style.whiteSpace = 'pre-wrap';
                    
                    // Convert markdown-style line breaks to actual newlines if needed
                    const formattedText = originalText
                        .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove markdown bold
                        .replace(/\n\n/g, '\n');  // Normalize double newlines
                    
                    textParagraph.textContent = formattedText;
                } else {
                    // Restore line clamp
                    textParagraph.classList.add('line-clamp-2');
                    textParagraph.style.whiteSpace = '';
                    textParagraph.textContent = originalText;
                }
            });

            modified++;
        });

        if (modified > 0) {
            log(`✓ Bug report expand/collapse enabled for ${modified} report(s)`);
            return true;
        }

        return false;
    }

    // ============= MINI EXECUTE BUTTONS FOR COLLAPSED TOOLS =============
    function executeTool(card, header) {
        log('executeTool called');
        
        const collapsibleRoot = card.querySelector('div[data-state]');
        if (!collapsibleRoot) {
            log('No collapsible root found');
            return;
        }

        const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';
        log('Tool state: ' + (isCollapsed ? 'collapsed' : 'expanded'));
        
        if (isCollapsed) {
            // Expand the tool first
            log('Expanding tool...');
            header.click();
            
            // Wait for the collapsible content to become visible and find the execute button
            const buttonObserver = new MutationObserver((mutations, obs) => {
                // Look for the collapsible content div with radix ID
                const collapsibleContent = card.querySelector('div[data-state="open"] > div[id^="radix-"][data-state="open"]');
                
                if (!collapsibleContent) {
                    log('Waiting for collapsible content to appear...');
                    return;
                }
                
                log('Found collapsible content: ' + collapsibleContent.id);
                
                // Find the execute/re-execute button - it's a direct child of the content div
                const buttons = collapsibleContent.querySelectorAll('div.px-3.pb-3.space-y-3 > button');
                log('Found ' + buttons.length + ' button(s) in content');
                
                let executeBtn = null;
                buttons.forEach(btn => {
                    const btnText = btn.textContent.trim();
                    log('  - Button text: "' + btnText + '"');
                    if (btnText === 'Execute' || btnText === 'Re-execute') {
                        executeBtn = btn;
                    }
                });
                
                if (executeBtn) {
                    obs.disconnect();
                    
                    const buttonText = executeBtn.textContent.trim();
                    log('Found ' + buttonText + ' button, clicking...');
                    
                    // Click the execute button
                    executeBtn.click();
                    log('Clicked ' + buttonText + ' button for collapsed tool');
                    
                    // Watch for the tool state to change (success/error)
                    watchForToolCompletion(card, header);
                }
            });
            
            buttonObserver.observe(card, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['hidden', 'data-state']
            });
            
            // Timeout fallback
            setTimeout(() => {
                buttonObserver.disconnect();
                log('Timeout waiting for execute button to appear');
            }, 5000);
        } else {
            // Tool is already open, find and click the execute button
            log('Tool already open, looking for execute button...');
            
            const collapsibleContent = card.querySelector('div[data-state="open"] > div[id^="radix-"][data-state="open"]');
            if (collapsibleContent) {
                const buttons = collapsibleContent.querySelectorAll('div.px-3.pb-3.space-y-3 > button');
                
                let executeBtn = null;
                buttons.forEach(btn => {
                    const btnText = btn.textContent.trim();
                    if (btnText === 'Execute' || btnText === 'Re-execute') {
                        executeBtn = btn;
                    }
                });
                
                if (executeBtn) {
                    const buttonText = executeBtn.textContent.trim();
                    executeBtn.click();
                    log('Clicked ' + buttonText + ' button for open tool');
                    // Don't watch for completion since tool is already open - user can see results
                } else {
                    log('No execute button found in open tool');
                }
            }
        }
    }

    function watchForToolCompletion(card, header) {
        log('Starting to watch for tool completion...');
        
        const originalBorderClass = Array.from(card.classList).find(cls => cls.startsWith('border-'));
        log('Original border class: ' + (originalBorderClass || 'none'));
        
        // Watch for the card's border color to change (indicating success/error)
        const completionObserver = new MutationObserver((mutations, obs) => {
            const hasSuccess = card.classList.contains('border-emerald-500/50');
            const hasError = card.classList.contains('border-red-500/50');
            
            if (hasSuccess || hasError) {
                obs.disconnect();
                log('Tool execution completed with ' + (hasSuccess ? 'SUCCESS' : 'ERROR'));
                
                // Collapse the tool immediately after completion
                const collapsibleRoot = card.querySelector('div[data-state]');
                if (collapsibleRoot && collapsibleRoot.getAttribute('data-state') === 'open') {
                    log('Collapsing tool...');
                    header.click();
                    log('Collapsed tool after ' + (hasSuccess ? 'success' : 'error'));
                }
            }
        });
        
        completionObserver.observe(card, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Timeout fallback - stop watching after 30 seconds
        setTimeout(() => {
            completionObserver.disconnect();
            log('Stopped watching for completion (5s timeout)');
        }, 5000);
    }

    // ============= DUPLICATE TO END BUTTON =============
    function duplicateToolToEnd(card, duplicateBtn) {
        log('duplicateToolToEnd called');
        
        const toolsContainer = document.querySelector(SELECTORS.workflowToolsArea);
        if (!toolsContainer) {
            log('Tools container not found');
            return;
        }
        
        // Get current tool count before duplication
        const toolCardsBefore = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
        const countBefore = toolCardsBefore.length;
        log('Tool count before duplication: ' + countBefore);
        
        // Get the current tool's position (index)
        const toolCardsArray = Array.from(toolCardsBefore);
        const currentIndex = toolCardsArray.indexOf(card.closest('div.rounded-lg.border.transition-colors') || card);
        log('Current tool index: ' + currentIndex);
        
        // Click the duplicate button
        duplicateBtn.click();
        log('Clicked duplicate button');
        
        // Watch for the new tool to appear
        const dupeObserver = new MutationObserver((mutations, obs) => {
            const toolCardsAfter = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
            
            if (toolCardsAfter.length > countBefore) {
                obs.disconnect();
                log('New tool detected, count: ' + toolCardsAfter.length);
                
                // The duplicated tool should be right after the original (currentIndex + 1)
                const duplicatedToolIndex = currentIndex + 1;
                const duplicatedTool = toolCardsAfter[duplicatedToolIndex];
                
                if (!duplicatedTool) {
                    log('Could not find duplicated tool at index ' + duplicatedToolIndex);
                    return;
                }
                
                // If it's already at the end, no need to move
                if (duplicatedToolIndex === toolCardsAfter.length - 1) {
                    log('Tool already at end, no move needed');
                    return;
                }
                
                // Calculate how many positions to move down
                const movesNeeded = (toolCardsAfter.length - 1) - duplicatedToolIndex;
                log('Moves needed to reach end: ' + movesNeeded);
                
                // Use keyboard simulation to move the tool
                moveToolToEndViaKeyboard(duplicatedTool, movesNeeded);
            }
        });
        
        dupeObserver.observe(toolsContainer, {
            childList: true,
            subtree: true
        });
        
        // Timeout fallback
        setTimeout(() => {
            dupeObserver.disconnect();
            log('Timeout waiting for duplicated tool to appear');
        }, 3000);
    }
    
    function moveToolToEndViaKeyboard(toolCard, movesNeeded) {
        log('moveToolToEndViaKeyboard: ' + movesNeeded + ' moves');
        
        // Find the drag handle within the tool
        const dragHandle = toolCard.querySelector('div[role="button"][aria-roledescription="sortable"]');
        if (!dragHandle) {
            log('Drag handle not found');
            return;
        }
        
        log('Found drag handle');
        
        // Focus the drag handle
        dragHandle.focus();
        
        // Small delay to ensure focus is set
        setTimeout(() => {
            // Press Space to pick up the item
            const spaceDownEvent = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                bubbles: true,
                cancelable: true
            });
            dragHandle.dispatchEvent(spaceDownEvent);
            log('Dispatched Space keydown to pick up');
            
            // Press ArrowDown for each move needed
            let moveCount = 0;
            const moveInterval = setInterval(() => {
                if (moveCount >= movesNeeded) {
                    clearInterval(moveInterval);
                    
                    // Press Space again to drop
                    setTimeout(() => {
                        const spaceDropEvent = new KeyboardEvent('keydown', {
                            key: ' ',
                            code: 'Space',
                            keyCode: 32,
                            which: 32,
                            bubbles: true,
                            cancelable: true
                        });
                        dragHandle.dispatchEvent(spaceDropEvent);
                        log('Dispatched Space keydown to drop');
                        
                        // Blur the handle
                        dragHandle.blur();
                        log('Tool moved to end successfully');
                    }, 50);
                    return;
                }
                
                const arrowDownEvent = new KeyboardEvent('keydown', {
                    key: 'ArrowDown',
                    code: 'ArrowDown',
                    keyCode: 40,
                    which: 40,
                    bubbles: true,
                    cancelable: true
                });
                dragHandle.dispatchEvent(arrowDownEvent);
                moveCount++;
                log('Dispatched ArrowDown ' + moveCount + '/' + movesNeeded);
            }, 50); // Small delay between arrow presses
            
        }, 50);
    }
    
    function addDuplicateToEndButtons() {
        const toolsContainer = document.querySelector(SELECTORS.workflowToolsArea);
        if (!toolsContainer) return false;
        
        const toolCards = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
        let buttonsAdded = 0;
        
        toolCards.forEach(card => {
            const header = card.querySelector(SELECTORS.toolHeader);
            if (!header) return;
            
            const buttonContainer = header.querySelector('div.flex.items-center.gap-1');
            if (!buttonContainer) return;
            
            // Check if button already exists
            if (buttonContainer.querySelector('.wf-duplicate-to-end-btn')) return;
            
            // Find the original duplicate button (second button after our mini execute, has the copy+ icon)
            const buttons = buttonContainer.querySelectorAll('button');
            let duplicateBtn = null;
            
            buttons.forEach(btn => {
                // Look for the duplicate button by its SVG content (has the copy+ icon)
                const svg = btn.querySelector('svg');
                if (svg) {
                    const hasLine15 = svg.querySelector('line[x1="15"][y1="12"][y2="18"]');
                    const hasRect = svg.querySelector('rect[width="14"][height="14"]');
                    if (hasLine15 && hasRect) {
                        duplicateBtn = btn;
                    }
                }
            });
            
            if (!duplicateBtn) return;
            
            // Find the delete button (after duplicate button)
            const deleteBtn = duplicateBtn.nextElementSibling;
            if (!deleteBtn || deleteBtn.tagName !== 'BUTTON') return;
            
            // Create the "Duplicate to End" button
            const dupToEndBtn = document.createElement('button');
            dupToEndBtn.className = 'wf-duplicate-to-end-btn inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground size-7 h-7 w-7';
            dupToEndBtn.title = 'Duplicate to End of Workflow';
            dupToEndBtn.setAttribute('data-state', 'closed');
            
            // SVG: Combination of duplicate icon + corner-down-left arrow
            dupToEndBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-muted-foreground hover:text-primary">
                    <!-- Copy/duplicate icon (scaled and positioned) -->
                    <rect x="9" y="2" width="10" height="10" rx="1.5" ry="1.5"></rect>
                    <path d="M5 10c-0.8 0-1.5 0.7-1.5 1.5v7c0 0.8 0.7 1.5 1.5 1.5h7c0.8 0 1.5-0.7 1.5-1.5"></path>
                    <!-- Plus sign on copy icon -->
                    <line x1="14" y1="5" x2="14" y2="9"></line>
                    <line x1="12" y1="7" x2="16" y2="7"></line>
                    <!-- Corner down-left arrow -->
                    <polyline points="21 14 21 20 15 20"></polyline>
                    <path d="M21 20 L17 16"></path>
                </svg>
            `;
            
            dupToEndBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Find the current duplicate button at click time
                const currentButtons = buttonContainer.querySelectorAll('button');
                let currentDuplicateBtn = null;
                
                currentButtons.forEach(btn => {
                    const svg = btn.querySelector('svg');
                    if (svg) {
                        const hasLine15 = svg.querySelector('line[x1="15"][y1="12"][y2="18"]');
                        const hasRect = svg.querySelector('rect[width="14"][height="14"]');
                        if (hasLine15 && hasRect) {
                            currentDuplicateBtn = btn;
                        }
                    }
                });
                
                if (currentDuplicateBtn) {
                    duplicateToolToEnd(card, currentDuplicateBtn);
                } else {
                    log('⚠ Could not find duplicate button when duplicate-to-end was clicked');
                }
            });
            
            // Insert after the duplicate button (before delete button)
            buttonContainer.insertBefore(dupToEndBtn, deleteBtn);
            buttonsAdded++;
        });
        
        if (buttonsAdded > 0) {
            log('Added ' + buttonsAdded + ' duplicate-to-end button(s)');
        }
        
        return buttonsAdded > 0;
    }
    
    // Add a separate cleanup function for orphaned buttons
    function cleanupOrphanedDuplicateButtons() {
        // Find any duplicate-to-end buttons that don't have proper sibling buttons
        const allDupToEndBtns = document.querySelectorAll('.wf-duplicate-to-end-btn');
        let removed = 0;
        
        allDupToEndBtns.forEach(btn => {
            const buttonContainer = btn.parentElement;
            if (!buttonContainer) {
                btn.remove();
                removed++;
                return;
            }
            
            // Check if the original duplicate and delete buttons still exist
            const prevSibling = btn.previousElementSibling;
            const nextSibling = btn.nextElementSibling;
            
            // If the button is not properly positioned between duplicate and delete, remove it
            if (!prevSibling || !nextSibling || nextSibling.tagName !== 'BUTTON') {
                btn.remove();
                removed++;
            }
        });
        
        if (removed > 0) {
            log(`Cleaned up ${removed} orphaned duplicate-to-end button(s)`);
        }
        
        return removed > 0;
    }

    // ============= SOURCE DATA EXPLORER BUTTON =============
    function addSourceDataExplorerButton() {
        // Only add if we have a source URL
        if (!source) return false;
        
        // Find the container with the "Recommend Tools" button
        const containers = document.querySelectorAll('div.flex.items-center.gap-2.mt-2');
        let targetContainer = null;
        
        for (const container of containers) {
            const recommendBtn = container.querySelector('button');
            if (recommendBtn && recommendBtn.textContent.includes('Recommend Tools')) {
                targetContainer = container;
                break;
            }
        }
        
        if (!targetContainer) return false;
        
        // Check if button already exists
        if (targetContainer.querySelector('#wf-source-explorer-btn')) return false;
        
        // Extract base URL (remove /mcp part)
        let baseUrl = source;
        if (baseUrl.includes('/mcp')) {
            baseUrl = baseUrl.substring(0, baseUrl.indexOf('/mcp'));
        }
        
        // Create the Source Data Explorer button
        const sourceBtn = document.createElement('button');
        sourceBtn.id = 'wf-source-explorer-btn';
        sourceBtn.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground h-8 rounded-sm pl-3 pr-3 text-xs gap-1.5 relative';
        sourceBtn.setAttribute('data-state', 'closed');
        
        // Database icon SVG
        sourceBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-blue-500">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M3 5V19C3 20.6569 7.02944 22 12 22C16.9706 22 21 20.6569 21 19V5"></path>
                <path d="M3 12C3 13.6569 7.02944 15 12 15C16.9706 15 21 13.6569 21 12"></path>
            </svg>
            Source Data Explorer
        `;
        
        sourceBtn.addEventListener('click', () => {
            window.open(baseUrl, '_blank');
            log('Opened source URL: ' + baseUrl);
        });
        
        // Insert after the first button (Recommend Tools)
        const firstButton = targetContainer.querySelector('button');
        if (firstButton && firstButton.nextSibling) {
            targetContainer.insertBefore(sourceBtn, firstButton.nextSibling);
        } else {
            targetContainer.appendChild(sourceBtn);
        }
        
        log('✓ Source Data Explorer button added');
        return true;
    }

    // ============= SETTINGS MODAL =============
    let settingsModalOpen = false;
    let settingsChanged = false;
    
    function createSettingsModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('wf-settings-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'wf-settings-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--background);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            width: 400px;
            max-height: 70vh;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            display: none;
        `;
        
        const modalContent = `
            <div class="space-y-4">
                <div class="flex items-center justify-between mb-4">
                    <h2 style="font-size: 18px; font-weight: 600;">WF Enhancer Settings</h2>
                    <button id="wf-settings-close" style="
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='var(--accent)'" onmouseout="this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div style="space-y: 3px;">
                    ${Object.entries(CONFIG).filter(([key]) => key !== 'VERSION').map(([key, value]) => {
                        const label = key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                                <label style="font-size: 14px; flex: 1;">${label}</label>
                                <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                                    <input type="checkbox" id="wf-setting-${key}" ${value ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                    <span style="
                                        position: absolute;
                                        cursor: pointer;
                                        top: 0; left: 0; right: 0; bottom: 0;
                                        background-color: ${value ? 'var(--brand, #4f46e5)' : '#ccc'};
                                        transition: 0.3s;
                                        border-radius: 24px;
                                    ">
                                        <span style="
                                            position: absolute;
                                            content: '';
                                            height: 18px;
                                            width: 18px;
                                            left: ${value ? '23px' : '3px'};
                                            bottom: 3px;
                                            background-color: white;
                                            transition: 0.3s;
                                            border-radius: 50%;
                                        "></span>
                                    </span>
                                </label>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div id="wf-settings-message" style="
                    display: none;
                    padding: 12px;
                    background: var(--accent);
                    border-radius: 6px;
                    font-size: 13px;
                    text-align: center;
                    margin-top: 16px;
                ">
                    Settings changed. Please refresh the page for changes to take effect.
                </div>
                
                <div style="font-size: 11px; color: var(--muted-foreground); text-align: center; margin-top: 16px;">
                    WF Enhancer v${CONFIG.VERSION}
                </div>
            </div>
        `;
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        
        // Add event listeners for toggles
        Object.keys(CONFIG).filter(key => key !== 'VERSION').forEach(key => {
            const checkbox = modal.querySelector(`#wf-setting-${key}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    const span = e.target.nextElementSibling;
                    const innerSpan = span.querySelector('span');
                    
                    if (e.target.checked) {
                        span.style.backgroundColor = 'var(--brand, #4f46e5)';
                        innerSpan.style.left = '23px';
                    } else {
                        span.style.backgroundColor = '#ccc';
                        innerSpan.style.left = '3px';
                    }
                    
                    CONFIG[key] = e.target.checked;
                    settingsChanged = true;
                    document.getElementById('wf-settings-message').style.display = 'block';
                });
            }
        });
        
        // Close button
        modal.querySelector('#wf-settings-close').addEventListener('click', () => {
            modal.style.display = 'none';
            settingsModalOpen = false;
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (settingsModalOpen && !modal.contains(e.target) && !e.target.closest('#wf-settings-btn')) {
                modal.style.display = 'none';
                settingsModalOpen = false;
            }
        });
        
        return modal;
    }
    
    function addSettingsButton() {
        // Check if button already exists
        if (document.getElementById('wf-settings-btn')) return false;
        
        // Find the bug report button
        const bugReportBtn = document.querySelector('body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > button');
        if (!bugReportBtn) return false;
        
        // Create settings button with same styling as bug report button
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'wf-settings-btn';
        settingsBtn.className = bugReportBtn.className;
        
        // Adjust position to be above the bug report button
        settingsBtn.style.cssText = bugReportBtn.style.cssText || '';
        settingsBtn.style.bottom = '136px'; // Position above bug report button (which is at bottom-20 = 80px)
        
        // Gear icon SVG
        settingsBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stroke-current size-5">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24M21 12h-6m-6 0H3"></path>
            </svg>
            <span class="sr-only">WF Enhancer Settings</span>
        `;
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('wf-settings-modal');
        if (!modal) {
            modal = createSettingsModal();
        }
        
        // Add click handler
        settingsBtn.addEventListener('click', () => {
            settingsModalOpen = !settingsModalOpen;
            modal.style.display = settingsModalOpen ? 'block' : 'none';
        });
        
        // Insert into page (same parent as bug report button)
        bugReportBtn.parentNode.insertBefore(settingsBtn, bugReportBtn);
        
        log('✓ Settings button added');
        return true;
    }

    // ============= AUTO-CONFIRM RE-EXECUTE DIALOG =============
    function autoConfirmReexecuteDialog() {
        if (!CONFIG.AUTO_CONFIRM_REEXECUTE) return false;
        
        // Look for the re-execute confirmation dialog
        const dialog = document.querySelector('div[role="alertdialog"][data-state="open"]');
        if (!dialog) return false;
        
        // Check if this is the re-execute dialog by looking for the specific heading
        const heading = dialog.querySelector('h2');
        if (!heading || !heading.textContent.includes('Re-execute this step')) return false;
        
        // Find and click the "Re-execute & Invalidate" button
        const buttons = dialog.querySelectorAll('button');
        let confirmBtn = null;
        
        buttons.forEach(btn => {
            const btnText = btn.textContent.trim();
            if (btnText.includes('Re-execute') && btnText.includes('Invalidate')) {
                confirmBtn = btn;
            }
        });
        
        if (confirmBtn) {
            log('Auto-confirming re-execute dialog');
            confirmBtn.click();
            log('Clicked "Re-execute & Invalidate" button');
            return true;
        }
        
        return false;
    }

    function addMiniExecuteButtons() {
        const toolsContainer = document.querySelector(SELECTORS.workflowToolsArea);
        if (!toolsContainer) return false;

        // Select all tool cards - default, success (emerald), and error (red) states
        const toolCards = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
        let buttonsAdded = 0;

        toolCards.forEach(card => {
            const collapsibleRoot = card.querySelector('div[data-state]');
            if (!collapsibleRoot) return;

            const header = card.querySelector(SELECTORS.toolHeader);
            if (!header) return;

            const buttonContainer = header.querySelector('div.flex.items-center.gap-1');
            if (!buttonContainer) return;

            // Check if mini execute button already exists
            let miniExecBtn = buttonContainer.querySelector('.wf-mini-execute-btn');
            
            const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';

            if (!miniExecBtn) {
                // Create the mini execute button
                miniExecBtn = document.createElement('button');
                miniExecBtn.className = 'wf-mini-execute-btn inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand !text-white transition-colors hover:brightness-95 border border-brand-accent rounded-sm size-7 h-7 w-7';
                miniExecBtn.title = 'Execute';
                miniExecBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-current size-3.5"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.03 8.652C10.7217 8.45933 10.3332 8.44913 10.0152 8.62536C9.69728 8.80158 9.5 9.13648 9.5 9.5V14.5C9.5 14.8635 9.69728 15.1984 10.0152 15.3746C10.3332 15.5509 10.7217 15.5407 11.03 15.348L15.03 12.848C15.3224 12.6653 15.5 12.3448 15.5 12C15.5 11.6552 15.3224 11.3347 15.03 11.152L11.03 8.652Z"></path></svg>`;
                
                miniExecBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    executeTool(card, header);
                });

                // Insert as first child of button container
                buttonContainer.insertBefore(miniExecBtn, buttonContainer.firstChild);
                buttonsAdded++;
            }

            // Update visibility based on collapsed state
            miniExecBtn.style.display = isCollapsed ? 'inline-flex' : 'none';
        });

        if (buttonsAdded > 0) {
            log(`✓ Added ${buttonsAdded} mini execute button(s)`);
        }

        return buttonsAdded > 0;
    }

    // ============= THREE COLUMN LAYOUT WITH IMPROVED FIRST COLUMN =============
    function createThreeColumnLayout() {
        if (STATE.threeColumnLayoutApplied) return false;

        const mainContainer = document.querySelector('body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > div.w-full.h-full.bg-background.rounded-sm.relative.flex.flex-col.min-w-0.overflow-hidden.border-\\[0\\.5px\\].shadow-\\[0_0_15px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\] > div > div.flex-1.flex.overflow-hidden.min-h-0 > div');
        
        if (!mainContainer) {
            STATE.retryCounters.threeColumnLayout++;
            return false;
        }

        if (document.getElementById('wf-three-col-layout')) {
            return false;
        }

        const leftColumn = document.querySelector('#\\:r7\\:');
        const existingDivider = mainContainer.querySelector('div[data-resize-handle]');
        const workflowColumn = document.querySelector('#\\:rb\\:');

        if (!leftColumn || !workflowColumn || !existingDivider) {
            STATE.retryCounters.threeColumnLayout++;
            return false;
        }

        const topSection = leftColumn.querySelector('div.flex-shrink-0');
        const bottomSection = leftColumn.querySelector('div.flex-1.min-h-0.overflow-hidden');

        if (!topSection || !bottomSection) {
            STATE.retryCounters.threeColumnLayout++;
            return false;
        }

        const panelGroupId = mainContainer.getAttribute('data-panel-group-id') || ':r6:';
        
        // Store references to preserve DOM elements
        const preservedElements = {
            leftColumn: leftColumn.parentNode.removeChild(leftColumn),
            workflowColumn: workflowColumn.parentNode.removeChild(workflowColumn),
            topSection: topSection,
            bottomSection: bottomSection
        };
        
        // Clear container after removing elements
        mainContainer.innerHTML = '';
        mainContainer.id = 'wf-three-col-layout';

        const savedCol1 = GM_getValue(STORAGE_KEYS.col1Width, 25);
        const savedCol2 = GM_getValue(STORAGE_KEYS.col2Width, 37.5);
        const savedCol3 = GM_getValue(STORAGE_KEYS.col3Width, 37.5);

        const col1 = document.createElement('div');
        col1.className = 'flex flex-col overflow-hidden transition-opacity';
        col1.id = 'wf-col-text';
        col1.style.cssText = `flex: ${savedCol1} 1 0px; overflow: hidden;`;
        col1.setAttribute('data-panel-group-id', panelGroupId);
        col1.setAttribute('data-panel', '');
        col1.setAttribute('data-panel-id', 'wf-col-text');
        col1.setAttribute('data-panel-size', '25');
        
        const splitWrapper = document.createElement('div');
        splitWrapper.className = 'flex flex-col h-full';
        splitWrapper.id = 'wf-split-wrapper';
        
        reorganizeFirstColumnContentPreserved(splitWrapper, preservedElements.topSection);
        col1.appendChild(splitWrapper);

        const divider1 = document.createElement('div');
        divider1.className = 'relative w-[2px] h-[98%] my-auto hover:bg-brand transition-all duration-300 ease-in-out mx-[1px] before:absolute before:top-0 before:left-[-3px] before:right-[-3px] before:bottom-0 before:content-[""] before:cursor-col-resize';
        divider1.setAttribute('role', 'separator');
        divider1.style.touchAction = 'none';
        divider1.setAttribute('tabindex', '0');
        divider1.setAttribute('data-panel-group-direction', 'horizontal');
        divider1.setAttribute('data-panel-group-id', panelGroupId);
        divider1.setAttribute('data-resize-handle', '');
        divider1.setAttribute('data-panel-resize-handle-enabled', 'true');
        divider1.setAttribute('data-panel-resize-handle-id', 'wf-divider-1');
        divider1.setAttribute('data-resize-handle-state', 'inactive');
        divider1.setAttribute('aria-controls', 'wf-col-text');
        divider1.setAttribute('aria-valuemax', '40');
        divider1.setAttribute('aria-valuemin', '15');
        divider1.setAttribute('aria-valuenow', '25');

        const col2 = document.createElement('div');
        col2.className = 'flex flex-col overflow-hidden transition-opacity';
        col2.id = 'wf-col-tools';
        col2.style.cssText = `flex: ${savedCol2} 1 0px; overflow: hidden;`;
        col2.setAttribute('data-panel-group-id', panelGroupId);
        col2.setAttribute('data-panel', '');
        col2.setAttribute('data-panel-id', 'wf-col-tools');
        col2.setAttribute('data-panel-size', '37.5');
        col2.appendChild(preservedElements.bottomSection);

        const divider2 = document.createElement('div');
        divider2.className = 'relative w-[2px] h-[98%] my-auto hover:bg-brand transition-all duration-300 ease-in-out mx-[1px] before:absolute before:top-0 before:left-[-3px] before:right-[-3px] before:bottom-0 before:content-[""] before:cursor-col-resize';
        divider2.setAttribute('role', 'separator');
        divider2.style.touchAction = 'none';
        divider2.setAttribute('tabindex', '0');
        divider2.setAttribute('data-panel-group-direction', 'horizontal');
        divider2.setAttribute('data-panel-group-id', panelGroupId);
        divider2.setAttribute('data-resize-handle', '');
        divider2.setAttribute('data-panel-resize-handle-enabled', 'true');
        divider2.setAttribute('data-panel-resize-handle-id', 'wf-divider-2');
        divider2.setAttribute('data-resize-handle-state', 'inactive');
        divider2.setAttribute('aria-controls', 'wf-col-tools');
        divider2.setAttribute('aria-valuemax', '50');
        divider2.setAttribute('aria-valuemin', '20');
        divider2.setAttribute('aria-valuenow', '37.5');

        preservedElements.workflowColumn.style.flex = `${savedCol3} 1 0px`;
        preservedElements.workflowColumn.setAttribute('data-panel-size', savedCol3.toString());

        mainContainer.appendChild(col1);
        mainContainer.appendChild(divider1);
        mainContainer.appendChild(col2);
        mainContainer.appendChild(divider2);
        mainContainer.appendChild(preservedElements.workflowColumn);

        setupColumnResize(divider1, col1, col2);
        setupColumnResize(divider2, col2, preservedElements.workflowColumn);

        STATE.threeColumnLayoutApplied = true;
        log('✓ Three column layout applied');
        
        setTimeout(() => {
            setupNotesAutoSave();
        }, 100);
        
        return true;
    }

    function reorganizeFirstColumnContentPreserved(wrapper, topSection) {
        const savedRatio = GM_getValue(STORAGE_KEYS.sectionSplitRatio, 60);
        
        const existingSection = topSection.querySelector('div.p-3.border-b');
        if (!existingSection) {
            log('⚠ Existing section not found for reorganization');
            return;
        }

        // Remove the existing section from topSection to preserve it
        topSection.removeChild(existingSection);

        const topPanel = document.createElement('div');
        topPanel.id = 'wf-top-panel';
        topPanel.className = 'flex flex-col overflow-hidden';
        topPanel.style.flex = `${savedRatio} 1 0%`;
        topPanel.style.minHeight = '100px';
        
        // Modify the existing section instead of cloning
        existingSection.className = 'p-3 border-b flex flex-col h-full';
        
        const textareaWrapper = existingSection.querySelector('div.space-y-2.relative');
        if (textareaWrapper) {
            textareaWrapper.className = 'space-y-2 relative flex-1 flex flex-col';
            
            const relativeDiv = textareaWrapper.querySelector('div.relative');
            if (relativeDiv) {
                relativeDiv.className = 'relative flex-1 flex flex-col';
                
                const textareaContainer = relativeDiv.querySelector('div.flex.flex-col');
                if (textareaContainer) {
                    textareaContainer.style.height = '100%';
                }
            }
        }
        
        // Append the preserved element
        topPanel.appendChild(existingSection);

        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'wf-section-resize-handle';
        resizeHandle.className = 'relative h-[2px] w-full hover:bg-brand transition-all duration-300 ease-in-out my-[1px]';
        resizeHandle.style.backgroundColor = 'var(--border)';
        resizeHandle.style.cursor = 'grab';
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.style.touchAction = 'none';
        
        const hitArea = document.createElement('div');
        hitArea.style.cssText = 'position: absolute; top: -6px; bottom: -6px; left: 0; right: 0; cursor: grab;';
        resizeHandle.appendChild(hitArea);

        const bottomPanel = document.createElement('div');
        bottomPanel.id = 'wf-bottom-panel';
        bottomPanel.className = 'p-3 border-b overflow-y-auto';
        bottomPanel.style.flex = `${100 - savedRatio} 1 0%`;
        bottomPanel.style.minHeight = '100px';

        createNotesSection(bottomPanel);

        wrapper.appendChild(topPanel);
        wrapper.appendChild(resizeHandle);
        wrapper.appendChild(bottomPanel);

        setupSectionResize(resizeHandle, topPanel, bottomPanel);
    }

    function reorganizeFirstColumnContent(wrapper, topSection) {
        const savedRatio = GM_getValue(STORAGE_KEYS.sectionSplitRatio, 60);
        
        const existingSection = topSection.querySelector('div.p-3.border-b');
        if (!existingSection) {
            log('⚠ Existing section not found for reorganization');
            return;
        }

        const existingNotesContainer = existingSection.querySelector('#wf-notes-container');
        if (existingNotesContainer) {
            existingNotesContainer.remove();
        }

        const topPanel = document.createElement('div');
        topPanel.id = 'wf-top-panel';
        topPanel.className = 'flex flex-col overflow-hidden';
        topPanel.style.flex = `${savedRatio} 1 0%`;
        topPanel.style.minHeight = '100px';
        
        const topContent = existingSection.cloneNode(true);
        topContent.className = 'p-3 border-b flex flex-col h-full';
        
        const textareaWrapper = topContent.querySelector('div.space-y-2.relative');
        if (textareaWrapper) {
            textareaWrapper.className = 'space-y-2 relative flex-1 flex flex-col';
            
            const relativeDiv = textareaWrapper.querySelector('div.relative');
            if (relativeDiv) {
                relativeDiv.className = 'relative flex-1 flex flex-col';
                
                const textareaContainer = relativeDiv.querySelector('div.flex.flex-col');
                if (textareaContainer) {
                    textareaContainer.style.height = '100%';
                }
            }
        }
        
        topPanel.appendChild(topContent);

        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'wf-section-resize-handle';
        resizeHandle.className = 'relative h-[2px] w-full hover:bg-brand transition-all duration-300 ease-in-out my-[1px]';
        resizeHandle.style.backgroundColor = 'var(--border)';
        resizeHandle.style.cursor = 'grab';
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.style.touchAction = 'none';
        
        const hitArea = document.createElement('div');
        hitArea.style.cssText = 'position: absolute; top: -6px; bottom: -6px; left: 0; right: 0; cursor: grab;';
        resizeHandle.appendChild(hitArea);

        const bottomPanel = document.createElement('div');
        bottomPanel.id = 'wf-bottom-panel';
        bottomPanel.className = 'p-3 border-b overflow-y-auto';
        bottomPanel.style.flex = `${100 - savedRatio} 1 0%`;
        bottomPanel.style.minHeight = '100px';

        createNotesSection(bottomPanel);

        wrapper.appendChild(topPanel);
        wrapper.appendChild(resizeHandle);
        wrapper.appendChild(bottomPanel);

        setupSectionResize(resizeHandle, topPanel, bottomPanel);
    }

    function createNotesSection(container) {
        const savedNotes = GM_getValue(STORAGE_KEYS.notes, '');
        if (CONFIG.DEBUG_NOTES) {
            log(`✓ Notes loaded from storage (${savedNotes.length} chars)`);
        }

        container.className = 'p-3 border-b overflow-hidden flex flex-col';

        const escapedNotes = savedNotes
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const notesHTML = `
            <div class="flex flex-col flex-1">
                <div class="flex items-center justify-between h-5 mb-2">
                    <div class="text-sm text-muted-foreground font-medium">Notes</div>
                </div>
                <div class="relative flex-1 flex flex-col">
                    <div class="flex flex-col relative rounded-md overflow-hidden border border-input bg-background shadow-sm h-full">
                        <textarea id="wf-notes-textarea" class="flex-1 w-full border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none" placeholder="Add your notes here. These are not submitted with your task. They are auto-saved and persist between page loads.">${escapedNotes}</textarea>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = notesHTML;
    }

    function setupSectionResize(handle, topPanel, bottomPanel) {
        let isResizing = false;
        let startY = 0;
        let startTopHeight = 0;
        let startBottomHeight = 0;
        let totalHeight = 0;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            
            const wrapper = handle.parentElement;
            totalHeight = wrapper.offsetHeight;
            startTopHeight = topPanel.offsetHeight;
            startBottomHeight = bottomPanel.offsetHeight;

            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            handle.style.cursor = 'grabbing';
            handle.style.backgroundColor = 'var(--brand)';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;
            const newTopHeight = startTopHeight + deltaY;
            const newBottomHeight = startBottomHeight - deltaY;

            const topPercent = (newTopHeight / totalHeight) * 100;
            const bottomPercent = (newBottomHeight / totalHeight) * 100;

            if (topPercent >= 20 && topPercent <= 80) {
                topPanel.style.flex = `${topPercent} 1 0%`;
                bottomPanel.style.flex = `${bottomPercent} 1 0%`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                handle.style.backgroundColor = 'var(--border)';

                const topFlex = parseFloat(topPanel.style.flex) || 60;
                GM_setValue(STORAGE_KEYS.sectionSplitRatio, topFlex);
            }
        });

        handle.addEventListener('mouseenter', () => {
            if (!isResizing) {
                handle.style.backgroundColor = 'var(--brand)';
            }
        });

        handle.addEventListener('mouseleave', () => {
            if (!isResizing) {
                handle.style.backgroundColor = 'var(--border)';
            }
        });
    }

    function setupColumnResize(divider, leftCol, rightCol) {
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;
        let totalWidth = 0;

        divider.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            
            const parent = divider.parentElement;
            totalWidth = parent.offsetWidth;
            
            const leftFlex = parseFloat(leftCol.style.flex) || 25;
            const rightFlex = parseFloat(rightCol.style.flex) || 37.5;
            
            startLeftWidth = (leftFlex / 100) * totalWidth;
            startRightWidth = (rightFlex / 100) * totalWidth;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            divider.setAttribute('data-resize-handle-state', 'active');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newLeftWidth = startLeftWidth + deltaX;
            const newRightWidth = startRightWidth - deltaX;

            const leftPercent = (newLeftWidth / totalWidth) * 100;
            const rightPercent = (newRightWidth / totalWidth) * 100;

            const minLeft = parseFloat(divider.getAttribute('aria-valuemin')) || 15;
            const maxLeft = parseFloat(divider.getAttribute('aria-valuemax')) || 45;

            if (leftPercent >= minLeft && leftPercent <= maxLeft && rightPercent >= 20) {
                leftCol.style.flex = `${leftPercent} 1 0px`;
                leftCol.setAttribute('data-panel-size', leftPercent.toString());
                
                rightCol.style.flex = `${rightPercent} 1 0px`;
                rightCol.setAttribute('data-panel-size', rightPercent.toString());
                
                divider.setAttribute('aria-valuenow', leftPercent.toString());
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                divider.setAttribute('data-resize-handle-state', 'inactive');
                saveColumnWidths();
            }
        });
    }

    function saveColumnWidths() {
        const col1 = document.getElementById('wf-col-text');
        const col2 = document.getElementById('wf-col-tools');
        const col3 = document.querySelector('#\\:rb\\:');

        if (col1) GM_setValue(STORAGE_KEYS.col1Width, parseFloat(col1.style.flex) || 25);
        if (col2) GM_setValue(STORAGE_KEYS.col2Width, parseFloat(col2.style.flex) || 37.5);
        if (col3) GM_setValue(STORAGE_KEYS.col3Width, parseFloat(col3.style.flex) || 37.5);
    }

    // ============= NOTES AUTO-SAVE =============
    let notesSaveTimeout = null;
    let notesObserver = null;

    function setupNotesAutoSave() {
        if (STATE.notesAutoSaveSetup) return false;

        const textarea = document.getElementById('wf-notes-textarea');
        
        if (!textarea) {
            STATE.retryCounters.notesAutoSave++;
            return false;
        }

        STATE.notesAutoSaveSetup = true;
        log('✓ Notes auto-save configured');

        textarea.addEventListener('input', () => {
            if (notesSaveTimeout) {
                clearTimeout(notesSaveTimeout);
            }
            
            notesSaveTimeout = setTimeout(() => {
                const currentValue = textarea.value;
                GM_setValue(STORAGE_KEYS.notes, currentValue);
                if (CONFIG.DEBUG_NOTES) {
                    log(`✓ Notes auto-saved (${currentValue.length} chars)`);
                }
            }, 1000);
        });

        if (!notesObserver) {
            notesObserver = new MutationObserver(() => {
                const currentTextarea = document.getElementById('wf-notes-textarea');
                if (currentTextarea && !STATE.notesAutoSaveSetup) {
                    STATE.notesAutoSaveSetup = false;
                    setupNotesAutoSave();
                }
            });

            const bottomPanel = document.getElementById('wf-bottom-panel');
            if (bottomPanel) {
                notesObserver.observe(bottomPanel, {
                    childList: true,
                    subtree: true
                });
            }
        }

        return true;
    }

    // ============= TOOL FAVORITES SYSTEM =============
    let favoriteTools = new Set();

    function loadFavorites() {
        if (STATE.favoritesInitialized) return;
        
        const saved = GM_getValue(STORAGE_KEYS.favoriteTools, '[]');
        try {
            favoriteTools = new Set(JSON.parse(saved));
            STATE.favoritesInitialized = true;
            log(`✓ Loaded ${favoriteTools.size} favorite tool(s)`);
        } catch (e) {
            log('⚠ Error loading favorites:', e);
            favoriteTools = new Set();
        }
    }

    function saveFavorites() {
        GM_setValue(STORAGE_KEYS.favoriteTools, JSON.stringify([...favoriteTools]));
    }

    function toggleFavorite(toolName) {
        if (favoriteTools.has(toolName)) {
            favoriteTools.delete(toolName);
        } else {
            favoriteTools.add(toolName);
        }
        saveFavorites();
    }

    function getToolName(toolButton) {
        const nameElement = toolButton.querySelector('div.flex.flex-col.items-start span.text-xs.font-medium.text-foreground span span');
        return nameElement ? nameElement.textContent.trim() : null;
    }

    function createStarSVG(filled = false) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', filled ? '#FFD700' : 'none');
        svg.setAttribute('stroke', filled ? '#FFD700' : 'currentColor');
        svg.setAttribute('stroke-width', '1');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.style.cssText = 'display: inline-block; vertical-align: middle;';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
        
        svg.appendChild(path);
        return svg;
    }

    function addFavoriteButton(toolButton) {
        if (toolButton.querySelector('.wf-favorite-star')) {
            return false;
        }

        const toolName = getToolName(toolButton);
        if (!toolName) return false;

        const nameContainer = toolButton.querySelector('div.flex.flex-col.items-start span.text-xs.font-medium.text-foreground');
        if (!nameContainer) return false;

        const starContainer = document.createElement('span');
        starContainer.className = 'wf-favorite-star inline-flex items-center mr-1 cursor-pointer hover:opacity-70 transition-opacity';
        starContainer.style.cssText = 'display: inline-flex; align-items: center; margin-right: 4px;';
        
        const isFavorite = favoriteTools.has(toolName);
        starContainer.appendChild(createStarSVG(isFavorite));
        
        starContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFavorite(toolName);
            
            starContainer.innerHTML = '';
            starContainer.appendChild(createStarSVG(favoriteTools.has(toolName)));
        });
        
        const toolNameSpan = nameContainer.querySelector('span');
        if (toolNameSpan) {
            const wrapper = document.createElement('span');
            wrapper.style.cssText = 'display: inline-flex; align-items: center;';
            
            const nameText = toolNameSpan.cloneNode(true);
            wrapper.appendChild(starContainer);
            wrapper.appendChild(nameText);
            
            nameContainer.replaceChild(wrapper, toolNameSpan);
        }
        
        return true;
    }

    function addFavoriteButtons() {
        loadFavorites();

        const toolsContainer = document.querySelector('#wf-col-tools > div > div > div');
        if (!toolsContainer) {
            STATE.retryCounters.favoriteButtons++;
            return false;
        }

        const toolButtons = toolsContainer.querySelectorAll('button.group\\/tool');
        
        let starsAdded = 0;
        toolButtons.forEach(button => {
            if (addFavoriteButton(button)) {
                starsAdded++;
            }
        });
        
        if (starsAdded > 0 && starsAdded !== STATE.lastStarsCount) {
            log(`✓ Added favorite stars to ${starsAdded} tool(s)`);
            STATE.lastStarsCount = starsAdded;
        }
        
        return starsAdded > 0;
    }


    // ============= MUTATION OBSERVER =============
    function initObserver() {
        const observer = new MutationObserver(() => {
            disableAutocorrectOnSearchInput();
            disableAutocorrectOnTextareas();
            addExpandCollapseButtons();
            removeTextareaGradientFade();
            createThreeColumnLayout();
            addFavoriteButtons();
            setupNotesAutoSave();
            setupBugReportExpand();
            addMiniExecuteButtons();
            addDuplicateToEndButtons();
            cleanupOrphanedDuplicateButtons();
            autoConfirmReexecuteDialog();
            addSourceDataExplorerButton();
            addSettingsButton();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('✓ Mutation observer initialized');
    }

    // ============= INITIALIZATION =============
    let initialized = false;

    function init() {
        // Prevent double initialization
        if (initialized) {
            log('⚠ Initialization already complete, skipping duplicate call');
            return;
        }
        initialized = true;

        console.log('[WF Enhancer] Version: ' + CONFIG.VERSION);
        console.log('[WF Enhancer] GitHub: https://github.com/adastra1826/fleet-ux-improvements');
        console.log('[WF Enhancer] If you have any issues, please report them to the GitHub repository. :)');

        disableAutocorrectOnSearchInput();
        disableAutocorrectOnTextareas();
        initObserver();

        console.log('[WF Enhancer] ✓ Initialization complete');
    }

    // Poll for page readiness since we're running at document-start
    function waitForPageReady() {
        const checkInterval = setInterval(() => {
            // Check if document is ready and body exists
            if (document.readyState === 'complete' || 
                (document.readyState === 'interactive' && document.body)) {
                clearInterval(checkInterval);
                init();
            }
        }, 50); // Check every 50ms
        
        // Fallback timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!initialized) {
                log('⚠ Page ready timeout reached, initializing anyway');
                init();
            }
        }, 10000);
    }

    // Start polling for page readiness
    waitForPageReady();

})();
