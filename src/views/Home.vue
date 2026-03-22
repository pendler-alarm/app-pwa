<template>
  <div class="home">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Pendler Alarm</p>
        <h1>Zug, Bahnhof, Terminort.</h1>
        <p class="intro">
          Vue-Frontend fuer kommende Google-Termine. Die Terminadresse wird
          geokodiert, dem naechsten Bahnhof zugeordnet und gegen die Workflow-API
          auf die naechsten Verbindungen gerechnet.
        </p>
      </div>
      <div class="hero-actions">
        <button
          v-if="!isAuthorized"
          type="button"
          class="button-primary"
          @click="loginWithGoogle"
        >
          Mit Google anmelden
        </button>
        <template v-else>
          <button type="button" class="button-secondary" @click="refreshAll">
            Aktualisieren
          </button>
          <button type="button" class="button-secondary" @click="logout">
            Logout
          </button>
        </template>
        <button type="button" class="button-chip" @click="toggleApiMode">
          API: {{ apiModeLabel }}
        </button>
      </div>
    </section>

    <div v-if="isBusy" class="status-message">Lade Daten...</div>
    <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

    <template v-if="isAuthorized">
      <section class="dashboard-grid">
        <article class="panel panel-events">
          <div class="panel-head">
            <div>
              <p class="section-label">Kommende Termine</p>
              <h2>Termine mit Reisebezug</h2>
            </div>
            <p class="muted">{{ upcomingEvents.length }} mit Ortsangabe</p>
          </div>

          <div v-if="eventsLoading" class="empty-state">Kalender wird geladen...</div>
          <div v-else-if="upcomingEvents.length === 0" class="empty-state">
            Keine kommenden Termine mit `location`.
          </div>
          <div v-else class="event-list">
            <button
              v-for="event in upcomingEvents"
              :key="event.id"
              type="button"
              class="event-card"
              :class="{ 'event-card--active': selectedEventId === event.id }"
              @click="selectEvent(event)"
            >
              <div class="event-card__top">
                <div>
                  <strong>{{ event.summary || 'Ohne Titel' }}</strong>
                  <p>{{ formatEventDate(event.startDate) }}</p>
                </div>
                <span class="badge">{{ relativeDateLabel(event.startDate) }}</span>
              </div>
              <p class="event-card__location">{{ event.location }}</p>
              <p v-if="event.resolvedLocation" class="event-card__meta">
                {{ event.resolvedLocation.displayName }}
              </p>
              <p v-else-if="event.isResolvingLocation" class="event-card__meta">
                Standort wird aufgeloest...
              </p>
              <p
                v-else-if="event.locationError"
                class="event-card__meta event-card__meta--error"
              >
                {{ event.locationError }}
              </p>
            </button>
          </div>
        </article>

        <article class="panel panel-control">
          <div class="panel-head">
            <div>
              <p class="section-label">Verbindung</p>
              <h2>Naechste Option zum Terminort</h2>
            </div>
          </div>

          <div v-if="selectedEvent" class="stack">
            <div class="info-card">
              <p class="label">Ausgewaehlter Termin</p>
              <strong>{{ selectedEvent.summary || 'Ohne Titel' }}</strong>
              <p>{{ formatEventDate(selectedEvent.startDate) }}</p>
              <p>{{ selectedEvent.location }}</p>
              <p v-if="selectedEvent.resolvedLocation">
                Koordinaten:
                {{ formatCoords(selectedEvent.resolvedLocation.latitude, selectedEvent.resolvedLocation.longitude) }}
              </p>
            </div>

            <div class="field">
              <label for="station-select">Zielbahnhof</label>
              <select
                id="station-select"
                v-model="selectedStationId"
                :disabled="stationsLoading || stations.length === 0"
                @change="handleStationChanged"
              >
                <option value="">Bahnhof waehlen</option>
                <option
                  v-for="station in stations"
                  :key="station.ifopt"
                  :value="station.ifopt"
                >
                  {{ station.name }} · {{ station.ifopt }}
                </option>
              </select>
              <p v-if="selectedEventNearestStation" class="hint">
                Naechster Bahnhof zum Terminort:
                {{ selectedEventNearestStation.name }}
                ({{ formatDistance(selectedEventNearestDistanceKm) }})
              </p>
            </div>

            <div class="field">
              <label for="train-select">Naechste Verbindung</label>
              <select
                id="train-select"
                v-model="selectedTrainId"
                :disabled="trainsLoading || trains.length === 0"
              >
                <option value="">Verbindung waehlen</option>
                <option
                  v-for="train in trains"
                  :key="train.option_id"
                  :value="train.option_id"
                >
                  {{ train.train_id }} · {{ train.planned_departure }} → {{ train.destination }}
                </option>
              </select>
            </div>

            <div v-if="selectedTrain" class="train-card">
              <div>
                <strong>{{ selectedTrain.train_id }}</strong>
                <p>{{ selectedTrain.destination }}</p>
              </div>
              <div class="train-card__meta">
                <span>Plan {{ selectedTrain.planned_departure }}</span>
                <span>RT {{ selectedTrain.estimated_departure }}</span>
                <span>Gl. {{ selectedTrain.platform || '-' }}</span>
              </div>
            </div>

            <div class="actions">
              <button
                type="button"
                class="button-primary"
                :disabled="!canCalculate || decisionLoading"
                @click="calculateConnectionForSelectedEvent"
              >
                {{ decisionLoading ? 'Berechne...' : 'Verbindung berechnen' }}
              </button>
              <button
                type="button"
                class="button-secondary"
                :disabled="!selectedEvent || trainsLoading"
                @click="loadTrainsForSelectedStation"
              >
                {{ trainsLoading ? 'Lade Zuege...' : 'Zuege neu laden' }}
              </button>
            </div>
          </div>

          <div v-else class="empty-state">
            Termin auswaehlen, damit Ort, Bahnhof und Verbindung ermittelt werden.
          </div>
        </article>
      </section>

      <section class="results-grid">
        <article class="panel">
          <div class="panel-head">
            <div>
              <p class="section-label">Empfehlung</p>
              <h2>Entscheidung</h2>
            </div>
          </div>

          <div v-if="decision" class="stack">
            <div class="decision-hero" :class="`risk-${decisionRiskLevel}`">
              <p class="label">Empfohlen</p>
              <strong>
                {{ decision.recommended.parking }} → {{ decision.recommended.entrance }}
              </strong>
              <p>Losfahren: {{ decision.recommended.departure_recommendation }}</p>
              <p>{{ decision.system_insight.reason }}</p>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <span>Bahnhof</span>
                <strong>{{ decision.selected_station.name }}</strong>
              </div>
              <div class="stat-card">
                <span>Zug</span>
                <strong>{{ decision.selected_train.train_id }}</strong>
              </div>
              <div class="stat-card">
                <span>Risiko</span>
                <strong>{{ riskLabel(decision.system_insight.risk_level) }}</strong>
              </div>
              <div class="stat-card">
                <span>Puffer</span>
                <strong>{{ decision.recommended.buffer }} Min.</strong>
              </div>
            </div>

            <div class="option-grid">
              <div class="option-card">
                <p class="label">Empfohlen</p>
                <strong>{{ decision.recommended.parking }}</strong>
                <p>Eingang {{ decision.recommended.entrance }}</p>
                <p>Anfahrt {{ decision.recommended.travel_time }} Min.</p>
                <p>Fussweg {{ decision.recommended.walking_time }} Min.</p>
              </div>
              <div class="option-card">
                <p class="label">Alternativen</p>
                <div
                  v-if="decision.alternatives && decision.alternatives.length"
                  class="stack stack--tight"
                >
                  <div
                    v-for="(item, index) in decision.alternatives.slice(0, 3)"
                    :key="`${item.parking}-${item.entrance}-${index}`"
                    class="alt-item"
                  >
                    <strong>{{ item.parking }} → {{ item.entrance }}</strong>
                    <p>
                      {{ item.travel_time }} Min. Anfahrt · {{ item.walking_time }} Min.
                      Fussweg
                    </p>
                  </div>
                </div>
                <p v-else>Keine Alternativen vorhanden.</p>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            Noch keine Berechnung vorhanden.
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <p class="section-label">Hinweis</p>
              <h2>Echtzeitmeldung</h2>
            </div>
          </div>

          <div v-if="notificationLoading" class="empty-state">
            Realtime-Hinweis wird geladen...
          </div>
          <div
            v-else-if="commuterNotification && commuterNotification.should_send"
            class="notification-card"
            :class="notificationClass"
          >
            <div class="notification-card__head">
              <strong>{{ commuterNotification.short_text }}</strong>
              <span>
                {{ commuterNotification.audience === 'planner' ? 'Planung' : 'Pendler' }}
              </span>
            </div>
            <p>{{ commuterNotification.title }}</p>
            <ul
              v-if="commuterNotification.details && commuterNotification.details.length"
              class="detail-list"
            >
              <li
                v-for="(detail, index) in commuterNotification.details"
                :key="`${detail.icon}-${index}`"
              >
                {{ detail.icon }} {{ detail.text }}
              </li>
            </ul>
          </div>
          <div v-else class="empty-state">
            Fuer die aktuelle Auswahl liegt keine besondere Meldung vor.
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<script>
import { getApiMode, setApiMode, workflowApi } from '../services/workflowApi';

