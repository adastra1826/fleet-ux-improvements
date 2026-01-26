# Cross-Browser Selector Guide

## Problem Statement

Long absolute selector paths are fragile and Safari-specific. They fail in other browsers (Chrome, Firefox, Edge) due to:
- Different DOM structure rendering
- Whitespace handling differences  
- CSS class application order
- Dynamic class name generation

**Example of fragile selector:**
```javascript
'[id="\\:rs\\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3'
```

## Solution: Robust Selector Patterns

Each plugin should implement its own robust selectors using the patterns below. No centralized helpers needed - use native DOM APIs and existing `Context.dom.query`/`queryAll`/`closest`.

---

## Pattern 1: Stable ID/Attribute + Relative Navigation

**Principle:** Start from a stable element (ID, data attribute, role) and navigate relatively.

**When to use:** When you have a stable root element (like an ID) but need to find descendants.

**Example:**
```javascript
// Instead of: '[id="\\:rs\\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3'
const panel = Context.dom.query('[id=":rs:"]', { context: `${this.id}.panel` });
if (!panel) return;

// Navigate relatively - find scrollable container
const scrollable = panel.querySelector('.overflow-y-auto');
if (!scrollable) return;

// Find tools container
const toolsArea = scrollable.querySelector('.space-y-3');
```

**Benefits:** Works even if intermediate divs change, as long as the stable root and target classes exist.

**Variations:**
- Use data attributes: `[id=":rs:"][data-panel]`
- Use role attributes: `[role="main"]`
- Combine with multiple queries for fallback

---

## Pattern 2: Text Content Matching

**Principle:** Use text content for buttons, labels, headings.

**When to use:** For interactive elements with visible, stable text content.

**Example (already used in mini-execute-buttons.js):**
```javascript
buttons.forEach(btn => {
    const btnText = btn.textContent.trim();
    if (btnText === 'Execute' || btnText === 'Re-execute') {
        executeBtn = btn;
    }
});
```

**Benefits:** Most reliable for interactive elements with visible text. Works across all browsers.

**Variations:**
- Partial match: `btnText.includes('Execute')`
- Case-insensitive: `btnText.toLowerCase() === 'execute'`
- Multiple text checks: `['Execute', 'Re-execute', 'Run'].includes(btnText)`

---

## Pattern 3: ARIA Attributes

**Principle:** Use semantic ARIA attributes that are browser-agnostic.

**When to use:** When elements have ARIA roles, labels, or state attributes.

**Examples (already used in plugins):**
```javascript
// Dialogs
const dialogs = Context.dom.queryAll('div[role="dialog"][data-state="open"]', {
    context: `${this.id}.dialogs`
});

// Expand/collapse state
const ariaExpanded = header.getAttribute('aria-expanded');
const isOpen = ariaExpanded === 'true';

// Labels
const labeledElement = Context.dom.query('[aria-label="Close"]', {
    context: `${this.id}.closeButton`
});
```

**Benefits:** ARIA attributes are standardized and reliable across browsers.

**Common ARIA attributes:**
- `role` - element role (dialog, button, menu, etc.)
- `aria-label` - accessible label
- `aria-expanded` - expand/collapse state
- `aria-describedby` - element description
- `aria-labelledby` - element label reference

---

## Pattern 4: Data Attributes

**Principle:** Use data attributes for state and identification.

**When to use:** When elements have data attributes for state management or identification.

**Examples (already used in multiple plugins):**
```javascript
// State attributes
const collapsibleRoot = Context.dom.query('div[data-state]', {
    root: card,
    context: `${this.id}.collapsibleRoot`
});
const isOpen = collapsibleRoot.getAttribute('data-state') === 'open';

// Panel identification
const panel = Context.dom.query('[id=":rs:"][data-panel]', {
    context: `${this.id}.panel`
});

// Custom data attributes
const toolCard = Context.dom.query('[data-tool-card]', {
    context: `${this.id}.toolCard`
});
```

**Benefits:** Data attributes are stable and less likely to change than CSS classes.

