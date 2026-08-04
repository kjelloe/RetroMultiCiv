// Graphics diagnostics (design contributed by the project's WebGL ally).
// Separate canvases per context type: asking one canvas for "webgl" after it
// already returned a "webgl2" context yields null and under-reports support.
export function getGraphicsDiagnostics() {
  let webgl2 = null, webgl1 = null, why = null;
  // When a browser REFUSES a context it fires webglcontextcreationerror with a
  // statusMessage saying why — blocklisted driver, hardware acceleration off,
  // failed ANGLE init. Without it all a blocked player learns is "unavailable",
  // which is the least useful true statement we could make.
  const onFail = e => { if (!why && e.statusMessage) why = e.statusMessage; };
  try {
    const c = document.createElement('canvas');
    c.addEventListener('webglcontextcreationerror', onFail, false);
    webgl2 = c.getContext('webgl2');
  } catch (_e) { /* unsupported */ }
  try {
    const c = document.createElement('canvas');
    c.addEventListener('webglcontextcreationerror', onFail, false);
    webgl1 = c.getContext('webgl') || c.getContext('experimental-webgl');
  } catch (_e) { /* unsupported */ }
  const gl = webgl2 || webgl1;
  const diag = { webgl2: Boolean(webgl2), webgl1: Boolean(webgl1), renderer: null, vendor: null, why };
  if (gl) {
    // Firefox exposes the real GPU via plain RENDERER/VENDOR (its
    // WEBGL_debug_renderer_info is deprecated and warns). Chrome/Safari mask
    // the plain values, so fall back to the extension only when needed.
    diag.renderer = gl.getParameter(gl.RENDERER);
    diag.vendor = gl.getParameter(gl.VENDOR);
    if (/webkit|mozilla|apple gpu/i.test(`${diag.renderer} ${diag.vendor}`)) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      if (info) {
        diag.renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
        diag.vendor = gl.getParameter(info.UNMASKED_VENDOR_WEBGL);
      }
    }
  }
  return diag;
}

export function showDiagnostics(diag) {
  const el = document.getElementById('hud-diag');
  el.textContent =
    `WebGL2: ${diag.webgl2 ? 'yes' : 'NO'} · WebGL1: ${diag.webgl1 ? 'yes' : 'NO'}\n` +
    `GPU: ${diag.renderer || 'none'}\n` +
    `vendor: ${diag.vendor || 'none'} · ${navigator.userAgent.match(/(firefox|edg|chrome)\/[\d.]+/i)?.[0] || 'browser'}` +
    (diag.why ? `\nbrowser said: ${diag.why}` : '') +
    (diag.webgl2 ? '' : diag.webgl1 ? '\nrunning on the WebGL1 fallback (three r162)' : '');
}

// Browser-AWARE, because the one message a blocked player ever sees used to send
// Firefox users to chrome:// URLs that do not exist in their browser. `ua` is a
// parameter so this is unit-testable without a real browser.
export function webglHelp(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const lead = 'WebGL is unavailable, so the 3D map cannot start. ';
  if (/firefox|gecko\//i.test(ua) && !/chrome|edg\//i.test(ua)) {
    return lead +
      'In Firefox: open about:support and read the Graphics section — it names ' +
      'the reason (a blocklisted driver, or hardware acceleration off). ' +
      'Enable Settings → General → Performance → "Use hardware acceleration when ' +
      'available". If the driver is blocklisted, about:config → ' +
      'webgl.force-enabled = true overrides it. Restart Firefox fully afterwards, ' +
      'or try another browser.';
  }
  if (/safari/i.test(ua) && !/chrome|chromium|edg\//i.test(ua)) {
    return lead +
      'In Safari: Settings → Advanced → "Show features for web developers", then ' +
      'Develop → Experimental Features and check that WebGL is enabled. ' +
      'Safari also disables WebGL in Lockdown Mode. Or try another browser.';
  }
  return lead +
    'In Chrome or Edge: check that hardware acceleration is on ' +
    '(chrome://settings/system), review chrome://gpu for the reason, and fully ' +
    'restart the browser (chrome://restart — a crashed GPU process reports ' +
    '"BindToCurrentSequence failed" until you do). Or try another browser.';
}

// A centered, actionable panel for the one case a player cannot recover from on
// their own: no WebGL at all, so nothing renders. Plain text in the corner was
// not enough — it is easy to miss, and it cannot carry a pref name you have to
// type exactly. `ua` and `diag` are parameters so this is testable headless.
//
// The Firefox branch is the REMEDY THAT ACTUALLY WORKED on a real report
// (2026-08-04): ANGLE could not find an EGL config on an Intel Iris Xe with a
// January-2026 driver — WebRender and WebGPU both fine, so not a dead GPU and
// not a blocklist — and webgl.angle.force-warp plus a FULL restart fixed it.
// The restart detail matters: closing the window is not enough.
export function webglBlockedHtml(diag = {}, ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const isFirefox = /firefox|gecko\//i.test(ua) && !/chrome|edg\//i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|edg\//i.test(ua);
  const esc = t => String(t == null ? '' : t)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // The browser's own reason, when it gave one — far more useful than ours.
  const reason = diag.why
    ? `<p class="wb-reason">Your browser reported: <code>${esc(diag.why)}</code></p>`
    : '';
  // EGL_NO_CONFIG is the signature of the case we have a verified fix for.
  const eglNoConfig = /EGL_NO_CONFIG|EXHAUSTED_DRIVERS/i.test(String(diag.why || ''));

  let steps;
  if (isFirefox) {
    steps =
      `<li><strong>Enable software rendering for 3D.</strong> Open a new tab, go to
        <code>about:config</code>, accept the warning, search for
        <code>webgl.angle.force-warp</code> and set it to <strong>true</strong>.</li>
       <li><strong>Restart Firefox completely</strong> — quit the whole browser, not
        just this window. The setting does not take effect otherwise.</li>
       <li>If that does not do it, hand Firefox your other GPU: Windows
        <em>Settings → Display → Graphics → Firefox → High performance</em>.</li>`
      + (eglNoConfig
        ? `<li class="wb-note">Your error is <code>EGL_NO_CONFIG</code>, which usually
             means a graphics-driver update broke the translation layer rather than
             anything being wrong with your hardware. Rolling the display driver
             back also fixes it.</li>`
        : '');
  } else if (isSafari) {
    steps =
      `<li>Safari → <em>Settings → Advanced</em> → tick
        <strong>Show features for web developers</strong>.</li>
       <li>Then <em>Develop → Experimental Features</em> and make sure WebGL is enabled.</li>
       <li>WebGL is also switched off entirely by <strong>Lockdown Mode</strong>.</li>`;
  } else {
    steps =
      `<li>Check hardware acceleration is on: <code>chrome://settings/system</code>.</li>
       <li>Open <code>chrome://gpu</code> — it names the reason near the top.</li>
       <li>Restart the browser fully via <code>chrome://restart</code>. A crashed GPU
        process reports "BindToCurrentSequence failed" until you do.</li>`;
  }

  return `<div class="wb-card" role="alertdialog" aria-labelledby="wb-title">
  <h2 id="wb-title">The 3D map can\u2019t start on this browser</h2>
  <p>Everything else about the game works \u2014 this is a graphics-driver problem
     on this machine, not a problem with your game or your connection.</p>
  ${reason}
  <p><strong>How to fix it${isFirefox ? ', in order' : ''}:</strong></p>
  <ol>${steps}</ol>
  <p class="wb-foot">Software rendering is slower than your graphics card, but the
     game is turn-based and stays perfectly playable on it.</p>
</div>`;
}

