/* Dutch Vocabulary Trainer V2.3 - single application version source. */
(function(){
  'use strict';

  const APP_VERSION = '2.3.0';
  const SCHEMA_VERSION = 3;

  window.DutchTrainerVersion = Object.freeze({
    app: APP_VERSION,
    schema: SCHEMA_VERSION
  });

  // Keep a small global alias for legacy modules while the codebase is migrated.
  window.DUTCH_TRAINER_VERSION = APP_VERSION;
})();
