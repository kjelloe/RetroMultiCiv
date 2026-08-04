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
