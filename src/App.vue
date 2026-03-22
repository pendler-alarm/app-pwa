<template>
  <div id="app">
    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
};
</script>

<style>
@import url('https://fonts.googleapis.com/css?family=Dosis:400,700');

:root {
  --bg-dark: #2e3440;
  --fg-light: #eceff4;
  --bg-light: #eceff4;
  --orange: #d08770;
  --green: #a3be8c;
  --yellow: #ebcb8b;
  --purple: #b48ead;
  --teal: #8fbcbb;
  --light-blue: #81a1c1;
  --dark-blue: #5e81ac;
  --calendar-color: #29323f;
  --bright-yellow: #fcee6d;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    linear-gradient(180deg, rgba(10, 14, 22, 0.42), rgba(10, 14, 22, 0.72)),
    url('./assets/bg-app.jpg') center center / cover no-repeat fixed;
}

#app {
  min-height: 100vh;
  font-family: 'Dosis', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--fg-light);
}

* {
  box-sizing: border-box;
}

button,
input,
textarea,
select {
  font: inherit;
}

main {
  min-height: 100vh;
}

.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'liga';
}
</style>
