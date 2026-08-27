/* Dutch Vocabulary Trainer V2.4 — tiny application entry point */
(function (window) {
    'use strict';

    const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
    DutchTrainer.version = '2.4.0';
    DutchTrainer.schemaVersion = 3;

    const baseUrl = new URL('./', import.meta.url);
    const modules = [
        'db.js',
        'vocabulary.js',
        'exercises/index.js',
        'exercises/choice.js',
        'exercises/fill.js',
        'exercises/production.js',
        'mastery.js',
        'scheduler-v2.js',
        'history.js',
        'practice.js'
    ];

    function load(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[data-v24-module="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.type = 'module';
            script.src = new URL(src, baseUrl).href;
            script.dataset.v24Module = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Could not load V2.4 module: ${src}`));
            document.head.appendChild(script);
        });
    }

    DutchTrainer.ready = modules.reduce(
        (promise, module) => promise.then(() => load(module)),
        Promise.resolve()
    ).then(() => window.DutchTrainer);

    window.DutchTrainer = DutchTrainer;
})(window);
