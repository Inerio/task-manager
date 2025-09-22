module.exports = function (config) {
  const path = require("path");

  const tryResolve = (ids) => {
    for (const id of ids) {
      try {
        require.resolve(id);
        return id;
      } catch {}
    }
    return null;
  };

  const pluginId = tryResolve([
    "@angular/build/webpack/plugins/karma",
    "@angular-devkit/build-angular/plugins/karma",
  ]);
  const angularKarma = pluginId ? require(pluginId) : null;

  const frameworks = ["jasmine"];
  if (pluginId) {
    frameworks.push(
      pluginId.includes("/webpack/")
        ? "webpack"
        : "@angular-devkit/build-angular"
    );
  }

  const hasHtmlReporter = (() => {
    try {
      require.resolve("karma-jasmine-html-reporter");
      return true;
    } catch {
      return false;
    }
  })();

  config.set({
    basePath: "",
    frameworks,
    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("karma-coverage"),
      ...(hasHtmlReporter ? [require("karma-jasmine-html-reporter")] : []),
      ...(angularKarma ? [angularKarma] : []),
    ],
    client: {
      jasmine: { random: false },
      clearContext: false,
    },
    reporters: hasHtmlReporter ? ["progress", "kjhtml"] : ["progress"],
    coverageReporter: {
      dir: path.join(__dirname, "./coverage/task-manager-front"),
      reporters: [
        { type: "html" },
        { type: "lcovonly" },
        { type: "text-summary" },
      ],
      fixWebpackSourcePaths: true,
    },
    browsers: ["ChromeHeadless"],
    singleRun: false,
    restartOnFileChange: true,
  });
};
