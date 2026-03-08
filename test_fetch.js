const fetch = require('node-fetch');

async function testFetch() {
    console.log("Testing satellite fetch...");
    try {
        const res = await fetch('http://127.0.0.1/kinita/public/api/check_seal.php');
        const text = await res.text();
        console.log("Success:", text);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testFetch();
