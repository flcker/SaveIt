export default {
  sourceDir: './dist',
  run: {
    firefox: 'firefox',
    startUrl: ['about:debugging#/runtime/this-firefox'],
    browserConsole: true,
  },
  build: {
    overwriteDest: true,
  },
};
