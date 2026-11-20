// 元とれ電卓の計算。入力値はこの端末の中だけで計算し、数字そのものはどこにも送らない(GA4には区分だけ送る)。
// 料金の既定値は公式ページで確認した値(index.htmlの「確認日」と合わせて直す)。
(function () {
  'use strict';

  // 特別リンク(メンバー紹介)。形はアソシエイトのヘルプ(2026-11-21確認)のとおり。hrefはここだけで管理する
  // プライム個人はメンバー紹介の一覧にないため、通常のリンク(member: false)
  var LINKS = {
    prime: { url: 'https://www.amazon.co.jp/amazonprime?tag=__TAG__', member: false },
    student: { url: 'https://www.amazon.co.jp/b?node=2410972051&tag=__TAG__', member: true },
    kindle: { url: 'https://www.amazon.co.jp/kindle-dbs/hz/signup?tag=__TAG__', member: true },
    audible: { url: 'https://www.amazon.co.jp/b/ref=adbl_JP_as_0068?ie=UTF8&node=7471076051&tag=__TAG__', member: true },
    music: { url: 'https://www.amazon.co.jp/music/unlimited/?tag=__TAG__', member: true }
  };
  // このツール専用のトラッキングID(2026-11-21作成、DALのアソシエイト)
  var TAG = 'mototore03-22';
  var TRIAL_NOTE = '無料体験は対象の人だけが使えます。期間が終わると自動で有料に切り替わるので、続けない場合は期間内に解約してください。期間や条件は申し込みの画面で確かめてください。';
  var STUDENT_NOTE = 'Prime Studentは大学・大学院・短大・専門学校・高専の学生が対象で、高校生は対象外です。18歳未満の人は保護者の同意が必要です。';
  var DEFAULT_BOOK_HOURS = 9;

  var NAMES = {
    prime: 'Amazonプライム',
    student: 'Prime Student',
    kindle: 'Kindle+(キンドルアンリミテッド)',
    audible: 'Audible(オーディブル)',
    music: 'Music Unlimited'
  };
  // 無料体験の長さ(日)。同じ得の額の時の並べ替えにだけ使う
  var TRIAL_DAYS = { prime: 30, student: 180, kindle: 30, audible: 30, music: 30 };

  var form = document.getElementById('calc');
  var out = document.getElementById('result');
  var summary = document.getElementById('summary');
  var adjusted = [];

  // 数値を読む。整数の欄(回・冊)は切り捨て、負数・上限超えは直して欄にも書き戻す
  function num(id, opts) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var raw = String(el.value).replace(/[,，]/g, '').trim();
    if (raw === '') return 0;
    var v = parseFloat(raw);
    if (!isFinite(v)) v = 0;
    var fixed = v;
    if (fixed < 0) fixed = 0;
    if (fixed > 1000000) fixed = 1000000;
    if (opts && opts.int) fixed = Math.floor(fixed);
    if (fixed !== v) {
      el.value = String(fixed);
      var lab = document.querySelector('label[for="' + id + '"]');
      adjusted.push('「' + (lab ? lab.textContent.replace(/[?？]$/, '') : id) + '」を' + fixed.toLocaleString('ja-JP') + 'に');
    }
    return fixed;
  }
  function checked(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }
  function yen(n) {
    return Math.round(n).toLocaleString('ja-JP') + '円';
  }
  function count(n) {
    return n.toLocaleString('ja-JP');
  }
  function signed(n) {
    var r = Math.round(n);
    if (r > 0) return '+' + r.toLocaleString('ja-JP') + '円 得';
    if (r < 0) return '−' + Math.abs(r).toLocaleString('ja-JP') + '円 損';
    return '±0円';
  }
  // 区分(例: edges [0,2,5] → '0','1-2','3-5','6+')
  function band(n, edges) {
    for (var i = 0; i < edges.length; i++) if (n <= edges[i]) return i === 0 ? String(edges[0]) : (edges[i - 1] + 1) + '-' + edges[i];
    return (edges[edges.length - 1] + 1) + '+';
  }
  // 料金feeを1単位unitの価値で上回るのに要る数(割り切れる時は「同じ」なので+1)
  function breakEven(fee, unit) {
    if (!(fee > 0) || !(unit > 0)) return 0;
    return Math.floor(fee / unit) + 1;
  }

  function compute() {
    adjusted = [];
    var isStudent = checked('is-student');
    var p = {
      prime: num('fee-prime'), primeYear: num('fee-prime-year'), student: num('fee-student'), kindle: num('fee-kindle'),
      audS: num('fee-aud-s'), audP: num('fee-aud-p'),
      musicMember: num('fee-music-member'), musicNon: num('fee-music-non'), musicStudent: num('fee-music-student')
    };
    var haveAnyPrime = checked('have-prime') || (isStudent && checked('have-student'));
    var rows = [];

    // 買い物(プライム・Prime Student)
    var smallOrders = num('small-orders', { int: true });
    var shipFee = num('ship-fee');
    var rushOrders = num('rush-orders', { int: true });
    var rushExtra = num('rush-extra');
    var videoValue = num('video-value');
    var primeKey = isStudent ? 'student' : 'prime';
    var primeFee = isStudent ? p.student : p.prime;
    if (smallOrders + rushOrders + videoValue > 0) {
      var shopValue = smallOrders * shipFee + rushOrders * rushExtra + videoValue;
      var pe = breakEven(primeFee, shipFee);
      rows.push({
        key: primeKey, net: shopValue - primeFee, fee: primeFee,
        used: isStudent ? (checked('have-student') || checked('have-prime')) : checked('have-prime'),
        tried: checked(isStudent ? 'tried-student' : 'tried-prime'),
        detail: '送料' + yen(smallOrders * shipFee) + (rushOrders ? '+お急ぎ便など' + yen(rushOrders * rushExtra) : '') + (videoValue ? '+見放題など' + yen(videoValue) : '') + '−会費' + yen(primeFee),
        even: pe ? '3,500円未満の注文が月' + count(pe) + '回あれば、送料だけで会費を上回る計算' : '',
        extra: (!isStudent && p.primeYear > 0) ? '年会費(' + yen(p.primeYear) + ')なら月あたり約' + yen(p.primeYear / 12) + 'で、月' + signed(shopValue - p.primeYear / 12) : ''
      });
    }

    // 読む(Kindle+)
    var books = num('ku-books', { int: true });
    var bookPrice = num('ku-price');
    if (books > 0) {
      var ke = breakEven(p.kindle, bookPrice);
      rows.push({
        key: 'kindle', net: books * bookPrice - p.kindle, fee: p.kindle,
        used: checked('have-kindle'), tried: checked('tried-kindle'),
        detail: yen(bookPrice) + '×' + count(books) + '冊−月額' + yen(p.kindle),
        even: ke ? '1冊' + yen(bookPrice) + 'なら、月' + count(ke) + '冊から月額を上回る計算' : ''
      });
    }

    // 聴く(Audible)。聴く時間を1冊の長さで割って冊数にする。0・空欄の長さは既定の9時間
    var hours = num('aud-hours');
    if (hours > 0) {
      var bh = num('aud-book-hours');
      var bookHours = bh >= 1 ? bh : DEFAULT_BOOK_HOURS;
      if (bh < 1) {
        document.getElementById('aud-book-hours').value = String(DEFAULT_BOOK_HOURS);
        adjusted.push('1冊の時間を' + DEFAULT_BOOK_HOURS + '時間に');
      }
      var audBooks = hours / bookHours;
      var audPrice = num('aud-price');
      var netS = Math.min(audBooks, 1) * audPrice - p.audS;
      var netP = audBooks * audPrice - p.audP;
      var premium = Math.round(netP) > Math.round(netS);
      var audPlan = premium ? 'プレミアム(聴き放題)' : 'スタンダード(毎月1冊)';
      var even = '';
      if (audPrice > 0) {
        if (premium) {
          var ape = breakEven(p.audP, audPrice);
          even = 'プレミアムは、1冊' + yen(audPrice) + 'なら月' + count(ape) + '冊(約' + count(ape * bookHours) + '時間)から月額を上回る計算';
        } else if (audPrice > p.audS) {
          even = 'スタンダードは、1冊' + yen(audPrice) + 'の本を月1冊聴けば月額を上回る計算。プレミアムの方が得になるのは、もっと多く聴く場合';
        }
      }
      rows.push({
        key: 'audible', net: premium ? netP : netS, fee: premium ? p.audP : p.audS, plan: audPlan,
        used: checked('have-audible'), tried: checked('tried-audible'),
        detail: '月' + count(hours) + '時間÷1冊' + count(bookHours) + '時間=約' + (Math.round(audBooks * 10) / 10).toLocaleString('ja-JP') + '冊。' + audPlan + 'で計算(スタンダード' + signed(netS) + '/プレミアム' + signed(netP) + ')',
        even: even
      });
    }

    // 音楽(Music Unlimited)。今払っている音楽サブスクと入れ替える前提。会員料金は今プライムに入っている時だけ
    var musicNow = num('music-now');
    if (musicNow > 0) {
      var musicFee = isStudent ? p.musicStudent : (haveAnyPrime ? p.musicMember : p.musicNon);
      var musicPlan = isStudent ? '学生プラン' : (haveAnyPrime ? '個人プラン(プライム会員の料金)' : '個人プラン(会員でない料金)');
      rows.push({
        key: 'music', net: musicNow - musicFee, fee: musicFee, plan: musicPlan,
        used: checked('have-music'), tried: checked('tried-music'),
        detail: '今の音楽サブスク' + yen(musicNow) + '−' + musicPlan + yen(musicFee),
        even: (!isStudent && !haveAnyPrime) ? 'プライムに入っている場合は月' + yen(p.musicMember) + 'になります' : ''
      });
    }
    return { rows: rows, isStudent: isStudent };
  }

  // 並べ方: 丸めた得の額→月額が安い→無料体験が長い(推しの選び方と同じ)
  function compareRows(a, b) {
    var na = Math.round(a.net), nb = Math.round(b.net);
    if (nb !== na) return nb - na;
    if (a.fee !== b.fee) return a.fee - b.fee;
    return TRIAL_DAYS[b.key] - TRIAL_DAYS[a.key];
  }
  function canTry(r) { return !r.used && !r.tried; }

  function linkFor(key) {
    return LINKS[key].url.replace('__TAG__', TAG);
  }

  // リンクと、そのすぐ下に置く無料体験の注記をまとめて返す
  function makeLink(row, placement, rank) {
    var wrap = document.createElement('div');
    var a = document.createElement('a');
    a.className = placement === 'top_pick' ? 'btn-trial' : 'link-trial';
    a.href = linkFor(row.key);
    a.target = '_blank';
    a.rel = 'sponsored noopener';
    a.dataset.service = row.key;
    a.dataset.placement = placement;
    a.dataset.rank = String(rank);
    a.dataset.net = String(Math.round(row.net));
    a.dataset.linkType = LINKS[row.key].member ? 'member_referral' : 'plain';
    var tag = document.createElement('span');
    tag.className = 'pr-tag';
    tag.textContent = 'PR';
    var vh = document.createElement('span');
    vh.className = 'vh';
    vh.textContent = '(Amazonのページが新しいタブで開きます)';
    a.appendChild(tag);
    a.appendChild(document.createTextNode(NAMES[row.key] + 'の無料体験の条件を見る'));
    a.appendChild(vh);
    wrap.appendChild(a);
    var tn = document.createElement('p');
    tn.className = 'trial-note';
    tn.textContent = TRIAL_NOTE + (row.key === 'student' ? STUDENT_NOTE : '');
    wrap.appendChild(tn);
    return wrap;
  }

  function text(tagName, cls, s) {
    var el = document.createElement(tagName);
    if (cls) el.className = cls;
    el.textContent = s;
    return el;
  }

  function render(res) {
    var rows = res.rows.slice().sort(compareRows);
    var top = rows.filter(function (r) { return Math.round(r.net) > 0 && canTry(r); })[0] || null;
    var nProfit = rows.filter(function (r) { return Math.round(r.net) > 0; }).length;
    out.hidden = false;

    if (!rows.length) {
      summary.textContent = '使い方が入力されていません。使うところ(注文回数・読む冊数・聴く時間・音楽サブスクの月額)を入れて、もう一度「計算する」を押してください。';
    } else if (top) {
      summary.textContent = '入力した使い方だと、いちばん得が大きいのは' + NAMES[top.key] + 'で、月' + signed(top.net) + 'の計算です。';
    } else if (nProfit > 0) {
      summary.textContent = '得になる計算のサービスはありますが、どれも「今入っている」か「前に無料体験を使った」にチェックがあります。';
    } else {
      summary.textContent = '入力した使い方だと、元が取れる計算のサービスはありません。今は入らなくてよさそうです。';
    }

    var adj = document.getElementById('adjusted');
    adj.hidden = !adjusted.length;
    adj.textContent = adjusted.length ? '入力を直して計算しました:' + adjusted.join('、') + 'しました。' : '';

    var topBox = document.getElementById('top-pick');
    topBox.innerHTML = '';
    if (top) {
      topBox.appendChild(text('h3', '', 'まず無料体験で試すなら: ' + NAMES[top.key]));
      topBox.appendChild(text('p', 'top-net', '月' + signed(top.net) + (top.plan ? '(' + top.plan + ')' : '')));
      topBox.appendChild(makeLink(top, 'top_pick', 1));
      topBox.appendChild(text('p', 'small', '入力した値で得の額がいちばん大きいものを、機械的に選んでいます(紹介料の額は関係ありません)。'));
      topBox.hidden = false;
    } else {
      topBox.hidden = true;
    }

    var list = document.getElementById('cards');
    list.innerHTML = '';
    rows.forEach(function (r, i) {
      var li = document.createElement('li');
      var net = Math.round(r.net);
      li.className = 'card ' + (net > 0 ? 'is-gain' : net < 0 ? 'is-loss' : 'is-even');
      var head = document.createElement('div');
      head.className = 'card-head';
      head.appendChild(text('h4', '', NAMES[r.key]));
      var val = document.createElement('p');
      val.className = 'card-net';
      var mark = text('span', 'mark', net > 0 ? '▲' : net < 0 ? '▼' : '―');
      mark.setAttribute('aria-hidden', 'true');
      val.appendChild(mark);
      val.appendChild(document.createTextNode('月' + signed(r.net)));
      head.appendChild(val);
      li.appendChild(head);
      li.appendChild(text('p', 'small', r.detail));
      if (r.even) li.appendChild(text('p', 'small even', r.even));
      if (r.extra) li.appendChild(text('p', 'small', r.extra));
      if (!canTry(r)) {
        li.appendChild(text('p', 'small', r.used ? '「今入っている」にチェックがあるので、比べるだけにしています。' : '「前に無料体験を使った」にチェックがあるので、比べるだけにしています。'));
      } else if (net > 0 && (!top || top.key !== r.key)) {
        li.appendChild(makeLink(r, 'card', i + 1));
      }
      list.appendChild(li);
    });

    if (typeof window.gtag === 'function') {
      window.gtag('event', rows.length ? 'calc_complete' : 'calc_empty', {
        top_service: top ? top.key : 'none',
        n_profitable: nProfit,
        n_rows: rows.length,
        is_student: res.isStudent ? 'yes' : 'no',
        order_band: band(num('small-orders', { int: true }), [0, 2, 5]),
        read_band: band(num('ku-books', { int: true }), [0, 2, 5]),
        listen_band: band(num('aud-hours'), [0, 10, 30]),
        music_band: num('music-now') > 0 ? 'paying' : 'none'
      });
    }
  }

  // 学生の時は、Prime Studentの欄を出す(通常のプライムの「今入っている」は学生でも出したまま)
  function syncStudent() {
    var s = checked('is-student');
    document.querySelectorAll('[data-student="only"]').forEach(function (el) { el.hidden = !s; });
    document.querySelectorAll('[data-student="not"]').forEach(function (el) { el.hidden = s; });
    if (!s) {
      ['have-student', 'tried-student'].forEach(function (id) { var c = document.getElementById(id); if (c) c.checked = false; });
    }
  }

  // 計算した後に入力が変わったら、古い結果を隠す
  function markStale() {
    if (!out.hidden) {
      out.hidden = true;
    }
  }

  // よく使う値のボタン
  document.querySelectorAll('[data-set]').forEach(function (btn) {
    btn.setAttribute('aria-label', btn.textContent + 'を入れる');
    btn.addEventListener('click', function () {
      var t = document.getElementById(btn.dataset.target);
      if (t) { t.value = btn.dataset.set; t.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  });

  document.getElementById('is-student').addEventListener('change', syncStudent);
  syncStudent();
  form.addEventListener('input', markStale);
  form.addEventListener('change', markStale);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    render(compute());
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    out.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    summary.focus({ preventScroll: true });
  });
  form.addEventListener('reset', function () {
    setTimeout(function () {
      syncStudent();
      out.hidden = true;
      document.getElementById('is-student').focus();
    }, 0);
  });
})();
