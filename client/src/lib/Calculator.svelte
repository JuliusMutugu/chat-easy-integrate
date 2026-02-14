<script>
  import { tick } from "svelte";
  /**
   * Simple calculator for quick math during negotiations.
   * Optional onInsertResult callback to insert the display value into chat.
   */
  let { onInsertResult = () => {} } = $props();
  let calcEl;
  $effect(() => {
    if (calcEl) {
      tick().then(() => calcEl?.focus());
    }
  });

  let display = $state("0");
  let previous = $state(null);
  let operation = $state(null);
  let fresh = $state(true);

  function inputDigit(d) {
    if (fresh) {
      display = String(d);
      fresh = false;
    } else {
      if (display === "0" && d !== ".") display = String(d);
      else if (d === "." && display.includes(".")) return;
      else display += String(d);
    }
  }

  function normalizeOp(op) {
    if (op === "−" || op === "-") return "-";
    if (op === "×" || op === "*") return "*";
    if (op === "÷" || op === "/") return "/";
    return op === "+" ? "+" : null;
  }

  function inputOp(op) {
    const normalized = normalizeOp(op);
    if (normalized == null) return;
    const rawNum = parseFloat(display);
    const num = Number.isNaN(rawNum) ? 0 : rawNum;
    if (previous != null && operation !== null) {
      const result = compute(previous, num, operation);
      const rounded = Number.isInteger(result) ? result : Math.round(result * 1e6) / 1e6;
      display = String(rounded);
      previous = rounded;
      operation = normalized;
    } else {
      previous = num;
      operation = normalized;
    }
    fresh = true;
  }

  function compute(a, b, op) {
    const aa = Number.isNaN(a) ? 0 : a;
    const bb = Number.isNaN(b) ? 0 : b;
    switch (op) {
      case "+": return aa + bb;
      case "-": return aa - bb;
      case "*": return aa * bb;
      case "/": return bb === 0 ? 0 : aa / bb;
      default: return bb;
    }
  }

  function equals() {
    const rawNum = parseFloat(display);
    const num = Number.isNaN(rawNum) ? 0 : rawNum;
    if (previous != null && operation !== null) {
      const result = compute(previous, num, operation);
      display = String(Number.isInteger(result) ? result : Math.round(result * 1e6) / 1e6);
      previous = null;
      operation = null;
    }
    fresh = true;
  }

  function clearDisplay() {
    display = "0";
    previous = null;
    operation = null;
    fresh = true;
  }

  function insertResult() {
    const value = display.replace(/^0+(\d)/, "$1") || "0";
    onInsertResult(value);
  }

  function handleKeydown(e) {
    const key = e.key;
    if (key >= "0" && key <= "9") {
      e.preventDefault();
      inputDigit(parseInt(key, 10));
      return;
    }
    if (key === "Numpad0" || key === "Numpad1" || key === "Numpad2" || key === "Numpad3" || key === "Numpad4" ||
        key === "Numpad5" || key === "Numpad6" || key === "Numpad7" || key === "Numpad8" || key === "Numpad9") {
      e.preventDefault();
      inputDigit(parseInt(key.replace("Numpad", ""), 10));
      return;
    }
    if (key === "." || key === "NumpadDecimal") {
      e.preventDefault();
      inputDigit(".");
      return;
    }
    if (key === "+" || key === "NumpadAdd") {
      e.preventDefault();
      inputOp("+");
      return;
    }
    if (key === "-" || key === "NumpadSubtract") {
      e.preventDefault();
      inputOp("-");
      return;
    }
    if (key === "*" || key === "NumpadMultiply") {
      e.preventDefault();
      inputOp("*");
      return;
    }
    if (key === "/" || key === "NumpadDivide") {
      e.preventDefault();
      inputOp("/");
      return;
    }
    if (key === "Enter" || key === "=" || key === "NumpadEnter") {
      e.preventDefault();
      equals();
      return;
    }
    if (key === "Escape" || key === "c" || key === "C") {
      e.preventDefault();
      clearDisplay();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="calculator" bind:this={calcEl} tabindex="-1" role="application" aria-label="Calculator" onkeydown={handleKeydown}>
  <div class="calc-display" aria-live="polite">{display}</div>
  <div class="calc-buttons">
    <button type="button" class="calc-btn calc-op" onclick={clearDisplay}>C</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("/")}>÷</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("*")}>×</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("-")}>−</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(7)}>7</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(8)}>8</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(9)}>9</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("+")}>+</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(4)}>4</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(5)}>5</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(6)}>6</button>
    <button type="button" class="calc-btn calc-eq" onclick={equals}>=</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(1)}>1</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(2)}>2</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(3)}>3</button>
    <button type="button" class="calc-btn calc-zero" onclick={() => inputDigit(0)}>0</button>
    <button type="button" class="calc-btn" onclick={() => inputDigit(".")}>.</button>
    <button type="button" class="calc-btn calc-insert" onclick={insertResult}>Insert result</button>
  </div>
</div>

<style>
  .calculator {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 1px solid var(--border);
  }

  .calc-display {
    font-size: 1.5rem;
    font-weight: 600;
    text-align: right;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
    border: 2px solid var(--border);
    border-radius: 8px;
    margin-bottom: 0.75rem;
    font-family: ui-monospace, monospace;
    color: var(--text-primary);
  }

  .calc-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .calc-btn {
    padding: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    border: 2px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .calc-btn:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .calc-op {
    background: var(--navy-100);
    color: var(--navy-800);
  }

  .calc-op:hover {
    background: var(--navy-200);
  }

  .calc-eq {
    background: var(--green-600);
    color: var(--white);
    border-color: var(--green-600);
  }

  .calc-eq:hover {
    background: var(--green-700);
    border-color: var(--green-700);
  }

  .calc-zero {
    grid-column: span 1;
  }

  .calc-insert {
    grid-column: span 2;
    font-size: 0.875rem;
    background: var(--green-100);
    color: var(--green-800);
    border-color: var(--green-400);
  }

  .calc-insert:hover {
    background: var(--green-200);
    border-color: var(--green-500);
  }
</style>
