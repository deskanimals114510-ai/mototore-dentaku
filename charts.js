// 本文の損益分岐の図(HTMLとCSSで描く棒グラフ)。数字は本文・表と同じ固定値(2026-11-21時点の料金)。
// 料金を変えたら、ここ・本文・表・JSON-LD・入力欄の既定値をまとめて直す。
(function () {
  'use strict';

  var CHARTS = {
    prime: {
      unit: '送料がかかる注文(月)',
      bars: [1, 2, 3, 4].map(function (n) { return { label: n + '回', value: n * 460, series: 'a' }; }),
      lines: [{ value: 600, label: 'プライム 600円' }, { value: 300, label: 'Student 300円' }],
      max: 2000
    },
    kindle: {
      unit: '対象の本を読む冊数(月)・1冊700円',
      bars: [1, 2, 3, 4].map(function (n) { return { label: n + '冊', value: n * 700, series: 'a' }; }),
      lines: [{ value: 980, label: 'Kindle+ 980円' }],
      max: 3000
    },
    audible: {
      unit: '聴く冊数(月)・1冊=2,000円・約9時間',
      legend: [{ series: 'b', label: 'スタンダード(月額880円)の得' }, { series: 'c', label: 'プレミアム(月額1,500円)の得' }],
      groups: [1, 2, 3].map(function (n) {
        return {
          label: n + '冊',
          bars: [
            { value: Math.min(n, 1) * 2000 - 880, series: 'b' },
            { value: n * 2000 - 1500, series: 'c' }
          ]
        };
      }),
      max: 5000
    }
  };

  function yen(n) { return n.toLocaleString('ja-JP') + '円'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function bar(value, max, series, title) {
    var col = el('div', 'cbar-col');
    var b = el('div', 'cbar s-' + series);
    b.style.height = Math.max(2, Math.round(value / max * 100)) + '%';
    b.title = title;
    var v = el('span', 'cbar-val', yen(value));
    col.appendChild(v);
    col.appendChild(b);
    return col;
  }

  function render(fig) {
    var c = CHARTS[fig.dataset.chart];
    if (!c) return;
    // 図の中身は読み上げない(同じ数字はfigcaptionと表にある)
    var plot = el('div', 'cplot' + (c.lines ? ' has-lines' : ''));
    plot.setAttribute('aria-hidden', 'true');
    if (c.legend) {
      var lg = el('ul', 'clegend');
      c.legend.forEach(function (l) {
        var li = el('li');
        li.appendChild(el('span', 'swatch s-' + l.series));
        li.appendChild(document.createTextNode(l.label));
        lg.appendChild(li);
      });
      plot.appendChild(lg);
    }
    var area = el('div', 'carea');
    (c.lines || []).forEach(function (ln) {
      var l = el('div', 'cline');
      l.style.bottom = (ln.value / c.max * 100) + '%';
      l.appendChild(el('span', 'cline-label', ln.label));
      area.appendChild(l);
    });
    var cols = el('div', 'ccols');
    var xs = el('div', 'cxlabels');
    if (c.bars) {
      c.bars.forEach(function (b) {
        var g = el('div', 'cgroup');
        g.appendChild(bar(b.value, c.max, b.series, b.label + ': ' + yen(b.value)));
        cols.appendChild(g);
        xs.appendChild(el('span', '', b.label));
      });
    } else {
      c.groups.forEach(function (g) {
        var gr = el('div', 'cgroup');
        g.bars.forEach(function (b, i) {
          gr.appendChild(bar(b.value, c.max, b.series, g.label + ' ' + c.legend[i].label + ': ' + yen(b.value)));
        });
        cols.appendChild(gr);
        xs.appendChild(el('span', '', g.label));
      });
    }
    area.appendChild(cols);
    plot.appendChild(area);
    plot.appendChild(xs);
    plot.appendChild(el('p', 'cunit', c.unit));
    fig.insertBefore(plot, fig.querySelector('figcaption'));
  }

  document.querySelectorAll('figure.chart[data-chart]').forEach(render);
})();