**Common data attributes in this codebase:**
- `data-state` - open/closed states
- `data-panel` - panel identification
- Custom data attributes for plugin-specific elements

---

## Pattern 5: Functional Selectors with Fallbacks

**Principle:** Combine multiple criteria and provide fallback strategies.

**When to use:** When a single selector might fail, or when you need multiple ways to find the same element.

**Example:**
```javascript
// Try multiple strategies
const toolbar = 
    Context.dom.query('[role="toolbar"]', { root: panel, context: 'toolbar' }) ||
    Context.dom.query('.border-b.h-9', { root: panel, context: 'toolbar' }) ||
    Array.from(panel.children).find(el => 
        el.classList.contains('border-b') && 
        el.classList.contains('h-9')
    );
```

**Benefits:** More resilient - if one approach fails, others can succeed.

**Fallback strategies:**
1. Try semantic selector first (role, data attribute)
2. Try class combination
3. Try DOM walking/programmatic search
4. Try text content matching
5. Try parent/sibling navigation

---

## Pattern 6: Placeholder/Label Text

**Principle:** For inputs, use placeholder or associated label text.

**When to use:** For form inputs, textareas, and other input elements.

**Example (already used in autocorrect-search.js):**
```javascript
const searchInput = Context.dom.query('input[placeholder="Search tools, descriptions, parameters..."]', {
    context: `${this.id}.searchInput`
});
```

**Benefits:** Placeholder text is usually stable and semantic.

**Variations:**
```javascript
// Partial placeholder match
const input = Array.from(document.querySelectorAll('input')).find(inp => 
    inp.placeholder && inp.placeholder.includes('Search')
);

// Find by associated label
const label = Array.from(document.querySelectorAll('label')).find(l => 
    l.textContent.includes('Search')
);
const input = label ? document.getElementById(label.getAttribute('for')) : null;
```

---

## Pattern 7: DOM Tree Walking

**Principle:** Walk the DOM programmatically when selectors are unreliable.

**When to use:** When CSS selectors can't express the logic you need, or when structure is too variable.

**Example:**
```javascript
// Find element by walking down the tree
function findToolsArea(panel) {
    if (!panel) return null;
    
    // Walk down looking for scrollable container with space-y-3 child
    const walker = document.createTreeWalker(
        panel,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: function(node) {
                if (node.classList.contains('overflow-y-auto')) {
                    // Check if it has a child with space-y-3
                    const child = Array.from(node.children).find(c => 
                        c.classList.contains('space-y-3')
                    );
                    if (child) return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );
    return walker.nextNode();
}
```

**Simpler walking example:**
```javascript
// Walk children programmatically
function findElementByClasses(root, requiredClasses) {
    const classes = requiredClasses.split(' ');
    const walk = (node) => {
        if (!node) return null;
        
        // Check if node has all required classes
        if (classes.every(cls => node.classList.contains(cls))) {
            return node;
        }
        
        // Check children
        for (const child of node.children) {
            const found = walk(child);
            if (found) return found;
        }
        
        return null;
    };
    
    return walk(root);
}
```

**Benefits:** Most flexible - can implement complex logic that selectors can't express.

---

## Pattern 8: Sibling/Parent Navigation

**Principle:** Use DOM relationships when structure is known.

**When to use:** When you have a reference element and know the relationship to the target.

**Examples (already used in duplicate-to-end.js):**
```javascript
// Navigate to sibling
const deleteBtn = duplicateBtn.nextElementSibling;
if (!deleteBtn || deleteBtn.tagName !== 'BUTTON') return;

// Navigate to previous sibling
const prevBtn = deleteBtn.previousElementSibling;

// Navigate up to find parent container
const card = Context.dom.closest(header, 'div.rounded-lg.border.transition-colors', {
    context: `${this.id}.toolCard`
});

// Navigate up with multiple checks
let parent = element.parentElement;
while (parent && !parent.classList.contains('target-class')) {
    parent = parent.parentElement;
}
```

**Benefits:** Works when you have a reference element and know the relationship.

