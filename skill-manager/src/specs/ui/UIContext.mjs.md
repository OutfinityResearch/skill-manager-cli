# UIContext Module Specification

Global singleton for managing UI provider context across the application.

## Overview

UIContext provides a centralized way to manage the current UI provider, allowing components to access UI capabilities without prop drilling. It supports provider switching, theme access, and temporary provider scoping.

## Module State

The module maintains:
- currentProvider: Currently active UI provider instance (null initially)
- defaultTheme: Theme used when no provider is set (baseTheme initially)

## UIContext Object

Singleton object with the following methods:

### setProvider

Sets the current UI provider.

Accepts:
- provider: UIProvider implementation object

Processing:
1. Throw error if provider is null or undefined
2. If previous provider exists and has dispose method, call it
3. Set currentProvider to new provider

### getProvider

Gets the current UI provider.

Returns the current UIProvider instance.

Throws error if no provider has been set.

### getTheme

Gets the current theme.

Processing:
1. If provider is set, return provider.theme
2. Otherwise return defaultTheme

Returns theme object.

### setDefaultTheme

Sets the default theme used when no provider is set.

Accepts:
- theme: Theme object

### hasProvider

Checks if a provider is currently set.

Returns boolean.

### getProviderIfAvailable

Gets provider without throwing error.

Returns current UIProvider or null if not set.

Useful for optional UI operations.

### clear

Clears the current provider.

Processing:
1. If current provider exists and has dispose method, call it
2. Set currentProvider to null

### withProvider

Executes function with a temporary provider.

Accepts:
- tempProvider: Provider to use temporarily
- fn: Function to execute

Processing:
1. Save current provider
2. Set temp provider as current
3. Execute function
4. Restore previous provider (even if fn throws)

Returns result of fn().

### withProviderAsync

Executes async function with a temporary provider.

Accepts:
- tempProvider: Provider to use temporarily
- fn: Async function to execute

Processing:
1. Save current provider
2. Set temp provider as current
3. Await function execution
4. Restore previous provider (even if fn throws)

Returns promise resolving to result of fn().

## Usage Pattern

Initialization at app startup:
1. Import UIContext
2. Create provider instance
3. Call UIContext.setProvider(provider)

Access from any component:
1. Call UIContext.getTheme() for theme access
2. Call UIContext.getProvider() for full provider access

Optional access pattern:
1. Check UIContext.hasProvider()
2. Or use UIContext.getProviderIfAvailable()

Testing pattern:
1. Use UIContext.withProvider(mockProvider, testFn)
2. Provider automatically restored after test

## Provider Interface

Providers are expected to have:
- theme: Theme object with colors, box characters, etc.
- dispose(): Optional cleanup method

Additional methods depend on provider implementation.

## Exports

Exports:
- UIContext object (named and default)
