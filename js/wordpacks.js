let pendingWordPack = null;


/* =========================
   WORD PACK FORMAT
========================= */

function validateWordPack(pack) {

    if(!pack)
        return false;

    if(!pack.words)
        return false;

    if(!Array.isArray(pack.words))
        return false;

    return true;

}


/* =========================
   PREVIEW
========================= */

function previewWordPack() {

    const input =
        document.getElementById(
            "wordPackFile"
        );


    const file =
        input.files[0];


    if(!file) {

        alert(
            "Please select a Word Pack JSON file."
        );

        return;

    }


    const reader =
        new FileReader();


    reader.onload = event => {

        try {

            const pack =
                JSON.parse(
                    event.target.result
                );


            if(!validateWordPack(pack)) {

                alert(
                    "This is not a valid Word Pack."
                );

                return;

            }


            pendingWordPack = pack;

            renderWordPackPreview();

        }

        catch(error) {

            console.error(error);

            alert(
                "Unable to read the Word Pack."
            );

        }

    };


    reader.readAsText(file);

}


/* =========================
   PREVIEW DISPLAY
========================= */

function renderWordPackPreview() {

    const preview =
        document.getElementById(
            "wordPackPreview"
        );


    preview.classList.remove("hidden");


    const pack =
        pendingWordPack;


    document.getElementById(
        "wordPackSummary"
    ).innerHTML = `

        <p>

            <strong>
                Pack:
            </strong>

            ${escapeHTML(
                pack.name || "Unnamed pack"
            )}

        </p>

        <p>

            <strong>
                Words:
            </strong>

            ${pack.words.length}

        </p>

        <p>

            <strong>
                Version:
            </strong>

            ${escapeHTML(
                pack.version || "1.0"
            )}

        </p>

    `;


    document.getElementById(
        "wordPackWords"
    ).innerHTML =
        pack.words.map(
            word => `

                <div class="pack-word">

                    <strong>
                        ${escapeHTML(
                            word.dutch
                        )}
                    </strong>

                    —
                    ${escapeHTML(
                        word.english
                    )}

                    <br>

                    <small class="muted">

                        ${
                            word.examples
                            ?
                            `${word.examples.length} examples`
                            :
                            "No examples"
                        }

                        ${
                            word.exercises
                            ?
                            ` • ${word.exercises.length} exercises`
                            :
                            ""
                        }

                    </small>

                </div>

            `
        ).join("");

}


/* =========================
   IMPORT
========================= */

async function importWordPack() {

    if(!pendingWordPack)
        return;


    let added = 0;

    let updated = 0;


    const existing =
        await getAllWords();


    for(const incoming of
        pendingWordPack.words) {


        if(
            !incoming.dutch ||
            !incoming.english
        )
            continue;


        const existingWord =
            existing.find(
                word =>
                    normalize(
                        word.dutch
                    ) ===
                    normalize(
                        incoming.dutch
                    )
            );


        if(existingWord) {

            /*
               IMPORTANT:

               Preserve learning statistics.

               Content may be updated,
               but learning history remains.
            */

            existingWord.english =
                incoming.english ||
                existingWord.english;

            existingWord.category =
                incoming.category ||
                existingWord.category;

            existingWord.difficulty =
                incoming.difficulty ||
                existingWord.difficulty;

            existingWord.explanation =
                incoming.explanation ||
                existingWord.explanation;

            existingWord.memory =
                incoming.memory ||
                existingWord.memory;

            existingWord.synonyms =
                incoming.synonyms ||
                existingWord.synonyms;

            existingWord.confusable =
                incoming.confusable ||
                existingWord.confusable;

            existingWord.examples =
                incoming.examples ||
                existingWord.examples;

            existingWord.exercises =
                incoming.exercises ||
                existingWord.exercises;

            existingWord.updatedAt =
                Date.now();


            await saveWord(existingWord);

            updated++;

        }

        else {

            const word = {

                id:
                    randomId("word"),

                dutch:
                    incoming.dutch,

                english:
                    incoming.english,

                category:
                    incoming.category ||
                    "General",

                difficulty:
                    incoming.difficulty ||
                    "B2",

                explanation:
                    incoming.explanation ||
                    "",

                memory:
                    incoming.memory ||
                    "",

                synonyms:
                    incoming.synonyms ||
                    [],

                confusable:
                    incoming.confusable ||
                    [],

                examples:
                    incoming.examples ||
                    [],

                exercises:
                    incoming.exercises ||
                    [],

                stats:
                    createInitialStats(),

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now()

            };


            await saveWord(word);

            added++;

        }

    }


    alert(

        `Word Pack imported.\n\n` +

        `New words: ${added}\n` +

        `Updated words: ${updated}`

    );


    pendingWordPack = null;


    document
        .getElementById(
            "wordPackPreview"
        )
        .classList.add("hidden");


    await renderVocabulary();

    await refreshDashboard();

}


function cancelWordPack() {

    pendingWordPack = null;

    document
        .getElementById(
            "wordPackPreview"
        )
        .classList.add("hidden");

}