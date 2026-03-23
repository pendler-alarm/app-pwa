<template>
  <div class="home">
    <home-hero
      :is-authorized="isAuthorized"
      :api-mode-label="apiModeLabel"
      @login="loginWithGoogle"
      @refresh="refreshAll"
      @logout="logout"
      @toggle-api-mode="toggleApiMode"
    />

    <div v-if="isBusy" class="status-message">Lade Daten...</div>
    <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

    <template v-if="isAuthorized">
      <section class="dashboard-grid">
        <event-list-panel
          :events="upcomingEvents"
          :loading="eventsLoading"
          :selected-event-id="selectedEventId"
          :decision-loading="decisionLoading"
          :previews="eventConnectionPreviews"
          :format-event-date="formatEventDate"
          :relative-date-label="relativeDateLabel"
          @select-event="selectEvent"
          @calculate-for-event="calculateConnectionForEvent"
        />

        <manual-connection-widget
          :origin-mode="manualForm.originMode"
          :origin-input="manualForm.originInput"
          :destination-input="manualForm.destinationInput"
          :resolved-origin="manualConnection.origin"
          :origin-refreshing="manualConnection.originRefreshing"
          :resolved-destination="manualConnection.destination"
          :station="manualConnection.station"
          :distance-label="manualConnection.distanceLabel"
          :trains="manualConnection.trains"
          :debug-data="manualConnection.debugData"
          :loading="manualConnection.loading"
          :preview-loading="manualConnection.previewLoading"
          :preview-error="manualConnection.error"
          :decision-loading="decisionLoading"
          :format-coords="formatCoords"
          @resolve="resolveManualConnection"
          @refresh-origin="refreshCurrentLocation"
          @calculate="calculateManualConnection"
          @update:origin-mode="manualForm.originMode = $event"
          @update:origin-input="manualForm.originInput = $event"
          @update:destination-input="manualForm.destinationInput = $event"
        />
      </section>

      <section class="results-grid">
        <decision-panel
          :decision="decision"
          :decision-risk-level="decisionRiskLevel"
          :context-label="decisionContextLabel"
          :risk-label="riskLabel"
        />

        <notification-panel
          :loading="notificationLoading"
          :notification="commuterNotification"
          :notification-class="notificationClass"
        />
      </section>
    </template>
  </div>
</template>

<script>
import HomeHero from '../components/home/HomeHero.vue';
import EventListPanel from '../components/home/EventListPanel.vue';
import ManualConnectionWidget from '../components/home/ManualConnectionWidget.vue';
import DecisionPanel from '../components/home/DecisionPanel.vue';
import NotificationPanel from '../components/home/NotificationPanel.vue';
import { getApiMode, setApiMode, workflowApi } from '../services/workflowApi';

const AUTH_STORAGE_KEY = 'pendler-alarm-google-auth';
const LOCATION_CACHE_KEY = 'pendler-alarm-location-cache-v1';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

function createInitialManualConnection() {
  return {
    loading: false,
    previewLoading: false,
    originRefreshing: false,
    debugData: null,
    error: '',
    origin: null,
    destination: null,
    station: null,
    trains: [],
    distanceLabel: '',
  };
}

