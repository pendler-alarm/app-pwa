<template>
  <article class="panel"> 
    <div class="panel-head">
      <div>
        <p class="section-label">Manuelle Suche</p>
        <h2>Verbindung ohne Termin pruefen</h2>
      </div>
    </div>

    <div class="stack">
      <div class="field">
        <label for="origin-mode">Start</label>
        <select
          id="origin-mode"
          :value="originMode"
          @change="$emit('update:origin-mode', $event.target.value)"
        >
          <option value="current">Aktueller Standort</option>
          <option value="manual">Adresse, Bahnhof oder lat/lon</option>
        </select>
      </div>

      <div class="active-origin-card" :class="{ 'active-origin-card--resolved': Boolean(resolvedOrigin) }">
        <div class="active-origin-card__head">
          <div>
            <p class="label">Aktiv genutzter Start</p>
            <strong v-if="resolvedOrigin">{{ resolvedOrigin.displayName }}</strong>
            <strong v-else-if="originMode === 'current'">Aktueller Standort</strong>
            <strong v-else>Manuelle Eingabe</strong>
          </div>
          <button
            v-if="originMode === 'current'"
            type="button"
            class="button-secondary"
            :disabled="originRefreshing"
            @click="$emit('refresh-origin')"
          >
            {{ originRefreshing ? 'Aktualisiere...' : 'Standort aktualisieren' }}
          </button>
        </div>

        <template v-if="resolvedOrigin">
          <p>{{ formatCoords(resolvedOrigin.latitude, resolvedOrigin.longitude) }}</p>
          <p v-if="resolvedOrigin.address">{{ resolvedOrigin.address }}</p>
        </template>
        <p v-else-if="originMode === 'current'">
          Wird beim Laden der Verbindung ueber Geolocation bestimmt.
        </p>
        <p v-else>
          Adresse, Bahnhof oder lat/lon aus dem Eingabefeld.
        </p>
      </div>

      <div v-if="originMode === 'manual'" class="field">
        <label for="manual-origin-input">Startpunkt</label>
        <input
          id="manual-origin-input"
          :value="originInput"
          type="text"
          placeholder="z.B. 52.52, 13.40 oder Berlin Hbf"
          @input="$emit('update:origin-input', $event.target.value)"
        >
      </div>

      <div class="field">
        <label for="manual-destination-input">Ziel</label>
        <input
          id="manual-destination-input"
          :value="destinationInput"
          type="text"
          placeholder="Adresse, Interesse oder Bahnhof"
          @input="$emit('update:destination-input', $event.target.value)"
        >
      </div>

      <div class="actions">
        <button
          type="button"
          class="button-primary"
          :disabled="loading"
          @click="$emit('resolve')"
        >
          {{ loading ? 'Suche laeuft...' : 'Verbindungen laden' }}
        </button>
      </div>

      <div v-if="resolvedDestination" class="stack">
        <div class="info-card">
          <p class="label">Ziel</p>
          <strong>{{ resolvedDestination.displayName }}</strong>
          <p>{{ formatCoords(resolvedDestination.latitude, resolvedDestination.longitude) }}</p>
        </div>
      </div>

      <connection-preview-list
        v-if="showPreview"
        heading="Naechste 3 Verbindungen fuer das Ziel"
        :station="station"
        :distance-label="distanceLabel"
        :trains="trains"
        :debug-data="debugData"
        :loading="previewLoading"
        :error="previewError"
        loading-label="Manuelle Verbindungen werden geladen..."
        empty-label="Keine Verbindungen fuer dieses Ziel verfuegbar."
        action-label="Empfehlung"
        :action-disabled="decisionLoading || !resolvedOrigin"
        @select-train="$emit('calculate', $event)"
      />
    </div>
  </article>
</template>

<script>
import ConnectionPreviewList from './ConnectionPreviewList.vue';

export default {
  name: 'ManualConnectionWidget',
  components: {
    ConnectionPreviewList,
  },
  props: {
    originMode: {
      type: String,
      default: 'current',
    },
    originInput: {
      type: String,
      default: '',
    },
    destinationInput: {
      type: String,
      default: '',
    },
    resolvedOrigin: {
      type: Object,
      default: null,
    },
    originRefreshing: {
      type: Boolean,
      default: false,
    },
    resolvedDestination: {
      type: Object,
      default: null,
    },
    station: {
      type: Object,
      default: null,
    },
    distanceLabel: {
      type: String,
      default: '',
    },
    trains: {
      type: Array,
      default: () => [],
    },
    debugData: {
      type: [Object, Array, String, Number, Boolean],
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    previewLoading: {
      type: Boolean,
      default: false,
    },
    previewError: {
      type: String,
      default: '',
    },
    decisionLoading: {
      type: Boolean,
      default: false,
    },
    formatCoords: {
      type: Function,
      required: true,
    },
  },
  computed: {
    showPreview() {
      return this.previewLoading || this.previewError || this.station || this.trains.length > 0;
    },
  },
};
</script>

<style scoped>
.panel {
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(241, 245, 249, 0.18);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72));
  backdrop-filter: blur(16px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.section-label,
.label {
  margin: 0;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
  color: #93c5fd;
}

h2,
p {
  margin: 0;
}

.stack {
  display: grid;
  gap: 12px;
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-size: 0.95rem;
  color: #cbd5e1;
}

.field select,
.field input {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(15, 23, 42, 0.68);
  color: #f8fafc;
}

.actions,
.active-origin-card__head {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
}

.button-primary,
.button-secondary {
  border: 0;
  border-radius: 16px;
  padding: 12px 16px;
  cursor: pointer;
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

.button-primary:disabled,
.button-secondary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.active-origin-card,
.info-card {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
  padding: 16px;
}

.active-origin-card--resolved {
  border-color: rgba(56, 189, 248, 0.45);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.18), rgba(255, 255, 255, 0.04));
}

.active-origin-card p,
.info-card p {
  margin-top: 6px;
  color: rgba(226, 232, 240, 0.8);
}

@media (max-width: 720px) {
  .panel {
    padding: 18px;
    border-radius: 22px;
  }

  .active-origin-card__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
