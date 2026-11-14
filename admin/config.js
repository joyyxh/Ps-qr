// Browser-safe settings only. The publishable key is designed to be public.
// Never add a service-role, secret or payment key to this file.
//
// This build leaves both values empty on purpose. With empty values the panel shows
// "not configured" and sends no request. A private deployment sets them. Hosting is still an
// open decision (STAGE7_DECISIONS.md §14.2 item 6), so no value is set here.
window.QRQUICK_ADMIN_CONFIG = {
  supabaseUrl: '',
  publishableKey: '',
};
