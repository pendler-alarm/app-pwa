<template>
  <div class="stack">
    <div class="info-card info-card--compact">
      <p class="label">{{ heading }}</p>
      <strong>{{ station ? station.name : 'Kein Zielbahnhof gefunden' }}</strong>
      <div class="info-card__meta">
        <span v-if="station">{{ station.ifopt }}</span>
        <span v-if="distanceLabel">{{ distanceLabel }}</span>
      </div>
    </div>

    <div v-if="loading" class="empty-state">{{ loadingLabel }}</div>
    <div v-else-if="error" class="empty-state empty-state--error">{{ error }}</div>
    <div v-else-if="!trains.length" class="empty-state">{{ emptyLabel }}</div>
    <div v-else class="stack stack--compact">
      <article
        v-for="train in trains.slice(0, 3)"
        :key="train.option_id"
        class="train-card"
      >
        <div class="train-card__hero">
          <div class="train-card__time train-card__time--left">
            <strong>{{ departureTime(train) }}</strong>
            <span>Start</span>
          </div>

          <div class="train-card__line-block">
            <div class="train-card__line-rail"></div>
            <div class="train-card__line-badges">
              <span
                class="mode-logo"
                :class="`mode-logo--${trainMode(train).key}`"
                :title="trainMode(train).label"
              >
                {{ trainMode(train).icon }}
              </span>
              <span class="line-badge">{{ compactTrainLabel(train) }}</span>
            </div>
          </div>

          <div class="train-card__time train-card__time--right">
            <strong>{{ arrivalTime(train) }}</strong>
            <span>Ziel</span>
          </div>
        </div>

        <div class="train-card__stops">
          <div class="train-card__stop">
            <span class="train-card__stop-label">Von</span>
            <strong>{{ startLabel }}</strong>
          </div>
          <div class="train-card__stop">
            <span class="train-card__stop-label">Nach</span>
            <strong>{{ destinationLabel(train) }}</strong>
          </div>
        </div>

        <div class="train-card__meta-row">
          <span>Gl. {{ train.platform || '-' }}</span>
          <span v-if="train.estimated_departure && train.estimated_departure !== train.planned_departure">
            aktuell {{ train.estimated_departure }}
          </span>
          <span>{{ trainMode(train).label }}</span>
        </div>

        <div class="train-card__footer">
          <span
            class="status-pill"
            :class="statusClass(train)"
          >
            {{ statusLabel(train) }}
          </span>
          <button
            type="button"
            class="button-secondary"
            :disabled="actionDisabled"
            @click="$emit('select-train', train.option_id)"
          >
            {{ actionLabel }}
          </button>
        </div>
      </article>
    </div>

    <details v-if="debugData" class="debug-panel">
      <summary class="debug-toggle">debug</summary>
      <pre>{{ debugText }}</pre>
    </details>
  </div>
</template>

<script>
const MODE_CONFIG = {
  sbahn: { key: 'sbahn', label: 'S-Bahn', icon: 'S' },
  ubahn: { key: 'ubahn', label: 'U-Bahn', icon: 'U' },
  regio: { key: 'regio', label: 'Regio', icon: 'R' },
  bus: { key: 'bus', label: 'Bus', icon: 'B' },
  tram: { key: 'tram', label: 'Tram', icon: 'T' },
  fern: { key: 'fern', label: 'Fern', icon: 'F' },
  default: { key: 'default', label: 'Bahn', icon: 'Z' },
};

