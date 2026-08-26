function createInitialStats() {

    return {

        mastery: 0,

        attempts: 0,

        correct: 0,

        minor: 0,

        wrong: 0,

        streak: 0,

        bestStreak: 0,

        lastAttempt: null,

        nextReview: Date.now(),

        byType: {

            meaning: {
                attempts: 0,
                correct: 0
            },

            recall: {
                attempts: 0,
                correct: 0
            },

            fill: {
                attempts: 0,
                correct: 0
            },

            context: {
                attempts: 0,
                correct: 0
            },

            production: {
                attempts: 0,
                correct: 0
            }

        }

    };

}


async function addWordFromForm() {

    const dutch =
        document.getElementById("nlWord").value.trim();

    const english =
        document.getElementById("enWord").value.trim();

    if(!dutch || !english) {

        alert(
            "Please enter both the Dutch and English word."
        );

        return;

    }


    const word = {

        id: randomId("word"),

        dutch,

        english,

        category:
            document.getElementById("category")
                .value.trim() || "General",

        difficulty:
            document.getElementById("difficulty")
                .value,

        explanation: "",

        memory: "",

        synonyms: [],

        confusable: [],

        examples: [],

        exercises: [],

        stats: createInitialStats(),

        createdAt: Date.now(),

        updatedAt: Date.now()

    };


    await saveWord(word);


    document.getElementById("nlWord").value = "";

    document.getElementById("enWord").value = "";

    document.getElementById("category").value = "";


    await renderVocabulary();

    await refreshDashboard();

}


async function renderVocabulary() {

    const words = await getAllWords();

    const search =
        document.getElementById(
            "vocabularySearch"
        )?.value
        .toLowerCase() || "";


    const filtered =
        words.filter(word => {

            const text =
                `${word.dutch} ${word.english} ${word.category}`
                    .toLowerCase();

            return text.includes(search);

        });


    const container =
        document.getElementById(
            "vocabularyTable"
        );


    if(!filtered.length) {

        container.innerHTML =
            `<p class="muted">
                No vocabulary found.
            </p>`;

        return;

    }


    container.innerHTML = filtered
        .sort((a,b) =>
            a.dutch.localeCompare(b.dutch)
        )
        .map(word => {

            const mastery =
                Math.round(word.stats.mastery);

            let badge = "bad";

            if(mastery >= 80)
                badge = "good";

            else if(mastery >= 50)
                badge = "warn";


            return `

            <div class="word-row">

                <div>

                    <div class="word-dutch">
                        ${escapeHTML(word.dutch)}
                    </div>

                    <div class="word-english">
                        ${escapeHTML(word.english)}
                    </div>

                </div>

                <div>
                    ${escapeHTML(word.category)}
                </div>

                <div>
                    ${escapeHTML(word.difficulty)}
                </div>

                <div>

                    <span class="badge ${badge}">
                        ${mastery}%
                    </span>

                </div>

            </div>

            `;

        })
        .join("");

}