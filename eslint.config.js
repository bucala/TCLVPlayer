import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["app.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        FileReader: "readonly",
        DOMParser: "readonly",
        HTMLElement: "readonly",
        Date: "readonly",
        Map: "readonly",
        Set: "readonly",
        URL: "readonly",
        Intl: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        requestAnimationFrame: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["native/electron/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["app.js", "native/electron/*.js"],
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { varsIgnorePattern: "^(loadEpgText|loadPlaylistText|xmlTvDate)$" }],
    },
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    files: ["tests/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
  {
    ignores: ["dist/", "android/", "node_modules/"],
  },
];
