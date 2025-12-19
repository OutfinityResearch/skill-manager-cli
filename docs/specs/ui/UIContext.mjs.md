# Design Spec: src/ui/UIContext.mjs

ID: DS(/ui/UIContext.mjs)

## Overview

**Role**: Global singleton for managing UI provider context across the application. Allows components to access UI capabilities (themes, styles) without prop drilling.

**Pattern**: Singleton with provider pattern. Central registry for the current UI provider, enabling runtime theme/style switching.

**Key Collaborators**:
- `index.mjs` - sets provider at startup
- `REPLSession` - accesses theme for styling
- All UI components - use `UIContext.getTheme()` for colors/styles
- UI providers (ClaudeCodeUIProvider, MinimalUIProvider) - implement provider interface

## What It Does

UIContext provides:

1. **Provider management**: Set, get, clear current UI provider
2. **Theme access**: Get current theme (from provider or default)
3. **Availability checking**: Safe checks before accessing provider
4. **Temporary scoping**: Execute code with temporary provider
5. **Lifecycle management**: Dispose providers on switch/clear

## How It Does It

### Singleton State
```javascript
let currentProvider = null;
let defaultTheme = baseTheme;

export const UIContext = {
    // ... methods
};
```

### Provider Management
```javascript
setProvider(provider) {
    if (!provider) {
        throw new Error('UIContext: Provider cannot be null or undefined');
    }

    // Dispose previous provider if it exists
    if (currentProvider && typeof currentProvider.dispose === 'function') {
        currentProvider.dispose();
    }

    currentProvider = provider;
}

getProvider() {
    if (!currentProvider) {
        throw new Error(
            'UIContext: No UI provider has been set. ' +
            'Call UIContext.setProvider() first, or use UIContext.hasProvider() to check.'
        );
    }
    return currentProvider;
}

getProviderIfAvailable() {
    return currentProvider; // Returns null if not set (no error)
}
```

### Theme Access
```javascript
getTheme() {
    if (currentProvider) {
        return currentProvider.theme;
    }
    return defaultTheme;
}

setDefaultTheme(theme) {
    defaultTheme = theme;
}
```

### Temporary Provider Scoping
```javascript
withProvider(tempProvider, fn) {
    const previous = currentProvider;
    currentProvider = tempProvider;
    try {
        return fn();
    } finally {
        currentProvider = previous;
    }
}

async withProviderAsync(tempProvider, fn) {
    const previous = currentProvider;
    currentProvider = tempProvider;
    try {
        return await fn();
    } finally {
        currentProvider = previous;
    }
}
```

### Cleanup
```javascript
clear() {
    if (currentProvider && typeof currentProvider.dispose === 'function') {
        currentProvider.dispose();
    }
    currentProvider = null;
}
```

## Why This Design

### 1. Singleton Pattern
**Decision**: Single global UIContext instance.

**Rationale**:
- Only one UI provider active at a time
- Avoid passing theme through every function
- Simple access from any module
- Consistent with React-like context patterns

### 2. Provider Abstraction
**Decision**: Theme comes from provider, not directly set.

**Rationale**:
- Providers can include more than theme (banners, inputs)
- Runtime style switching is provider swap
- Clean separation of UI capabilities
- Extensible for new UI features

### 3. Default Theme Fallback
**Decision**: `getTheme()` returns default if no provider set.

**Rationale**:
- Code can always get a theme
- Graceful degradation
- Initialization order flexibility
- Simplifies component code

### 4. Explicit Error on getProvider
**Decision**: Throw error if no provider and using `getProvider()`.

**Rationale**:
- Catches configuration bugs early
- Clear error message with recovery hint
- `getProviderIfAvailable()` for optional access
- Forces explicit handling of missing provider

### 5. Dispose on Switch
**Decision**: Call `dispose()` on previous provider when switching.

**Rationale**:
- Clean resource management
- Providers may hold event listeners
- Prevents memory leaks
- Standard lifecycle pattern

### 6. Scoped Execution Helpers
**Decision**: `withProvider()` for temporary provider scope.

**Rationale**:
- Useful for testing
- Guaranteed cleanup via finally
- Supports both sync and async
- Avoids manual save/restore

## Public API

### Provider Management
```javascript
UIContext.setProvider(provider)     // Set active provider (throws if null)
UIContext.getProvider()             // Get provider (throws if none)
UIContext.getProviderIfAvailable()  // Get provider or null
UIContext.hasProvider()             // Check if provider is set
UIContext.clear()                   // Remove and dispose provider
```

### Theme Access
```javascript
UIContext.getTheme()              // Get theme from provider or default
UIContext.setDefaultTheme(theme)  // Set fallback theme
```

### Scoped Execution
```javascript
UIContext.withProvider(provider, fn)       // Sync execution with temp provider
UIContext.withProviderAsync(provider, fn)  // Async execution with temp provider
```

## Provider Interface

Providers should implement:
```javascript
{
    theme: {
        colors: { cyan, green, yellow, ... },
        box: { topLeft, horizontal, ... },
        spinner: { interval, ... },
        // ... other theme properties
    },
    dispose(): void  // Optional cleanup method
}
```

## Usage Examples

### App Initialization
```javascript
import { UIContext } from './ui/UIContext.mjs';
import { ClaudeCodeUIProvider } from './ui/providers/ClaudeCodeUIProvider.mjs';

// At startup
UIContext.setProvider(new ClaudeCodeUIProvider());
```

### Component Theme Access
```javascript
import { UIContext } from './ui/UIContext.mjs';

function renderPrompt() {
    const theme = UIContext.getTheme();
    return `${theme.colors.cyan}>${theme.colors.reset} `;
}
```

### Testing with Mock Provider
```javascript
import { UIContext } from './ui/UIContext.mjs';

test('renders with custom theme', () => {
    const mockProvider = { theme: { colors: { cyan: '' } } };

    UIContext.withProvider(mockProvider, () => {
        const result = renderPrompt();
        expect(result).toBe('> ');
    });
});
```

### Safe Optional Access
```javascript
import { UIContext } from './ui/UIContext.mjs';

function maybeShowBanner() {
    const provider = UIContext.getProviderIfAvailable();
    if (provider?.banner) {
        provider.banner.showStartup();
    }
}
```

## Pseudocode

```javascript
// Module state
let currentProvider = null;
let defaultTheme = baseTheme;

UIContext = {
    setProvider(provider) {
        if (!provider) throw Error('Provider required');
        if (currentProvider?.dispose) currentProvider.dispose();
        currentProvider = provider;
    },

    getProvider() {
        if (!currentProvider) throw Error('No provider set');
        return currentProvider;
    },

    getTheme() {
        return currentProvider?.theme || defaultTheme;
    },

    hasProvider() {
        return currentProvider !== null;
    },

    withProvider(temp, fn) {
        previous = currentProvider;
        currentProvider = temp;
        try {
            return fn();
        } finally {
            currentProvider = previous;
        }
    },
};
```

## Notes/Constraints

- Not thread-safe (JavaScript is single-threaded anyway)
- Provider swap during async operation may cause issues
- Theme changes don't trigger re-renders (no observer pattern)
- Components cache theme reference for performance
- Default theme must be valid theme object
- `dispose()` is optional on providers
- No validation of provider.theme structure
- Singleton makes testing require explicit setup/teardown
