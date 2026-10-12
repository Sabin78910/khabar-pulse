export const LICENSING_HASH = "#/licensing";
export const DMCA_URL = "https://github.com/Sabin78910/khabar-pulse/issues/new";
export const DMCA_RESPONSE_HOURS = 72;

export function isLicensingHash(hash: string): boolean {
  return hash.replace(/\/+$/, "") === LICENSING_HASH;
}