export default {
  name: 'ConnectionPreviewList',
  props: {
    heading: {
      type: String,
      default: 'Naechste Verbindungen',
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
    error: {
      type: String,
      default: '',
    },
    loadingLabel: {
      type: String,
      default: 'Verbindungen werden geladen...',
    },
    emptyLabel: {
      type: String,
      default: 'Keine Verbindungen verfuegbar.',
    },
    actionLabel: {
      type: String,
      default: 'Berechnen',
    },
    actionDisabled: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    startLabel() {
      return this.station?.name || 'Start';
    },
    debugText() {
      return JSON.stringify(this.debugData, null, 2);
    },
  },
  methods: {
    compactTrainLabel(train) {
      return String(train?.train_id || 'Verbindung').trim();
    },
    destinationLabel(train) {
      return String(train?.destination || 'Ziel').trim();
    },
    trainMode(train) {
      const identifier = String(train?.train_id || '').toUpperCase();
      const destination = String(train?.destination || '').toUpperCase();
      const haystack = `${identifier} ${destination}`;

      if (/\bS\d+\b|S-BAHN/.test(haystack)) {
        return MODE_CONFIG.sbahn;
      }
      if (/\bU\d+\b|U-BAHN/.test(haystack)) {
        return MODE_CONFIG.ubahn;
      }
      if (/\bBUS\b|\bM\d+\b|\bX\d+\b/.test(haystack)) {
        return MODE_CONFIG.bus;
      }
      if (/TRAM|STRASSENBAHN|\bM[1-9][0-9]?\b/.test(haystack)) {
        return MODE_CONFIG.tram;
      }
      if (/\bICE\b|\bIC\b|\bEC\b|\bTGV\b|\bRJ\b/.test(haystack)) {
        return MODE_CONFIG.fern;
      }
      if (/\bRE\b|\bRB\b|\bIRE\b|\bMEX\b|\bRS\b/.test(haystack)) {
        return MODE_CONFIG.regio;
      }
      return MODE_CONFIG.default;
    },
    parseTimeToMinutes(value) {
      const input = String(value || '').trim();
      const match = input.match(/(\d{1,2}):(\d{2})/);
      if (!match) {
        return null;
      }
      return Number(match[1]) * 60 + Number(match[2]);
    },
    delayMinutes(train) {
      const plannedMinutes = this.parseTimeToMinutes(train?.planned_departure);
      const estimatedMinutes = this.parseTimeToMinutes(train?.estimated_departure);
      if (plannedMinutes === null || estimatedMinutes === null) {
        return 0;
      }
      let diff = estimatedMinutes - plannedMinutes;
      if (diff < -720) {
        diff += 1440;
      }
      if (diff > 720) {
        diff -= 1440;
      }
      return Math.max(0, diff);
    },
    departureTime(train) {
      return train?.estimated_departure || train?.planned_departure || '--:--';
    },
    arrivalTime(train) {
      return train?.estimated_arrival || train?.planned_arrival || train?.arrival || '--:--';
    },
    statusLabel(train) {
      return this.delayMinutes(train) > 0 ? 'Verspaetet' : 'Puenktlich';
    },
    statusClass(train) {
      return this.delayMinutes(train) > 0 ? 'status-pill--delayed' : 'status-pill--on-time';
    },
  },
};
</script>

<style scoped>
.stack {
  display: grid;
  gap: 12px;
}

.stack--compact {
  gap: 8px;
}

.label {
  margin: 0;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
  color: #93c5fd;
}

.info-card,
.train-card,
.empty-state,
.debug-panel {
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #f8fafc;
  border-radius: 18px;
  padding: 14px;
}

.info-card__meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.85rem;
}

.train-card {
  display: grid;
  gap: 10px;
}

.train-card__hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.train-card__time {
  display: grid;
  gap: 2px;
  white-space: nowrap;
}

.train-card__time strong {
  font-size: 1.45rem;
  line-height: 1;
}

.train-card__time span,
.train-card__stop-label,
.train-card__meta-row {
  font-size: 0.82rem;
  color: rgba(226, 232, 240, 0.72);
}

.train-card__time--right {
  text-align: right;
}

.train-card__line-block {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.train-card__line-rail {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.35), rgba(16, 185, 129, 0.95));
}

.train-card__line-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: -16px;
}

.mode-logo {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 800;
  border: 2px solid rgba(15, 23, 42, 0.8);
}

.line-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 10px;
  background: #10b981;
  color: white;
  font-size: 0.82rem;
  font-weight: 800;
}

.mode-logo--sbahn,
.mode-logo--regio,
.mode-logo--default {
  background: #16a34a;
  color: white;
}

.mode-logo--ubahn {
  background: #2563eb;
  color: white;
}

.mode-logo--bus {
  background: #f59e0b;
  color: #111827;
}

.mode-logo--tram {
  background: #a855f7;
  color: white;
}

.mode-logo--fern {
  background: #ef4444;
  color: white;
}

.train-card__stops {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.train-card__stop {
  display: grid;
  gap: 4px;
}

.train-card__stop strong {
  font-size: 0.95rem;
}

.train-card__meta-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.train-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
}

.status-pill--on-time {
  background: rgba(34, 197, 94, 0.16);
  color: #bbf7d0;
}

.status-pill--delayed {
  background: rgba(248, 113, 113, 0.16);
  color: #fecaca;
}

.empty-state--error {
  color: #fee2e2;
  background: rgba(127, 29, 29, 0.45);
  border-color: rgba(248, 113, 113, 0.35);
}

.button-secondary {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  cursor: pointer;
  white-space: nowrap;
}

.button-secondary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.debug-panel {
  padding-top: 8px;
}

.debug-toggle {
  cursor: pointer;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(226, 232, 240, 0.52);
  user-select: none;
}

.debug-panel pre {
  margin: 10px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.72rem;
  color: rgba(226, 232, 240, 0.82);
}

@media (max-width: 720px) {
  .train-card__hero,
  .train-card__stops {
    grid-template-columns: 1fr;
  }

  .train-card__time--right {
    text-align: left;
  }

  .train-card__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
