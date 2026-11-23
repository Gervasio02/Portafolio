const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({ testDir: ".", use: { baseURL: "http://127.0.0.1:8765" }, webServer: { command: "python -m http.server 8765 --directory ../../portal", url: "http://127.0.0.1:8765/interrogatorio/", reuseExistingServer: !process.env.CI } });
