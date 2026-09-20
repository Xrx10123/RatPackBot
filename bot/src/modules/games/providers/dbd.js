import { config } from '../../../config.js';
import { fetchJson } from '../../../utils/httpJson.js';

export function isConfigured() {
  return Boolean(config.dbd.apiBaseUrl);
}

/**
 * The build plan references a "DBD-Database wiki API" for killer/survivor
 * perks and characters, but no stable public host for it could be confirmed —
 * the closest match on GitHub (Techial/DBD-Database) is a self-hostable
 * Express+MongoDB app with no documented public deployment. Rather than
 * guess a URL, this stays off by default; set DBD_API_BASE_URL once you have
 * a working instance and these will start resolving.
 */
export async function getKillerPerks() {
  if (!isConfigured()) throw new Error('DBD_API_BASE_URL is not configured');
  return fetchJson(`${config.dbd.apiBaseUrl.replace(/\/$/, '')}/API/v1/killer_perks`);
}

export async function getSurvivorPerks() {
  if (!isConfigured()) throw new Error('DBD_API_BASE_URL is not configured');
  return fetchJson(`${config.dbd.apiBaseUrl.replace(/\/$/, '')}/API/v1/survivor_perks`);
}
