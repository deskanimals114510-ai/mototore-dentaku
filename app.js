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
  var TRIAL_NOTE_SHORT = '無料体験は対象の人だけ。期間が終わると自動で有料になります(詳しくは下の注意)。';
  var STUDENT_NOTE = 'Prime Studentは大学・大学院・短大・専門学校・高専の学生が対象で、高校生は対象外です。18歳未満の人は保護者の同意が必要です。';
  var DEFAULT_BOOK_HOURS = 9;

  var NAMES = {
    prime: 'Amazonプライム',
    student: 'Prime Student',
    kindle: 'Kindle+(キンドルアンリミテッド)',
    audible: 'オーディブル',
    music: 'Music Unlimited'
  };
  var SHORT = { prime: 'プライム', student: 'Prime Student', kindle: 'Kindle+', audible: 'オーディブル', music: 'Music Unlimited' };
  // 無料体験の長さ(日)。同じ得の額の時の並べ替えにだけ使う
  var TRIAL_DAYS = { prime: 30, student: 180, kindle: 30, audible: 30, music: 30 };

  var form = document.getElementById('calc');
  var out = document.getElementById('result');
  var summary = document.getElementById('summary');
  var adjusted = [];
  // trueの時だけ、直した値を入力欄に書き戻す(入力の途中では書き戻さない)
  var fixMode = false;

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
    if (fixed !== v && fixMode) {
      el.value = String(fixed);
      var lab = document.querySelector('label[for="' + id + '"]');
      adjusted.push((lab && lab.dataset.name ? lab.dataset.name : (lab ? lab.textContent.replace(/[?？]$/, '') : id)) + 'を' + fixed.toLocaleString('ja-JP') + 'に');
    }
    return fixed;
  }
  function used(id) { return checked(id); }
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
  function gainPhrase(n) {
    var r = Math.round(n);
    if (r > 0) return '月' + r.toLocaleString('ja-JP') + '円得する';
    if (r < 0) return '月' + Math.abs(r).toLocaleString('ja-JP') + '円損する';
    return '得も損もない';
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
    var haveAnyPrime = checked('have-prime') || checked('music-prime') || (isStudent && checked('have-student'));
    var rows = [];
    var pending = [];  // 選んだがまだ数字が0のサービス
    var bands = { order_band: 'off', read_band: 'off', listen_band: 'off', music_band: 'off' };

    // 買い物(プライム・Prime Student)
    var primeKey = isStudent ? 'student' : 'prime';
    var primeFee = isStudent ? p.student : p.prime;
    if (used('use-shop')) {
      var smallOrders = num('small-orders', { int: true });
      var shipFee = num('ship-fee');
      var rushOrders = num('rush-orders', { int: true });
      var rushExtra = num('rush-extra');
      var videoValue = num('video-value');
      bands.order_band = band(smallOrders, [0, 2, 5]);
    }
    if (used('use-shop') && smallOrders + rushOrders + videoValue === 0) pending.push(primeKey);
    else if (used('use-shop')) {
      var shopValue = smallOrders * shipFee + rushOrders * rushExtra + videoValue;
      var pe = breakEven(primeFee, shipFee);
      rows.push({
        key: primeKey, net: shopValue - primeFee, fee: primeFee,
        used: isStudent ? (checked('have-student') || checked('have-prime')) : checked('have-prime'),
        tried: checked(isStudent ? 'tried-student' : 'tried-prime'),
        detail: '送料' + yen(smallOrders * shipFee) + (rushOrders ? '+お急ぎ便など' + yen(rushOrders * rushExtra) : '') + (videoValue ? '+見放題など' + yen(videoValue) : '') + '−会費' + yen(primeFee),
        even: pe ? '送料がかかる注文が月' + count(pe) + '回以上なら、送料だけで入った方が得になる計算です。' : '',
        extra: (!isStudent && p.primeYear > 0) ? '年会費(' + yen(p.primeYear) + '、12か月続ける場合)なら月あたり約' + yen(p.primeYear / 12) + 'で、' + gainPhrase(shopValue - p.primeYear / 12) + '計算です。' : ''
      });
    }

    // 読む(Kindle+)
    if (used('use-read')) {
      var books = num('ku-books', { int: true });
      var bookPrice = num('ku-price');
      bands.read_band = band(books, [0, 2, 5]);
    }
    if (used('use-read') && books === 0) pending.push('kindle');
    else if (used('use-read')) {
      var ke = breakEven(p.kindle, bookPrice);
      rows.push({
        key: 'kindle', net: books * bookPrice - p.kindle, fee: p.kindle,
        used: checked('have-kindle'), tried: checked('tried-kindle'),
        detail: yen(bookPrice) + '×' + count(books) + '冊−月額' + yen(p.kindle),
        even: ke ? '1冊' + yen(bookPrice) + 'なら、月' + count(ke) + '冊から月額を上回る計算です。' : ''
      });
    }

    // 聴く(Audible)。聴く時間を1冊の長さで割って冊数にする。0・空欄の長さは既定の9時間
    if (used('use-listen')) {
      var hours = num('aud-hours');
      bands.listen_band = band(hours, [0, 10, 30]);
    }
    if (used('use-listen') && hours === 0) pending.push('audible');
    else if (used('use-listen')) {
      var bh = num('aud-book-hours');
      var bookHours = bh >= 1 ? bh : DEFAULT_BOOK_HOURS;
      if (bh < 1 && fixMode) {
        document.getElementById('aud-book-hours').value = String(DEFAULT_BOOK_HOURS);
        adjusted.push('1冊の時間を' + DEFAULT_BOOK_HOURS + 'に');
      }
      var audBooks = hours / bookHours;
      var audPrice = num('aud-price');
      var netS = Math.min(audBooks, 1) * audPrice - p.audS;
      var netP = audBooks * audPrice - p.audP;
      var premium = Math.round(netP) > Math.round(netS);
      var audPlan = premium ? 'プレミアム(聴き放題)' : 'スタンダード(毎月1冊)';
      var even = '';
      if (audPrice > 0) {
        // プレミアムがスタンダードより得になる聴く時間: 冊数 > 1 + (プレミアム−スタンダード)/1冊の値段
        var switchHours = Math.ceil(bookHours * (1 + (p.audP - p.audS) / audPrice));
        even = (premium ? 'プレミアム(聴き放題の対象の作品だけ)の方が得なので、プレミアムで計算しています。' : (audPrice > p.audS ? 'スタンダードは、月1冊聴けば月額を上回る計算です。' : '')) +
          '1冊' + yen(audPrice) + 'なら、月' + count(switchHours) + '時間以上聴くとプレミアムの方が得です。';
      }
      rows.push({
        key: 'audible', net: premium ? netP : netS, fee: premium ? p.audP : p.audS, plan: audPlan,
        used: checked('have-audible'), tried: checked('tried-audible'),
        detail: '月約' + (Math.round(audBooks * 10) / 10).toLocaleString('ja-JP') + '冊(' + count(hours) + '時間÷1冊' + count(bookHours) + '時間)。スタンダード' + signed(netS) + '/プレミアム' + signed(netP),
        even: even
      });
    }

    // 音楽(Music Unlimited)。今払っている音楽サブスクと入れ替える前提。会員料金は今プライムに入っている時だけ
    if (used('use-music')) {
      var musicNow = num('music-now');
      bands.music_band = musicNow > 0 ? 'paying' : 'none';
    }
    if (used('use-music') && musicNow === 0) pending.push('music');
    else if (used('use-music')) {
      var musicFee = isStudent ? p.musicStudent : (haveAnyPrime ? p.musicMember : p.musicNon);
      var musicPlan = isStudent ? '学生プラン' : (haveAnyPrime ? '個人プラン(プライム会員の料金)' : '個人プラン(会員でない料金)');
      rows.push({
        key: 'music', net: musicNow - musicFee, fee: musicFee, plan: musicPlan,
        used: checked('have-music'), tried: checked('tried-music'),
        detail: '今の音楽サブスク' + yen(musicNow) + '−' + musicPlan + yen(musicFee),
        even: (!isStudent && !haveAnyPrime) ? 'プライムに入っている場合、Music Unlimitedは月額' + yen(p.musicMember) + 'になります。' : (isStudent ? '学生プランは在学の確認が必要です。' : '')
      });
    }
    return { rows: rows, isStudent: isStudent, pending: pending, bands: bands };
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
    tn.textContent = (placement === 'top_pick' ? TRIAL_NOTE : TRIAL_NOTE_SHORT) + (row.key === 'student' ? STUDENT_NOTE : '');
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

    var bestOwned = rows.filter(function (r) { return Math.round(r.net) > 0 && !canTry(r); })[0] || null;
    var msg;
    if (!rows.length) {
      msg = res.pending.length ? '回数や冊数などに1以上を入れると、すぐここに結果が出ます。' : '上の1で使うものを選ぶと、ここに月いくら得か損かが出ます。';
    } else if (top && top === rows[0]) {
      msg = 'いちばん得が大きいのは' + NAMES[top.key] + 'です。入ると、入らない場合より' + gainPhrase(top.net) + '計算です。';
    } else if (top) {
      msg = '今入っておらず無料体験を使ったことがないものの中では、' + NAMES[top.key] + 'がいちばん得が大きく、' + gainPhrase(top.net) + '計算です。';
    } else if (bestOwned) {
      msg = (bestOwned.used ? '今入っている' : '前に無料体験を使った') + NAMES[bestOwned.key] + 'は、入らない場合より' + gainPhrase(bestOwned.net) + '計算です。';
    } else {
      msg = '入力した使い方では、料金を上回る計算のサービスはありません(送料・本・音楽の差だけで比べています)。';
    }
    if (rows.length && res.pending.length) {
      msg += res.pending.map(function (k) { return SHORT[k]; }).join('・') + 'は、1以上を入れると計算します。';
    }
    summary.textContent = msg;
    document.getElementById('result-detail').hidden = !rows.length;
    document.getElementById('to-detail').hidden = !rows.length;
    document.getElementById('also-calc').hidden = !(rows.length && checked('use-shop') && !checked('use-read') && !checked('use-listen'));

    var adj = document.getElementById('adjusted');
    adj.hidden = !adjusted.length;
    adj.textContent = adjusted.length ? '入力を直しました:' + adjusted.join('、') + '。直した値で計算しています。' : '';

    var topBox = document.getElementById('top-pick');
    topBox.innerHTML = '';
    if (top) {
      var art = document.createElement('img');
      art.className = 'top-art';
      art.src = 'img/' + top.key + '.webp';
      art.width = 640;
      art.height = 480;
      art.alt = '';
      topBox.appendChild(art);
      topBox.appendChild(text('h3', '', 'まず無料体験で試すなら:' + NAMES[top.key]));
      topBox.appendChild(text('p', 'top-net', '月' + signed(top.net) + (top.plan ? '・' + top.plan + 'で計算' : '')));
      topBox.appendChild(makeLink(top, 'top_pick', rows.indexOf(top) + 1));
      var how = document.createElement('p'); how.className = 'small'; how.innerHTML = '得の額だけで機械的に選んでいます(紹介料の額は関係ありません)。<a href="#faq">選び方</a>'; topBox.appendChild(how);
      topBox.hidden = false;
    } else {
      topBox.hidden = true;
    }

    // 得と損の棒(0を真ん中に、得は右・損は左)。数字と「得/損」の文字も添えるので色だけに頼らない
    var chart = document.getElementById('result-chart');
    chart.innerHTML = '';
    chart.hidden = rows.length < 2;
    if (rows.length >= 2) {
      var maxAbs = rows.reduce(function (m, r) { return Math.max(m, Math.abs(Math.round(r.net))); }, 1);
      var hasLoss = rows.some(function (r) { return Math.round(r.net) < 0; });
      var hasGain = rows.some(function (r) { return Math.round(r.net) > 0; });
      // 損がなければ0を左端、得がなければ右端に置く
      var zero = hasLoss && hasGain ? 50 : (hasLoss ? 100 : 0);
      var span = hasLoss && hasGain ? 50 : 100;
      chart.style.setProperty('--zero', zero + '%');
      var hd = document.createElement('p');
      hd.className = 'rc-head';
      hd.appendChild(text('span', '', hasLoss ? '← 損' : ''));
      hd.appendChild(text('span', '', hasLoss && hasGain ? '0円の線から、月の得(右)・損(左)' : (hasGain ? '0円の線から、月の得' : '0円の線から、月の損')));
      hd.appendChild(text('span', '', hasGain ? '得 →' : ''));
      chart.appendChild(hd);
      rows.forEach(function (r) {
        var net = Math.round(r.net);
        var row = document.createElement('div');
        row.className = 'rc-row';
        row.appendChild(text('span', 'rc-name', SHORT[r.key]));
        var track = document.createElement('div');
        track.className = 'rc-track';
        var b = document.createElement('div');
        b.className = 'rc-bar ' + (net >= 0 ? 'is-gain' : 'is-loss');
        b.style.width = (Math.abs(net) / maxAbs * span) + '%';
        track.appendChild(b);
        row.appendChild(track);
        row.appendChild(text('span', 'rc-val', signed(r.net)));
        chart.appendChild(row);
      });
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
        li.appendChild(text('p', 'small', r.used ? '「今入っている」にチェックがあるので、無料体験の案内は出していません。' : '「前に無料体験を使った」にチェックがあるので、無料体験の案内は出していません。'));
      } else if (net > 0 && (!top || top.key !== r.key)) {
        li.appendChild(makeLink(r, 'card', i + 1));
      }
      list.appendChild(li);
    });

    updateSticky(rows, top, bestOwned, res.pending);
    lastStatus = rows.length ? msg : '';
    // GA4: 数字が入った行がある時だけ、入力が止まって2秒後、結果が変わった時に1回送る。区分はこの時点の値
    clearTimeout(gaTimer);
    if (!rows.length || !gaReady) return;
    var sig = JSON.stringify(rows.map(function (r) { return [r.key, Math.round(r.net)]; }));
    var params = {
      top_service: top ? top.key : 'none',
      n_profitable: nProfit,
      n_rows: rows.length,
      n_links: document.querySelectorAll('#result a[data-service], #result-detail a[data-service]').length,
      entry: entryUse || 'none',
      is_student: res.isStudent ? 'yes' : 'no',
      order_band: res.bands.order_band,
      read_band: res.bands.read_band,
      listen_band: res.bands.listen_band,
      music_band: res.bands.music_band
    };
    gaTimer = setTimeout(function () {
      if (sig === lastSig || typeof window.gtag !== 'function') return;
      lastSig = sig;
      window.gtag('event', 'calc_complete', params);
    }, 2000);
  }
  var gaTimer = null, lastSig = '', gaReady = false, lastStatus = '';

  // スマホで結果が画面の外にある時だけ、下に「いちばん得」の帯を出す
  var sticky = document.getElementById('sticky-result');
  var stickyText = document.getElementById('sticky-text');
  var resultInView = false;
  var formFocused = false;
  function updateSticky(rows, top, bestOwned, pending) {
    if (!rows.length) { sticky.hidden = true; return; }
    var r = top ? SHORT[top.key] + 'が月+' + Math.round(top.net).toLocaleString('ja-JP') + '円 得(目安)'
      : (bestOwned ? '入っている' + SHORT[bestOwned.key] + 'は月+' + Math.round(bestOwned.net).toLocaleString('ja-JP') + '円 得(目安)' : '今は元が取れる計算のものなし');
    stickyText.textContent = r;
    sticky.hidden = resultInView || formFocused;
  }
  // 入力中は帯を隠して、フォーカスした欄が帯の後ろに入らないようにする
  form.addEventListener('focusin', function (e) {
    if (e.target.matches('input, button, summary')) { formFocused = true; sticky.hidden = true; }
  });
  form.addEventListener('focusout', function () {
    formFocused = false;
    setTimeout(function () { if (!formFocused && document.querySelectorAll('#cards li').length && !resultInView) sticky.hidden = false; }, 50);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      resultInView = es[0].isIntersecting;
      if (resultInView) sticky.hidden = true;
      else if (document.querySelectorAll('#cards li').length && !formFocused) sticky.hidden = false;
    }).observe(out);
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

  // 選んだサービスの質問だけ開く
  function syncSections() {
    var any = false;
    document.querySelectorAll('.tile input[data-sec]').forEach(function (cb) {
      document.getElementById(cb.dataset.sec).hidden = !cb.checked;
      cb.closest('.tile').classList.toggle('is-on', cb.checked);
      if (cb.checked) any = true;
    });
    document.getElementById('step-guide-text').textContent = any ? '選んだものの質問に答える(答えるとすぐ結果が変わります)' : '上で選ぶと、ここに質問が出ます。';
    document.getElementById('step-guide').classList.toggle('is-active', any);
  }

  // 入力のたびに計算し直す(少し待ってから)
  var liveTimer = null;
  function live(fix) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      fixMode = !!fix; render(compute()); fixMode = false;
      if (fix) announce();
    }, 150);
  }

  // 指定のタイルを入れて、その質問へ移動する(本文の「自分の数字で計算する」・結果の「同じように計算できます」)
  function openUse(id, student) {
    var cb = document.getElementById(id);
    if (!cb) return;
    if (student && !checked('is-student')) { document.getElementById('is-student').checked = true; syncStudent(); }
    if (!cb.checked) cb.checked = true;
    syncSections();
    live(true);
    var sec = document.getElementById(cb.dataset.sec);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    var first = sec.querySelector('input[type="number"]');
    if (first) first.focus({ preventScroll: true });
  }
  document.querySelectorAll('.btn-back[data-use]').forEach(function (b) {
    b.addEventListener('click', function () { openUse(b.dataset.use, b.dataset.student === '1'); });
  });
  // タイルを入れた時、開いた質問が画面の下に隠れていれば少しだけ動かす
  document.querySelectorAll('.tile input[data-sec]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (!cb.checked) return;
      var sec = document.getElementById(cb.dataset.sec);
      setTimeout(function () {
        var r = sec.getBoundingClientRect();
        if (r.top > window.innerHeight - 80) sec.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }, 0);
    });
  });
  // URLの ?use=shop|read|listen|music で、最初に選ぶタイルを決める(決まった値だけ受け付ける)
  var entryUse = '';
  (function () {
    var m = { shop: 'use-shop', read: 'use-read', listen: 'use-listen', music: 'use-music' };
    var v = new URLSearchParams(location.search).get('use');
    if (v && m[v]) {
      entryUse = v;
      document.getElementById(m[v]).checked = true;
    }
  })();

  // 読み上げ用: 確定した時だけ、結果を1文で知らせる
  var statusEl = document.getElementById('live-status');
  var statusTimer = null;
  function announce() {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = lastStatus; }, 800);
  }

  // −/+ボタン
  document.querySelectorAll('.step[data-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = document.getElementById(btn.dataset.target);
      var v = parseFloat(t.value) || 0;
      t.value = String(Math.min(1000000, Math.max(0, Math.floor(v + parseFloat(btn.dataset.step)))));
      t.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

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
  syncSections();
  form.addEventListener('change', function (e) {
    if (e.target.matches('.tile input')) syncSections();
    live(true);
  });
  form.addEventListener('input', function () { live(false); });

  function goResult() {
    clearTimeout(liveTimer);
    fixMode = true;
    render(compute());
    fixMode = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    out.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    summary.focus({ preventScroll: true });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); goResult(); });
  document.getElementById('sticky-link').addEventListener('click', function (e) { e.preventDefault(); goResult(); });
  form.addEventListener('reset', function () {
    setTimeout(function () {
      document.querySelectorAll('#calc details[open]').forEach(function (d) { d.open = false; });
      lastSig = '';
      syncStudent();
      syncSections();
      render(compute());
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 10 });
      document.getElementById('use-shop').focus();
    }, 0);
  });
  render(compute());
  gaReady = true;  // 読み込み直後(ブラウザが入力値を戻した時)は送らない
})();
