// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'data/*', 'supabase/functions/*'],
  },
  // palvelinkoodi (Node, ajetaan Metro-kehityspalvelimessa)
  { files: ['server/**/*.js', 'scripts/**/*.js', 'metro.config.js'], languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'writable', process: 'readonly', Buffer: 'readonly' } } },
]);