export default {
  name: 'Home',
  components: {
    HomeHero,
    EventListPanel,
    ManualConnectionWidget,
    DecisionPanel,
    NotificationPanel,
  },
  data() {
    return {
      accessToken: null,
      tokenClient: null,
      isAuthorized: false,
      isLoading: false,
      eventsLoading: false,
      stationsLoading: false,
      decisionLoading: false,
      notificationLoading: false,
      errorMessage: '',
      events: [],
      stations: [],
      selectedEventId: '',
      decision: null,
      commuterNotification: null,
      decisionContextLabel: '',
      eventConnectionPreviews: {},
      manualForm: {
        originMode: 'current',
        originInput: '',
        destinationInput: '',
      },
      manualConnection: createInitialManualConnection(),
      apiMode: getApiMode(),
      googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      calendarScope: 'https://www.googleapis.com/auth/calendar',
    };
  },
  computed: {
    upcomingEvents() {
      return this.events
        .filter((event) => event.startDate && event.location)
        .sort((left, right) => left.startDate - right.startDate)
        .slice(0, 8);
    },
    decisionRiskLevel() {
      return this.decision?.system_insight?.risk_level || 'medium';
    },
    apiModeLabel() {
      return this.apiMode === 'local' ? 'Lokal' : 'Live';
    },
    isBusy() {
      return this.isLoading || this.eventsLoading || this.stationsLoading;
    },
    notificationClass() {
      const severity = this.commuterNotification?.severity;
      if (severity === 'critical') {
        return 'notification-card--critical';
      }
      if (severity === 'warning') {
        return 'notification-card--warning';
      }
      return 'notification-card--ok';
    },
  },
  methods: {
    parseCalendarDate(value) {
      const input = String(value || '').trim();
      const compactMatch = input.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
      if (compactMatch) {
        const [, year, month, day, hour, minute, second, zulu] = compactMatch;
        if (zulu) {
          return new Date(
            Date.UTC(
              Number(year),
              Number(month) - 1,
              Number(day),
              Number(hour),
              Number(minute),
              Number(second),
            ),
          );
        }
        return new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
        );
      }
      const fallback = new Date(input);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    },
    enrichEvents(items) {
      return items
        .map((event) => {
          const startDate = this.getEventDate(event);
          if (!startDate || startDate.getTime() < Date.now()) {
            return null;
          }
          return {
            ...event,
            startDate,
            resolvedLocation: null,
            locationError: '',
            isResolvingLocation: false,
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.startDate - right.startDate);
    },
    getEventDate(event) {
      const value = (event.start && (event.start.dateTime || event.start.date)) || '';
      if (!value) {
        return null;
      }
      return this.parseCalendarDate(value);
    },
    formatEventDate(date) {
      if (!(date instanceof Date)) {
        return '';
      }
      return new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    },
    relativeDateLabel(date) {
      if (!(date instanceof Date)) {
        return '';
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(date);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((target - today) / 86400000);
      if (diffDays === 0) {
        return 'Heute';
      }
      if (diffDays === 1) {
        return 'Morgen';
      }
      return `In ${diffDays} Tagen`;
    },
    formatCoords(lat, lon) {
      return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
    },
    formatDistance(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '';
      }
      return value < 1 ? `${Math.round(value * 1000)} m entfernt` : `${value.toFixed(1)} km entfernt`;
    },
    riskLabel(level) {
      if (level === 'low') {
        return 'Niedrig';
      }
      if (level === 'medium') {
        return 'Mittel';
      }
      return 'Hoch';
    },
    getLocationCache() {
      try {
        return JSON.parse(window.localStorage.getItem(LOCATION_CACHE_KEY) || '{}');
      } catch (error) {
        return {};
      }
    },
    setLocationCache(cache) {
      window.localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cache));
    },
    normalizeLocationKey(location) {
      return String(location || '').trim().toLowerCase();
    },
    extractCoordinatesFromText(value) {
      const input = String(value || '').trim();
      if (!input) {
        return null;
      }

      const normalized = input.replace(/,/g, '.');
      const patterns = [
        /(?:^|[^\d-])(-?\d{1,2}\.\d+)\s*[,;/ ]\s*(-?\d{1,3}\.\d+)(?:[^\d.]|$)/,
        /[?&](?:q|query|ll|sll|destination|origin)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/i,
        /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      ];

      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) {
          continue;
        }

        const latitude = Number(match[1]);
        const longitude = Number(match[2]);
        if (
          Number.isNaN(latitude) ||
          Number.isNaN(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        ) {
          continue;
        }

        return { latitude, longitude };
      }

      return null;
    },
    cleanLocationText(location) {
      return String(location || '')
        .replace(/\bhttps?:\/\/\S+/gi, ' ')
        .replace(/\bwww\.\S+/gi, ' ')
        .replace(/\bmeet\.google\.com\/\S+/gi, ' ')
        .replace(/\b(?:zoom|teams|webex)\b[^\n,;]*/gi, ' ')
        .replace(/\b(?:ort|adresse|address|location)\s*:/gi, ' ')
        .replace(/\((?:online|remote|telefon|phone|call|meeting)[^)]*\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },
    normalizeAddressPart(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/,\s*,+/g, ', ')
        .trim()
        .replace(/^[,.\s]+|[,.\s]+$/g, '');
    },
    extractStreetAddress(value) {
      const streetPattern = /\b([A-Za-zÄÖÜäöüß0-9.'-]+(?:\s+[A-Za-zÄÖÜäöüß0-9.'-]+){0,5}\s+(?:str(?:aße|asse|\.?)|allee|weg|platz|gasse|ufer|damm|ring|chaussee|pfad|steg|kamp|markt|kai|zeile|promenade|hof|park|wall|stieg|ausbau|bogen|tor|plan|höhe|hoehe))\s*(\d{1,4}[A-Za-z]?(?:\s*[-/]\s*\d{1,4}[A-Za-z]?)?)?\b/i;
      const match = String(value || '').match(streetPattern);
      if (!match) {
        return '';
      }

      const street = this.normalizeAddressPart(match[1]);
      const houseNumber = this.normalizeAddressPart(match[2]);
      return this.normalizeAddressPart([street, houseNumber].filter(Boolean).join(' '));
    },
    extractPostalAddress(value) {
      const segments = String(value || '')
        .split(/\s*[\n,;|]\s*/)
        .map((segment) => this.normalizeAddressPart(segment))
        .filter(Boolean);

      for (const segment of segments) {
        const match = segment.match(/\b(\d{5})(?:\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.'-]*(?:\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.'-]*){0,3}))?\b/);
        if (!match) {
          continue;
        }

        return this.normalizeAddressPart([match[1], match[2]].filter(Boolean).join(' '));
      }

      return '';
    },
    sanitizeLocationQuery(location) {
      const input = String(location || '').trim();
      if (!input) {
        return '';
      }

      const sanitized = this.cleanLocationText(input)
        .replace(/\s+/g, ' ')
        .trim();

      if (!sanitized || this.extractCoordinatesFromText(input)) {
        return '';
      }

      const streetAddress = this.extractStreetAddress(sanitized);
      const postalAddress = this.extractPostalAddress(sanitized);
      const extractedAddress = this.normalizeAddressPart(
        [streetAddress, postalAddress].filter(Boolean).join(', '),
      );
      if (extractedAddress.length >= 4) {
        return extractedAddress;
      }

      const parts = sanitized
        .split(/\s*[\n;|]\s*|\s{2,}/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^(online|remote|home office|telefon|phone|call|meeting)$/i.test(part));

      return this.normalizeAddressPart(parts.join(', ')).length >= 4
        ? this.normalizeAddressPart(parts.join(', '))
        : '';
    },
    resolveEmbeddedCoordinates(event) {
      const latitude = Number(event?.latitude ?? event?.geo?.lat);
      const longitude = Number(event?.longitude ?? event?.geo?.lon);
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        return {
          latitude,
          longitude,
          displayName: event?.geo?.displayName || event?.location || '',
          source: event?.geo?.source || 'event',
        };
      }

      const extracted = this.extractCoordinatesFromText(
        event?.location || event?.geo?.displayName || event?.description,
      );
      if (!extracted) {
        return null;
      }

      return {
        latitude: extracted.latitude,
        longitude: extracted.longitude,
        displayName: event?.location || event?.geo?.displayName || '',
        source: 'location-text',
      };
    },
    updateEventState(eventId, patch) {
      this.events = this.events.map((event) => (event.id === eventId ? { ...event, ...patch } : event));
    },
    updateEventPreview(eventId, patch) {
      this.eventConnectionPreviews = {
        ...this.eventConnectionPreviews,
        [eventId]: {
          ...(this.eventConnectionPreviews[eventId] || {}),
          ...patch,
        },
      };
    },
    matchStationFromText(value) {
      const input = String(value || '').trim().toLowerCase();
      if (!input) {
        return null;
      }

      const exactMatch = this.stations.find((station) => {
        return (
          String(station.ifopt || '').toLowerCase() === input ||
          String(station.name || '').toLowerCase() === input
        );
      });
      if (exactMatch) {
        return exactMatch;
      }

      const partialMatches = this.stations.filter((station) => {
        return (
          String(station.name || '').toLowerCase().includes(input) ||
          String(station.ifopt || '').toLowerCase().includes(input)
        );
      });

      return partialMatches.length === 1 ? partialMatches[0] : null;
    },
    async resolveLocationText(input, options = {}) {
      const rawInput = String(input || '').trim();
      if (!rawInput) {
        throw new Error(options.emptyMessage || 'Bitte eine Adresse, einen Bahnhof oder Koordinaten eingeben.');
      }

      const stationMatch = this.matchStationFromText(rawInput);
      if (stationMatch) {
        return {
          latitude: Number(stationMatch.latitude),
          longitude: Number(stationMatch.longitude),
          displayName: stationMatch.name,
          source: 'station',
          station: stationMatch,
        };
      }

      const embedded = this.extractCoordinatesFromText(rawInput);
      if (embedded) {
        return {
          latitude: embedded.latitude,
          longitude: embedded.longitude,
          displayName: rawInput,
          source: 'location-text',
        };
      }

      const searchQuery = this.sanitizeLocationQuery(rawInput);
      if (!searchQuery) {
        throw new Error(options.invalidMessage || 'Eingabe enthaelt keine geokodierbare Adresse.');
      }

      const results = await workflowApi.searchAddressCoordinates(searchQuery);
      const match = Array.isArray(results) ? results[0] : null;
      if (!match) {
        throw new Error(options.notFoundMessage || 'Adresse konnte nicht geokodiert werden.');
      }

      return {
        latitude: Number(match.lat),
        longitude: Number(match.lon),
        displayName: match.display_name || rawInput,
        source: 'nominatim',
      };
    },
    async resolveEventLocation(event) {
      if (!event || !event.location) {
        return null;
      }
      if (event.resolvedLocation) {
        return event.resolvedLocation;
      }

      this.updateEventState(event.id, {
        isResolvingLocation: true,
        locationError: '',
      });

      try {
        const cache = this.getLocationCache();
        const cacheKey = this.normalizeLocationKey(event.location);
        const cached = cache[cacheKey];
        const searchQuery = this.sanitizeLocationQuery(event.location);

        let resolved = cached || this.resolveEmbeddedCoordinates(event);
        if (!resolved) {
          if (!searchQuery) {
            throw new Error('Terminort enthaelt keine geokodierbare Adresse.');
          }

          const results = await workflowApi.searchAddressCoordinates(searchQuery);
          const match = Array.isArray(results) ? results[0] : null;
          if (!match) {
            throw new Error('Adresse konnte nicht geokodiert werden.');
          }
          resolved = {
            latitude: Number(match.lat),
            longitude: Number(match.lon),
            displayName: match.display_name || event.location,
            source: 'nominatim',
          };
        }

        if (!resolved || Number.isNaN(resolved.latitude) || Number.isNaN(resolved.longitude)) {
          throw new Error('Ungueltige Koordinaten fuer Terminort.');
        }

        const normalized = {
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          displayName: resolved.displayName || event.location,
          source: resolved.source || 'nominatim',
          updatedAt: new Date().toISOString(),
        };

        cache[cacheKey] = normalized;
        this.setLocationCache(cache);

        this.updateEventState(event.id, {
          resolvedLocation: normalized,
          isResolvingLocation: false,
          locationError: '',
        });

        return normalized;
      } catch (error) {
        this.updateEventState(event.id, {
          isResolvingLocation: false,
          locationError: error.message || 'Standort konnte nicht aufgeloest werden.',
        });
        throw error;
      }
    },
    toRadians(value) {
      return (value * Math.PI) / 180;
    },
    getDistanceKm(lat1, lon1, lat2, lon2) {
      const earthRadiusKm = 6371;
      const dLat = this.toRadians(lat2 - lat1);
      const dLon = this.toRadians(lon2 - lon1);
      const startLat = this.toRadians(lat1);
      const endLat = this.toRadians(lat2);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(startLat) * Math.cos(endLat) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadiusKm * c;
    },
    findNearestStation(coords) {
      if (!coords || this.stations.length === 0) {
        return null;
      }

      return this.stations.reduce((closest, station) => {
        const latitude = Number(station.latitude);
        const longitude = Number(station.longitude);
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
          return closest;
        }

        const distance = this.getDistanceKm(
          coords.latitude,
          coords.longitude,
          latitude,
          longitude,
        );

        if (!closest || distance < closest.distance) {
          return { ...station, distance };
        }

        return closest;
      }, null);
    },
    async getCurrentPosition() {
      if (!navigator.geolocation) {
        throw new Error('Geolocation wird von diesem Browser nicht unterstuetzt.');
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              displayName: 'Aktueller Standort',
              source: 'geolocation',
            });
          },
          () => reject(new Error('Aktueller Standort konnte nicht gelesen werden.')),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          },
        );
      });
    },
    async resolveCurrentLocationDetails() {
      const origin = await this.getCurrentPosition();

      try {
        const result = await workflowApi.reverseAddressCoordinates({
          latitude: origin.latitude,
          longitude: origin.longitude,
        });

        return {
          ...origin,
          address: result?.display_name || '',
        };
      } catch (error) {
        return {
          ...origin,
          address: '',
        };
      }
    },
    async initializeCurrentLocation(options = {}) {
      const { force = false, silent = true } = options;
      if (this.manualForm.originMode !== 'current') {
        return null;
      }
      if (this.manualConnection.origin && !force) {
        return this.manualConnection.origin;
      }

      this.manualConnection = {
        ...this.manualConnection,
        originRefreshing: true,
      };

      try {
        const origin = await this.resolveCurrentLocationDetails();
        this.manualConnection = {
          ...this.manualConnection,
          origin,
          originRefreshing: false,
        };
        return origin;
      } catch (error) {
        this.manualConnection = {
          ...this.manualConnection,
          origin: null,
          originRefreshing: false,
        };
        if (!silent) {
          this.errorMessage = error.message || 'Aktueller Standort konnte nicht gelesen werden.';
        }
        return null;
      }
    },
    async refreshCurrentLocation() {
      await this.initializeCurrentLocation({ force: true, silent: false });
    },
    async fetchTrainsForStation(stationId) {
      return workflowApi.getTrains({ station_ifopt: stationId });
    },
    async ensureEventPreview(event) {
      this.updateEventPreview(event.id, {
        loading: true,
        error: '',
        trains: [],
        station: null,
        distanceLabel: '',
        debugData: null,
      });

      try {
        const resolved = await this.resolveEventLocation(event);
        const nearestStation = this.findNearestStation(resolved);
        if (!nearestStation) {
          throw new Error('Kein passender Bahnhof fuer den Terminort gefunden.');
        }

        const trainsPayload = await this.fetchTrainsForStation(nearestStation.ifopt);
        const trains = trainsPayload.trains || [];
        this.updateEventPreview(event.id, {
          loading: false,
          error: '',
          station: nearestStation,
          trains,
          distanceLabel: this.formatDistance(nearestStation.distance),
          debugData: {
            station: nearestStation,
            resolvedOrigin: resolved,
            trainsResponse: trainsPayload,
          },
        });
      } catch (error) {
        this.updateEventPreview(event.id, {
          loading: false,
          error: error.message || 'Verbindungen konnten nicht geladen werden.',
          station: null,
          trains: [],
          distanceLabel: '',
          debugData: null,
        });
        this.errorMessage = error.message || 'Terminort konnte nicht verarbeitet werden.';
      }
    },
    readStoredAuth() {
      const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!rawValue) return null;
      try {
        const parsedValue = JSON.parse(rawValue);
        if (!parsedValue || !parsedValue.accessToken || !parsedValue.expiresAt) return null;
        if (parsedValue.expiresAt <= Date.now()) {
          this.clearStoredAuth();
          return null;
        }
        return parsedValue;
      } catch (error) {
        this.clearStoredAuth();
        return null;
      }
    },
    persistAuth(tokenResponse) {
      const expiresIn = Number(tokenResponse.expires_in || 0);
      const expiresAt = Date.now() + Math.max(expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS, 0);
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ accessToken: tokenResponse.access_token, expiresAt }),
      );
    },
    clearStoredAuth() {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === 'true') {
            resolve();
          } else {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener(
              'error',
              () => reject(new Error(`Failed to load script: ${src}`)),
              { once: true },
            );
          }
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.addEventListener(
          'load',
          () => {
            script.dataset.loaded = 'true';
            resolve();
          },
          { once: true },
        );
        script.addEventListener(
          'error',
          () => reject(new Error(`Failed to load script: ${src}`)),
          { once: true },
        );
        document.head.appendChild(script);
      });
    },
    async initGoogleIdentity() {
      await this.loadScript('https://accounts.google.com/gsi/client');
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.googleClientId,
        scope: this.calendarScope,
        callback: async (tokenResponse) => {
          if (!tokenResponse || !tokenResponse.access_token) {
            this.errorMessage = 'Google login failed.';
            return;
          }
          this.accessToken = tokenResponse.access_token;
          this.isAuthorized = true;
          this.errorMessage = '';
          this.persistAuth(tokenResponse);
          await this.loadEvents();
        },
      });
    },
    loginWithGoogle() {
      if (!this.tokenClient) {
        this.errorMessage = 'Google client not initialized.';
        return;
      }
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    },
    logout() {
      if (this.accessToken && window.google && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(this.accessToken);
      }
      this.clearStoredAuth();
      this.accessToken = null;
      this.isAuthorized = false;
      this.events = [];
      this.selectedEventId = '';
      this.decision = null;
      this.commuterNotification = null;
      this.decisionContextLabel = '';
      this.eventConnectionPreviews = {};
      this.errorMessage = '';
      this.manualConnection = createInitialManualConnection();
    },
    async apiFetch(url, options = {}) {
      if (!this.accessToken) {
        throw new Error('Missing access token');
      }
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (response.status === 401) {
        this.clearStoredAuth();
        this.isAuthorized = false;
        this.accessToken = null;
        throw new Error('Session expired. Please login again.');
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      if (response.status === 204) {
        return null;
      }
      return response.json();
    },
    async loadEvents() {
      this.eventsLoading = true;
      this.errorMessage = '';
      try {
        const params = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100',
          timeMin: new Date().toISOString(),
        });
        const data = await this.apiFetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        );
        this.events = this.enrichEvents(data.items || []);
        this.eventConnectionPreviews = {};
        if (!this.selectedEventId && this.upcomingEvents.length > 0) {
          await this.selectEvent(this.upcomingEvents[0]);
        }
      } catch (error) {
        this.errorMessage = error.message || 'Could not load events.';
      } finally {
        this.eventsLoading = false;
      }
    },
    async loadStations() {
      this.stationsLoading = true;
      this.errorMessage = '';
      try {
        this.stations = await workflowApi.getStations();
      } catch (error) {
        this.errorMessage = error.message || 'Bahnhoefe konnten nicht geladen werden.';
      } finally {
        this.stationsLoading = false;
      }
    },
    async selectEvent(event) {
      this.selectedEventId = event.id;
      this.errorMessage = '';
      await this.ensureEventPreview(event);
    },
    async calculateConnection(origin, station, trainId, contextLabel) {
      if (!origin || !station || !trainId) {
        this.errorMessage = 'Startpunkt, Bahnhof und Verbindung werden fuer die Berechnung benoetigt.';
        return;
      }

      this.decisionLoading = true;
      this.notificationLoading = true;
      this.errorMessage = '';

      try {
        const originString = `${origin.latitude},${origin.longitude}`;
        const [decision, notification] = await Promise.all([
          workflowApi.getDecision({
            origin: originString,
            origin_lat: origin.latitude,
            origin_lon: origin.longitude,
            train_id: trainId,
            station_ifopt: station.ifopt,
          }),
          workflowApi.getCommuterNotification({
            origin: originString,
            origin_lat: origin.latitude,
            origin_lon: origin.longitude,
            train_id: trainId,
            station_ifopt: station.ifopt,
          }),
        ]);

        this.decision = decision;
        this.commuterNotification = notification;
        this.decisionContextLabel = contextLabel;
      } catch (error) {
        this.errorMessage = error.message || 'Verbindung konnte nicht berechnet werden.';
      } finally {
        this.decisionLoading = false;
        this.notificationLoading = false;
      }
    },
    async calculateConnectionForEvent({ event, trainId }) {
      const preview = this.eventConnectionPreviews[event.id];
      if (!preview || !preview.station) {
        this.errorMessage = 'Bitte zuerst die Verbindungen fuer den Termin laden.';
        return;
      }

      const origin = event.resolvedLocation || (await this.resolveEventLocation(event));
      const contextLabel = `${event.summary || 'Ohne Titel'} · ${preview.station.name}`;
      await this.calculateConnection(origin, preview.station, trainId, contextLabel);
    },
    async resolveManualConnection() {
      this.manualConnection = {
        ...this.manualConnection,
        loading: true,
        previewLoading: true,
        error: '',
        trains: [],
        station: null,
        distanceLabel: '',
        debugData: null,
      };
      this.errorMessage = '';

      try {
        const origin = this.manualForm.originMode === 'current'
          ? (this.manualConnection.origin || (await this.initializeCurrentLocation({ force: true, silent: false })))
          : await this.resolveLocationText(this.manualForm.originInput, {
              emptyMessage: 'Bitte einen Startpunkt eingeben.',
            });

        if (!origin) {
          throw new Error('Aktueller Standort konnte nicht gelesen werden.');
        }
        const destination = await this.resolveLocationText(this.manualForm.destinationInput, {
          emptyMessage: 'Bitte ein Ziel eingeben.',
        });

        const station = destination.station || this.findNearestStation(destination);
        if (!station) {
          throw new Error('Kein passender Zielbahnhof gefunden.');
        }

        const trainsPayload = await this.fetchTrainsForStation(station.ifopt);
        const trains = trainsPayload.trains || [];
        const distanceKm = destination.station
          ? 0
          : this.getDistanceKm(
              destination.latitude,
              destination.longitude,
              Number(station.latitude),
              Number(station.longitude),
            );

        this.manualConnection = {
          loading: false,
          previewLoading: false,
          error: '',
          origin,
          destination,
          station,
          trains,
          distanceLabel: destination.station ? 'Direkter Bahnhofstreffer' : this.formatDistance(distanceKm),
          debugData: {
            origin,
            destination,
            station,
            trainsResponse: trainsPayload,
          },
        };
      } catch (error) {
        this.manualConnection = {
          ...this.manualConnection,
          loading: false,
          previewLoading: false,
          error: error.message || 'Manuelle Verbindung konnte nicht geladen werden.',
          trains: [],
          station: null,
          distanceLabel: '',
          debugData: null,
        };
        this.errorMessage = error.message || 'Manuelle Verbindung konnte nicht geladen werden.';
      }
    },
    async calculateManualConnection(trainId) {
      const { origin, station, destination } = this.manualConnection;
      if (!origin || !station) {
        this.errorMessage = 'Bitte zuerst Start und Ziel fuer die manuelle Suche laden.';
        return;
      }

      const contextLabel = `${origin.displayName} → ${destination?.displayName || station.name}`;
      await this.calculateConnection(origin, station, trainId, contextLabel);
    },
    toggleApiMode() {
      const nextMode = this.apiMode === 'local' ? 'live' : 'local';
      setApiMode(nextMode);
      this.apiMode = nextMode;
      this.decision = null;
      this.commuterNotification = null;
      this.decisionContextLabel = '';
      this.eventConnectionPreviews = {};
      this.manualConnection = {
        ...this.manualConnection,
        previewLoading: false,
        error: '',
        station: null,
        trains: [],
        distanceLabel: '',
      };
      this.loadStations().then(() => {
        const currentEvent = this.upcomingEvents.find((event) => event.id === this.selectedEventId);
        if (currentEvent) {
          this.selectEvent(currentEvent);
        }
      });
    },
    async refreshAll() {
      await Promise.all([this.loadStations(), this.loadEvents()]);
    },
  },
  async mounted() {
    if (!this.googleClientId) {
      this.errorMessage = 'Missing VITE_GOOGLE_CLIENT_ID';
      return;
    }

    this.isLoading = true;
    try {
      await Promise.all([
        this.initGoogleIdentity(),
        this.loadStations(),
        this.initializeCurrentLocation(),
      ]);
      const storedAuth = this.readStoredAuth();
      if (storedAuth) {
        this.accessToken = storedAuth.accessToken;
        this.isAuthorized = true;
        await this.loadEvents();
      }
    } finally {
      this.isLoading = false;
    }
  },
};
</script>

<style scoped>
.home {
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}

.dashboard-grid,
.results-grid {
  display: grid;
  gap: 20px;
  margin-top: 20px;
}

.dashboard-grid {
  grid-template-columns: 1.05fr 0.95fr;
}

.results-grid {
  grid-template-columns: 1.15fr 0.85fr;
}

.error {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  color: #fee2e2;
  background: rgba(127, 29, 29, 0.6);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.status-message {
  margin-top: 16px;
  padding: 18px;
  border-radius: 18px;
  color: rgba(226, 232, 240, 0.72);
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 1100px) {
  .dashboard-grid,
  .results-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .home {
    padding: 18px 14px 40px;
  }
}
</style>
