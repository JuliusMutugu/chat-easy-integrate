<script>
  /**
   * Simple calculator for quick math during negotiations.
   * Optional onInsertResult callback to insert the display value into chat.
   */
  let { onInsertResult = () => {} } = $props();

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

  function inputOp(op) {
    const num = parseFloat(display);
    if (previous != null && operation) {
      const result = compute(previous, num, operation);
      display = String(Number.isInteger(result) ? result : Math.round(result * 1e6) / 1e6);
      previous = null;
      operation = null;
    } else {
      previous = num;
    }
    operation = op;
    fresh = true;
  }

  function compute(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? 0 : a / b;
      default: return b;
    }
  }

  function equals() {
    const num = parseFloat(display);
    if (previous != null && operation) {
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
</script>

<div class="calculator">
  <div class="calc-display" aria-live="polite">{display}</div>
  <div class="calc-buttons">
    <button type="button" class="calc-btn calc-op" onclick={clearDisplay}>C</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("÷")}>÷</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("×")}>×</button>
    <button type="button" class="calc-btn calc-op" onclick={() => inputOp("−")}>−</button>
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
