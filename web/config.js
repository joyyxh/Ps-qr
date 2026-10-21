// Browser-safe settings only. The publishable key is designed to be public.
// Do NOT add a service-role key or any payment secret to this file.
window.PRINTNEST_CONFIG = {
  supabaseUrl: 'https://qvnwqrevgyootaaunrto.supabase.co',
  publishableKey: 'sb_publishable_KD8Le_sBbkckDqo727k76Q_e5LH2dZI',
  // The public address of the customer page, used inside shop QR codes, for example
  // 'https://printnest.example/'. Set this before printing QR codes. Leave it empty
  // to use the address of the page itself.
  publicBaseUrl: 'https://cdn.jsdelivr.net/gh/joyyxh/Ps-qr@gh-pages/index.html',
  // HTTPS page that receives Supabase email-confirmation links. The mobile
  // build sets this from PRINTNEST_PUBLIC_URL; leave empty in source until the
  // real deployed site URL is known.
  authRedirectUrl: 'https://cdn.jsdelivr.net/gh/joyyxh/Ps-qr@gh-pages/index.html',
  ownerApp: false,
};
