// ===================================================================
// GMON32 · Simulador V/F — lógica de la aplicación
// ===================================================================
(function () {
  "use strict";

  const LS_KEYS = {
    missed: "gmon32_missed_v1",
    best: "gmon32_best_v1",
    runs: "gmon32_runs_v1",
  };

  // ---------- Utilidades de almacenamiento ----------
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* almacenamiento no disponible, se ignora */
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Estado ----------
  const state = {
    unit: "all",
    count: "20",
    mode: "study",
    queue: [],
    idx: 0,
    answers: [], // {q, picked, correct}
    locked: false,
    missedIds: loadJSON(LS_KEYS.missed, []),
    best: loadJSON(LS_KEYS.best, null),
    runs: loadJSON(LS_KEYS.runs, 0),
  };

  // ---------- Referencias DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    home: $("#screen-home"),
    quiz: $("#screen-quiz"),
    summary: $("#screen-summary"),
    review: $("#screen-review"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => (s.style.display = "none"));
    screens[name].style.display = "flex";
    window.scrollTo(0, 0);
  }

  // ---------- Home: segmented controls ----------
  function wireSegmented(groupEl, onChange) {
    const buttons = groupEl.querySelectorAll(".seg-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        onChange(btn.dataset.value);
      });
    });
  }

  wireSegmented($("#group-unit"), (v) => (state.unit = v));
  wireSegmented($("#group-count"), (v) => (state.count = v));
  wireSegmented($("#group-mode"), (v) => (state.mode = v));

  function renderHomeStats() {
    $("#stat-total").textContent = QUESTION_BANK.length;
    $("#total-count-sub").textContent = QUESTION_BANK.length + " preg.";
    $("#stat-best").textContent = state.best === null ? "—" : state.best + "%";
    $("#stat-runs").textContent = state.runs;
    $("#missed-pill").textContent = state.missedIds.length;
  }
  renderHomeStats();

  // ---------- Construir cola de preguntas ----------
  function poolForUnit(unit) {
    if (unit === "all") return QUESTION_BANK;
    const u = parseInt(unit, 10);
    return QUESTION_BANK.filter((q) => q.u === u);
  }

  function buildQueue(pool, count) {
    const shuffled = shuffle(pool);
    if (count === "all") return shuffled;
    const n = Math.min(parseInt(count, 10), shuffled.length);
    return shuffled.slice(0, n);
  }

  // ---------- Iniciar simulacro ----------
  $("#btn-start").addEventListener("click", () => {
    const pool = poolForUnit(state.unit);
    state.queue = buildQueue(pool, state.count);
    state.idx = 0;
    state.answers = [];
    state.locked = false;
    if (state.queue.length === 0) {
      alert("No hay preguntas disponibles para esta selección.");
      return;
    }
    showScreen("quiz");
    renderQuestion();
  });

  $("#btn-review-missed").addEventListener("click", () => {
    if (state.missedIds.length === 0) {
      renderReview([], true);
      showScreen("review");
      return;
    }
    const pool = QUESTION_BANK.filter((q) => state.missedIds.includes(q.id));
    state.queue = shuffle(pool);
    state.idx = 0;
    state.answers = [];
    state.locked = false;
    showScreen("quiz");
    renderQuestion();
  });

  $("#btn-quiz-exit").addEventListener("click", () => {
    if (confirm("¿Salir del simulacro? Se perderá el progreso actual.")) {
      showScreen("home");
      renderHomeStats();
    }
  });

  // ---------- Render de pregunta ----------
  function currentQuestion() {
    return state.queue[state.idx];
  }

  function updateProgress() {
    const total = state.queue.length;
    const done = state.idx;
    const pct = total ? (done / total) * 100 : 0;
    $("#progress-fill").style.width = pct + "%";
    $("#progress-text").textContent = (done + 1) + "/" + total;

    // aguja mini-gauge según % de aciertos hasta ahora
    const correctSoFar = state.answers.filter((a) => a.correct).length;
    const ratio = state.answers.length ? correctSoFar / state.answers.length : 0.5;
    const angle = -90 + ratio * 180;
    $("#mini-needle").style.transform = "rotate(" + angle + "deg)";
  }

  function renderQuestion() {
    const q = currentQuestion();
    $("#chip-topic").textContent = q.t;
    $("#chip-unit").textContent = "Unidad " + q.u;
    $("#question-text").textContent = q.q;
    $("#question-card").classList.remove("is-correct", "is-incorrect");
    $("#feedback").style.display = "none";
    $("#btn-next").style.display = "none";
    $("#btn-falso").classList.remove("is-locked", "is-picked", "is-reveal-correct", "is-reveal-wrong");
    $("#btn-verdadero").classList.remove("is-locked", "is-picked", "is-reveal-correct", "is-reveal-wrong");
    state.locked = false;
    updateProgress();
  }

  function answer(picked) {
    if (state.locked) return;
    state.locked = true;
    const q = currentQuestion();
    const correct = picked === q.a;
    state.answers.push({ id: q.id, picked, correct });

    // actualizar banco de falladas persistente
    if (!correct) {
      if (!state.missedIds.includes(q.id)) state.missedIds.push(q.id);
    } else {
      state.missedIds = state.missedIds.filter((id) => id !== q.id);
    }
    saveJSON(LS_KEYS.missed, state.missedIds);

    const falsoBtn = $("#btn-falso");
    const verdaderoBtn = $("#btn-verdadero");
    falsoBtn.classList.add("is-locked");
    verdaderoBtn.classList.add("is-locked");

    const pickedBtn = picked ? verdaderoBtn : falsoBtn;
    pickedBtn.classList.add("is-picked");

    if (state.mode === "study") {
      // revelar cual era la correcta
      const correctBtn = q.a ? verdaderoBtn : falsoBtn;
      correctBtn.classList.add("is-reveal-correct");
      if (!correct) pickedBtn.classList.add("is-reveal-wrong");

      $("#question-card").classList.add(correct ? "is-correct" : "is-incorrect");
      $("#feedback").style.display = "block";
      $("#feedback").classList.toggle("is-correct", correct);
      $("#feedback").classList.toggle("is-incorrect", !correct);
      $("#feedback-title").textContent = correct ? "✓ Correcto" : "✕ Incorrecto — la afirmación era " + (q.a ? "Verdadera" : "Falsa");
      $("#feedback-explain").textContent = q.e;
    } else {
      // modo examen: sin feedback inmediato
      $("#feedback").style.display = "block";
      $("#feedback").classList.remove("is-correct", "is-incorrect");
      $("#feedback-title").textContent = "";
      $("#feedback-explain").textContent = "Modo examen: verás la corrección completa al final del simulacro.";
    }

    $("#btn-next").style.display = "block";
    $("#btn-next").textContent = state.idx === state.queue.length - 1 ? "Ver resultados" : "Siguiente";
    updateProgress();
  }

  $("#btn-falso").addEventListener("click", () => answer(false));
  $("#btn-verdadero").addEventListener("click", () => answer(true));

  $("#btn-next").addEventListener("click", () => {
    if (state.idx < state.queue.length - 1) {
      state.idx++;
      renderQuestion();
    } else {
      finishQuiz();
    }
  });

  // ---------- Resumen ----------
  function finishQuiz() {
    const total = state.answers.length;
    const correct = state.answers.filter((a) => a.correct).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;

    state.runs++;
    saveJSON(LS_KEYS.runs, state.runs);
    if (state.best === null || pct > state.best) {
      state.best = pct;
      saveJSON(LS_KEYS.best, state.best);
    }

    $("#summary-pct").textContent = pct + "%";
    $("#summary-score").textContent = correct + " de " + total + " correctas";
    const angle = -90 + (pct / 100) * 180;
    $("#summary-needle").style.transform = "rotate(" + angle + "deg)";

    const stamp = $("#summary-stamp");
    if (pct >= 60) {
      stamp.textContent = "APROBADO";
      stamp.classList.remove("stamp-fail");
    } else {
      stamp.textContent = "A REPASAR";
      stamp.classList.add("stamp-fail");
    }

    renderTopicBreakdown();
    renderHomeStats();
    showScreen("summary");
  }

  function renderTopicBreakdown() {
    const byTopic = {};
    state.answers.forEach((ans) => {
      const q = QUESTION_BANK.find((x) => x.id === ans.id);
      if (!q) return;
      if (!byTopic[q.t]) byTopic[q.t] = { correct: 0, total: 0 };
      byTopic[q.t].total++;
      if (ans.correct) byTopic[q.t].correct++;
    });

    const container = $("#topic-breakdown-rows");
    container.innerHTML = "";
    Object.keys(byTopic)
      .sort()
      .forEach((topic) => {
        const stat = byTopic[topic];
        const pct = Math.round((stat.correct / stat.total) * 100);
        const row = document.createElement("div");
        row.className = "topic-row";
        row.innerHTML =
          '<div class="topic-row-head"><span class="topic-row-name">' +
          topic +
          '</span><span class="topic-row-frac">' +
          stat.correct +
          "/" +
          stat.total +
          '</span></div><div class="topic-bar-track"><div class="topic-bar-fill" style="width:' +
          pct +
          '%;"></div></div>';
        container.appendChild(row);
      });
  }

  $("#btn-summary-review").addEventListener("click", () => {
    const failed = state.answers.filter((a) => !a.correct).map((a) => a.id);
    const failedQuestions = failed.map((id) => QUESTION_BANK.find((q) => q.id === id));
    renderReview(failedQuestions, false, state.answers);
    showScreen("review");
  });

  $("#btn-summary-retry").addEventListener("click", () => {
    $("#btn-start").click();
  });

  $("#btn-summary-home").addEventListener("click", () => {
    showScreen("home");
    renderHomeStats();
  });

  // ---------- Repaso ----------
  function renderReview(questions, isMissedBank, answersRef) {
    const list = $("#review-list");
    const empty = $("#review-empty");
    list.innerHTML = "";

    let dataset = questions;
    if (isMissedBank) {
      dataset = QUESTION_BANK.filter((q) => state.missedIds.includes(q.id));
    }

    $("#review-title").textContent = isMissedBank ? "Preguntas falladas" : "Repaso de errores";

    if (dataset.length === 0) {
      empty.style.display = "flex";
      list.style.display = "none";
      return;
    }
    empty.style.display = "none";
    list.style.display = "flex";

    dataset.forEach((q) => {
      if (!q) return;
      let userPicked = null;
      if (answersRef) {
        const found = answersRef.find((a) => a.id === q.id);
        if (found) userPicked = found.picked;
      }
      const item = document.createElement("div");
      item.className = "review-item " + (userPicked === null ? "" : userPicked === q.a ? "is-correct" : "is-incorrect");
      let answersHtml = "<b>Correcta: " + (q.a ? "Verdadero" : "Falso") + "</b>";
      if (userPicked !== null) {
        answersHtml += " · Tu respuesta: " + (userPicked ? "Verdadero" : "Falso");
      }
      item.innerHTML =
        '<div class="review-chip-row"><span class="chip">' +
        q.t +
        '</span><span class="chip chip-muted">Unidad ' +
        q.u +
        '</span></div>' +
        '<p class="review-text">' +
        q.q +
        '</p>' +
        '<p class="review-answers">' +
        answersHtml +
        '</p>' +
        '<p class="review-explain">' +
        q.e +
        "</p>";
      list.appendChild(item);
    });
  }

  $("#btn-review-back").addEventListener("click", () => {
    showScreen("home");
    renderHomeStats();
  });
  $("#btn-review-done").addEventListener("click", () => {
    showScreen("home");
    renderHomeStats();
  });

  // ---------- Inicio ----------
  showScreen("home");
})();
