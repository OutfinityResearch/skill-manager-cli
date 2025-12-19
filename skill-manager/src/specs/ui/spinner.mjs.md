# Spinner Module Specification

Provides animated loading indicators for long-running operations.

## Overview

The spinner module provides both animated spinners and static status lines for showing progress during CLI operations. It supports multiple animation styles, elapsed time display, and interrupt hints.

## Constants

### SPINNER_FRAMES

Object containing animation frame sets:
- dots: Braille dot patterns (default style)
- line: Simple line rotation
- arc: Arc character rotation
- circle: Quarter circle rotation
- square: Square quadrant rotation
- bounce: Bouncing dot
- pulse: Block density pulse
- arrows: Directional arrow rotation
- clock: Clock face emoji rotation

## Spinner Class

### Constructor

Creates a new Spinner instance.

Accepts options object with optional fields:
- style: Animation style name (default "dots")
- interval: Animation frame interval in milliseconds (default from theme or 80)
- color: Spinner color name (default "cyan")
- stream: Output stream (default process.stderr)
- showInterruptHint: Show "Esc to interrupt" hint (default false)
- theme: Theme object for colors

Initializes:
- Frame array from style
- Animation interval
- Color code from theme
- Frame index counter
- Timer reference (null until started)
- Message text
- Start time for elapsed calculation
- Spinning and paused state flags

### Public Methods

#### start

Starts the spinner animation.

Accepts:
- message: Text to display (default "Processing")

Processing:
1. Return if already spinning
2. Set spinning state to true
3. Store message and start time
4. Hide terminal cursor
5. Start interval timer calling render

Returns this for chaining.

#### render

Renders current frame and message.

Output format:
- "[colored-frame] message (elapsed)"
- If showInterruptHint: Adds "Esc to interrupt" on line below

Uses ANSI escape sequences to clear and rewrite in place.

#### update

Updates the spinner message without stopping.

Accepts:
- message: New message text

Returns this for chaining.

#### pause

Temporarily stops animation for user input.

Processing:
1. Clear interval timer
2. Clear displayed line(s)
3. Show cursor
4. Set paused state

Used when prompting user during long operations.

Returns this for chaining.

#### resume

Resumes paused animation.

Processing:
1. Check paused state
2. Hide cursor
3. Restart interval timer

Returns this for chaining.

#### succeed

Stops with success indicator.

Accepts:
- message: Optional final message (defaults to current message)

Displays "✓ message (elapsed)" in green.

Returns this for chaining.

#### fail

Stops with failure indicator.

Accepts:
- message: Optional final message (defaults to current message)

Displays "✗ message (elapsed)" in yellow.

Returns this for chaining.

#### info

Stops with info indicator.

Accepts:
- message: Optional final message (defaults to current message)

Displays "ℹ message (elapsed)" in blue.

Returns this for chaining.

#### stop

Stops the spinner and optionally displays final message.

Accepts:
- finalMessage: Optional message to display

Processing:
1. Clear interval timer
2. Reset spinning and paused states
3. Clear displayed line(s)
4. Show cursor
5. Write final message with elapsed time if provided

Returns this for chaining.

### Private Methods

#### getElapsed

Calculates and formats elapsed time since start.

Returns:
- Empty string if not started
- "(Ns)" for seconds under 60
- "(Nm Ns)" for times over 60 seconds

## createSpinner Function

Factory function to create and start a spinner.

Accepts:
- message: Initial message
- options: Spinner constructor options

Returns started Spinner instance.

## StatusLine Class

Non-animated status line that updates in place.

### Constructor

Accepts:
- stream: Output stream (default process.stderr)

### Methods

#### update

Updates the status line text.

Accepts:
- message: New message

Processing:
1. Hide cursor on first call
2. Clear line and write message

Returns this for chaining.

#### clear

Clears the status line and restores cursor.

Returns this for chaining.

#### done

Displays final message with newline and restores cursor.

Accepts:
- message: Final message

Returns this for chaining.

## Terminal Control

Uses ANSI escape sequences:
- Hide cursor: ESC[?25l
- Show cursor: ESC[?25h
- Clear line: ESC[K
- Carriage return: \r

## Exports

Exports:
- Spinner class (named and default)
- createSpinner function
- StatusLine class
