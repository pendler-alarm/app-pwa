<template>
  <article class="panel">
    <div class="panel-head">
      <div>
        <p class="section-label">Empfehlung</p>
        <h2>Entscheidung</h2>
      </div>
      <p v-if="contextLabel" class="muted">{{ contextLabel }}</p>
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
</template>

<script>
export default {
  name: 'DecisionPanel',
  props: {
    decision: {
      type: Object,
      default: null,
    },
    decisionRiskLevel: {
      type: String,
      default: 'medium',
    },
    contextLabel: {
      type: String,
      default: '',
    },
    riskLabel: {
      type: Function,
      required: true,
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

.muted,
.empty-state {
  color: rgba(226, 232, 240, 0.72);
}

.stack {
  display: grid;
  gap: 12px;
}

.stack--tight {
  gap: 8px;
}

.empty-state,
.stat-card,
.option-card {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
  padding: 16px;
}

.stats-grid,
.option-grid {
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

@media (max-width: 720px) {
  .panel {
    padding: 18px;
    border-radius: 22px;
  }

  .panel-head {
    display: grid;
  }

  .stats-grid,
  .option-grid {
    grid-template-columns: 1fr;
  }
}
</style>
