/** The platform's mark, from its one file: packages/shared/brand/logo.svg, served as <base>logo.svg (vite.config's publicDir).
 *  The sidebar, the phone's header, the login and the Super Admin draw it through here; both apps' favicon is the same file
 *  (index.html) and the APK icons are rendered from it (scripts/gerar-icones.mjs). A new logo is a new logo.svg (then run that
 *  script). Decorative: name it on the link around it. */
export function Logo({ size }: { size: number }) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={size} height={size} style={{ display: "block", flex: `0 0 ${size}px` }} />;
}
