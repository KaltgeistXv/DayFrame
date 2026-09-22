import path from 'node:path';
import { auditUiRules, collectUiSources } from './check-ui-system.mjs';

/** Development feedback only; npm lifecycle guards enforce checks before build. */
export function uiRulesPlugin() {
  return {
    name: 'dayframe-ui-rules',
    apply: 'serve',
    configureServer(server) {
      let timer;
      let failed = false;
      const inspect = () => {
        try {
          const errors = auditUiRules(collectUiSources(server.config.root));
          if (errors.length) {
            server.config.logger.error('[UI rules]\n' + errors.join('\n'));
            failed = true;
          } else if (failed) {
            server.config.logger.info('[UI rules] Rules passed.');
            failed = false;
          }
        } catch (error) {
          failed = true;
          server.config.logger.error('[UI rules] ' + error.message);
        }
      };
      const changed = (file) => {
        const relative = path.relative(server.config.root, file).split(path.sep).join('/');
        if (!/^(?:app|components|hooks|lib)\/.*\.(?:css|tsx?)$/.test(relative)) return;
        clearTimeout(timer);
        timer = setTimeout(inspect, 200);
      };
      for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, changed);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        for (const event of ['add', 'change', 'unlink']) server.watcher.off(event, changed);
      });
    },
  };
}
