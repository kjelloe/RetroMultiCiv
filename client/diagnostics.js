// Graphics diagnostics (design contributed by the project's WebGL ally).
// Separate canvases per context type: asking one canvas for "webgl" after it
// already returned a "webgl2" context yields null and under-reports support.
export function getGraphicsDiagnostics() {
  let webgl2 = null, webgl1 = null;
  try { webgl2 = document.createElement('canvas').getContext('webgl2'); } catch (_e) { /* unsupported */ }
  try {
    const c = document.createElement('canvas');
    webgl1 = c.getContext('webgl') || c.getContext('experimental-webgl');
  } catch (_e) { /* unsupported */ }
  const gl = webgl2 || webgl1;
  const diag = { webgl2: Boolean(webgl2), webgl1: Boolean(webgl1), renderer: null, vendor: null };
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
    (diag.webgl2 ? '' : diag.webgl1 ? '\nrunning on the WebGL1 fallback (three r162)' : '');
}

export function webglHelp() {
  return 'WebGL is unavailable. Check that hardware acceleration is enabled ' +
    '(chrome://settings/system), review chrome://gpu, fully restart the browser ' +
    '(chrome://restart — a crashed GPU process gives "BindToCurrentSequence failed" ' +
    'until restart), or try another browser.';
}
