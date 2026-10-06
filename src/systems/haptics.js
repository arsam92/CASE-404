/* CASE 404 — haptic feedback (Vibration API).
   Fails silently on desktop / unsupported browsers. */

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const Haptics = {
  /** Light tap — UI click, select */
  light() {
    if (canVibrate) navigator.vibrate(12);
  },
  /** Medium — stamp, evidence found, phone notify */
  medium() {
    if (canVibrate) navigator.vibrate([18, 30, 18]);
  },
  /** Success pulse — contradiction broken, strong reveal */
  success() {
    if (canVibrate) navigator.vibrate([30, 40, 30, 40, 50]);
  },
  /** Fail / wrong evidence */
  fail() {
    if (canVibrate) navigator.vibrate([60, 40, 80]);
  },
  /** Threat escalation — long unsettling pattern */
  threat() {
    if (canVibrate) navigator.vibrate([40, 60, 40, 60, 40, 120, 80]);
  },
  /** Custom pattern (ms array) */
  custom(pattern) {
    if (canVibrate) navigator.vibrate(pattern);
  }
};
