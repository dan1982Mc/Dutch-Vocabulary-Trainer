async function renderHistory() {

    const records =
        await getHistory();


    const container =
        document.getElementById(
            "historyTable"
        );


    if(!records.length) {

        container.innerHTML =
            `<p class="muted">
                No learning history yet.
            </p>`;

        return;

    }


    const sorted =
        [...records]
        .sort(
            (a,b) =>
                b.timestamp -
                a.timestamp
        )
        .slice(0,100);


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>Time</th>
                    <th>Word</th>
                    <th>Exercise</th>
                    <th>Result</th>
                    <th>Mastery</th>

                </tr>

            </thead>

            <tbody>

                ${
                    sorted.map(record => `

                        <tr>

                            <td>
                                ${new Date(
                                    record.timestamp
                                ).toLocaleString()}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        record.word
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${record.type}
                            </td>

                            <td>
                                ${record.result}
                            </td>

                            <td>
                                ${Math.round(
                                    record.masteryAfter
                                )}%
                            </td>

                        </tr>

                    `).join("")
                }

            </tbody>

        </table>

    `;

}