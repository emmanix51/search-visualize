/* ============================================================
   Sort Visualizer — trace Bubble / Selection / Insertion line by line.

   Same design as app.js: for a given array we precompute the ENTIRE
   run as a "tape" of events up front:

       { line, note, cmp?, mov?, viz }

     line -> index into JAVA[algo], the row the code panel highlights
     note -> one sentence explaining what this line just did
     cmp  -> true if the event performed an arr[?] vs arr[?] comparison
     mov  -> true if the event wrote into the array (swap / shift / place)
     viz  -> a COMPLETE snapshot AFTER the line ran, including the array

   Because every event carries a full snapshot (array included) rather
   than a delta, stepping backwards is just re-rendering tape[cursor-1]
   — no recomputation, no state to unwind.
   ============================================================ */

(function () {
  'use strict';

  var MAX_CELLS = 20;

  /* ------------------------------------------------------------
     1. THE JAVA SOURCE — single source of truth.
        The code panel is built from these arrays and the tracers
        below emit line indices into them, so the code shown and the
        code executed can never drift apart.
     ------------------------------------------------------------ */
  var JAVA = {
    bubble: [
      'public class Main {',
      '',
      '    public static void bubbleSort(int[] arr) {',
      '        int n = arr.length;',
      '        for (int i = 0; i < n - 1; i++) {',
      '            for (int j = 0; j < n - 1 - i; j++) {',
      '                if (arr[j] > arr[j + 1]) {',
      '                    int temp = arr[j];',
      '                    arr[j] = arr[j + 1];',
      '                    arr[j + 1] = temp;',
      '                }',
      '            }',
      '        }',
      '    }',
      '',
      '    public static void main(String[] args) {',
      '        int[] arr = {7, 3, 9, 4, 1};',
      '        bubbleSort(arr);',
      '    }',
      '}'
    ],
    selection: [
      'public class Main {',
      '',
      '    public static void selectionSort(int[] arr) {',
      '        int n = arr.length;',
      '        for (int i = 0; i < n - 1; i++) {',
      '            int minIdx = i;',
      '            for (int j = i + 1; j < n; j++) {',
      '                if (arr[j] < arr[minIdx]) minIdx = j;',
      '            }',
      '            int temp = arr[i];',
      '            arr[i] = arr[minIdx];',
      '            arr[minIdx] = temp;',
      '        }',
      '    }',
      '',
      '    public static void main(String[] args) {',
      '        int[] arr = {7, 3, 9, 4, 1};',
      '        selectionSort(arr);',
      '    }',
      '}'
    ],
    insertion: [
      'public class Main {',
      '',
      '    public static void insertionSort(int[] arr) {',
      '        int n = arr.length;',
      '        for (int i = 1; i < n; i++) {',
      '            int key = arr[i];',
      '            int j = i - 1;',
      '            while (j >= 0 && arr[j] > key) {',
      '                arr[j + 1] = arr[j];',
      '                j--;',
      '            }',
      '            arr[j + 1] = key;',
      '        }',
      '    }',
      '',
      '    public static void main(String[] args) {',
      '        int[] arr = {7, 3, 9, 4, 1};',
      '        insertionSort(arr);',
      '    }',
      '}'
    ]
  };

  /* ------------------------------------------------------------
     2. TRACERS — mirror the Java above, one emit() per line.
     ------------------------------------------------------------ */

  function idxRange(a, b) {
    var r = [];
    for (var i = a; i < b; i++) r.push(i);
    return r;
  }

  function marks1(i, label) {
    var m = {};
    m[i] = label;
    return m;
  }

  function marks2(a, la, b, lb) {
    var m = {};
    m[a] = la;
    m[b] = lb;
    return m;
  }

  function baseSnap(arr, o) {
    var s = {
      arr: arr.slice(), cmp: [], swp: [], shift: [], mk: {},
      varName: null, varValue: null, sorted: [], region: [], minIdx: -1
    };
    if (o) for (var k in o) s[k] = o[k];
    return s;
  }

  function traceBubble(input) {
    var t = [];
    var arr = input.slice();
    function snap(o) { return baseSnap(arr, o); }
    function emit(line, note, viz, cmp, mov) {
      var e = { line: line, note: note, viz: viz };
      if (cmp) e.cmp = true;
      if (mov) e.mov = true;
      t.push(e);
    }

    var M = 2;
    var n = arr.length;
    emit(M + 0, 'bubbleSort(arr) is called with an array of ' + n +
            ' element' + (n === 1 ? '' : 's') + '. It will be sorted in place.', snap());
    emit(M + 1, 'int n = arr.length = ' + n + '.', snap());

    for (var i = 0; i < n - 1; i++) {
      var locked = idxRange(Math.max(n - i, 0), n);
      emit(M + 2, 'Outer pass i = ' + i + '. Check i < n - 1: ' + i + ' < ' + (n - 1) +
              ' is true, so run the pass.' +
              (i > 0 ? ' The last ' + i + ' element' + (i === 1 ? '' : 's') + ' are already locked (green).' : ''),
           snap({ sorted: locked }));

      var limit = n - 1 - i;
      for (var j = 0; j < limit; j++) {
        emit(M + 3, 'Inner: check j < n - 1 - i: ' + j + ' < ' + limit + ' is true.',
             snap({ sorted: locked, mk: marks2(j, 'j', j + 1, 'j+1') }));

        var a = arr[j], b = arr[j + 1];
        var doSwap = a > b;
        emit(M + 4, 'Compare arr[' + j + '] = ' + a + ' with arr[' + (j + 1) + '] = ' + b + ': ' +
                a + ' > ' + b + ' is ' + doSwap + ', so ' +
                (doSwap ? 'the pair is out of order — swap them.' : 'they are already in order — leave them.'),
             snap({ sorted: locked, cmp: [j, j + 1], mk: marks2(j, 'j', j + 1, 'j+1') }), true);

        if (doSwap) {
          emit(M + 5, 'int temp = arr[' + j + '] = ' + a + ' — hold the left value so it is not overwritten.',
               snap({ sorted: locked, swp: [j, j + 1], varName: 'temp', varValue: a,
                      mk: marks2(j, 'j', j + 1, 'j+1') }));
          arr[j] = arr[j + 1];
          emit(M + 6, 'arr[' + j + '] = arr[' + (j + 1) + '] — position ' + j + ' now also holds ' + arr[j] +
                  ' (a temporary duplicate).',
               snap({ sorted: locked, swp: [j, j + 1], varName: 'temp', varValue: a,
                      mk: marks2(j, 'j', j + 1, 'j+1') }), false, true);
          arr[j + 1] = a;
          emit(M + 7, 'arr[' + (j + 1) + '] = temp — position ' + (j + 1) + ' now holds ' + a + '. The swap is complete.',
               snap({ sorted: locked, swp: [j, j + 1], varName: 'temp', varValue: a,
                      mk: marks2(j, 'j', j + 1, 'j+1') }), false, true);
          emit(M + 8, 'Close the if block and move to the next pair.',
               snap({ sorted: locked, mk: marks2(j, 'j', j + 1, 'j+1') }));
        } else {
          emit(M + 8, 'The condition was false, so nothing inside the if ran. Move to the next pair.',
               snap({ sorted: locked, cmp: [j, j + 1], mk: marks2(j, 'j', j + 1, 'j+1') }));
        }
      }

      emit(M + 3, 'Inner: check j < n - 1 - i: ' + limit + ' < ' + limit +
              ' is false, so the inner loop ends.', snap({ sorted: locked }));

      var newLocked = idxRange(n - 1 - i, n);
      emit(M + 9, 'Close the inner for block. The largest remaining value has bubbled to index ' +
              (n - 1 - i) + ' — it is now locked (green).', snap({ sorted: newLocked }));
    }

    var all = idxRange(0, n);
    emit(M + 2, 'Outer: check i < n - 1: ' + (n - 1) + ' < ' + (n - 1) +
            ' is false, so the outer loop ends.', snap({ sorted: all }));
    emit(M + 10, 'Close the outer for block. Every element is in its final position.', snap({ sorted: all }));
    emit(M + 11, 'The method returns void — the array is sorted in place: ' + arr.join(', ') + '.', snap({ sorted: all }));
    return t;
  }

  function traceSelection(input) {
    var t = [];
    var arr = input.slice();
    function snap(o) { return baseSnap(arr, o); }
    function emit(line, note, viz, cmp, mov) {
      var e = { line: line, note: note, viz: viz };
      if (cmp) e.cmp = true;
      if (mov) e.mov = true;
      t.push(e);
    }

    var M = 2;
    var n = arr.length;
    emit(M + 0, 'selectionSort(arr) is called with an array of ' + n +
            ' element' + (n === 1 ? '' : 's') + '. It will be sorted in place.', snap());
    emit(M + 1, 'int n = arr.length = ' + n + '.', snap());

    for (var i = 0; i < n - 1; i++) {
      var locked = idxRange(0, i);
      emit(M + 2, 'Outer pass i = ' + i + '. Check i < n - 1: ' + i + ' < ' + (n - 1) +
              ' is true, so run the pass.' +
              (i > 0 ? ' The first ' + i + ' element' + (i === 1 ? '' : 's') + ' are already sorted (green).' : ''),
           snap({ sorted: locked }));

      var minIdx = i;
      emit(M + 3, 'int minIdx = ' + i + ' — assume the smallest value of the unsorted part is at position ' + i + '.',
           snap({ sorted: locked, minIdx: minIdx, mk: marks1(i, 'min') }));

      for (var j = i + 1; j < n; j++) {
        emit(M + 4, 'Inner: check j < n: ' + j + ' < ' + n + ' is true.',
             snap({ sorted: locked, minIdx: minIdx, mk: marks2(j, 'j', minIdx, 'min') }));

        var less = arr[j] < arr[minIdx];
        emit(M + 5, 'Compare arr[' + j + '] = ' + arr[j] + ' with the current minimum arr[' + minIdx + '] = ' + arr[minIdx] +
                ': ' + arr[j] + ' < ' + arr[minIdx] + ' is ' + less + ', so ' +
                (less ? 'this is a new smallest value — remember it.' : 'the current minimum is still the smallest.'),
             snap({ sorted: locked, cmp: [j, minIdx], minIdx: minIdx, mk: marks2(j, 'j', minIdx, 'min') }), true);

        if (less) {
          minIdx = j;
          emit(M + 5, 'minIdx = ' + j + ' — position ' + j + ' is now the smallest value seen so far.',
               snap({ sorted: locked, minIdx: minIdx, mk: marks1(minIdx, 'min') }));
        }
      }

      emit(M + 4, 'Inner: check j < n: ' + n + ' < ' + n + ' is false, so the scan ends.',
           snap({ sorted: locked, minIdx: minIdx, mk: marks1(minIdx, 'min') }));
      emit(M + 6, 'Close the inner for block. arr[' + minIdx + '] = ' + arr[minIdx] +
              ' is the smallest of the unsorted part; move it to position ' + i + '.',
           snap({ sorted: locked, minIdx: minIdx, mk: marks1(minIdx, 'min') }));

      var tmp = arr[i];
      emit(M + 7, 'int temp = arr[' + i + '] = ' + tmp + ' — save the value currently at position ' + i + '.',
           snap({ sorted: locked, minIdx: minIdx, varName: 'temp', varValue: tmp,
                  mk: marks2(i, 'i', minIdx, 'min') }));
      arr[i] = arr[minIdx];
      emit(M + 8, 'arr[' + i + '] = arr[' + minIdx + '] — position ' + i + ' now holds the smallest value ' + arr[i] + '.',
           snap({ sorted: locked, swp: [i, minIdx], varName: 'temp', varValue: tmp,
                  mk: marks2(i, 'i', minIdx, 'min') }), false, true);
      arr[minIdx] = tmp;
      emit(M + 9, 'arr[' + minIdx + '] = temp — position ' + minIdx + ' now holds ' + tmp + '. The swap is complete.',
           snap({ sorted: locked, swp: [i, minIdx], varName: 'temp', varValue: tmp,
                  mk: marks2(i, 'i', minIdx, 'min') }), false, true);
    }

    var all = idxRange(0, n);
    emit(M + 2, 'Outer: check i < n - 1: ' + (n - 1) + ' < ' + (n - 1) +
            ' is false, so the outer loop ends.', snap({ sorted: all }));
    emit(M + 10, 'Close the outer for block. Every element is sorted.', snap({ sorted: all }));
    emit(M + 11, 'The method returns void — the array is sorted in place: ' + arr.join(', ') + '.', snap({ sorted: all }));
    return t;
  }

  function traceInsertion(input) {
    var t = [];
    var arr = input.slice();
    function snap(o) { return baseSnap(arr, o); }
    function emit(line, note, viz, cmp, mov) {
      var e = { line: line, note: note, viz: viz };
      if (cmp) e.cmp = true;
      if (mov) e.mov = true;
      t.push(e);
    }

    var M = 2;
    var n = arr.length;
    emit(M + 0, 'insertionSort(arr) is called with an array of ' + n +
            ' element' + (n === 1 ? '' : 's') + '. It will be sorted in place.', snap());
    emit(M + 1, 'int n = arr.length = ' + n + '.', snap());

    for (var i = 1; i < n; i++) {
      var regionBefore = idxRange(0, i);
      emit(M + 2, 'Outer pass i = ' + i + '. Check i < n: ' + i + ' < ' + n +
              ' is true. The prefix arr[0..' + (i - 1) + '] is already sorted; element ' + i + ' is next to insert.',
           snap({ region: regionBefore }));

      var key = arr[i];
      emit(M + 3, 'int key = arr[' + i + '] = ' + key + ' — pull this value out so the cells can slide over it.',
           snap({ region: regionBefore, varName: 'key', varValue: key, mk: marks1(i, 'key') }));

      var j = i - 1;
      emit(M + 4, 'int j = i - 1 = ' + j + ' — start scanning the sorted prefix from its right end.',
           snap({ region: regionBefore, varName: 'key', varValue: key, j: j, mk: marks1(j, 'j') }));

      while (true) {
        if (j >= 0) {
          var gt = arr[j] > key;
          emit(M + 5, 'Check j >= 0 && arr[j] > key: ' + j + ' >= 0 is true, and arr[' + j + '] = ' + arr[j] +
                  ' > ' + key + ' is ' + gt + ', so ' +
                  (gt ? 'slide it one slot to the right.' : 'this is where the key belongs — stop scanning.'),
               snap({ region: regionBefore, varName: 'key', varValue: key, cmp: [j], j: j, mk: marks1(j, 'j') }), true);
          if (!gt) break;

          arr[j + 1] = arr[j];
          emit(M + 6, 'arr[' + (j + 1) + '] = arr[' + j + '] — ' + arr[j] + ' slides one slot to the right.',
               snap({ region: regionBefore, varName: 'key', varValue: key, shift: [j + 1], j: j,
                      mk: marks1(j, 'j') }), false, true);
          j--;
          emit(M + 7, 'j-- — j is now ' + j + '.',
               snap({ region: regionBefore, varName: 'key', varValue: key, j: j,
                      mk: j >= 0 ? marks1(j, 'j') : {} }));
        } else {
          emit(M + 5, 'Check j >= 0 && arr[j] > key: ' + j + ' >= 0 is false, so the while stops here. ' +
                  'Java short-circuits — arr[' + j + '] is never read.',
               snap({ region: regionBefore, varName: 'key', varValue: key, j: j }));
          break;
        }
      }

      emit(M + 8, 'Close the while block.',
           snap({ region: regionBefore, varName: 'key', varValue: key, j: j }));
      arr[j + 1] = key;
      emit(M + 9, 'arr[' + (j + 1) + '] = key — drop ' + key + ' into position ' + (j + 1) +
              '. The sorted prefix now covers arr[0..' + i + '].',
           snap({ region: idxRange(0, i + 1), varName: 'key', varValue: key, mk: marks1(j + 1, 'key') }), false, true);
    }

    var all = idxRange(0, n);
    emit(M + 2, 'Outer: check i < n: ' + n + ' < ' + n + ' is false, so the outer loop ends.',
         snap({ region: all }));
    emit(M + 10, 'Close the outer for block. Every element has been inserted into place.', snap({ region: all }));
    emit(M + 11, 'The method returns void — the array is sorted in place: ' + arr.join(', ') + '.', snap({ region: all }));
    return t;
  }

  var TRACERS = { bubble: traceBubble, selection: traceSelection, insertion: traceInsertion };

  /* ------------------------------------------------------------
     3. JAVA SYNTAX HIGHLIGHTING — single pass so spans never nest.
     ------------------------------------------------------------ */
  var TOKENS = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|\b(public|static|class|void|int|boolean|return|if|else|for|while|new|true|false|null|String|args|System|out|println|Arrays|toString)\b|\b(arr|minIdx|temp|length|key|n|i|j)\b|\b(\d+)\b/g;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightJava(src) {
    var out = '';
    var last = 0;
    var m;
    TOKENS.lastIndex = 0;
    while ((m = TOKENS.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="k">' + esc(m[3]) + '</span>';
      else if (m[4]) out += '<span class="v">' + esc(m[4]) + '</span>';
      else if (m[5]) out += '<span class="n">' + esc(m[5]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  var MARKCLASS = { 'j': 'm-j', 'j+1': 'm-j2', 'min': 'm-min', 'key': 'm-key', 'i': 'm-i' };

  /* ------------------------------------------------------------
     4. RENDERING
     ------------------------------------------------------------ */

  function buildCode(eng) {
    var body = eng.els.code;
    body.textContent = '';
    eng.lineEls = [];
    JAVA[eng.algo].forEach(function (src, li) {
      var row = document.createElement('div');
      row.className = 'code-line';

      var ln = document.createElement('span');
      ln.className = 'ln';
      ln.textContent = li + 1;

      var code = document.createElement('span');
      code.className = 'src';
      code.innerHTML = highlightJava(src);

      row.appendChild(ln);
      row.appendChild(code);
      body.appendChild(row);
      eng.lineEls.push(row);
    });
  }

  function mark(cls, text) {
    var b = document.createElement('b');
    b.className = cls;
    b.textContent = text;
    return b;
  }

  function paintStage(eng, viz) {
    var arr = viz.arr;
    var mk = eng.els.markers;
    var cl = eng.els.cells;
    var ix = eng.els.indices;
    mk.textContent = '';
    cl.textContent = '';
    ix.textContent = '';

    for (var i = 0; i < arr.length; i++) {
      var slot = document.createElement('span');
      slot.className = 'slot';
      var lbl = viz.mk[i];
      if (lbl) slot.appendChild(mark(MARKCLASS[lbl] || 'm-j', lbl));
      mk.appendChild(slot);

      var cell = document.createElement('div');
      cell.className = 'cell';

      var val = document.createElement('b');
      val.textContent = arr[i];
      var idx = document.createElement('small');
      idx.textContent = 'i=' + i;
      cell.appendChild(val);
      cell.appendChild(idx);

      if (viz.swp.indexOf(i) >= 0 || viz.shift.indexOf(i) >= 0) cell.classList.add('swap');
      else if (viz.cmp.indexOf(i) >= 0) cell.classList.add('compare');
      else if (viz.minIdx === i) cell.classList.add('min');
      else if (viz.sorted.indexOf(i) >= 0) cell.classList.add('sorted');
      else if (viz.region.indexOf(i) >= 0) cell.classList.add('region');
      cl.appendChild(cell);

      var label = document.createElement('span');
      label.textContent = i;
      ix.appendChild(label);
    }
  }

  function paintCode(eng, cursor) {
    for (var i = 0; i < eng.lineEls.length; i++) {
      var row = eng.lineEls[i];
      var isActive = i === cursor;
      row.classList.toggle('active', isActive);
      row.classList.toggle('seen', i < cursor);
    }
  }

  function paint(eng) {
    var ev = eng.tape[eng.cursor];
    if (!ev) return;

    paintStage(eng, ev.viz);
    paintCode(eng, ev.line);

    eng.els.narrText.textContent = ev.note;
    if (ev.viz.varName) {
      eng.els.varchip.textContent = ev.viz.varName + ' = ' + ev.viz.varValue;
      eng.els.varchip.hidden = false;
    } else {
      eng.els.varchip.hidden = true;
      eng.els.varchip.textContent = '';
    }
    eng.els.stepcount.textContent = 'Step ' + (eng.cursor + 1) + ' of ' + eng.tape.length;

    eng.els.back.disabled = eng.cursor === 0;
    eng.els.restart.disabled = eng.cursor === 0;
    eng.els.step.disabled = eng.cursor >= eng.tape.length - 1;
  }

  function step(eng) {
    if (eng.cursor < eng.tape.length - 1) { eng.cursor++; paint(eng); }
  }
  function back(eng) {
    if (eng.cursor > 0) { eng.cursor--; paint(eng); }
  }
  function restart(eng) { eng.cursor = 0; paint(eng); }

  /* ------------------------------------------------------------
     5. WIRING
     ------------------------------------------------------------ */

  var engines = {};
  var activeAlgo = 'bubble';

  function makeEngine(algo) {
    var pane = document.getElementById('pane-' + algo);
    var eng = {
      algo: algo,
      pane: pane,
      arr: [],
      tape: [],
      cursor: 0,
      lineEls: [],
      els: {
        markers: pane.querySelector('[data-role="markers"]'),
        cells: pane.querySelector('[data-role="cells"]'),
        indices: pane.querySelector('[data-role="indices"]'),
        narration: pane.querySelector('[data-role="narration"]'),
        narrText: pane.querySelector('[data-role="narrtext"]'),
        varchip: pane.querySelector('[data-role="varchip"]'),
        stepcount: pane.querySelector('[data-role="stepcount"]'),
        code: pane.querySelector('[data-role="code"]'),
        back: pane.querySelector('[data-role="back"]'),
        step: pane.querySelector('[data-role="step"]'),
        restart: pane.querySelector('[data-role="restart"]')
      }
    };

    buildCode(eng);

    eng.els.step.addEventListener('click', function () { step(eng); });
    eng.els.back.addEventListener('click', function () { back(eng); });
    eng.els.restart.addEventListener('click', function () { restart(eng); });

    return eng;
  }

  function readInputs() {
    var raw = document.getElementById('arrInput').value.trim();
    var parts = raw.split(/[\s,]+/).filter(function (s) { return s.length > 0; });
    if (parts.length === 0) return { err: 'Enter at least one number for the array.' };
    if (parts.length > MAX_CELLS) return { err: 'Keep it to ' + MAX_CELLS + ' elements or fewer so the array stays readable.' };

    var arr = [];
    for (var i = 0; i < parts.length; i++) {
      if (!/^-?\d+$/.test(parts[i])) {
        return { err: 'The array must contain whole numbers only, separated by commas or spaces.' };
      }
      arr.push(parseInt(parts[i], 10));
    }
    return { arr: arr };
  }

  function apply() {
    var res = readInputs();
    var errEl = document.getElementById('errMsg');
    if (res.err) {
      errEl.textContent = res.err;
      errEl.classList.add('show');
      return false;
    }
    errEl.textContent = '';
    errEl.classList.remove('show');

    for (var algo in engines) {
      var eng = engines[algo];
      eng.arr = res.arr.slice();
      eng.tape = TRACERS[algo](res.arr);
      eng.cursor = 0;
      paint(eng);
    }
    return true;
  }

  function randomize() {
    var res = readInputs();
    var n = res.err ? 6 : res.arr.length;
    n = Math.min(Math.max(n, 3), MAX_CELLS);
    var pool = [];
    for (var v = 1; v <= 99; v++) pool.push(v);
    for (var k = pool.length - 1; k > 0; k--) {
      var r = Math.floor(Math.random() * (k + 1));
      var tmp = pool[k]; pool[k] = pool[r]; pool[r] = tmp;
    }
    document.getElementById('arrInput').value = pool.slice(0, n).join(', ');
    apply();
  }

  var ACCENT_SOFT = {
    bubble: 'rgba(255,154,94,.10)',
    selection: 'rgba(179,136,255,.10)',
    insertion: 'rgba(78,203,255,.10)'
  };

  function showTab(algo) {
    activeAlgo = algo;
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.getAttribute('data-algo') === algo;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.pane').forEach(function (p) {
      var on = p.getAttribute('data-algo') === algo;
      p.classList.toggle('hidden', !on);
      p.hidden = !on;
    });
    document.body.style.setProperty('--pane-accent-soft', ACCENT_SOFT[algo]);
  }

  /* Offline verification hook: when this file is loaded outside a
     browser (Node), export the pure tracers and skip all DOM wiring. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JAVA: JAVA, TRACERS: TRACERS };
    return;
  }

  /* ---------- boot ---------- */
  engines.bubble = makeEngine('bubble');
  engines.selection = makeEngine('selection');
  engines.insertion = makeEngine('insertion');

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-algo')); });
  });

  document.getElementById('applyBtn').addEventListener('click', apply);
  document.getElementById('randomBtn').addEventListener('click', randomize);
  document.getElementById('arrInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') apply();
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var el = e.target;
    var tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (el && el.isContentEditable)) return;

    var isSpace = (e.key === ' ' || e.key === 'Spacebar');
    if (isSpace && tag === 'button') return;

    var eng = engines[activeAlgo];
    if (isSpace || e.key === 'ArrowRight') { e.preventDefault(); step(eng); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(eng); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(eng); }
    else if (e.key === '1') { showTab('bubble'); }
    else if (e.key === '2') { showTab('selection'); }
    else if (e.key === '3') { showTab('insertion'); }
  });

  showTab('bubble');
  apply();
})();
