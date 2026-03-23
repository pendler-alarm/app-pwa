<template>
  <section class="hero-card">
    <div>
      <p class="eyebrow">Pendler Alarm</p>
      <h1>Dein Kalender zwischen Gleis und Alltag.</h1>
      <p class="intro">
        Google Login, Terminvorschau und manuelle Verbindungsprüfung in einer
        kompakten Oberfläche.
      </p>
    </div>

    <div class="hero-actions">
      <button
        v-if="!isAuthorized"
        type="button"
        class="button-primary"
        @click="$emit('login')"
      >
        Mit Google anmelden
      </button>
      <template v-else>
        <button type="button" class="button-secondary" @click="$emit('refresh')">
          Aktualisieren
        </button>
        <button type="button" class="button-secondary" @click="$emit('logout')">
          Logout
        </button>
      </template>
      <button type="button" class="button-chip" @click="$emit('toggle-api-mode')">
        API: {{ apiModeLabel }}
      </button>
    </div>
  </section>
</template>

<script>
export default {
  name: 'HomeHero',
  props: {
    isAuthorized: {
      type: Boolean,
      default: false,
    },
    apiModeLabel: {
      type: String,
      default: '',
    },
  },
};
</script>

<style scoped>
.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid rgba(241, 245, 249, 0.18);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72));
  backdrop-filter: blur(16px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 12px;
  color: #93c5fd;
}

h1,
p {
  margin: 0;
}

h1 {
  margin-top: 10px;
  font-size: clamp(2rem, 3vw, 3.6rem);
  line-height: 1;
}

.intro {
  margin-top: 16px;
  max-width: 780px;
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.5;
}

.hero-actions {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

button {
  border: 0;
  border-radius: 16px;
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

@media (max-width: 720px) {
  .hero-card {
    padding: 18px;
    border-radius: 22px;
    display: grid;
  }
}
</style>
