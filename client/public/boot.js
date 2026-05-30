// Supabase invite / password-recovery links arrive with a one-time token in the
// URL hash. Capture that intent here — before the JS bundle and supabase-js load
// and consume the hash — so the app can route the user to /seteaza-parola even
// if Supabase fell back to the site root because the redirect URL wasn't
// allow-listed.
//
// Lives as an external file (not inline) so the production Content-Security-
// Policy can use `script-src 'self'` with no inline-script allowance.
(function () {
  try {
    if (/[#&]type=(invite|recovery)(\b|=)/.test(location.hash)) {
      sessionStorage.setItem("pw-setup-pending", "1");
    }
  } catch (e) {}
})();
