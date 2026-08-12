import {checkExpoWebArtifacts, npmInstall} from "rampway/tasks"

export default {
  application: "velocious-dashboard",
  stages: {
    production: {
      repo: "https://github.com/kaspernj/velocious-dashboard.git",
      branch: "master",
      deployTo: "/root/docker/velocious-dashboard-production/homedev/velocious-dashboard",
      strategy: "remote-git",
      transport: {type: "ssh"},
      hosts: [{host: "server3.diestoeckels.de", port: 22, user: "root"}],
      keepReleases: 5,
      linkedFiles: [],
      linkedDirs: [],
      tasks: {
        install: [npmInstall()],
        verify: [
          {command: "npm run all-checks"},
          {command: "npm run test:unit"},
          {command: "npm run verify:production-test-boundary"}
        ],
        build: [
          {command: "npx expo export --platform web --output-dir app/dist"},
          checkExpoWebArtifacts({dir: "app/dist"})
        ]
      },
      runtime: {type: "none"},
      healthChecks: [{name: "nginx-static-entrypoint", path: "app/dist/index.html"}]
    }
  }
}
