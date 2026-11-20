// GA4計測。ローカル開発サーバーからのアクセスは除外する。
// GA4プロパティ「診断ツール群」(549448334)のウェブストリーム「元とれ電卓」(16383215326、2026-11-21作成)。
// 入力した数字そのものは送らない(app.jsのcalc_completeも区分だけ)。
(function () {
  const GA_MEASUREMENT_ID = 'G-DZB40ZFEKH';
  const isLocalDev = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID) || isLocalDev) return;
  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(gaScript);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // 入力値はURLに載らないが、念のためクエリはutm_だけ残す
  const keep = new URLSearchParams();
  new URLSearchParams(location.search).forEach((v, k) => { if (k.startsWith('utm_')) keep.set(k, v); });
  const qs = keep.toString();
  window.gtag('config', GA_MEASUREMENT_ID, { page_location: location.origin + location.pathname + (qs ? '?' + qs : '') });

  // Amazonへのリンクはaffiliate_click(どのサービス・どこに置いたリンクか・得の帯)、それ以外の外部リンクはoutbound_click。
  // 中ボタンで新しいタブに開いた分も数えるため、auxclickも同じ処理で拾う
  function netBand(n) {
    if (!isFinite(n)) return '';
    if (n <= 0) return 'loss';
    if (n <= 500) return '1-500';
    if (n <= 1500) return '501-1500';
    return '1501+';
  }
  function onLinkClick(e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (url.hostname === location.hostname) return;
    // affiliate_clickは計算結果のリンク(data-serviceつき)だけ。出典のAmazonヘルプなどはoutbound_clickに数える
    if (a.dataset.service) {
      window.gtag('event', 'affiliate_click', {
        service: a.dataset.service,
        placement: a.dataset.placement || 'other',
        rank: a.dataset.rank || '',
        net_band: netBand(parseFloat(a.dataset.net)),
        link_type: a.dataset.linkType || ''
      });
    } else {
      window.gtag('event', 'outbound_click', {
        link_domain: url.hostname,
        link_text: (a.textContent || '').trim().slice(0, 100)
      });
    }
  }
  document.addEventListener('click', onLinkClick, true);
  document.addEventListener('auxclick', function (e) { if (e.button === 1) onLinkClick(e); }, true);
})();
