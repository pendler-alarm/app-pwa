<template>
  <div class="home">
    <section class="hero-card">
      <p class="eyebrow">Pendler Alarm</p>
      <h1>Dein Kalender zwischen Gleis und Alltag.</h1>
      <p class="intro">Google Login, Wochenansicht und die naechsten 3 Termine in einer kompakten Oberflaeche.</p>
      <div class="topbar">
        <button v-if="!isAuthorized" type="button" @click="loginWithGoogle">Login with Google</button>
        <template v-else>
          <button type="button" class="button-secondary" @click="logout">Logout</button>
          <button type="button" class="button-secondary" @click="loadEvents">Refresh</button>
        </template>
      </div>
    </section>

    <div v-if="isLoading" class="status-message">Loading...</div>
    <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

    <template v-if="isAuthorized">
      <section class="view-switcher">
        <div>
          <p class="section-label">Aktuelle Woche</p>
          <h2>{{ currentWeekHeadline }}</h2>
        </div>
        <p class="view-switcher__hint">7 Tage Uebersicht, darunter die naechsten 3 Termine.</p>
      </section>
      <MonthView
        :selected-date="selectedDate"
        :events="normalizedEvents"
        @createEvent="createEvent"
        @deleteEvent="deleteEvent"
        @selectDate="selectDate"
        @selectCurrentDay="selectCurrentDay"
      />
    </template>
  </div>
</template>

<script>
import MonthView from "../components/MonthView.vue";

const AUTH_STORAGE_KEY = "pendler-alarm-google-auth";
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export default {
  name: "Home",
  components: { MonthView },
  data() {
    return {
      accessToken: null,
      tokenClient: null,
      isAuthorized: false,
      isLoading: false,
      errorMessage: "",
      events: [],
      selectedDate: new Date(),
      googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      calendarScope: "https://www.googleapis.com/auth/calendar",
    };
  },
  computed: {
    normalizedEvents() {
      return this.events
        .map((event) => {
          const date = this.getEventDate(event);
          return date ? { ...event, date: date } : null;
        })
        .filter(Boolean)
        .sort((left, right) => left.date - right.date);
    },
    currentWeekHeadline() {
      const start = this.startOfWeek(new Date());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startLabel = start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      const endLabel = end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      return startLabel + " - " + endLabel;
    },
  },
  methods: {
    startOfWeek(date) {
      const result = new Date(date);
      const day = result.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      result.setHours(0, 0, 0, 0);
      result.setDate(result.getDate() + offset);
      return result;
    },
    getEventDate(event) {
      const value = (event.start && (event.start.dateTime || event.start.date)) || "";
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
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
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken: tokenResponse.access_token, expiresAt: expiresAt }));
    },
    clearStoredAuth() {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector("script[src=\"" + src + "\"]");
        if (existing) {
          if (existing.dataset.loaded === "true") {
            resolve();
          } else {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Failed to load script: " + src)), { once: true });
          }
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.addEventListener("load", () => {
          script.dataset.loaded = "true";
          resolve();
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("Failed to load script: " + src)), { once: true });
        document.head.appendChild(script);
      });
    },
    async initGoogleIdentity() {
      await this.loadScript("https://accounts.google.com/gsi/client");
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.googleClientId,
        scope: this.calendarScope,
        callback: async (tokenResponse) => {
          if (!tokenResponse || !tokenResponse.access_token) {
            this.errorMessage = "Google login failed.";
            return;
          }
          this.accessToken = tokenResponse.access_token;
          this.isAuthorized = true;
          this.errorMessage = "";
          this.persistAuth(tokenResponse);
          await this.loadEvents();
        },
      });
    },
    loginWithGoogle() {
      if (!this.tokenClient) {
        this.errorMessage = "Google client not initialized.";
        return;
      }
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? "" : "consent" });
    },
    logout() {
      if (this.accessToken && window.google && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(this.accessToken);
      }
      this.clearStoredAuth();
      this.accessToken = null;
      this.isAuthorized = false;
      this.events = [];
      this.errorMessage = "";
    },
    async apiFetch(url, options = {}) {
      if (!this.accessToken) throw new Error("Missing access token");
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: "Bearer " + this.accessToken,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      if (response.status === 401) {
        this.clearStoredAuth();
        this.isAuthorized = false;
        this.accessToken = null;
        throw new Error("Session expired. Please login again.");
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "HTTP " + response.status);
      }
      if (response.status === 204) return null;
      return response.json();
    },
    async loadEvents() {
      this.isLoading = true;
      this.errorMessage = "";
      try {
        const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: "100", timeMin: new Date().toISOString() });
        const data = await this.apiFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + params.toString());
        this.events = data.items || [];
      } catch (error) {
        this.errorMessage = error.message || "Could not load events.";
      } finally {
        this.isLoading = false;
      }
    },
    async createEvent(resource) {
      this.isLoading = true;
      this.errorMessage = "";
      try {
        await this.apiFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", body: JSON.stringify(resource) });
        await this.loadEvents();
      } catch (error) {
        this.errorMessage = error.message || "Could not create event.";
      } finally {
        this.isLoading = false;
      }
    },
    async deleteEvent(eventId) {
      this.isLoading = true;
      this.errorMessage = "";
      try {
        await this.apiFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events/" + encodeURIComponent(eventId), { method: "DELETE" });
        this.events = this.events.filter((event) => event.id !== eventId);
      } catch (error) {
        this.errorMessage = error.message || "Could not delete event.";
      } finally {
        this.isLoading = false;
      }
    },
    selectDate(payload) {
      this.selectedDate = new Date(payload.year, payload.month, payload.day, 9, 0, 0, 0);
    },
    selectCurrentDay() {
      this.selectedDate = new Date();
    },
  },
  async mounted() {
    if (!this.googleClientId) {
      this.errorMessage = "Missing VITE_GOOGLE_CLIENT_ID";
      return;
    }
    await this.initGoogleIdentity();
    const storedAuth = this.readStoredAuth();
    if (!storedAuth) return;
    this.accessToken = storedAuth.accessToken;
    this.isAuthorized = true;
    await this.loadEvents();
  },
};
</script>