const AUTH_STORAGE_KEY = 'pendler-alarm-google-auth';
const LOCATION_CACHE_KEY = 'pendler-alarm-location-cache-v1';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export default {
  name: 'Home',
  data() {
    return {
      accessToken: null,
      tokenClient: null,
      isAuthorized: false,
      isLoading: false,
      eventsLoading: false,
      stationsLoading: false,
      trainsLoading: false,
      decisionLoading: false,
      notificationLoading: false,
      errorMessage: '',
      events: [],
      stations: [],
      trains: [],
      selectedEventId: '',
      selectedStationId: '',
      selectedTrainId: '',
      decision: null,
      commuterNotification: null,
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
    selectedEvent() {
      return this.events.find((event) => event.id === this.selectedEventId) || null;
    },
    selectedStation() {
      return this.stations.find((station) => station.ifopt === this.selectedStationId) || null;
    },
    selectedTrain() {
      return this.trains.find((train) => train.option_id === this.selectedTrainId) || null;
    },
    selectedEventNearestStation() {
      const event = this.selectedEvent;
      if (!event || !event.resolvedLocation || this.stations.length === 0) {
        return null;
      }
      return this.findNearestStation(event.resolvedLocation);
    },
    selectedEventNearestDistanceKm() {
      const event = this.selectedEvent;
      const station = this.selectedEventNearestStation;
      if (!event || !station || !event.resolvedLocation) {
        return null;
      }
      return this.getDistanceKm(
        event.resolvedLocation.latitude,
        event.resolvedLocation.longitude,
        Number(station.latitude),
        Number(station.longitude),
      );
    },
    decisionRiskLevel() {
      return this.decision?.system_insight?.risk_level || 'medium';
    },
    apiModeLabel() {
      return this.apiMode === 'local' ? 'Lokal' : 'Live';
    },
    canCalculate() {
      return Boolean(
        this.selectedEvent &&
          this.selectedEvent.resolvedLocation &&
          this.selectedStationId &&
          this.selectedTrainId,
      );
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
          return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
        }
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
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
        return '-';
      }
      return value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(1)} km`;
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
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken: tokenResponse.access_token, expiresAt }));
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
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
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
        script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
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
      this.selectedStationId = '';
      this.selectedTrainId = '';
      this.trains = [];
      this.decision = null;
      this.commuterNotification = null;
      this.errorMessage = '';
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
        const data = await this.apiFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`);
        this.events = this.enrichEvents(data.items || []);
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
    async loadTrainsForStation(stationId) {
      if (!stationId) {
        this.trains = [];
        this.selectedTrainId = '';
        return;
      }

      this.trainsLoading = true;
      this.errorMessage = '';
      try {
        const payload = await workflowApi.getTrains({ station_ifopt: stationId });
        this.trains = payload.trains || [];
        this.selectedTrainId = this.trains[0]?.option_id || '';
      } catch (error) {
        this.errorMessage = error.message || 'Zuege konnten nicht geladen werden.';
      } finally {
        this.trainsLoading = false;
      }
    },
    async loadTrainsForSelectedStation() {
      await this.loadTrainsForStation(this.selectedStationId);
    },
    async selectEvent(event) {
      this.selectedEventId = event.id;
      this.decision = null;
      this.commuterNotification = null;
      this.selectedTrainId = '';

      try {
        const resolved = await this.resolveEventLocation(event);
        const nearestStation = this.findNearestStation(resolved);
        if (nearestStation) {
          this.selectedStationId = nearestStation.ifopt;
          await this.loadTrainsForStation(nearestStation.ifopt);
        }
      } catch (error) {
        this.errorMessage = error.message || 'Terminort konnte nicht verarbeitet werden.';
      }
    },
    async handleStationChanged() {
      this.decision = null;
      this.commuterNotification = null;
      await this.loadTrainsForStation(this.selectedStationId);
    },
    async calculateConnectionForSelectedEvent() {
      if (!this.canCalculate) {
        this.errorMessage = 'Terminort, Bahnhof und Verbindung werden fuer die Berechnung benoetigt.';
        return;
      }

      const origin = this.selectedEvent.resolvedLocation;
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
            train_id: this.selectedTrainId,
            station_ifopt: this.selectedStationId,
          }),
          workflowApi.getCommuterNotification({
            origin: originString,
            origin_lat: origin.latitude,
            origin_lon: origin.longitude,
            train_id: this.selectedTrainId,
            station_ifopt: this.selectedStationId,
          }),
        ]);

        this.decision = decision;
        this.commuterNotification = notification;
      } catch (error) {
        this.errorMessage = error.message || 'Verbindung konnte nicht berechnet werden.';
      } finally {
        this.decisionLoading = false;
        this.notificationLoading = false;
      }
    },
    toggleApiMode() {
      const nextMode = this.apiMode === 'local' ? 'live' : 'local';
      setApiMode(nextMode);
      this.apiMode = nextMode;
      this.selectedStationId = '';
      this.selectedTrainId = '';
      this.trains = [];
      this.decision = null;
      this.commuterNotification = null;
      this.loadStations().then(() => {
        const currentEvent = this.selectedEvent;
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
      await this.initGoogleIdentity();
      await this.loadStations();
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

.hero-card,
.panel {
  border: 1px solid rgba(241, 245, 249, 0.18);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72));
  backdrop-filter: blur(16px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  border-radius: 28px;
}

.eyebrow,
.section-label,
.label {
  margin: 0;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
  color: #93c5fd;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  margin-top: 10px;
  font-size: clamp(2rem, 3vw, 3.6rem);
  line-height: 1;
}

h2 {
  font-size: 1.5rem;
}

.intro {
  margin-top: 16px;
  max-width: 780px;
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.5;
}

.hero-actions,
.actions {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

button,
select {
  border: 0;
  border-radius: 16px;
}

.button-primary,
.button-secondary,
.button-chip {
  padding: 12px 16px;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease, background 0.16s ease;
}

.button-primary {
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: #eff6ff;
}

.button-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.button-chip {
  background: rgba(14, 165, 233, 0.12);
  color: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.panel {
  border-radius: 24px;
  padding: 24px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.muted,
.hint,
.event-card__meta,
.train-card__meta,
.empty-state,
.status-message {
  color: rgba(226, 232, 240, 0.72);
}

.event-list,
.stack {
  display: grid;
  gap: 12px;
}

.stack--tight {
  gap: 8px;
}

.event-card,
.info-card,
.train-card,
.stat-card,
.option-card,
.notification-card {
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #f8fafc;
  border-radius: 20px;
  padding: 16px;
}

.event-card--active {
  border-color: rgba(56, 189, 248, 0.7);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.26), rgba(15, 23, 42, 0.3));
}

.event-card__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.event-card__location {
  margin-top: 12px;
  color: #f8fafc;
}

.event-card__meta {
  margin-top: 8px;
  font-size: 0.92rem;
}

.event-card__meta--error {
  color: #fca5a5;
}

.badge {
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(186, 230, 253, 0.12);
  color: #bae6fd;
  font-size: 12px;
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-size: 0.95rem;
  color: #cbd5e1;
}

.field select {
  padding: 14px 16px;
  background: rgba(15, 23, 42, 0.68);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.22);
}

.train-card__meta,
.stats-grid,
.option-grid,
.detail-list {
  display: grid;
  gap: 10px;
}

.stats-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.option-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stat-card span {
  display: block;
  color: rgba(226, 232, 240, 0.7);
  font-size: 0.88rem;
}

.decision-hero {
  border-radius: 22px;
  padding: 18px;
  color: #0f172a;
}

.risk-low {
  background: linear-gradient(135deg, #bbf7d0, #86efac);
}

.risk-medium {
  background: linear-gradient(135deg, #fde68a, #fbbf24);
}

.risk-high {
  background: linear-gradient(135deg, #fecaca, #f87171);
}

.alt-item + .alt-item {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.notification-card__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.notification-card__head span {
  font-size: 0.8rem;
  opacity: 0.85;
}

.notification-card--critical {
  background: rgba(127, 29, 29, 0.45);
  border-color: rgba(248, 113, 113, 0.5);
}

.notification-card--warning {
  background: rgba(120, 53, 15, 0.45);
  border-color: rgba(251, 191, 36, 0.5);
}

.notification-card--ok {
  background: rgba(20, 83, 45, 0.45);
  border-color: rgba(74, 222, 128, 0.5);
}

.detail-list {
  padding-left: 18px;
}

.error {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  color: #fee2e2;
  background: rgba(127, 29, 29, 0.6);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.status-message,
.empty-state {
  margin-top: 16px;
  padding: 18px;
  border-radius: 18px;
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

  .hero-card,
  .panel {
    padding: 18px;
    border-radius: 22px;
  }

  .hero-card,
  .panel-head,
  .event-card__top {
    display: grid;
  }

  .stats-grid,
  .option-grid {
    grid-template-columns: 1fr;
  }
}
</style>
