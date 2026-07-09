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

  const CHART_COLORS = {
    grid: 'rgba(255,255,255,0.06)',
    ticks: '#8a9199',
    position: '#4ADE80',
    tangent: '#FFCC00',
    point: '#E63946',
    temp: '#E63946',
    asymptote: 'rgba(138,145,153,0.6)'
  };

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
  }

  /**
   * Reinicia ambos gráficos (se llama al cambiar máquina/terreno/sliders).
   */
  function reset() {
    positionChart.data.datasets[0].data = [];
    positionChart.data.datasets[1].data = [];
    positionChart.data.datasets[2].data = [];
    temperatureChart.data.datasets[0].data = [];
    temperatureChart.data.datasets[1].data = [];
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
    document.getElementById('hudSpeed').textContent = data.speedKmh.toFixed(0);
    document.getElementById('hudDistance').textContent = data.stopDistance.toFixed(1);
    document.getElementById('hudTime').textContent = data.time.toFixed(2);
    document.getElementById('hudAccel').textContent = data.acceleration.toFixed(2);
    document.getElementById('hudTemp').textContent = data.temp.toFixed(0);
    document.getElementById('hudStatus').textContent = data.status;

    if (typeof data.forceKN === 'number') {
      document.getElementById('hudForce').textContent = data.forceKN.toFixed(1);
    }
    if (typeof data.energyMJ === 'number') {
      document.getElementById('hudEnergy').textContent = data.energyMJ.toFixed(2);
    }

    // Bandera de falla térmica (brake fade): se refleja como alerta visual
    // pulsante en los clusters de temperatura y estado del HUD, más un
    // banner grande y parpadeante en rojo ("¡ADVERTENCIA: BRAKE FADE!").
    const tempCluster = document.querySelector('.hud-temp');
    const statusCluster = document.querySelector('.hud-status');
    if (tempCluster) tempCluster.classList.toggle('brake-fade', !!data.brakeFade);
    if (statusCluster) statusCluster.classList.toggle('brake-fade', !!data.brakeFade);

    const banner = ensureFadeBanner();
    banner.classList.toggle('is-visible', !!data.brakeFade);
  }

  return { init, reset, pushFrame, updateHUD };
})();

window.Dashboard = Dashboard;