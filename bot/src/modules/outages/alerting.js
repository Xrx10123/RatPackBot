/** Pure status/alert logic, kept free of Discord + DB so it can be unit-tested. */

export function toStatus(indicator) {
  if (indicator === 'none') return 'up';
  if (indicator === 'minor') return 'degraded';
  return 'down'; // major | critical
}

/** How many consecutive failed status-page fetches count as the service being down. */
export const FETCH_FAILURE_THRESHOLD = 3;

/**
 * Decides what a poll result means for a monitor.
 *
 * `fetchFailed` is a failure to reach the status page at all (as opposed to
 * the page reporting an incident). One blip used to read as "down" and ping
 * @here immediately, then "recovered" five minutes later — so a fetch
 * failure only counts as down after FETCH_FAILURE_THRESHOLD in a row.
 *
 * Alerting is incident-based rather than edge-based: a down alert fires
 * once whenever the service reaches 'down' without an open incident (so
 * up → degraded → down alerts, which the old up→down edge check missed),
 * and the recovery fires once it's fully 'up' again (so down → degraded → up
 * still gets its "back online"). The very first check of a new monitor
 * never alerts — there's no baseline yet.
 *
 * @returns {{ status: string|null, failCount: number, alerting: boolean, notify: 'down'|'recovered'|null }}
 *   status null means "keep the last known status".
 */
export function evaluatePoll({ lastStatus, alerting, failCount }, { indicator, fetchFailed }) {
  let status;
  let nextFailCount = 0;

  if (fetchFailed) {
    nextFailCount = (failCount ?? 0) + 1;
    if (nextFailCount < FETCH_FAILURE_THRESHOLD) {
      return { status: null, failCount: nextFailCount, alerting: Boolean(alerting), notify: null };
    }
    status = 'down';
  } else {
    status = toStatus(indicator);
  }

  const isFirstCheck = lastStatus == null;
  if (status === 'down' && !alerting && !isFirstCheck) {
    return { status, failCount: nextFailCount, alerting: true, notify: 'down' };
  }
  if (status === 'up' && alerting) {
    return { status, failCount: nextFailCount, alerting: false, notify: 'recovered' };
  }
  return { status, failCount: nextFailCount, alerting: Boolean(alerting), notify: null };
}

/**
 * Normalizes what someone types into /outage add into a bare Statuspage
 * hostname — people paste "https://status.example.com/" as often as the
 * bare host. Returns null for anything that isn't a plausible public
 * hostname (no IPs, no localhost, no ports or paths), since this value is
 * fetched server-side.
 */
export function normalizeStatusHost(input) {
  let host = String(input ?? '').trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0];
  if (host.length === 0 || host.length > 70) return null;
  if (!/^(?=.{1,70}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return null;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return null;
  return host;
}
