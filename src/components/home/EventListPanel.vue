<template>
  <article class="panel">
    <div class="panel-head">
      <div>
        <p class="section-label">Kommende Termine</p>
        <h2>Termine mit Reisebezug</h2>
      </div>
      <p class="muted">{{ events.length }} mit Ortsangabe</p>
    </div>

    <div v-if="loading" class="empty-state">Kalender wird geladen...</div>
    <div v-else-if="!events.length" class="empty-state">
      Keine kommenden Termine mit `location`.
    </div>
    <div v-else class="event-list">
      <article
        v-for="event in events"
        :key="event.id"
        class="event-card"
        :class="{ 'event-card--active': selectedEventId === event.id }"
      >
        <div
          class="event-card__summary"
          role="button"
          tabindex="0"
          @click="$emit('select-event', event)"
          @keydown.enter.prevent="$emit('select-event', event)"
          @keydown.space.prevent="$emit('select-event', event)"
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
        </div>

        <connection-preview-list
          v-if="selectedEventId === event.id"
          heading="Naechste 3 Verbindungen"
          :station="previewForEvent(event.id).station"
          :distance-label="previewForEvent(event.id).distanceLabel"
          :trains="previewForEvent(event.id).trains || []"
          :debug-data="previewForEvent(event.id).debugData"
          :loading="previewForEvent(event.id).loading"
          :error="previewForEvent(event.id).error"
          loading-label="Verbindungen fuer den Termin werden geladen..."
          empty-label="Fuer diesen Termin konnten keine Verbindungen geladen werden."
          action-label="Empfehlung"
          :action-disabled="decisionLoading"
          @select-train="$emit('calculate-for-event', { event, trainId: $event })"
        />
      </article>
    </div>
  </article>
</template>

<script>
import ConnectionPreviewList from './ConnectionPreviewList.vue';

export default {
  name: 'EventListPanel',
  components: {
    ConnectionPreviewList,
  },
  props: {
    events: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    selectedEventId: {
      type: String,
      default: '',
    },
    decisionLoading: {
      type: Boolean,
      default: false,
    },
    previews: {
      type: Object,
      default: () => ({}),
    },
    formatEventDate: {
      type: Function,
      required: true,
    },
    relativeDateLabel: {
      type: Function,
      required: true,
    },
  },
  methods: {
    previewForEvent(eventId) {
      return this.previews[eventId] || {};
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

.panel-head,
.event-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.section-label {
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

.panel-head {
  margin-bottom: 18px;
}

.muted,
.event-card__meta,
.empty-state {
  color: rgba(226, 232, 240, 0.72);
}

.event-list {
  display: grid;
  gap: 12px;
}

.event-card,
.empty-state {
  width: 100%;
  text-align: left;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
  padding: 16px;
}

.event-card--active {
  border-color: rgba(56, 189, 248, 0.7);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.26), rgba(15, 23, 42, 0.3));
}

.event-card__summary {
  cursor: pointer;
  outline: none;
}

.event-card__summary:focus-visible {
  border-radius: 16px;
  box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.8);
}

.event-card__location {
  margin-top: 12px;
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

.empty-state {
  padding: 18px;
}

@media (max-width: 720px) {
  .panel {
    padding: 18px;
    border-radius: 22px;
  }

  .panel-head,
  .event-card__top {
    display: grid;
  }
}
</style>