<style scoped>
.home { width: min(100%, 1160px); margin: 0 auto; padding: 40px 20px 64px; color: var(--fg-light); }
.hero-card, .view-switcher, .status-message, .error { backdrop-filter: blur(14px); background: rgba(17, 24, 39, 0.48); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; }
.hero-card { padding: 20px; margin-bottom: 20px; }
.eyebrow, .section-label { margin: 0 0 8px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--bright-yellow); }
.hero-card h1, .view-switcher h2 { margin: 0; }
.intro { max-width: 42rem; margin: 16px 0 0; color: rgba(236, 239, 244, 0.82); line-height: 1.5; }
.topbar, .view-switcher { display: flex; gap: 10px; }
.topbar { flex-wrap: wrap; margin-top: 22px; }
.status-message, .error { margin-bottom: 12px; padding: 16px 18px; }
.error { color: #ffd8d1; background: rgba(176, 0, 32, 0.18); border-color: rgba(255, 112, 112, 0.28); }
.view-switcher { justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 18px; }
.view-switcher__hint { margin: 0; color: rgba(236, 239, 244, 0.72); text-align: right; }
button { border: 0; border-radius: 999px; padding: 12px 18px; font: inherit; font-weight: 700; cursor: pointer; color: #18212b; background: linear-gradient(135deg, var(--bright-yellow), #ffd18b); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18); }
.button-secondary { color: var(--fg-light); background: rgba(255, 255, 255, 0.14); box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.14); }
@media (max-width: 640px) { .home { padding-top: 28px; } .view-switcher { flex-direction: column; align-items: stretch; } .view-switcher__hint { text-align: left; } }
</style>