**Common navigation methods:**
- `element.nextElementSibling` - next sibling
- `element.previousElementSibling` - previous sibling
- `element.parentElement` - parent
- `element.children` - direct children
- `Context.dom.closest(element, selector)` - closest ancestor matching selector

---

## Real-World Migration Examples

### Example 1: Workflow Tools Area

**Current (fragile):**
```javascript
selectors: {
    workflowToolsArea: '[id="\\:rs\\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3'
}
```

**Robust approach:**
```javascript
// In plugin's onMutation method
const panel = Context.dom.query('[id=":rs:"]', { context: `${this.id}.panel` });
if (!panel) return;

// Strategy 1: Try finding by class combination within panel
let toolsArea = panel.querySelector('.space-y-3');
if (toolsArea && toolsArea.closest('[id=":rs:"]') === panel) {
    // Found it - verify it's within the right container
    const scrollable = toolsArea.closest('.overflow-y-auto');
    if (!scrollable || !panel.contains(scrollable)) {
        toolsArea = null; // Wrong element, try another strategy
    }
}

// Strategy 2: Walk down to find scrollable, then space-y-3
if (!toolsArea) {
    const scrollable = panel.querySelector('.overflow-y-auto');
    if (scrollable) {
        toolsArea = scrollable.querySelector('.space-y-3');
    }
}

// Strategy 3: Walk programmatically
if (!toolsArea) {
    const walker = document.createTreeWalker(
        panel,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: function(node) {
                if (node.classList.contains('overflow-y-auto')) {
                    const child = node.querySelector('.space-y-3');
                    if (child) return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );
    const scrollable = walker.nextNode();
    if (scrollable) {
        toolsArea = scrollable.querySelector('.space-y-3');
    }
}
```

---

### Example 2: Toolbar

**Current (fragile):**
```javascript
selectors: {
    toolbar: '[id="\\:rs\\:"] > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center'
}
```

**Robust approach:**
```javascript
const panel = Context.dom.query('[id=":rs:"]', { context: `${this.id}.panel` });
if (!panel) return;

// Find toolbar by multiple strategies
let toolbar = null;

// Strategy 1: Look for role attribute
toolbar = panel.querySelector('[role="toolbar"]');

// Strategy 2: Find element with border-b and h-9 classes
if (!toolbar) {
    const candidates = panel.querySelectorAll('.border-b.h-9');
    toolbar = Array.from(candidates).find(el => 
        el.classList.contains('flex') && 
        el.classList.contains('items-center')
    );
}

// Strategy 3: Walk children looking for toolbar-like structure
if (!toolbar) {
    toolbar = Array.from(panel.children).find(child => {
        const inner = child.querySelector('.flex.items-center');
        return inner && child.classList.contains('border-b');
    });
}

// Strategy 4: Find by specific class combination (fewer classes = more flexible)
if (!toolbar) {
    toolbar = panel.querySelector('.border-b.h-9 .flex.items-center');
}
```

---

### Example 3: Long Body Path

**Current (fragile):**
```javascript
selectors: {
    toolbar: 'body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > div.w-full.h-full.bg-background.rounded-sm.relative.flex.flex-col.min-w-0.overflow-hidden.border-\\[0\\.5px\\].shadow-\\[0_0_15px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\] > div > div.flex.items-center.gap-2.px-4.py-2.border-b'
}
```

**Robust approach:**
```javascript
// Strategy 1: Use semantic HTML
let main = document.querySelector('main');
if (!main) {
    // Strategy 2: Use role attribute
    main = document.querySelector('[role="main"]');
}
if (!main) {
    // Strategy 3: Find by data attribute if available
    main = document.querySelector('[data-main]');
}
if (!main) {
    // Strategy 4: Find main by walking from body
    const bodyChildren = Array.from(document.body.children);
    main = bodyChildren.find(child => 
        child.tagName === 'MAIN' || 
        child.getAttribute('role') === 'main'
    );
}

if (main) {
    // Now navigate relatively from stable root
    const toolbar = main.querySelector('.border-b') ||
                    Array.from(main.children).find(el => 
                        el.classList.contains('border-b') &&
                        el.classList.contains('flex') &&
                        el.classList.contains('items-center')
                    );
}
```

