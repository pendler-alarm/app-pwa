<template>
  <section class="month-view">
    <header class="month-view__header">
      <div>
        <p class="section-label">Wochenansicht</p>
        <h2>{{ weekLabel }}</h2>
      </div>
      <button type="button" class="ghost-button" @click="$emit(&quot;selectCurrentDay&quot;)">Heute</button>
    </header>

    <div class="month-view__weekdays">
      <span v-for="day in weekDays" :key="day.iso">{{ day.weekday }}</span>
    </div>

    <div class="month-view__grid">
      <button
        v-for="day in weekDays"
        :key="day.iso"
        type="button"
        class="day-cell"
        :class="dayCellClass(day.date)"
        @click="selectDate(day.date)"
      >
        <span>{{ day.dayLabel }}</span>
        <strong>{{ day.dateLabel }}</strong>
        <small v-if="eventsOnDay(day.date).length">{{ eventsOnDay(day.date).length }} Termine</small>
        <small v-else>frei</small>
      </button>
    </div>

    <aside class="month-view__panel">
      <div class="month-view__panel-header">
        <div>
          <p class="section-label">Termine diese Woche</p>
          <h3>{{ weekEventsHeadline }}</h3>
        </div>
      </div>
      <div v-if="weekEvents.length" class="month-view__list">
        <article v-for="event in weekEvents" :key="event.id" class="month-view__event">
          <div>
            <strong>{{ event.summary || "(ohne Titel)" }}</strong>
            <p>{{ formatEventDateTime(event.date) }}</p>
          </div>
          <button type="button" class="danger-button" @click="$emit(&quot;deleteEvent&quot;, event.id)">Loeschen</button>
        </article>
      </div>
      <div v-else class="month-view__empty">Keine Termine in dieser Woche.</div>
    </aside>

    <aside class="month-view__panel">
      <div class="month-view__panel-header">
        <div>
          <p class="section-label">Naechste 3 Termine</p>
          <h3>{{ upcomingHeadline }}</h3>
        </div>
      </div>
      <div v-if="upcomingEvents.length" class="month-view__list">
        <article v-for="event in upcomingEvents" :key="event.id" class="month-view__event">
          <div>
            <strong>{{ event.summary || "(ohne Titel)" }}</strong>
            <p>{{ formatEventDateTime(event.date) }}</p>
          </div>
          <button type="button" class="danger-button" @click="$emit(&quot;deleteEvent&quot;, event.id)">Loeschen</button>
        </article>
      </div>
      <div v-else class="month-view__empty">Keine kommenden Termine gefunden.</div>
    </aside>
  </section>
</template>

<script>
export default {
  name: "MonthView",
  props: {
    selectedDate: { type: Date, required: true },
    events: { type: Array, default: () => [] },
  },
  computed: {
    today() {
      return new Date();
    },
    weekDays() {
      const start = this.startOfWeek(this.today);
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return {
          date,
          iso: date.toISOString(),
          weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
          dayLabel: date.toLocaleDateString(undefined, { weekday: "long" }),
          dateLabel: date.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        };
      });
    },
    weekLabel() {
      const first = this.weekDays[0] ? this.weekDays[0].date : null;
      const last = this.weekDays[this.weekDays.length - 1] ? this.weekDays[this.weekDays.length - 1].date : null;
      if (!first || !last) return "";
      const startLabel = first.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      const endLabel = last.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      return startLabel + " - " + endLabel;
    },
    weekEvents() {
      const start = this.startOfWeek(this.today);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return this.events.filter((event) => event.date >= start && event.date < end);
    },
    weekEventsHeadline() {
      return this.weekEvents.length ? this.weekEvents.length + " Termine in dieser Woche" : "Aktuell nichts eingeplant";
    },
    upcomingEvents() {
      const now = new Date();
      const upcoming = this.events.filter((event) => event.date >= now);
      if (upcoming.length) return upcoming.slice(0, 3);
      return this.weekEvents.slice(0, 3);
    },
    upcomingHeadline() {
      return this.upcomingEvents.length ? "Kommende Eintraege" : "Aktuell nichts geplant";
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
    isSameDay(date1, date2) {
      return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
    },
    dayCellClass(date) {
      return {
        "day-cell--selected": this.isSameDay(date, this.selectedDate),
        "day-cell--today": this.isSameDay(date, this.today),
        "day-cell--busy": this.eventsOnDay(date).length > 0,
      };
    },
    selectDate(date) {
      this.$emit("selectDate", { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() });
    },
    eventsOnDay(date) {
      return this.events.filter((event) => this.isSameDay(event.date, date));
    },
    formatEventDateTime(date) {
      const dateLabel = date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
      const timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return dateLabel + " · " + timeLabel;
    },
  },
};
</script>

<style scoped>
.month-view { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr); gap: 16px; align-items: start; }
.month-view__header, .month-view__panel, .month-view__event, .month-view__empty { backdrop-filter: blur(14px); background: rgba(17, 24, 39, 0.48); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; }
.month-view__header { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px; }
.month-view__weekdays, .month-view__grid { grid-column: 1; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.month-view__weekdays { color: rgba(236, 239, 244, 0.72); font-size: 0.9rem; }
.month-view__weekdays span { text-align: center; }
.day-cell { min-height: 130px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.06); color: var(--fg-light); font: inherit; cursor: pointer; text-align: left; }
.day-cell strong { font-size: 1.1rem; }
.day-cell small { color: rgba(236, 239, 244, 0.7); }
.day-cell--selected { border-color: rgba(252, 238, 109, 0.7); box-shadow: inset 0 0 0 1px rgba(252, 238, 109, 0.55); }
.day-cell--today { background: rgba(129, 161, 193, 0.22); }
.day-cell--busy { background: rgba(94, 129, 172, 0.22); }
.month-view__panel { padding: 18px; display: grid; gap: 14px; }
.month-view__panel:first-of-type, .month-view__panel:last-of-type { grid-column: 2; }
.month-view__panel-header, .month-view__event { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.month-view__list { display: grid; gap: 12px; }
.month-view__event { padding: 14px 16px; border-radius: 18px; background: rgba(255, 255, 255, 0.05); }
.month-view__event p { margin: 6px 0 0; color: rgba(236, 239, 244, 0.72); }
.month-view__empty { padding: 18px; color: rgba(236, 239, 244, 0.72); }
.ghost-button, .danger-button { border: 0; border-radius: 999px; padding: 11px 16px; font: inherit; font-weight: 700; cursor: pointer; }
.ghost-button { color: var(--fg-light); background: rgba(255, 255, 255, 0.14); }
.danger-button { color: #ffd8d1; background: rgba(208, 135, 112, 0.16); border: 1px solid rgba(208, 135, 112, 0.4); }
@media (max-width: 960px) { .month-view { grid-template-columns: 1fr; } .month-view__header, .month-view__weekdays, .month-view__grid, .month-view__panel:first-of-type, .month-view__panel:last-of-type { grid-column: 1; } }
@media (max-width: 800px) { .month-view__header, .month-view__panel-header, .month-view__event { flex-direction: column; align-items: stretch; } }
@media (max-width: 640px) { .month-view__grid { grid-template-columns: 1fr; } .month-view__weekdays { display: none; } .day-cell { min-height: 84px; padding: 10px; } }
</style>
