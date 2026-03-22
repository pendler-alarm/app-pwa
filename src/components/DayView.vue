<template>
  <section class="day-view">
    <header class="day-view__header">
      <button type="button" class="nav-button" @click="$emit('selectDay', -1)">
        Prev
      </button>
      <div>
        <p class="section-label">Day View</p>
        <h2>{{ selectedDayLabel }}</h2>
      </div>
      <button type="button" class="nav-button" @click="$emit('selectDay', 1)">
        Next
      </button>
    </header>

    <div class="day-view__composer">
      <input
        v-model="eventTitle"
        type="text"
        placeholder="Termin fuer diesen Tag anlegen"
        @keyup.enter="createEvent"
      >
      <button type="button" @click="createEvent">Add event</button>
    </div>

    <div v-if="eventsOnSelectedDay.length" class="day-view__list">
      <article
        v-for="event in eventsOnSelectedDay"
        :key="event.id"
        class="day-view__event"
      >
        <div>
          <strong>{{ event.summary || '(ohne Titel)' }}</strong>
          <p>{{ formatEventTime(event.date) }}</p>
        </div>
        <button type="button" class="danger-button" @click="$emit('deleteEvent', event.id)">
          Delete
        </button>
      </article>
    </div>

    <div v-else class="day-view__empty">Keine Termine fuer diesen Tag.</div>
  </section>
</template>

<script>
export default {
  name: 'DayView',
  props: {
    selectedDate: {
      type: Date,
      required: true,
    },
    events: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      eventTitle: '',
    };
  },
  computed: {
    eventsOnSelectedDay() {
      return this.events.filter((event) => this.isSameDay(event.date, this.selectedDate));
    },
    selectedDayLabel() {
      return this.selectedDate.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
  },
  methods: {
    isSameDay(date1, date2) {
      return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
      );
    },
    formatEventTime(date) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    createEvent() {
      const title = this.eventTitle.trim();
      if (!title) {
        return;
      }

      const start = new Date(this.selectedDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      this.$emit('createEvent', {
        summary: title,
        start: {
          dateTime: start.toISOString(),
        },
        end: {
          dateTime: end.toISOString(),
        },
      });

      this.eventTitle = '';
    },
  },
};
</script>

<style scoped>
.day-view {
  display: grid;
  gap: 16px;
}

.day-view__header,
.day-view__composer,
.day-view__event,
.day-view__empty {
  backdrop-filter: blur(14px);
  background: rgba(17, 24, 39, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}

.day-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px;
}

.day-view__header h2,
.section-label {
  margin: 0;
}

.section-label {
  margin-bottom: 6px;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--bright-yellow);
}

.day-view__composer {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.day-view__composer input {
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--fg-light);
}

.day-view__list {
  display: grid;
  gap: 12px;
}

.day-view__event {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
}

.day-view__event p {
  margin: 6px 0 0;
  color: rgba(236, 239, 244, 0.72);
}

.day-view__empty {
  padding: 18px;
  color: rgba(236, 239, 244, 0.72);
}

.nav-button,
.day-view button {
  border: 0;
  border-radius: 999px;
  padding: 11px 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  color: #18212b;
  background: linear-gradient(135deg, var(--bright-yellow), #ffd18b);
}

.danger-button {
  color: #ffd8d1;
  background: rgba(208, 135, 112, 0.16);
  border: 1px solid rgba(208, 135, 112, 0.4);
}

@media (max-width: 640px) {
  .day-view__header,
  .day-view__composer,
  .day-view__event {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
