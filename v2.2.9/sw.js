const CACHE_NAME = "dutch-vocabulary-v1.1";

const FILES = [

    "./",
    "./index.html",
    "./style.css",

    "./js/app.js",
    "./js/db.js",
    "./js/dashboard.js",
    "./js/vocabulary.js",
    "./js/practice.js",
    "./js/history.js",
    "./js/wordpacks.js"

];


self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(
                    cache =>
                        cache.addAll(FILES)
                )

        );

    }
);


self.addEventListener(
    "fetch",
    event => {

        event.respondWith(

            caches
                .match(event.request)
                .then(
                    cached =>
                        cached ||
                        fetch(event.request)
                )

        );

    }
);