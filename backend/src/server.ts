import express from 'express'; // import the express framework (used to create the backend server)
import cors from 'cors'; // import cors middleware (allows requests from other origins like Angular)

const app = express(); // create an express application instance
const PORT = 3000; // define the port where the backend will run

app.use(cors()); // enable cors for all incoming requests
app.use(express.json()); // enable JSON parsing for incoming requests

app.get('/api/health', (_req, res) => { // define a GET endpoint at /api/health
    res.json({ok: true}); // send a JSON response to the client
})

app.listen(PORT, () => { // start the server and listen on the defined port
    console.log("Backend running on http://localhost:${PORT}");
})