---

## Migration Checklist

When updating a plugin's selectors:

- [ ] Identify all fragile selectors (long absolute paths with `>` chains)
- [ ] Find stable root elements (IDs, data attributes, semantic elements)
- [ ] Replace absolute paths with relative navigation from stable roots
- [ ] Add fallback strategies for critical selectors
- [ ] Test in Chrome, Firefox, Edge, and Safari
- [ ] Verify selectors work when DOM structure changes slightly
- [ ] Update plugin version number per `.cursorrules` (minor tweak = +0.1, significant rewrite = +1)
- [ ] Run `./utils/update-archetypes.js` if version changed

---

## Best Practices

1. **Start from stable roots:** Always begin with IDs, data attributes, or semantic elements (main, nav, etc.)

2. **Use relative navigation:** Once you have a stable root, use `querySelector`/`querySelectorAll` with relative selectors or DOM walking

3. **Provide fallbacks:** Implement multiple strategies - if one fails, try another

4. **Test in multiple browsers:** Verify each selector works in Chrome, Firefox, Edge, and Safari

5. **Use existing patterns:** Look at plugins that already use robust selectors:
   - `autocorrect-search.js` - uses placeholder text
   - `mini-execute-buttons.js` - uses text content matching
   - `expand-collapse-buttons.js` - uses ARIA attributes and data-state
   - `request-revisions.js` - uses role attributes

6. **Avoid absolute paths:** Never use selectors with `>` chains longer than 2-3 levels

7. **Combine strategies:** Use multiple criteria (text + class + attribute) for more reliable identification

8. **Keep it simple:** Prefer simpler selectors over complex ones - they're more maintainable

9. **Document complex logic:** If you use DOM walking or complex fallbacks, add comments explaining why

10. **Handle nulls gracefully:** Always check for null/undefined before using elements

---

## Common Pitfalls to Avoid

1. **Don't rely on class order:** `div.class1.class2` may not work if classes are applied in different order
   - Instead: Check for each class individually or use `classList.contains()`

2. **Don't assume DOM structure:** Intermediate divs may be added/removed
   - Instead: Use relative navigation or DOM walking

3. **Don't use too many classes:** Long class chains are fragile
   - Instead: Use fewer, more distinctive classes or combine with other attributes

4. **Don't ignore whitespace:** Text content matching should use `.trim()`
   - Instead: `element.textContent.trim() === 'Expected Text'`

5. **Don't forget fallbacks:** Single-strategy selectors can break
   - Instead: Provide multiple ways to find the same element

---

## Quick Reference

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Stable ID + Relative | Have stable root, need descendants | `panel.querySelector('.target')` |
| Text Content | Buttons, labels with visible text | `btn.textContent.trim() === 'Execute'` |
| ARIA Attributes | Elements with semantic attributes | `[role="dialog"]`, `aria-expanded` |
| Data Attributes | State or identification | `[data-state="open"]` |
| Fallbacks | Critical elements that must be found | Try multiple strategies with `\|\|` |
| Placeholder/Label | Form inputs | `input[placeholder="Search..."]` |
| DOM Walking | Complex structure, variable paths | `createTreeWalker()` or recursive walk |
| Sibling/Parent | Known relationship from reference | `element.nextElementSibling` |

---

## Questions to Ask When Migrating

1. **What's the most stable identifier?** (ID, data attribute, role, text content?)
2. **Can I find it by text content?** (Most reliable for interactive elements)
3. **Are there ARIA attributes?** (Standardized, browser-agnostic)
4. **Can I navigate relatively?** (From stable root to target)
5. **What if the structure changes slightly?** (Add fallbacks)
6. **Does this work in all browsers?** (Test in Chrome, Firefox, Edge, Safari)

---

*This guide should be updated as new patterns are discovered or existing patterns are refined.*
