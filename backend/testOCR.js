const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient({
    keyFilename: './google-vision-key.json'
});

async function detectText() {
    const [result] = await client.textDetection('arabic-test.jpg');
    console.log(result.textAnnotations[0].description);
}

detectText();