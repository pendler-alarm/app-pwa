const API_MODE_STORAGE_KEY = 'workflow-api-mode';
const LOCAL_API_BASE = '/api/workflow';
const LIVE_API_BASE = 'http://188.64.43.112:11000/workflow';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

function readInitialApiMode() {
  if (typeof window === 'undefined') {
    return 'live';
  }
  return window.localStorage.getItem(API_MODE_STORAGE_KEY) === 'local'
    ? 'local'
    : 'live';
}

let apiMode = readInitialApiMode();

function getApiBase() {
  return apiMode === 'local' ? LOCAL_API_BASE : LIVE_API_BASE;
}

export function getApiMode() {
  return apiMode;
}

export function setApiMode(nextMode) {
  apiMode = nextMode === 'local' ? 'local' : 'live';
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(API_MODE_STORAGE_KEY, apiMode);
  }
}

async function request(path, params = {}, options = {}) {
  const url = new URL(`${getApiBase()}${path}`, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json();
}

async function requestJson(url, params = {}, options = {}) {
  const requestUrl = new URL(url);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      requestUrl.searchParams.set(key, value);
    }
  });

  const response = await fetch(requestUrl.toString(), options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json();
}

export const workflowApi = {
  getStations() {
    return request('/stations');
  },
  getTrains({ station_ifopt, station_name }) {
    return request('/trains', { station_ifopt, station_name });
  },
  getDecision({ origin, origin_lat, origin_lon, train_id, station_ifopt, station_name }) {
    return request('/decision', { origin, origin_lat, origin_lon, train_id, station_ifopt, station_name });
  },
  getCommuterNotification({ origin, origin_lat, origin_lon, train_id, station_ifopt, station_name }) {
    return request('/notifications/commuter', { origin, origin_lat, origin_lon, train_id, station_ifopt, station_name });
  },
  searchAddressCoordinates(query) {
    return requestJson(
      NOMINATIM_SEARCH_URL,
      {
        q: query,
        format: 'jsonv2',
        limit: 1,
        addressdetails: 1,
      },
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': typeof navigator !== 'undefined' ? navigator.language || 'de-DE' : 'de-DE',
        },
      },
    );
  },
};
