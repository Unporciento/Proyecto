/**
 * ============================================================================
 *  dashboard.js
 *  TELEMETRÍA: GRÁFICOS CHART.JS + HUD NUMÉRICO
 * ============================================================================
 *  Encapsula la creación y actualización en tiempo real de:
 *    - Gráfico 1: posición f(t), punto dinámico y recta tangente en vivo.
 *    - Gráfico 2: temperatura de frenos vs tiempo, con línea de asíntota.
 *    - HUD: velocímetro, distancia de frenado, tiempo, aceleración.
 * ============================================================================
 */

const Dashboard = (function () {

  let positionChart, temperatureChart;
  let els = {}; // referencias DOM del HUD, cacheadas una sola vez en init() (ver updateHUD)

  const CHART_COLORS = {
    grid: 'rgba(255,255,255,0.06)',
    ticks: '#8a9199',
    position: '#4ADE80',
    tangent: '#FFCC00',
    point: '#E63946',
    temp: '#E63946',
    asymptote: 'rgba(138,145,153,0.6)',
    ghost: 'rgba(200,204,209,0.55)'
  };

  const LINE_WIDTHS = {
    normal:       { position: 2, tangent: 1.5, point: 5,  temp: 2, asymptote: 1,   ghost: 1.5 },
    presentation: { position: 5, tangent: 4,   point: 11, temp: 5, asymptote: 2.5, ghost: 3 }
  };
  let presentationActive = false;

  let lastRunPosition = [];
  let lastRunTemp = [];

  const commonScaleOptions = {
    grid: { color: CHART_COLORS.grid },
    ticks: { color: CHART_COLORS.ticks, font: { size: 10 } }
  };

  /**
   * Inicializa ambos gráficos vacíos. Se llenan cuadro a cuadro desde main.js.
   */
  function init() {
    const posCtx = document.getElementById('chartPosition').getContext('2d');
    positionChart = new Chart(posCtx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'f(t) — Posición',
            data: [],
            borderColor: CHART_COLORS.position,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.15
          },
          {
            label: 'Recta tangente L(t)',
            data: [],
            borderColor: CHART_COLORS.tangent,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0
          },
          {
            label: 'Punto actual',
            data: [],
            borderColor: CHART_COLORS.point,
            backgroundColor: CHART_COLORS.point,
            pointRadius: 5,
            pointHoverRadius: 6,
            showLine: false
          },
          {
            // Ronda 10 — Ghost Chart: corrida anterior en gris punteado tenue,
            // para comparar visualmente dos parábolas de frenado.
            label: 'Corrida anterior (referencia)',
            data: [],
            borderColor: CHART_COLORS.ghost,
            backgroundColor: 'transparent',
            borderWidth: LINE_WIDTHS.normal.ghost,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.15
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false },
        scales: {
          // Ronda 6: `suggestedMin/suggestedMax` fijan un rango inicial
          // realista (0–6s, 0–120m) para que, antes de la primera corrida
          // (con `data: []`), el gráfico no muestre el rango 0–1 por
          // defecto de Chart.js — que se veía como una escala "rota" en
          // la captura de referencia. Una vez hay datos reales, Chart.js
          // sigue autoescalando con normalidad si la corrida los supera.
          x: { type: 'linear', suggestedMax: 6, title: { display: true, text: 't (s)', color: CHART_COLORS.ticks }, ...commonScaleOptions },
          y: { suggestedMin: 0, suggestedMax: 120, title: { display: true, text: 'Distancia (m)', color: CHART_COLORS.ticks }, ...commonScaleOptions }
        },
        plugins: {
          legend: { labels: { color: '#c8ccd1', boxWidth: 14, font: { size: 10 } } }
        }
      }
    });

    const tempCtx = document.getElementById('chartTemperature').getContext('2d');
    temperatureChart = new Chart(tempCtx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'T(t) — Temperatura del disco',
            data: [],
            borderColor: CHART_COLORS.temp,
            backgroundColor: 'rgba(230,57,70,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.2
          },
          {
            label: 'Asíntota (T ambiente)',
            data: [],
            borderColor: CHART_COLORS.asymptote,
            borderWidth: 1,
            borderDash: [3, 5],
            pointRadius: 0
          },
          {
            // Ronda 10 — Ghost Chart: temperatura de la corrida anterior.
            label: 'Corrida anterior (referencia)',
            data: [],
            borderColor: CHART_COLORS.ghost,
            backgroundColor: 'transparent',
            borderWidth: LINE_WIDTHS.normal.ghost,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0.2
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false },
        scales: {
          x: { type: 'linear', suggestedMax: 6, title: { display: true, text: 't (s)', color: CHART_COLORS.ticks }, ...commonScaleOptions },
          y: { suggestedMin: 0, suggestedMax: 450, title: { display: true, text: 'Temperatura (°C)', color: CHART_COLORS.ticks }, ...commonScaleOptions }
        },
        plugins: {
          legend: { labels: { color: '#c8ccd1', boxWidth: 14, font: { size: 10 } } }
        }
      }
    });

    // Referencias DOM del HUD cacheadas una sola vez: updateHUD() se llama
    // ~60 veces/seg mientras la simulación corre, así que volver a buscar
    // estos mismos 11 nodos en cada frame (incluyendo 2 querySelector, más
    // lentos que getElementById) es trabajo desperdiciado en el hot path.
    els = {
      speed: document.getElementById('hudSpeed'),
      distance: document.getElementById('hudDistance'),
      time: document.getElementById('hudTime'),
      accel: document.getElementById('hudAccel'),
      temp: document.getElementById('hudTemp'),
      status: document.getElementById('hudStatus'),
      force: document.getElementById('hudForce'),
      energy: document.getElementById('hudEnergy'),
      tempCluster: document.querySelector('.hud-temp'),
      statusCluster: document.querySelector('.hud-status'),
      banner: ensureFadeBanner()
    };
  }

  /**
   * Reinicia ambos gráficos (se llama al cambiar máquina/terreno/sliders,
   * o al presionar "Simular" de nuevo).
   *
   * Ronda 10 — Ghost Chart: si la corrida que se está por borrar tenía al
   * menos 2 puntos reales (es decir, hubo una simulación de verdad, no
   * solo la vista previa estática en t=0), esos puntos se copian al
   * dataset "fantasma" (gris punteado, dataset índice 3) ANTES de vaciar
   * los datasets reales, para que la próxima corrida se dibuje encima de
   * la anterior y se puedan comparar ambas parábolas a simple vista.
   * `keepGhost = false` (usado desde showStaticPreview) evita que un
   * simple ajuste de slider sin simular pise el fantasma de la última
   * corrida real.
   */
  function reset(keepGhost = true) {
    const hadRealRun = positionChart.data.datasets[0].data.length > 1;
    if (keepGhost && hadRealRun) {
      lastRunPosition = positionChart.data.datasets[0].data.slice();
      lastRunTemp = temperatureChart.data.datasets[0].data.slice();
    }

    positionChart.data.datasets[0].data = [];
    positionChart.data.datasets[1].data = [];
    positionChart.data.datasets[2].data = [];
    positionChart.data.datasets[3].data = keepGhost ? lastRunPosition : [];

    temperatureChart.data.datasets[0].data = [];
    temperatureChart.data.datasets[1].data = [];
    temperatureChart.data.datasets[2].data = keepGhost ? lastRunTemp : [];

    positionChart.update('none');
    temperatureChart.update('none');
  }

  /** Borra por completo el Ghost Chart (p. ej. al aplicar un Caso de prueba nuevo). */
  function clearGhost() {
    lastRunPosition = [];
    lastRunTemp = [];
    positionChart.data.datasets[3].data = [];
    temperatureChart.data.datasets[2].data = [];
    positionChart.update('none');
    temperatureChart.update('none');
  }

  /**
   * Ronda 10 — Modo Presentación: engrosa (o revierte) las líneas y
   * puntos de ambos gráficos para que sobrevivan a la compresión de
   * video de Google Meet. Se puede llamar en cualquier momento, incluso
   * a mitad de una corrida — Chart.js redibuja con `update('none')`
   * (sin animación) para no perder el frame en curso.
   */
  function setPresentationMode(active) {
    presentationActive = active;
    const w = active ? LINE_WIDTHS.presentation : LINE_WIDTHS.normal;

    const posDs = positionChart.data.datasets;
    posDs[0].borderWidth = w.position;
    posDs[1].borderWidth = w.tangent;
    posDs[2].pointRadius = w.point;
    posDs[2].pointHoverRadius = w.point + 1;
    posDs[3].borderWidth = w.ghost;

    const tempDs = temperatureChart.data.datasets;
    tempDs[0].borderWidth = w.temp;
    tempDs[1].borderWidth = w.asymptote;
    tempDs[2].borderWidth = w.ghost;

    positionChart.update('none');
    temperatureChart.update('none');
  }

  /**
   * Empuja un nuevo frame de datos a los gráficos.
   * @param {object} frame  { t, position, tangentSeries: [{x,y}], ambientTemp, temp }
   */
  function pushFrame(frame) {
    // --- Gráfico de posición ---
    positionChart.data.datasets[0].data.push({ x: frame.t, y: frame.position });
    positionChart.data.datasets[1].data = frame.tangentSeries;
    positionChart.data.datasets[2].data = [{ x: frame.t, y: frame.position }];
    positionChart.update('none');

    // --- Gráfico de temperatura ---
    temperatureChart.data.datasets[0].data.push({ x: frame.t, y: frame.temp });
    temperatureChart.data.datasets[1].data = [
      { x: 0, y: frame.ambientTemp },
      { x: frame.t + 5, y: frame.ambientTemp }
    ];
    temperatureChart.update('none');
  }

  /**
   * Crea (una sola vez) el banner flotante de advertencia de Brake Fade,
   * si aún no existe en el DOM, y lo agrega al body. Se mantiene oculto
   * por defecto (display:none vía CSS) y updateHUD() lo muestra/oculta.
   */
  function ensureFadeBanner() {
    let banner = document.getElementById('brakeFadeBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'brakeFadeBanner';
      banner.className = 'brake-fade-banner';
      banner.textContent = '¡ADVERTENCIA: BRAKE FADE!';
      // role="alert" + aria-live="assertive": un lector de pantalla debe
      // anunciar esto de inmediato (es una alerta de seguridad), a
      // diferencia del estado del HUD (aria-live="polite" en index.html),
      // que puede esperar a que el usuario termine lo que esté leyendo.
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
      document.body.appendChild(banner);
    }
    return banner;
  }

  /**
   * Actualiza los indicadores numéricos del HUD inferior, incluyendo
   * fuerza de frenado (F = m·a) y energía cinética (Ec = ½·m·v²), y la
   * alerta visual de falla térmica (brake fade) cuando corresponde.
   */
  function updateHUD(data) {
    els.speed.textContent = data.speedKmh.toFixed(0);
    els.distance.textContent = data.stopDistance.toFixed(1);
    els.time.textContent = data.time.toFixed(2);
    els.accel.textContent = data.acceleration.toFixed(2);
    els.temp.textContent = data.temp.toFixed(0);
    els.status.textContent = data.status;

    if (typeof data.forceKN === 'number') {
      els.force.textContent = data.forceKN.toFixed(1);
    }
    if (typeof data.energyMJ === 'number') {
      els.energy.textContent = data.energyMJ.toFixed(2);
    }

    // Bandera de falla térmica (brake fade): se refleja como alerta visual
    // pulsante en los clusters de temperatura y estado del HUD, más un
    // banner grande y parpadeante en rojo ("¡ADVERTENCIA: BRAKE FADE!").
    if (els.tempCluster) els.tempCluster.classList.toggle('brake-fade', !!data.brakeFade);
    if (els.statusCluster) els.statusCluster.classList.toggle('brake-fade', !!data.brakeFade);

    els.banner.classList.toggle('is-visible', !!data.brakeFade);
  }

  return { init, reset, pushFrame, updateHUD, setPresentationMode, clearGhost };
})();

window.Dashboard = Dashboard;