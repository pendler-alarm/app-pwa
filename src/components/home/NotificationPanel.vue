<template>
  <article class="panel">
    <div class="panel-head">
      <div>
        <p class="section-label">Hinweis</p>
        <h2>Echtzeitmeldung</h2>
      </div>
    </div>

    <div v-if="loading" class="empty-state">
      Realtime-Hinweis wird geladen...
    </div>
    <div
      v-else-if="notification && notification.should_send"
      class="notification-card"
      :class="notificationClass"
    >
      <div class="notification-card__head">
        <strong>{{ notification.short_text }}</strong>
        <span>
          {{ notification.audience === 'planner' ? 'Planung' : 'Pendler' }}
        </span>
      </div>
      <p>{{ notification.title }}</p>
      <ul
        v-if="notification.details && notification.details.length"
        class="detail-list"
      >
        <li
          v-for="(detail, index) in notification.details"
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
</template>

<script>
export default {
  name: 'NotificationPanel',
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
    notification: {
      type: Object,
      default: null,
    },
    notificationClass: {
      type: String,
      default: 'notification-card--ok',
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
.notification-card__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.panel-head {
  margin-bottom: 18px;
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

.empty-state,
.notification-card {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
  padding: 16px;
}

.empty-state {
  color: rgba(226, 232, 240, 0.72);
}

.notification-card__head {
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
  display: grid;
  gap: 10px;
  padding-left: 18px;
}

@media (max-width: 720px) {
  .panel {
    padding: 18px;
    border-radius: 22px;
  }

  .panel-head,
  .notification-card__head {
    display: grid;
  }
}
</style>
