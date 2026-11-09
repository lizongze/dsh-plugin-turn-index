/**
 * dsh-plugin-turn-index — Host half.
 *
 * The feature lives entirely in the browser half (`lib/client.js`), which is
 * loaded from this package's `dsh.client` declaration. This entry exists so the
 * package is a valid profile bundle row; it contributes no Host services.
 */

/** Cordis plugin name. */
export const name = 'dsh-plugin-turn-index'

/** No Host-side behaviour. */
export function apply() {}
