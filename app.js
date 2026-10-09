/* ============================================================
   Search Visualizer — trace the Java line by line.

   Design note (the important bit):
   For a given array + target we precompute the ENTIRE run as a
   "tape" of events up front:

       { line, note, cmp?, viz }

     line -> index into JAVA[algo], the row the code panel highlights
     note -> one sentence explaining what this line just did
     cmp  -> true if this event performed an arr[?] == target comparison
     viz  -> a COMPLETE snapshot of the array state after the line ran

   Because every event carries a full snapshot rather than a delta,
   stepping backwards is just re-rendering tape[cursor - 1] — no
   recomputation, no state to unwind. That is what makes Back work.
   ============================================================ */

(function () {
  'use strict';

  var MAX_CELLS = 24;

  /* ------------------------------------------------------------
     1. THE JAVA SOURCE — single source of truth.
        The code panel is built from these arrays and the tracers
        below emit line indices into them, so the code shown and
        the code executed can never drift apart.
     ------------------------------------------------------------ */
  var JAVA = {
    linear: [
      'public static int linearSearch(int[] arr, int target) {',
      '    for (int i = 0; i < arr.length; i++) {',
      '        if (arr[i] == target) {',
      '            return i;',
      '        }',
      '    }',
      '    return -1;',
      '}'
    ],
    binary: [
      'public static int binarySearch(int[] arr, int target) {',
      '    int low = 0;',
      '    int high = arr.length - 1;',
      '',
      '    while (low <= high) {',
      '        int mid = (low + high) / 2;',
      '        if (arr[mid] == target) {',
      '            return mid;',
      '        } else if (arr[mid] < target) {',
      '            low = mid + 1;',
      '        } else {',
      '            high = mid - 1;',
      '        }',
      '    }',
      '    return -1;',
      '}'
    ]
  };

  /* ------------------------------------------------------------
     2. TRACERS — mirror the Java above, one emit() per line.
     ------------------------------------------------------------ */

  function traceLinear(arr, target) {
    var t = [];
    function snap(o) {
      var s = { i: -1, elim: [], found: -1, notFound: false };
      if (o) for (var k in o) s[k] = o[k];
      return s;
    }
    function emit(line, note, viz, cmp) {
      var e = { line: line, note: note, viz: viz };
      if (cmp) e.cmp = true;
      t.push(e);
    }

    emit(0, 'linearSearch(arr, target) is called with an array of ' + arr.length +
            ' element' + (arr.length === 1 ? '' : 's') + ' and target = ' + target + '.', snap());

    var i = 0;
    var elim = [];

    emit(1, 'int i = 0 — the scan starts at the first index.', snap());

    while (i < arr.length) {
      emit(1, 'Check i < arr.length: ' + i + ' < ' + arr.length +
              ' is true, so run the loop body.', snap({ elim: elim.slice(), i: i }));

      emit(2, 'Compare arr[' + i + '] = ' + arr[i] + ' with target ' + target +
              ' — not equal, so the if body is skipped.',
           snap({ elim: elim.slice(), i: i }), true);

      if (arr[i] === target) {
        emit(3, 'arr[' + i + '] == target is true, so the body runs: return ' + i +
                '. The loop never runs again.', snap({ elim: elim.slice(), i: i, found: i }));
        return t;
      }

      emit(4, 'The condition was false, so nothing inside the if ran. Close the block and go back to the top of the loop.',
           snap({ elim: elim.slice(), i: i }));

      elim.push(i);
      i++;
      emit(1, 'i++ — i is now ' + i + '.', snap({ elim: elim.slice() }));
    }

    emit(1, 'Check i < arr.length: ' + i + ' < ' + arr.length +
            ' is false. The loop ends.', snap({ elim: elim.slice() }));
    emit(5, 'Close the for block.', snap({ elim: elim.slice() }));
    emit(6, 'Every index was checked and none matched, so return -1. In Java that -1 is how the caller learns the target is not in the array.',
           snap({ elim: elim.slice(), notFound: true }));

    return t;
  }

  function traceBinary(arr, target) {
    var t = [];
    function snap(o) {
      var s = { low: -1, high: -1, mid: -1, found: -1, notFound: false };
      if (o) for (var k in o) s[k] = o[k];
      return s;
    }
    function emit(line, note, viz, cmp) {
      var e = { line: line, note: note, viz: viz };
      if (cmp) e.cmp = true;
      t.push(e);
    }

    emit(0, 'binarySearch(arr, target) is called with an array of ' + arr.length +
            ' element' + (arr.length === 1 ? '' : 's') + ' and target = ' + target + '.', snap());
    emit(1, 'int low = 0 — the search window opens at the first index.', snap({ low: 0 }));
    emit(2, 'int high = arr.length - 1 = ' + (arr.length - 1) +
            ' — the window reaches the last index. Right now the whole array is still in play.',
           snap({ low: 0, high: arr.length - 1 }));

    var low = 0;
    var high = arr.length - 1;

    while (low <= high) {
      emit(4, 'Check low <= high: ' + low + ' <= ' + high +
              ' is true, so run the loop body.', snap({ low: low, high: high }));

      var sum = low + high;
      var mid = Math.floor(sum / 2);
      emit(5, 'int mid = (' + low + ' + ' + high + ') / 2 = ' + sum + ' / 2 = ' + mid +
              '. Java drops the decimal when both sides are int. mid is the middle of the window.',
           snap({ low: low, high: high, mid: mid }));

      if (arr[mid] === target) {
        emit(6, 'arr[' + mid + '] = ' + arr[mid] + ' == target ' + target +
                ' — they are equal, so the body runs.', snap({ low: low, high: high, mid: mid }), true);
        emit(7, 'return ' + mid + '. The target is at index ' + mid +
                ' and the search stops here — everything outside the window was already thrown away.',
               snap({ low: low, high: high, mid: mid, found: mid }));
        return t;
      }

      emit(6, 'arr[' + mid + '] = ' + arr[mid] + ' == target ' + target +
              ' — not equal, so fall through to the else if.', snap({ low: low, high: high, mid: mid }), true);

      if (arr[mid] < target) {
        emit(8, 'Check arr[' + mid + '] = ' + arr[mid] + ' < ' + target +
                ' — true, so the target has to be somewhere to the RIGHT of mid.',
               snap({ low: low, high: high, mid: mid }));
        emit(9, 'low = mid + 1 = ' + (mid + 1) + '. Everything from index 0 to ' + mid +
                ' is now outside the window and is never looked at again — half the array just disappeared.',
               snap({ low: mid + 1, high: high, mid: mid }));
        low = mid + 1;
      } else {
        emit(8, 'Check arr[' + mid + '] = ' + arr[mid] + ' < ' + target +
                ' — false, so the plain else runs: the target has to be to the LEFT of mid.',
               snap({ low: low, high: high, mid: mid }));
        emit(11, 'high = mid - 1 = ' + (mid - 1) + '. Everything from index ' + mid + ' to ' +
                 (arr.length - 1) + ' is outside the window and is never looked at again — half the array just disappeared.',
               snap({ low: low, high: mid - 1, mid: mid }));
        high = mid - 1;
      }

      emit(12, 'Close the if/else and loop back to the while.', snap({ low: low, high: high }));
    }

    emit(4, 'Check low <= high: ' + low + ' <= ' + high +
            ' is false. The window is empty, so the loop ends.', snap({ low: low, high: high }));
    emit(13, 'Close the while block.', snap({ low: low, high: high }));
    emit(14, 'The window closed without a match, so return -1. On sorted data that is proof the target is not in the array.',
           snap({ low: low, high: high, notFound: true }));

    return t;
  }

  var TRACERS = { linear: traceLinear, binary: traceBinary };

  var PRESETS = {
    'linear-found':   { arr: [3, 7, 1, 9, 5, 8, 2, 6], target: 9 },
    'linear-missing': { arr: [3, 7, 1, 9, 5, 8, 2, 6], target: 4 },
    'binary-found':   { arr: [2, 5, 8, 12, 19, 23, 31, 44], target: 23 },
    'binary-missing': { arr: [2, 5, 8, 12, 19, 23, 31, 44], target: 50 }
  };

  /* ------------------------------------------------------------
     3. JAVA SYNTAX HIGHLIGHTING — single pass so spans never nest.
     ------------------------------------------------------------ */
  var TOKENS = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|\b(public|static|class|void|int|boolean|return|if|else|for|while|new|true|false|null)\b|\b(arr|target|i|low|high|mid|length)\b|\b(\d+)\b/g;

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

  /* ------------------------------------------------------------
     4. RENDERING
     ------------------------------------------------------------ */

  function buildCode(eng) {
    var body = eng.els.code;
    body.textContent = '';
    eng.lineEls = [];
    JAVA[eng.algo].forEach(function (src, li) {
      var row = document.createElement('div');
      row.className = 'code-line' + (src.length === 0 ? ' blank' : '');

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

  function paintStage(eng, viz) {
    var arr = eng.arr;
    var mk = eng.els.markers;
    var cl = eng.els.cells;
    var ix = eng.els.indices;
    mk.textContent = '';
    cl.textContent = '';
    ix.textContent = '';

    for (var i = 0; i < arr.length; i++) {
      /* pointer / boundary markers above the cells */
      var slot = document.createElement('span');
      slot.className = 'slot';

      if (eng.algo === 'linear') {
        if (viz.i === i) slot.appendChild(mark('m-i', '▼'));
      } else {
        if (viz.low === i) slot.appendChild(mark('m-l', 'L'));
        if (viz.mid === i) slot.appendChild(mark('m-m', 'M'));
        if (viz.high === i) slot.appendChild(mark('m-h', 'H'));
      }
      mk.appendChild(slot);

      /* the cell itself */
      var cell = document.createElement('div');
      cell.className = 'cell';

      var val = document.createElement('b');
      val.textContent = arr[i];
      var idx = document.createElement('small');
      idx.textContent = 'i=' + i;
      cell.appendChild(val);
      cell.appendChild(idx);

      if (viz.found === i) {
        cell.classList.add('found');
      } else if (eng.algo === 'linear') {
        if (viz.elim.indexOf(i) >= 0) cell.classList.add('elim');
        else if (viz.i === i) cell.classList.add('cur');
      } else {
        if (viz.low >= 0 && viz.high >= 0 && (i < viz.low || i > viz.high)) cell.classList.add('elim');
        else if (viz.mid === i) cell.classList.add('cur');
      }
      cl.appendChild(cell);

      var label = document.createElement('span');
      label.textContent = i;
      ix.appendChild(label);
    }
  }

  function mark(cls, text) {
    var b = document.createElement('b');
    b.className = cls;
    b.textContent = text;
    return b;
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

    eng.els.narration.textContent = ev.note;
    eng.els.stepcount.textContent = 'Step ' + (eng.cursor + 1) + ' of ' + eng.tape.length;

    var cmps = 0;
    for (var i = 0; i <= eng.cursor; i++) if (eng.tape[i].cmp) cmps++;
    eng.els.cmpcount.textContent = 'comparisons: ' + cmps;

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
  var activeAlgo = 'linear';

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
        stepcount: pane.querySelector('[data-role="stepcount"]'),
        cmpcount: pane.querySelector('[data-role="cmpcount"]'),
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

    pane.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = PRESETS[btn.getAttribute('data-preset')];
        document.getElementById('arrInput').value = p.arr.join(', ');
        document.getElementById('targetInput').value = String(p.target);
        apply();
      });
    });

    return eng;
  }

  function readInputs() {
    var raw = document.getElementById('arrInput').value.trim();
    var traw = document.getElementById('targetInput').value.trim();

    var parts = raw.split(/[\s,]+/).filter(function (s) { return s.length > 0; });
    if (parts.length === 0) return { err: 'Enter at least one element for the array.' };
    if (parts.length > MAX_CELLS) return { err: 'Keep it to ' + MAX_CELLS + ' elements or fewer so the array stays readable.' };

    var arr = [];
    for (var i = 0; i < parts.length; i++) {
      if (!/^-?\d+$/.test(parts[i])) {
        return { err: 'The array must contain whole numbers only, separated by commas or spaces.' };
      }
      arr.push(parseInt(parts[i], 10));
    }

    if (traw === '' || !/^-?\d+$/.test(traw)) return { err: 'The target must be a whole number.' };

    return { arr: arr, target: parseInt(traw, 10) };
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
      eng.tape = TRACERS[algo](res.arr, res.target);
      eng.cursor = 0;
      paint(eng);
    }
    return true;
  }

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
    document.body.style.setProperty('--pane-accent-soft',
      algo === 'binary' ? 'rgba(47,211,164,.10)' : 'rgba(78,168,255,.10)');
  }

  /* ---------- boot ---------- */
  engines.linear = makeEngine('linear');
  engines.binary = makeEngine('binary');

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-algo')); });
  });

  document.getElementById('applyBtn').addEventListener('click', apply);
  document.getElementById('arrInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') apply();
  });
  document.getElementById('targetInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') apply();
  });
  document.getElementById('sortBtn').addEventListener('click', function () {
    var res = readInputs();
    var arr = res.err ? [] : res.arr.slice();
    arr.sort(function (a, b) { return a - b; });
    document.getElementById('arrInput').value = arr.join(', ');
    apply();
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var el = e.target;
    var tag = (el && el.tagName) ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (el && el.isContentEditable)) return;

    /* Space on a focused button should activate the button, not also step. */
    var isSpace = (e.key === ' ' || e.key === 'Spacebar');
    if (isSpace && tag === 'button') return;

    var eng = engines[activeAlgo];
    if (isSpace || e.key === 'ArrowRight') { e.preventDefault(); step(eng); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(eng); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(eng); }
    else if (e.key === '1') { showTab('linear'); }
    else if (e.key === '2') { showTab('binary'); }
  });

  showTab('linear');
  apply();
})();